import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

export async function createTestAdmin() {
  const hashed = await hashPassword('Admin@123');
  const admin = await prisma.user.create({
    data: {
      name: 'Test Admin',
      email: 'admin@test.com',
      password: hashed,
      role: 'admin',
    },
  });
  const token = generateToken({ userId: admin.id, email: admin.email, role: admin.role });
  return { admin, token };
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
  await prisma.user.deleteMany();
}
