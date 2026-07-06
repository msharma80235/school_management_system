import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

// Admin creates login credentials for a student
export async function createStudentAccount(req: Request, res: Response): Promise<void> {
  try {
    const studentId = req.params.id as string;
    const { email, password } = req.body;
    const orgId = req.user!.orgId;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const student = await prisma.student.findFirst({ where: { id: studentId, org_id: orgId } });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    if (student.user_id) {
      res.status(409).json({ error: 'Student already has a login account' });
      return;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: orgId } } });
    if (existingEmail) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name: `${student.first_name} ${student.last_name}`,
        email,
        password: hashed,
        role: 'student',
        org_id: orgId,
      },
    });

    await prisma.student.update({
      where: { id: studentId },
      data: { user_id: user.id },
    });

    res.status(201).json({
      message: 'Student login account created',
      account: { email, student_name: `${student.first_name} ${student.last_name}` },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student-facing: get my profile and class info
export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const student = await prisma.student.findFirst({
      where: { user_id: userId },
      include: {
        class: { select: { id: true, name: true, section: true, academic_year: true } },
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    res.json({ student });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student-facing: get my attendance
export async function getMyAttendance(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { month, year } = req.query;

    const student = await prisma.student.findFirst({ where: { user_id: userId } });
    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const where: any = { student_id: student.id };
    if (month && year) {
      where.date = { startsWith: `${year}-${String(month).padStart(2, '0')}` };
    }

    const attendance = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' } });

    const total = attendance.length;
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const late = attendance.filter((a) => a.status === 'late').length;

    res.json({
      attendance,
      summary: { total, present, absent, late, percentage: total > 0 ? Math.round((present / total) * 100) : 0 },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public: student self-registration using roll number
export async function selfRegisterStudent(req: Request, res: Response): Promise<void> {
  try {
    const { org_slug, roll_number, email, password } = req.body;

    if (!org_slug || !roll_number || !email || !password) {
      res.status(400).json({ error: 'School ID, student/roll number, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { slug: org_slug } });
    if (!org || !org.is_active) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { roll_number_org_id: { roll_number, org_id: org.id } },
    });
    if (!student) {
      res.status(404).json({ error: 'Student ID not found. Please check with your school.' });
      return;
    }

    if (!student.is_active) {
      res.status(400).json({ error: 'This student record is inactive' });
      return;
    }

    if (student.user_id) {
      res.status(409).json({ error: 'This student already has a login account. Please sign in instead.' });
      return;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: org.id } } });
    if (existingEmail) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name: `${student.first_name} ${student.last_name}`,
        email,
        password: hashed,
        role: 'student',
        org_id: org.id,
      },
    });

    await prisma.student.update({
      where: { id: student.id },
      data: { user_id: user.id },
    });

    const token = generateToken({ userId: user.id, email, role: 'student', orgId: org.id });

    res.status(201).json({
      message: 'Student account registered successfully',
      token,
      user: { id: user.id, name: user.name, email, role: 'student' },
      org: { id: org.id, name: org.name, slug: org.slug },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public: parent self-registration using child's roll number
export async function selfRegisterParent(req: Request, res: Response): Promise<void> {
  try {
    const { org_slug, roll_number, name, email, password } = req.body;

    if (!org_slug || !roll_number || !name || !email || !password) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { slug: org_slug } });
    if (!org || !org.is_active) {
      res.status(404).json({ error: 'School not found' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { roll_number_org_id: { roll_number, org_id: org.id } },
    });
    if (!student || !student.is_active) {
      res.status(404).json({ error: 'Student ID not found. Please check with your school.' });
      return;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email_org_id: { email, org_id: org.id } } });
    if (existingEmail) {
      res.status(409).json({ error: 'Email already in use. Please sign in instead.' });
      return;
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: 'parent', org_id: org.id },
    });

    // Link parent to the student
    await prisma.parentStudent.create({
      data: { parent_id: user.id, student_id: student.id },
    });

    const token = generateToken({ userId: user.id, email, role: 'parent', orgId: org.id });

    res.status(201).json({
      message: 'Parent account registered successfully',
      token,
      user: { id: user.id, name, email, role: 'parent' },
      org: { id: org.id, name: org.name, slug: org.slug },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
