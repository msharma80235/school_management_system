import { Request, Response } from 'express';
import prisma from '../prisma/client';

const bookInclude = {
  subject: { select: { id: true, name: true, code: true } },
  class: { select: { id: true, name: true, section: true } },
  uploader: { select: { id: true, name: true, role: true } },
  reviewer: { select: { id: true, name: true } },
};

const docInclude = {
  uploader: { select: { id: true, name: true, role: true } },
  reviewer: { select: { id: true, name: true } },
};

// Everything waiting for review, plus recent decisions for context
export async function getModerationQueue(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;

    const [pendingBooks, pendingDocuments, recentBooks, recentDocuments] = await Promise.all([
      prisma.book.findMany({
        where: { org_id: orgId, approval_status: 'pending' },
        include: bookInclude,
        orderBy: { updated_at: 'asc' },
      }),
      prisma.schoolDocument.findMany({
        where: { org_id: orgId, approval_status: 'pending' },
        include: docInclude,
        orderBy: { created_at: 'asc' },
      }),
      prisma.book.findMany({
        where: { org_id: orgId, approval_status: { in: ['approved', 'rejected'] }, reviewed_at: { not: null } },
        include: bookInclude,
        orderBy: { reviewed_at: 'desc' },
        take: 10,
      }),
      prisma.schoolDocument.findMany({
        where: { org_id: orgId, approval_status: { in: ['approved', 'rejected'] }, reviewed_at: { not: null } },
        include: docInclude,
        orderBy: { reviewed_at: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      pending: { books: pendingBooks, documents: pendingDocuments },
      recent: { books: recentBooks, documents: recentDocuments },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

function parseAction(req: Request, res: Response): { status: string; note: string | null } | null {
  const { action, note } = req.body;
  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    return null;
  }
  if (action === 'reject' && (!note || !String(note).trim())) {
    res.status(400).json({ error: 'A note is required when rejecting' });
    return null;
  }
  return { status: action === 'approve' ? 'approved' : 'rejected', note: note ? String(note).trim() : null };
}

export async function reviewBook(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const decision = parseAction(req, res);
    if (!decision) return;

    const existing = await prisma.book.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return; }
    if (existing.approval_status !== 'pending') {
      res.status(400).json({ error: 'This book is not awaiting review' });
      return;
    }

    const book = await prisma.book.update({
      where: { id },
      data: {
        approval_status: decision.status,
        reviewed_by: req.user!.userId,
        reviewed_at: new Date(),
        review_note: decision.note,
      },
      include: bookInclude,
    });

    res.json({ message: `"${book.title}" ${decision.status}`, book });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function reviewDocument(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const decision = parseAction(req, res);
    if (!decision) return;

    const existing = await prisma.schoolDocument.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Document not found' }); return; }
    if (existing.approval_status !== 'pending') {
      res.status(400).json({ error: 'This document is not awaiting review' });
      return;
    }

    const document = await prisma.schoolDocument.update({
      where: { id },
      data: {
        approval_status: decision.status,
        reviewed_by: req.user!.userId,
        reviewed_at: new Date(),
        review_note: decision.note,
      },
      include: docInclude,
    });

    res.json({ message: `"${document.title}" ${decision.status}`, document });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
