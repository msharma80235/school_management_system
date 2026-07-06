import { Request, Response } from 'express';
import prisma from '../prisma/client';

export async function createGrade(req: Request, res: Response): Promise<void> {
  try {
    const { name, display_order } = req.body;
    const orgId = req.user!.orgId;
    if (!name) { res.status(400).json({ error: 'Grade name is required' }); return; }

    const existing = await prisma.gradeLevel.findUnique({ where: { name_org_id: { name, org_id: orgId } } });
    if (existing) { res.status(409).json({ error: 'Grade level already exists' }); return; }

    const grade = await prisma.gradeLevel.create({ data: { name, display_order: display_order ?? 0, org_id: orgId } });
    res.status(201).json({ message: 'Grade level created', grade });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listGrades(req: Request, res: Response): Promise<void> {
  try {
    const grades = await prisma.gradeLevel.findMany({ where: { org_id: req.user!.orgId }, orderBy: { display_order: 'asc' } });
    res.json({ grades });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateGrade(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { name, display_order } = req.body;
    const orgId = req.user!.orgId;

    const existing = await prisma.gradeLevel.findFirst({ where: { id, org_id: orgId } });
    if (!existing) { res.status(404).json({ error: 'Grade level not found' }); return; }

    if (name && name !== existing.name) {
      const dup = await prisma.gradeLevel.findUnique({ where: { name_org_id: { name, org_id: orgId } } });
      if (dup) { res.status(409).json({ error: 'Grade level name already exists' }); return; }
    }

    const grade = await prisma.gradeLevel.update({ where: { id }, data: { ...(name && { name }), ...(display_order !== undefined && { display_order }) } });
    res.json({ message: 'Grade level updated', grade });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteGrade(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const orgId = req.user!.orgId;

    const existing = await prisma.gradeLevel.findFirst({ where: { id, org_id: orgId } });
    if (!existing) { res.status(404).json({ error: 'Grade level not found' }); return; }

    const classCount = await prisma.class.count({ where: { name: existing.name, org_id: orgId } });
    if (classCount > 0) { res.status(400).json({ error: 'Cannot delete grade level that is used by existing classes' }); return; }

    await prisma.gradeLevel.delete({ where: { id } });
    res.json({ message: 'Grade level deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
