import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { findTeacherConflict } from '../utils/teacherConflict';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Which teachers can this user view a schedule for?
export async function getViewableTeachers(req: Request, res: Response): Promise<void> {
  try {
    const role = req.user!.role;
    const select = { id: true, name: true, subject: true };

    let teachers;
    if (role === 'teacher') {
      teachers = await prisma.user.findMany({ where: { id: req.user!.userId }, select });
    } else if (role === 'admin' || role === 'staff' || role === 'volunteer') {
      teachers = await prisma.user.findMany({
        where: { role: 'teacher', org_id: req.user!.orgId, is_active: true },
        select, orderBy: { name: 'asc' },
      });
    } else {
      teachers = []; // students/parents follow class schedules instead
    }

    res.json({ teachers });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// A teacher's full week: the class periods they teach plus personal slots
// (duties, meetings). Everything is normalized to one shape for the calendar.
export async function getTeacherSchedule(req: Request, res: Response): Promise<void> {
  try {
    const teacherId = req.query.teacher_id as string;
    if (!teacherId) { res.status(400).json({ error: 'teacher_id is required' }); return; }

    // Teachers may only look at their own schedule
    if (req.user!.role === 'teacher' && teacherId !== req.user!.userId) {
      res.status(403).json({ error: 'You can only view your own schedule' });
      return;
    }

    const teacher = await prisma.user.findFirst({
      where: { id: teacherId, role: 'teacher', org_id: req.user!.orgId },
      select: { id: true, name: true },
    });
    if (!teacher) { res.status(404).json({ error: 'Teacher not found' }); return; }

    const [classSlots, personalSlots] = await Promise.all([
      prisma.classScheduleSlot.findMany({
        where: { teacher_id: teacherId },
        include: {
          subject: { select: { id: true, name: true } },
          class: { select: { id: true, name: true, section: true } },
        },
      }),
      prisma.teacherScheduleSlot.findMany({ where: { teacher_id: teacherId } }),
    ]);

    const slots = [
      ...classSlots.map((s) => ({
        id: s.id,
        source: 'class' as const,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        title: `${s.subject?.name || s.title} (${s.class.name}${s.class.section ? ` - ${s.class.section}` : ''})`,
        location: s.location,
        subject: null,
      })),
      ...personalSlots.map((s) => ({
        id: s.id,
        source: 'personal' as const,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        title: s.title,
        location: s.location,
        subject: null,
      })),
    ].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

    res.json({ teacher, slots });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

function validateInput(body: any, res: Response): boolean {
  const { day_of_week, start_time, end_time, title } = body;
  if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) {
    res.status(400).json({ error: 'day_of_week must be 0 (Sunday) through 6 (Saturday)' });
    return false;
  }
  if (!TIME_RE.test(start_time || '') || !TIME_RE.test(end_time || '')) {
    res.status(400).json({ error: 'Times must be in HH:MM 24-hour format' });
    return false;
  }
  if (start_time >= end_time) {
    res.status(400).json({ error: 'End time must be after start time' });
    return false;
  }
  if (!String(title || '').trim()) {
    res.status(400).json({ error: 'Title is required (e.g. Bus Duty, Staff Meeting)' });
    return false;
  }
  return true;
}

export async function createPersonalSlot(req: Request, res: Response): Promise<void> {
  try {
    const { teacher_id, day_of_week, start_time, end_time, title, location } = req.body;

    const teacher = await prisma.user.findFirst({ where: { id: teacher_id, role: 'teacher', org_id: req.user!.orgId } });
    if (!teacher) { res.status(404).json({ error: 'Teacher not found' }); return; }
    if (!validateInput(req.body, res)) return;

    const conflict = await findTeacherConflict(teacher_id, day_of_week, start_time, end_time);
    if (conflict) { res.status(409).json({ error: conflict }); return; }

    const slot = await prisma.teacherScheduleSlot.create({
      data: {
        teacher_id, day_of_week, start_time, end_time,
        title: String(title).trim(),
        location: location?.trim() || null,
        org_id: req.user!.orgId,
      },
    });

    res.status(201).json({ message: `Added to ${teacher.name}'s schedule`, slot });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updatePersonalSlot(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.teacherScheduleSlot.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Schedule slot not found' }); return; }

    const merged = {
      day_of_week: req.body.day_of_week ?? existing.day_of_week,
      start_time: req.body.start_time ?? existing.start_time,
      end_time: req.body.end_time ?? existing.end_time,
      title: req.body.title !== undefined ? req.body.title : existing.title,
    };
    if (!validateInput(merged, res)) return;

    const conflict = await findTeacherConflict(existing.teacher_id, merged.day_of_week, merged.start_time, merged.end_time, { personalSlotId: id });
    if (conflict) { res.status(409).json({ error: conflict }); return; }

    const slot = await prisma.teacherScheduleSlot.update({
      where: { id },
      data: {
        day_of_week: merged.day_of_week,
        start_time: merged.start_time,
        end_time: merged.end_time,
        title: String(merged.title).trim(),
        ...(req.body.location !== undefined && { location: req.body.location?.trim() || null }),
      },
    });

    res.json({ message: 'Schedule updated', slot });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deletePersonalSlot(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.teacherScheduleSlot.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Schedule slot not found' }); return; }

    await prisma.teacherScheduleSlot.delete({ where: { id } });
    res.json({ message: 'Removed from schedule' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
