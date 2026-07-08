import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { canAccessClass } from '../utils/classAccess';

const homeworkInclude = {
  subject: { select: { id: true, name: true, code: true } },
  class: { select: { id: true, name: true, section: true } },
  assigned_by_user: { select: { id: true, name: true } },
  book: { select: { id: true, title: true, author: true } },
};

export async function createHomework(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, class_id, subject_id, due_date, book_id } = req.body;
    const orgId = req.user!.orgId;

    if (!title || !class_id || !subject_id || !due_date) {
      res.status(400).json({ error: 'Title, class, subject, and due date are required' });
      return;
    }

    const classExists = await prisma.class.findFirst({ where: { id: class_id, org_id: orgId } });
    if (!classExists) { res.status(404).json({ error: 'Class not found' }); return; }

    if (!(await canAccessClass(req.user!, class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    if (book_id) {
      const bookExists = await prisma.book.findFirst({ where: { id: book_id, org_id: orgId } });
      if (!bookExists) { res.status(404).json({ error: 'Book not found' }); return; }
      if (bookExists.approval_status !== 'approved') {
        res.status(400).json({ error: 'This book is awaiting moderator approval and cannot be assigned yet' }); return;
      }
    }

    const homework = await prisma.homework.create({
      data: {
        title, description: description || null, class_id, subject_id, due_date,
        book_id: book_id || null,
        assigned_by: req.user?.userId || null, org_id: orgId,
      },
      include: homeworkInclude,
    });

    res.status(201).json({ message: 'Homework assigned', homework });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listHomework(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, subject_id, upcoming } = req.query;
    const where: any = { org_id: req.user!.orgId, is_active: true };
    if (class_id) where.class_id = class_id;
    if (subject_id) where.subject_id = subject_id;
    // Teachers only see homework for their assigned classes
    if (req.user!.role === 'teacher') where.class = { class_teachers: { some: { teacher_id: req.user!.userId } } };
    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      where.due_date = { gte: today };
    }

    const homework = await prisma.homework.findMany({
      where,
      include: homeworkInclude,
      orderBy: { due_date: 'asc' },
    });

    res.json({ homework });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateHomework(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { title, description, subject_id, due_date, book_id } = req.body;

    const existing = await prisma.homework.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Homework not found' }); return; }

    if (!(await canAccessClass(req.user!, existing.class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    if (book_id) {
      const book = await prisma.book.findFirst({ where: { id: book_id, org_id: req.user!.orgId } });
      if (!book) { res.status(404).json({ error: 'Book not found' }); return; }
      if (book.approval_status !== 'approved') {
        res.status(400).json({ error: 'This book is awaiting moderator approval and cannot be assigned yet' }); return;
      }
    }

    const homework = await prisma.homework.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(subject_id && { subject_id }),
        ...(due_date && { due_date }),
        ...(book_id !== undefined && { book_id: book_id || null }),
      },
      include: homeworkInclude,
    });

    res.json({ message: 'Homework updated', homework });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteHomework(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.homework.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Homework not found' }); return; }

    if (!(await canAccessClass(req.user!, existing.class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    await prisma.homework.update({ where: { id }, data: { is_active: false } });
    res.json({ message: 'Homework removed' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student-facing: homework for my class
export async function getMyHomework(req: Request, res: Response): Promise<void> {
  try {
    const student = await prisma.student.findFirst({ where: { user_id: req.user!.userId } });
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const homework = await prisma.homework.findMany({
      where: { class_id: student.class_id, is_active: true },
      include: homeworkInclude,
      orderBy: { due_date: 'asc' },
    });

    // Attach this student's own submission (status/grade) to each item.
    const submissions = await prisma.submission.findMany({
      where: { student_id: student.id, homework_id: { in: homework.map((h) => h.id) } },
    });
    const byHomework = new Map(submissions.map((s) => [s.homework_id, s]));
    const withSubmission = homework.map((h) => ({ ...h, my_submission: byHomework.get(h.id) || null }));

    res.json({ homework: withSubmission });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Parent-facing: homework for a child's class
export async function getChildHomework(req: Request, res: Response): Promise<void> {
  try {
    const parentId = req.user!.userId;
    const studentId = req.params.studentId as string;

    const link = await prisma.parentStudent.findFirst({
      where: { parent_id: parentId, student_id: studentId },
    });
    if (!link) { res.status(403).json({ error: 'Access denied' }); return; }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const homework = await prisma.homework.findMany({
      where: { class_id: student.class_id, is_active: true },
      include: homeworkInclude,
      orderBy: { due_date: 'asc' },
    });

    res.json({ homework });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
