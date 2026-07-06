import { Request, Response } from 'express';
import prisma from '../prisma/client';

export async function createSubject(req: Request, res: Response): Promise<void> {
  try {
    const { name, code } = req.body;
    const orgId = req.user!.orgId;
    if (!name || !code) { res.status(400).json({ error: 'Name and code are required' }); return; }

    const existing = await prisma.subject.findUnique({ where: { code_org_id: { code, org_id: orgId } } });
    if (existing) { res.status(409).json({ error: 'Subject code already exists' }); return; }

    const subject = await prisma.subject.create({ data: { name, code, org_id: orgId } });
    res.status(201).json({ message: 'Subject created', subject });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listSubjects(req: Request, res: Response): Promise<void> {
  try {
    const subjects = await prisma.subject.findMany({
      where: { org_id: req.user!.orgId },
      orderBy: { name: 'asc' },
    });
    res.json({ subjects });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSubject(req: Request, res: Response): Promise<void> {
  try {
    const { name, code } = req.body;
    const id = req.params.id as string;
    const existing = await prisma.subject.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Subject not found' }); return; }

    const subject = await prisma.subject.update({
      where: { id },
      data: { ...(name && { name }), ...(code && { code }) },
    });
    res.json({ message: 'Subject updated', subject });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSubject(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.subject.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Subject not found' }); return; }

    const examCount = await prisma.exam.count({ where: { subject_id: id } });
    if (examCount > 0) { res.status(400).json({ error: 'Cannot delete subject with existing exams' }); return; }

    await prisma.classSubject.deleteMany({ where: { subject_id: id } });
    await prisma.subject.delete({ where: { id } });
    res.json({ message: 'Subject deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function assignSubjectsToClass(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, subject_ids } = req.body;
    if (!class_id || !subject_ids || !Array.isArray(subject_ids)) {
      res.status(400).json({ error: 'class_id and subject_ids array required' }); return;
    }

    // Remove existing assignments and re-assign
    await prisma.classSubject.deleteMany({ where: { class_id } });
    for (const sid of subject_ids) {
      await prisma.classSubject.create({ data: { class_id, subject_id: sid } }).catch(() => {});
    }

    const assignments = await prisma.classSubject.findMany({
      where: { class_id },
      include: { subject: true },
    });
    res.json({ message: 'Subjects assigned', subjects: assignments.map((a) => a.subject) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getClassSubjects(req: Request, res: Response): Promise<void> {
  try {
    const classId = req.params.classId as string;
    const assignments = await prisma.classSubject.findMany({
      where: { class_id: classId },
      include: { subject: true },
    });
    res.json({ subjects: assignments.map((a) => a.subject) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
