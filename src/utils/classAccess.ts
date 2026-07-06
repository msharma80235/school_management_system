import prisma from '../prisma/client';
import { TokenPayload } from './jwt';

// Admins and volunteers may act on any class in their org; teachers only on classes assigned to them.
export async function canAccessClass(user: TokenPayload, classId: string): Promise<boolean> {
  const where: any = { id: classId, org_id: user.orgId };
  if (user.role === 'teacher') where.class_teachers = { some: { teacher_id: user.userId } };
  const cls = await prisma.class.findFirst({ where, select: { id: true } });
  return !!cls;
}

// Prisma relation filter matching classes assigned to this teacher
export function teacherClassFilter(userId: string) {
  return { class_teachers: { some: { teacher_id: userId } } };
}
