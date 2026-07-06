import prisma from '../prisma/client';

beforeAll(async () => {
  // Clean all tables before tests
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
