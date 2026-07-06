import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { canAccessClass } from '../utils/classAccess';

export async function markAttendance(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, date, records } = req.body;
    const orgId = req.user!.orgId;

    if (!class_id || !date || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'class_id, date, and records array are required' }); return;
    }

    const classExists = await prisma.class.findFirst({ where: { id: class_id, org_id: orgId } });
    if (!classExists) { res.status(404).json({ error: 'Class not found' }); return; }

    if (!(await canAccessClass(req.user!, class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    const results = [];
    for (const record of records) {
      const { student_id, status, remarks } = record;
      if (!student_id || !status) continue;

      const existing = await prisma.attendance.findUnique({ where: { student_id_date: { student_id, date } } });

      if (existing) {
        results.push(await prisma.attendance.update({ where: { id: existing.id }, data: { status, remarks: remarks || null, marked_by: req.user?.userId } }));
      } else {
        results.push(await prisma.attendance.create({ data: { student_id, class_id, date, status, remarks: remarks || null, marked_by: req.user?.userId, org_id: orgId } }));
      }
    }

    res.json({ message: `Attendance marked for ${results.length} students`, count: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAttendance(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, date } = req.query;
    if (!class_id || !date) { res.status(400).json({ error: 'class_id and date are required' }); return; }

    if (!(await canAccessClass(req.user!, class_id as string))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    const students = await prisma.student.findMany({
      where: { class_id: class_id as string, is_active: true, org_id: req.user!.orgId },
      orderBy: { roll_number: 'asc' },
      select: { id: true, first_name: true, last_name: true, roll_number: true },
    });

    const records = await prisma.attendance.findMany({ where: { class_id: class_id as string, date: date as string } });
    const recordMap = new Map(records.map((r) => [r.student_id, r]));

    const attendance = students.map((s) => ({
      student_id: s.id, first_name: s.first_name, last_name: s.last_name, roll_number: s.roll_number,
      status: recordMap.get(s.id)?.status || 'unmarked', remarks: recordMap.get(s.id)?.remarks || null,
    }));

    res.json({ attendance, date, class_id });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAttendanceSummary(req: Request, res: Response): Promise<void> {
  try {
    const class_id = req.params.classId as string;
    const { month, year } = req.query;
    if (!month || !year) { res.status(400).json({ error: 'month and year are required' }); return; }

    if (!(await canAccessClass(req.user!, class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    const datePrefix = `${year}-${String(month).padStart(2, '0')}`;

    const students = await prisma.student.findMany({
      where: { class_id, is_active: true, org_id: req.user!.orgId },
      orderBy: { roll_number: 'asc' },
      select: { id: true, first_name: true, last_name: true, roll_number: true },
    });

    const records = await prisma.attendance.findMany({ where: { class_id, date: { startsWith: datePrefix } } });

    const summary = students.map((s) => {
      const sr = records.filter((r) => r.student_id === s.id);
      const present = sr.filter((r) => r.status === 'present').length;
      const absent = sr.filter((r) => r.status === 'absent').length;
      const late = sr.filter((r) => r.status === 'late').length;
      const total = sr.length;
      return { ...s, present, absent, late, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
    });

    res.json({ summary, month, year });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
