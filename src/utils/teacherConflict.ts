import prisma from '../prisma/client';

// A teacher can never be in two places at once: checks both the class periods
// they teach and their personal schedule (duties, meetings) for overlap.
export async function findTeacherConflict(
  teacherId: string,
  day: number,
  start: string,
  end: string,
  exclude: { classSlotId?: string; personalSlotId?: string } = {}
): Promise<string | null> {
  const classClash = await prisma.classScheduleSlot.findFirst({
    where: {
      teacher_id: teacherId,
      day_of_week: day,
      start_time: { lt: end },
      end_time: { gt: start },
      ...(exclude.classSlotId && { id: { not: exclude.classSlotId } }),
    },
    include: {
      subject: { select: { name: true } },
      class: { select: { name: true, section: true } },
    },
  });
  if (classClash) {
    const what = classClash.subject?.name || classClash.title || 'a period';
    const cls = `${classClash.class.name}${classClash.class.section ? ` - ${classClash.class.section}` : ''}`;
    return `Teacher is already teaching ${what} in ${cls} (${classClash.start_time}–${classClash.end_time})`;
  }

  const personalClash = await prisma.teacherScheduleSlot.findFirst({
    where: {
      teacher_id: teacherId,
      day_of_week: day,
      start_time: { lt: end },
      end_time: { gt: start },
      ...(exclude.personalSlotId && { id: { not: exclude.personalSlotId } }),
    },
  });
  if (personalClash) {
    return `Teacher already has "${personalClash.title}" scheduled (${personalClash.start_time}–${personalClash.end_time})`;
  }

  return null;
}
