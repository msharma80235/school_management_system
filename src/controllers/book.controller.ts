import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client';
import { gateUpload } from '../utils/uploadGuard';

const bookInclude = {
  subject: { select: { id: true, name: true, code: true } },
  class: { select: { id: true, name: true, section: true } },
  uploader: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
};

// Admins and assigned moderators publish directly; everyone else needs approval
function canModerate(req: Request): boolean {
  return req.user!.role === 'admin' || !!req.user!.isModerator;
}

function removeStoredFile(fileName: string | null) {
  if (!fileName) return;
  const p = path.resolve('uploads', fileName);
  fs.unlink(p, () => {});
}

// Upload a PDF or scanned copy for a book
export async function uploadBookFile(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.book.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return; }

    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    // Safety gate: a flagged copy is rejected and never stored
    const gate = await gateUpload(existing.title, req.file.filename, req.user!.orgId);
    if (!gate.ok) { res.status(400).json({ error: gate.error }); return; }

    // Replace any previous copy
    removeStoredFile(existing.file_path);

    // A new file from a non-moderator goes back through review
    const needsReview = !canModerate(req);
    const book = await prisma.book.update({
      where: { id },
      data: {
        file_path: req.file.filename,
        ...(needsReview && { approval_status: 'pending', reviewed_by: null, reviewed_at: null, review_note: null }),
      },
      include: bookInclude,
    });

    res.json({ message: needsReview ? 'Book copy uploaded — pending moderator approval' : 'Book copy uploaded', book });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Remove the uploaded copy from a book
export async function removeBookFile(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.book.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return; }

    removeStoredFile(existing.file_path);

    const book = await prisma.book.update({
      where: { id },
      data: { file_path: null },
      include: bookInclude,
    });

    res.json({ message: 'Book copy removed', book });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createBook(req: Request, res: Response): Promise<void> {
  try {
    const { title, author, isbn, publisher, edition, subject_id, custom_category, class_id, is_mandatory } = req.body;
    const orgId = req.user!.orgId;

    if (!title || !author) {
      res.status(400).json({ error: 'Title and author are required' });
      return;
    }

    if (!subject_id && !custom_category) {
      res.status(400).json({ error: 'Select a subject or enter a custom category' });
      return;
    }

    const gate = await gateUpload([title, author, publisher, custom_category].filter(Boolean).join(' '), null, req.user!.orgId);
    if (!gate.ok) { res.status(400).json({ error: gate.error }); return; }

    const approved = canModerate(req);
    const book = await prisma.book.create({
      data: {
        title, author,
        isbn: isbn || null,
        publisher: publisher || null,
        edition: edition || null,
        subject_id: subject_id || null,
        custom_category: subject_id ? null : (custom_category || null),
        class_id: class_id || null,
        is_mandatory: is_mandatory ?? true,
        approval_status: approved ? 'approved' : 'pending',
        uploaded_by: req.user!.userId,
        ...(approved && { reviewed_by: req.user!.userId, reviewed_at: new Date() }),
        org_id: orgId,
      },
      include: bookInclude,
    });

    res.status(201).json({ message: approved ? 'Book added' : 'Book submitted — pending moderator approval', book });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listBooks(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, subject_id, mandatory } = req.query;
    const where: any = { org_id: req.user!.orgId };
    if (class_id) where.class_id = class_id;
    if (subject_id) where.subject_id = subject_id;
    if (mandatory === 'true') where.is_mandatory = true;
    if (mandatory === 'false') where.is_mandatory = false;

    // Moderators/admins see everything; others see approved books plus their own submissions
    if (!canModerate(req)) {
      where.OR = [{ approval_status: 'approved' }, { uploaded_by: req.user!.userId }];
    }

    const books = await prisma.book.findMany({
      where,
      include: bookInclude,
      orderBy: [{ subject: { name: 'asc' } }, { title: 'asc' }],
    });

    res.json({ books });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateBook(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { title, author, isbn, publisher, edition, subject_id, custom_category, class_id, is_mandatory } = req.body;

    const existing = await prisma.book.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return; }

    const gate = await gateUpload([title, author, publisher, custom_category].filter(Boolean).join(' '), null, req.user!.orgId);
    if (!gate.ok) { res.status(400).json({ error: gate.error }); return; }

    // Edits by non-moderators send the book back through review
    const needsReview = !canModerate(req);
    const book = await prisma.book.update({
      where: { id },
      data: {
        ...(needsReview && { approval_status: 'pending', reviewed_by: null, reviewed_at: null, review_note: null }),
        ...(title && { title }),
        ...(author && { author }),
        ...(isbn !== undefined && { isbn: isbn || null }),
        ...(publisher !== undefined && { publisher: publisher || null }),
        ...(edition !== undefined && { edition: edition || null }),
        ...(subject_id !== undefined && { subject_id: subject_id || null }),
        ...(custom_category !== undefined && { custom_category: custom_category || null }),
        ...(class_id !== undefined && { class_id: class_id || null }),
        ...(is_mandatory !== undefined && { is_mandatory }),
      },
      include: bookInclude,
    });

    res.json({ message: 'Book updated', book });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteBook(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.book.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return; }

    removeStoredFile(existing.file_path);
    await prisma.book.delete({ where: { id } });
    res.json({ message: 'Book removed' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student-facing: books for my class (class-specific + org-wide books)
export async function getMyBooks(req: Request, res: Response): Promise<void> {
  try {
    const student = await prisma.student.findFirst({ where: { user_id: req.user!.userId } });
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const books = await prisma.book.findMany({
      where: {
        org_id: student.org_id,
        approval_status: 'approved',
        OR: [{ class_id: student.class_id }, { class_id: null }],
      },
      include: bookInclude,
      orderBy: [{ subject: { name: 'asc' } }, { title: 'asc' }],
    });

    res.json({ books });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Parent-facing: books for a child's class
export async function getChildBooks(req: Request, res: Response): Promise<void> {
  try {
    const parentId = req.user!.userId;
    const studentId = req.params.studentId as string;

    const link = await prisma.parentStudent.findFirst({
      where: { parent_id: parentId, student_id: studentId },
    });
    if (!link) { res.status(403).json({ error: 'Access denied' }); return; }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const books = await prisma.book.findMany({
      where: {
        org_id: student.org_id,
        approval_status: 'approved',
        OR: [{ class_id: student.class_id }, { class_id: null }],
      },
      include: bookInclude,
      orderBy: [{ subject: { name: 'asc' } }, { title: 'asc' }],
    });

    res.json({ books });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
