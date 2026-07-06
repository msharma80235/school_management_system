import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';

export async function createVolunteer(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body;
    const orgId = req.user!.orgId;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: orgId } } });
    if (existing) { res.status(409).json({ error: 'Email already exists' }); return; }

    const hashed = await hashPassword(password);
    const volunteer = await prisma.user.create({
      data: { name, email, password: hashed, role: 'volunteer', org_id: orgId },
      select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
    });

    res.status(201).json({ message: 'Volunteer account created', volunteer });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listVolunteers(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [volunteers, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'volunteer', org_id: orgId },
        select: { id: true, name: true, email: true, is_active: true, created_at: true },
        skip, take: limit, orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where: { role: 'volunteer', org_id: orgId } }),
    ]);

    res.json({ volunteers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function toggleVolunteerStatus(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id as string, role: 'volunteer', org_id: req.user!.orgId },
    });
    if (!existing) { res.status(404).json({ error: 'Volunteer not found' }); return; }

    const volunteer = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { is_active: !existing.is_active },
      select: { id: true, name: true, email: true, is_active: true },
    });

    res.json({
      message: `Volunteer ${volunteer.is_active ? 'activated' : 'deactivated'} successfully`,
      volunteer,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
