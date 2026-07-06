import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';

const assignmentInclude = {
  class: { select: { id: true, name: true, section: true } },
};

export async function createStaff(req: Request, res: Response): Promise<void> {
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
    const staff = await prisma.user.create({
      data: { name, email, password: hashed, role: 'staff', org_id: orgId },
      select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
    });

    res.status(201).json({ message: 'Staff account created', staff });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listStaff(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const staff = await prisma.user.findMany({
      where: { role: 'staff', org_id: orgId },
      select: {
        id: true, name: true, email: true, is_active: true, created_at: true,
        staff_assignments: { include: assignmentInclude, orderBy: { created_at: 'desc' as const } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ staff });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function toggleStaffStatus(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id as string, role: 'staff', org_id: req.user!.orgId },
    });
    if (!existing) { res.status(404).json({ error: 'Staff member not found' }); return; }

    const staff = await prisma.user.update({
      where: { id: existing.id },
      data: { is_active: !existing.is_active },
      select: { id: true, name: true, email: true, is_active: true },
    });

    res.json({ message: `Staff member ${staff.is_active ? 'activated' : 'deactivated'}`, staff });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: assign a duty to a staff member (class / laboratory / office / any custom type)
export async function addAssignment(req: Request, res: Response): Promise<void> {
  try {
    const staffId = req.params.id as string;
    const { assignment_type, class_id, details } = req.body;
    const orgId = req.user!.orgId;

    if (!assignment_type || !assignment_type.trim()) {
      res.status(400).json({ error: 'Assignment type is required' });
      return;
    }

    const staff = await prisma.user.findFirst({ where: { id: staffId, role: 'staff', org_id: orgId } });
    if (!staff) { res.status(404).json({ error: 'Staff member not found' }); return; }

    if (class_id) {
      const cls = await prisma.class.findFirst({ where: { id: class_id, org_id: orgId } });
      if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }
    }

    const assignment = await prisma.staffAssignment.create({
      data: {
        staff_id: staffId,
        assignment_type: assignment_type.trim().toLowerCase(),
        class_id: class_id || null,
        details: details || null,
        org_id: orgId,
      },
      include: assignmentInclude,
    });

    res.status(201).json({ message: 'Assignment added', assignment });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function removeAssignment(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.assignmentId as string;
    const existing = await prisma.staffAssignment.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Assignment not found' }); return; }

    await prisma.staffAssignment.delete({ where: { id } });
    res.json({ message: 'Assignment removed' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Staff: my own duties (read-only)
export async function getMyAssignments(req: Request, res: Response): Promise<void> {
  try {
    const assignments = await prisma.staffAssignment.findMany({
      where: { staff_id: req.user!.userId },
      include: assignmentInclude,
      orderBy: { created_at: 'desc' },
    });
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
