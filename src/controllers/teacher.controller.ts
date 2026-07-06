import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';

export async function createTeacher(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, subject } = req.body;
    const orgId = req.user!.orgId;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: orgId } } });
    if (existing) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    const hashed = await hashPassword(password);
    const teacher = await prisma.user.create({
      data: { name, email, password: hashed, role: 'teacher', subject: subject || null, org_id: orgId },
      select: { id: true, name: true, email: true, role: true, subject: true, is_active: true, created_at: true },
    });

    res.status(201).json({ message: 'Teacher created successfully', teacher });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listTeachers(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [teachers, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'teacher', org_id: orgId },
        select: { id: true, name: true, email: true, subject: true, is_active: true, created_at: true },
        skip, take: limit, orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where: { role: 'teacher', org_id: orgId } }),
    ]);

    res.json({ teachers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTeacher(req: Request, res: Response): Promise<void> {
  try {
    const teacher = await prisma.user.findFirst({
      where: { id: req.params.id as string, role: 'teacher', org_id: req.user!.orgId },
      select: { id: true, name: true, email: true, role: true, subject: true, is_active: true, created_at: true, updated_at: true },
    });

    if (!teacher) { res.status(404).json({ error: 'Teacher not found' }); return; }
    res.json({ teacher });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateTeacher(req: Request, res: Response): Promise<void> {
  try {
    const { name, subject } = req.body;
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id as string, role: 'teacher', org_id: req.user!.orgId },
    });
    if (!existing) { res.status(404).json({ error: 'Teacher not found' }); return; }

    const teacher = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { ...(name && { name }), ...(subject !== undefined && { subject }) },
      select: { id: true, name: true, email: true, role: true, subject: true, is_active: true, updated_at: true },
    });

    res.json({ message: 'Teacher updated successfully', teacher });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function toggleTeacherStatus(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id as string, role: 'teacher', org_id: req.user!.orgId },
    });
    if (!existing) { res.status(404).json({ error: 'Teacher not found' }); return; }

    const teacher = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { is_active: !existing.is_active },
      select: { id: true, name: true, email: true, is_active: true },
    });

    res.json({ message: `Teacher ${teacher.is_active ? 'activated' : 'deactivated'} successfully`, teacher });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
