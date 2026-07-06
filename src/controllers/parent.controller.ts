import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';

export async function createParent(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, student_ids } = req.body;
    const orgId = req.user!.orgId;

    if (!name || !email || !password) { res.status(400).json({ error: 'Name, email, and password are required' }); return; }

    const existing = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: orgId } } });
    if (existing) { res.status(409).json({ error: 'Email already exists' }); return; }

    const hashed = await hashPassword(password);
    const parent = await prisma.user.create({
      data: { name, email, password: hashed, role: 'parent', org_id: orgId },
      select: { id: true, name: true, email: true, role: true, is_active: true, created_at: true },
    });

    if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
      for (const sid of student_ids) {
        await prisma.parentStudent.create({
          data: { parent_id: parent.id, student_id: sid },
        }).catch(() => {}); // skip duplicates
      }
    }

    const links = await prisma.parentStudent.findMany({
      where: { parent_id: parent.id },
      include: { student: { select: { id: true, first_name: true, last_name: true, roll_number: true } } },
    });

    res.status(201).json({ message: 'Parent account created', parent: { ...parent, students: links.map((l) => l.student) } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listParents(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [parents, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'parent', org_id: orgId },
        select: { id: true, name: true, email: true, is_active: true, created_at: true,
          parent_students: { include: { student: { select: { id: true, first_name: true, last_name: true, roll_number: true, is_active: true, class: { select: { name: true, section: true } } } } } },
        },
        skip, take: limit, orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where: { role: 'parent', org_id: orgId } }),
    ]);

    // Parents with no active enrolled student are greyed out in the UI
    const formatted = parents.map((p) => ({
      ...p,
      students: p.parent_students.map((ps) => ps.student),
      has_active_students: p.parent_students.some((ps) => ps.student.is_active),
      parent_students: undefined,
    }));
    res.json({ parents: formatted, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Full details for one parent: account info plus every linked child
export async function getParent(req: Request, res: Response): Promise<void> {
  try {
    const parent = await prisma.user.findFirst({
      where: { id: req.params.id as string, role: 'parent', org_id: req.user!.orgId },
      select: {
        id: true, name: true, email: true, is_active: true, is_locked: true, created_at: true,
        parent_students: {
          include: {
            student: {
              include: { class: { select: { id: true, name: true, section: true, academic_year: true } } },
            },
          },
        },
      },
    });
    if (!parent) { res.status(404).json({ error: 'Parent not found' }); return; }

    res.json({
      parent: {
        ...parent,
        students: parent.parent_students.map((ps) => ps.student),
        has_active_students: parent.parent_students.some((ps) => ps.student.is_active),
        parent_students: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function linkStudent(req: Request, res: Response): Promise<void> {
  try {
    const parent_id = req.params.id as string;
    const { student_id } = req.body;
    if (!student_id) { res.status(400).json({ error: 'Student ID is required' }); return; }

    const parent = await prisma.user.findFirst({ where: { id: parent_id, role: 'parent', org_id: req.user!.orgId } });
    if (!parent) { res.status(404).json({ error: 'Parent not found' }); return; }

    await prisma.parentStudent.create({ data: { parent_id, student_id } });
    res.json({ message: 'Student linked to parent' });
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Student already linked to this parent' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function unlinkStudent(req: Request, res: Response): Promise<void> {
  try {
    const parent_id = req.params.id as string;
    const student_id = req.params.studentId as string;
    await prisma.parentStudent.deleteMany({ where: { parent_id, student_id } });
    res.json({ message: 'Student unlinked from parent' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMyChildren(req: Request, res: Response): Promise<void> {
  try {
    const links = await prisma.parentStudent.findMany({
      where: { parent_id: req.user!.userId },
      include: { student: { include: { class: { select: { id: true, name: true, section: true, academic_year: true } } } } },
    });
    res.json({ children: links.map((l) => l.student) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getChildAttendance(req: Request, res: Response): Promise<void> {
  try {
    const parentId = req.user!.userId;
    const studentId = req.params.studentId as string;
    const { month, year } = req.query;

    const link = await prisma.parentStudent.findFirst({ where: { parent_id: parentId, student_id: studentId } });
    if (!link) { res.status(403).json({ error: 'Access denied' }); return; }

    const where: any = { student_id: studentId };
    if (month && year) { where.date = { startsWith: `${year}-${String(month).padStart(2, '0')}` }; }

    const attendance = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' } });

    const total = attendance.length;
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const late = attendance.filter((a) => a.status === 'late').length;

    res.json({ attendance, summary: { total, present, absent, late, percentage: total > 0 ? Math.round((present / total) * 100) : 0 } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
