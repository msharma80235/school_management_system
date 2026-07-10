import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

export const TEST_ORG_SLUG = 'test-org';

export async function createTestAdmin() {
  const org = await prisma.organization.create({
    data: { name: 'Test Org', slug: TEST_ORG_SLUG, email: 'org@test.com' },
  });
  const hashed = await hashPassword('Admin@123');
  const admin = await prisma.user.create({
    data: {
      name: 'Test Admin',
      email: 'admin@test.com',
      password: hashed,
      role: 'admin',
      org_id: org.id,
    },
  });
  const token = generateToken({ userId: admin.id, email: admin.email, role: admin.role, orgId: org.id });
  return { admin, org, token };
}

export async function createTestTeacher(overrides: Record<string, any> = {}) {
  const hashed = await hashPassword('Teacher@123');
  const teacher = await prisma.user.create({
    data: {
      name: 'Test Teacher',
      email: `teacher-${Date.now()}@test.com`,
      password: hashed,
      role: 'teacher',
      subject: 'Mathematics',
      ...overrides,
    },
  });
  const token = generateToken({ userId: teacher.id, email: teacher.email, role: teacher.role });
  return { teacher, token };
}

export async function cleanDatabase() {
  // SQLite enforces foreign keys, so delete children before parents.
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.quizResponse.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.admission.deleteMany();
  await prisma.mark.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.volunteerAttendance.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.classScheduleSlot.deleteMany();
  await prisma.teacherScheduleSlot.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.staffAssignment.deleteMany();
  await prisma.book.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.schoolDocument.deleteMany();
  await prisma.contentScanResult.deleteMany();
  await prisma.reportCardConfig.deleteMany();
  await prisma.rolesDocument.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.student.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.gradeLevel.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

// An admin that belongs to a real organization, with an org-scoped token —
// needed to exercise org-scoped privileged actions (and their audit rows).
export async function createOrgAdmin(suffix = '1') {
  const org = await prisma.organization.create({
    data: { name: `Org ${suffix}`, slug: `org-${suffix}`, email: `org${suffix}@test.com` },
  });
  const hashed = await hashPassword('Admin@123');
  const admin = await prisma.user.create({
    data: { name: `Admin ${suffix}`, email: `admin-${suffix}@test.com`, password: hashed, role: 'admin', org_id: org.id },
  });
  const token = generateToken({ userId: admin.id, email: admin.email, role: admin.role, orgId: org.id });
  return { org, admin, token };
}
