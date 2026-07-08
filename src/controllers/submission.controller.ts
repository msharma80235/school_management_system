import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client';
import { gateUpload } from '../utils/uploadGuard';
import { canAccessClass } from '../utils/classAccess';
import { notify } from '../utils/notify';

const submissionInclude = {
  student: { select: { id: true, first_name: true, last_name: true, roll_number: true } },
};

// Student turns in work against a homework item (optional file + note).
export async function submitHomework(req: Request, res: Response): Promise<void> {
  try {
    const homeworkId = req.params.id as string;
    const { note } = req.body;
    const orgId = req.user!.orgId;

    const student = await prisma.student.findFirst({ where: { user_id: req.user!.userId, org_id: orgId } });
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const homework = await prisma.homework.findFirst({ where: { id: homeworkId, org_id: orgId, is_active: true } });
    if (!homework) { res.status(404).json({ error: 'Homework not found' }); return; }
    if (homework.class_id !== student.class_id) {
      res.status(403).json({ error: 'This homework is not for your class' }); return;
    }

    if (!req.file && !note?.trim()) {
      res.status(400).json({ error: 'Attach a file or write a note to submit' }); return;
    }

    const existing = await prisma.submission.findUnique({
      where: { homework_id_student_id: { homework_id: homeworkId, student_id: student.id } },
    });
    if (existing?.status === 'graded') {
      if (req.file) fs.unlink(path.resolve('uploads', req.file.filename), () => {});
      res.status(400).json({ error: 'This submission has already been graded and can no longer be changed' }); return;
    }

    // Safety gate: a flagged file is deleted and never stored.
    const gate = await gateUpload(note || '', req.file?.filename);
    if (!gate.ok) { res.status(400).json({ error: gate.error }); return; }

    // Replace any previous (ungraded) file.
    if (existing?.file_path && req.file) {
      fs.unlink(path.resolve('uploads', existing.file_path), () => {});
    }

    const data = {
      file_path: req.file ? req.file.filename : existing?.file_path ?? null,
      note: note?.trim() || null,
      status: 'submitted',
      submitted_at: new Date(),
    };

    const submission = existing
      ? await prisma.submission.update({ where: { id: existing.id }, data, include: submissionInclude })
      : await prisma.submission.create({
          data: { homework_id: homeworkId, student_id: student.id, org_id: orgId, ...data },
          include: submissionInclude,
        });

    res.status(existing ? 200 : 201).json({ message: existing ? 'Submission updated' : 'Submitted', submission });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Teacher/admin: all submissions for a homework item.
export async function listSubmissions(req: Request, res: Response): Promise<void> {
  try {
    const homeworkId = req.params.id as string;
    const homework = await prisma.homework.findFirst({ where: { id: homeworkId, org_id: req.user!.orgId } });
    if (!homework) { res.status(404).json({ error: 'Homework not found' }); return; }
    if (!(await canAccessClass(req.user!, homework.class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    const submissions = await prisma.submission.findMany({
      where: { homework_id: homeworkId },
      include: submissionInclude,
      orderBy: { submitted_at: 'desc' },
    });

    res.json({ homework: { id: homework.id, title: homework.title }, submissions });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Teacher/admin: grade a submission; notifies the student and their parents.
export async function gradeSubmission(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { grade, max_grade, feedback } = req.body;

    const existing = await prisma.submission.findFirst({
      where: { id, org_id: req.user!.orgId },
      include: { homework: { select: { title: true, class_id: true } }, student: { select: { first_name: true, last_name: true, user_id: true } } },
    });
    if (!existing) { res.status(404).json({ error: 'Submission not found' }); return; }
    if (!(await canAccessClass(req.user!, existing.homework.class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    const g = grade === undefined || grade === null || grade === '' ? null : parseFloat(grade);
    const mg = max_grade === undefined || max_grade === null || max_grade === '' ? null : parseFloat(max_grade);
    if (g !== null && (isNaN(g) || g < 0)) { res.status(400).json({ error: 'Grade must be a non-negative number' }); return; }
    if (g !== null && mg !== null && g > mg) { res.status(400).json({ error: 'Grade cannot exceed the maximum' }); return; }

    const submission = await prisma.submission.update({
      where: { id },
      data: {
        grade: g, max_grade: mg, feedback: feedback?.trim() || null,
        status: 'graded', graded_by: req.user!.userId, graded_at: new Date(),
      },
      include: submissionInclude,
    });

    // Notify the student and their parents.
    const childName = `${existing.student.first_name} ${existing.student.last_name}`.trim();
    const scoreText = g !== null ? ` — ${g}${mg !== null ? `/${mg}` : ''}` : '';
    if (existing.student.user_id) {
      await notify({
        userId: existing.student.user_id, orgId: req.user!.orgId, category: 'marks',
        title: `Homework graded: ${existing.homework.title}`,
        body: `Your submission for "${existing.homework.title}" was graded${scoreText}.`,
        link: '/student/dashboard',
      });
    }
    const parents = await prisma.parentStudent.findMany({ where: { student_id: existing.student_id }, select: { parent_id: true } });
    await Promise.all(parents.map((p) => notify({
      userId: p.parent_id, orgId: req.user!.orgId, category: 'marks',
      title: `Homework graded: ${existing.homework.title}`,
      body: `${childName}'s submission for "${existing.homework.title}" was graded${scoreText}.`,
      link: '/parent/dashboard',
    })));

    res.json({ message: 'Submission graded', submission });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student: my submission for one homework item (used to show status/grade).
export async function getMySubmission(req: Request, res: Response): Promise<void> {
  try {
    const homeworkId = req.params.id as string;
    const student = await prisma.student.findFirst({ where: { user_id: req.user!.userId } });
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const submission = await prisma.submission.findUnique({
      where: { homework_id_student_id: { homework_id: homeworkId, student_id: student.id } },
    });
    res.json({ submission });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
