import { Request, Response } from 'express';
import prisma from '../prisma/client';

// Admin/teacher: mark attendance for volunteers on a date
export async function markVolunteerAttendance(req: Request, res: Response): Promise<void> {
  try {
    const { date, records } = req.body;
    const orgId = req.user!.orgId;

    if (!date || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'date and records array are required' });
      return;
    }

    let count = 0;
    for (const record of records) {
      const { volunteer_id, status, remarks } = record;
      if (!volunteer_id || !status) continue;

      // Ensure the volunteer belongs to this org
      const volunteer = await prisma.user.findFirst({
        where: { id: volunteer_id, role: 'volunteer', org_id: orgId },
      });
      if (!volunteer) continue;

      const existing = await prisma.volunteerAttendance.findUnique({
        where: { volunteer_id_date: { volunteer_id, date } },
      });

      if (existing) {
        await prisma.volunteerAttendance.update({
          where: { id: existing.id },
          data: { status, remarks: remarks || null, marked_by: req.user?.userId },
        });
      } else {
        await prisma.volunteerAttendance.create({
          data: { volunteer_id, date, status, remarks: remarks || null, marked_by: req.user?.userId, org_id: orgId },
        });
      }
      count++;
    }

    res.json({ message: `Attendance marked for ${count} volunteers`, count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin/teacher: all volunteers with their status for a date
export async function getVolunteerAttendance(req: Request, res: Response): Promise<void> {
  try {
    const { date } = req.query;
    const orgId = req.user!.orgId;

    if (!date) { res.status(400).json({ error: 'date is required' }); return; }

    const volunteers = await prisma.user.findMany({
      where: { role: 'volunteer', org_id: orgId, is_active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });

    const records = await prisma.volunteerAttendance.findMany({
      where: { org_id: orgId, date: date as string },
    });
    const recordMap = new Map(records.map((r) => [r.volunteer_id, r]));

    const attendance = volunteers.map((v) => ({
      volunteer_id: v.id,
      name: v.name,
      email: v.email,
      status: recordMap.get(v.id)?.status || 'unmarked',
      remarks: recordMap.get(v.id)?.remarks || null,
    }));

    res.json({ attendance, date });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Volunteer: my own attendance (read-only)
export async function getMyVolunteerAttendance(req: Request, res: Response): Promise<void> {
  try {
    const { month, year } = req.query;

    const where: any = { volunteer_id: req.user!.userId };
    if (month && year) {
      where.date = { startsWith: `${year}-${String(month).padStart(2, '0')}` };
    }

    const attendance = await prisma.volunteerAttendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });

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
