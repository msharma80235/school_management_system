import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client';
import { gateUpload } from '../utils/uploadGuard';

const VALID_ROLES = ['teacher', 'student', 'parent', 'volunteer', 'staff'];

function cleanAudience(raw: string | undefined): string {
  if (!raw) return VALID_ROLES.join(',');
  const roles = raw.split(',').map((r) => r.trim().toLowerCase()).filter((r) => VALID_ROLES.includes(r));
  return roles.length > 0 ? roles.join(',') : VALID_ROLES.join(',');
}

const docInclude = {
  uploader: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
};

function canModerate(req: Request): boolean {
  return req.user!.role === 'admin' || !!req.user!.isModerator;
}

// Upload a document (multipart — file + metadata fields).
// Admins/moderators publish directly; teacher/staff uploads wait for moderator approval.
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, category, audience } = req.body;
    const orgId = req.user!.orgId;

    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }
    if (!req.file) { res.status(400).json({ error: 'A document file is required' }); return; }

    // Safety gate: inappropriate content never enters the system
    const gate = await gateUpload([title, description, category].filter(Boolean).join(' '), req.file.filename);
    if (!gate.ok) { res.status(400).json({ error: gate.error }); return; }

    const approved = canModerate(req);
    const document = await prisma.schoolDocument.create({
      data: {
        title,
        description: description || null,
        category: category || 'general',
        file_path: req.file.filename,
        audience: cleanAudience(audience),
        approval_status: approved ? 'approved' : 'pending',
        ...(approved && { reviewed_by: req.user!.userId, reviewed_at: new Date() }),
        uploaded_by: req.user?.userId || null,
        org_id: orgId,
      },
      include: docInclude,
    });

    res.status(201).json({ message: approved ? 'Document uploaded' : 'Document submitted — pending moderator approval', document });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// All roles: list documents (admin sees everything; others only what their role is allowed to see)
export async function listDocuments(req: Request, res: Response): Promise<void> {
  try {
    const { category } = req.query;
    const role = req.user!.role;
    const where: any = { org_id: req.user!.orgId };
    if (category) where.category = category;
    if (role !== 'admin') where.audience = { contains: role };

    // Moderators/admins see everything; others see approved docs plus their own submissions
    if (!canModerate(req)) {
      where.OR = [{ approval_status: 'approved' }, { uploaded_by: req.user!.userId }];
    }

    const documents = await prisma.schoolDocument.findMany({
      where,
      include: docInclude,
      orderBy: { created_at: 'desc' },
    });

    res.json({ documents });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: update document metadata (not the file)
export async function updateDocument(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { title, description, category, audience } = req.body;

    const existing = await prisma.schoolDocument.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Document not found' }); return; }

    const document = await prisma.schoolDocument.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(category && { category }),
        ...(audience !== undefined && { audience: cleanAudience(audience) }),
      },
      include: docInclude,
    });

    res.json({ message: 'Document updated', document });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: delete a document (removes the file too)
export async function deleteDocument(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.schoolDocument.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Document not found' }); return; }

    fs.unlink(path.resolve('uploads', existing.file_path), () => {});
    await prisma.schoolDocument.delete({ where: { id } });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
