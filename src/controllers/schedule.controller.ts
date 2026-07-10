import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { findTeacherConflict } from '../utils/teacherConflict';

const slotInclude = {
  subject: { select: { id: true, name: true, code: true } },
  class: { select: { id: true, name: true, section: true } },
  teacher: { select: { id: true, name: true } },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Which classes can this user pick a schedule for?
export async function getViewableClasses(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const role = req.user!.role;
    const classSelect = { id: true, name: true, section: true, academic_year: true };

    let classes;
    if (role === 'teacher') {
      classes = await prisma.class.findMany({
        where: { org_id: orgId, class_teachers: { some: { teacher_id: req.user!.userId } } },
        select: classSelect, orderBy: [{ name: 'asc' }, { section: 'asc' }],
      });
    } else if (role === 'student') {
      const student = await prisma.student.findFirst({ where: { user_id: req.user!.userId } });
      classes = student
        ? await prisma.class.findMany({ where: { id: student.class_id }, select: classSelect })
        : [];
    } else if (role === 'parent') {
      const links = await prisma.parentStudent.findMany({
        where: { parent_id: req.user!.userId, student: { is_active: true } },
        include: { student: { select: { class_id: true } } },
      });
      const classIds = [...new Set(links.map((l) => l.student.class_id))];
      classes = await prisma.class.findMany({
        where: { id: { in: classIds } }, select: classSelect, orderBy: [{ name: 'asc' }, { section: 'asc' }],
      });
    } else {
      // admin, staff, volunteer — the whole school
      classes = await prisma.class.findMany({
        where: { org_id: orgId }, select: classSelect, orderBy: [{ name: 'asc' }, { section: 'asc' }],
      });
    }

    res.json({ classes });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Weekly schedule for a class — any authenticated org member can view
export async function getSchedule(req: Request, res: Response): Promise<void> {
  try {
    const classId = req.query.class_id as string;
    if (!classId) { res.status(400).json({ error: 'class_id is required' }); return; }

    const cls = await prisma.class.findFirst({ where: { id: classId, org_id: req.user!.orgId } });
    if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }

    const slots = await prisma.classScheduleSlot.findMany({
      where: { class_id: classId },
      include: slotInclude,
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    res.json({ slots });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

function validateSlotInput(body: any, res: Response): boolean {
  const { day_of_week, start_time, end_time, subject_id, title } = body;
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
  if (!subject_id && !String(title || '').trim()) {
    res.status(400).json({ error: 'Pick a subject or enter a custom title' });
    return false;
  }
  return true;
}

async function hasOverlap(classId: string, day: number, start: string, end: string, excludeId?: string): Promise<boolean> {
  const clash = await prisma.classScheduleSlot.findFirst({
    where: {
      class_id: classId,
      day_of_week: day,
      start_time: { lt: end },
      end_time: { gt: start },
      ...(excludeId && { id: { not: excludeId } }),
    },
  });
  return !!clash;
}

export async function createSlot(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, day_of_week, start_time, end_time, subject_id, title, location, teacher_id } = req.body;

    const cls = await prisma.class.findFirst({ where: { id: class_id, org_id: req.user!.orgId } });
    if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }
    if (!validateSlotInput(req.body, res)) return;

    if (await hasOverlap(class_id, day_of_week, start_time, end_time)) {
      res.status(409).json({ error: 'This time overlaps another period on the same day' });
      return;
    }

    if (teacher_id) {
      const teacher = await prisma.user.findFirst({ where: { id: teacher_id, role: 'teacher', org_id: req.user!.orgId } });
      if (!teacher) { res.status(404).json({ error: 'Teacher not found' }); return; }
      const conflict = await findTeacherConflict(teacher_id, day_of_week, start_time, end_time);
      if (conflict) { res.status(409).json({ error: conflict }); return; }
    }

    const slot = await prisma.classScheduleSlot.create({
      data: {
        class_id, day_of_week, start_time, end_time,
        subject_id: subject_id || null,
        title: subject_id ? null : String(title).trim(),
        location: location?.trim() || null,
        teacher_id: teacher_id || null,
        org_id: req.user!.orgId,
      },
      include: slotInclude,
    });

    res.status(201).json({ message: 'Period added to schedule', slot });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSlot(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.classScheduleSlot.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Schedule slot not found' }); return; }

    const merged = {
      day_of_week: req.body.day_of_week ?? existing.day_of_week,
      start_time: req.body.start_time ?? existing.start_time,
      end_time: req.body.end_time ?? existing.end_time,
      subject_id: req.body.subject_id !== undefined ? (req.body.subject_id || null) : existing.subject_id,
      title: req.body.title !== undefined ? (req.body.title || null) : existing.title,
    };
    if (!validateSlotInput(merged, res)) return;

    if (await hasOverlap(existing.class_id, merged.day_of_week, merged.start_time, merged.end_time, id)) {
      res.status(409).json({ error: 'This time overlaps another period on the same day' });
      return;
    }

    const teacherId = req.body.teacher_id !== undefined ? (req.body.teacher_id || null) : existing.teacher_id;
    if (teacherId) {
      const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: 'teacher', org_id: req.user!.orgId } });
      if (!teacher) { res.status(404).json({ error: 'Teacher not found' }); return; }
      const conflict = await findTeacherConflict(teacherId, merged.day_of_week, merged.start_time, merged.end_time, { classSlotId: id });
      if (conflict) { res.status(409).json({ error: conflict }); return; }
    }

    const slot = await prisma.classScheduleSlot.update({
      where: { id },
      data: {
        day_of_week: merged.day_of_week,
        start_time: merged.start_time,
        end_time: merged.end_time,
        subject_id: merged.subject_id,
        title: merged.subject_id ? null : merged.title,
        teacher_id: teacherId,
        ...(req.body.location !== undefined && { location: req.body.location?.trim() || null }),
      },
      include: slotInclude,
    });

    res.json({ message: 'Schedule updated', slot });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// Auto-generate a weekly timetable for a class: lays the class's subjects across
// a day×period grid (round-robin), assigns each subject's teacher when the class
// has one whose subject matches, and skips a teacher for a cell where that would
// double-book them (validated with the same findTeacherConflict used everywhere).
export async function generateTimetable(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId!;
    const { class_id, replace } = req.body;
    const start_time = req.body.start_time || '09:00';
    const period_minutes = Math.min(Math.max(parseInt(req.body.period_minutes) || 40, 20), 120);
    const periods_per_day = Math.min(Math.max(parseInt(req.body.periods_per_day) || 6, 1), 12);
    const days: number[] = Array.isArray(req.body.days) && req.body.days.length
      ? req.body.days.filter((d: number) => d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5];

    if (!TIME_RE.test(start_time)) { res.status(400).json({ error: 'start_time must be HH:MM 24-hour' }); return; }

    const cls = await prisma.class.findFirst({ where: { id: class_id, org_id: orgId } });
    if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }

    const classSubjects = await prisma.classSubject.findMany({
      where: { class_id }, include: { subject: { select: { id: true, name: true } } },
    });
    if (classSubjects.length === 0) { res.status(400).json({ error: 'Add subjects to this class before generating a timetable' }); return; }

    // Map each subject to a class teacher whose subject matches (heuristic).
    const classTeachers = await prisma.classTeacher.findMany({
      where: { class_id }, include: { teacher: { select: { id: true, subject: true } } },
    });
    const subjectTeacher = new Map<string, string>();
    for (const cs of classSubjects) {
      const t = classTeachers.find((ct) => (ct.teacher.subject || '').toLowerCase() === cs.subject.name.toLowerCase());
      if (t) subjectTeacher.set(cs.subject.id, t.teacher.id);
    }

    const existing = await prisma.classScheduleSlot.count({ where: { class_id } });
    if (existing > 0 && !replace) {
      res.status(409).json({ error: 'This class already has a timetable. Pass replace: true to regenerate it.' }); return;
    }
    if (replace) await prisma.classScheduleSlot.deleteMany({ where: { class_id } });

    const startMin = toMin(start_time);
    const periods = Array.from({ length: periods_per_day }, (_, i) => ({
      start: toHHMM(startMin + i * period_minutes), end: toHHMM(startMin + (i + 1) * period_minutes),
    }));

    const warnings: string[] = [];
    const slots = [];
    let k = 0;
    for (const day of days) {
      for (let p = 0; p < periods_per_day; p++) {
        const cs = classSubjects[k % classSubjects.length]; k++;
        const { start, end } = periods[p];
        let teacherId: string | null = subjectTeacher.get(cs.subject.id) || null;
        if (teacherId) {
          const conflict = await findTeacherConflict(teacherId, day, start, end);
          if (conflict) { warnings.push(`${cs.subject.name} (day ${day} ${start}): ${conflict} — period left without a teacher`); teacherId = null; }
        }
        const slot = await prisma.classScheduleSlot.create({
          data: { class_id, day_of_week: day, start_time: start, end_time: end, subject_id: cs.subject.id, teacher_id: teacherId, org_id: orgId },
          include: slotInclude,
        });
        slots.push(slot);
      }
    }

    res.status(201).json({ message: `Generated ${slots.length} periods`, created: slots.length, warnings, slots });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSlot(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.classScheduleSlot.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Schedule slot not found' }); return; }

    await prisma.classScheduleSlot.delete({ where: { id } });
    res.json({ message: 'Period removed from schedule' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
