import dotenv from 'dotenv';
dotenv.config();

import prisma from './client';
import { hashPassword } from '../utils/password';

async function seed() {
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: 'demo-school' },
  });

  if (existingOrg) {
    console.log('Demo organization already exists. Skipping seed.');
    return;
  }

  const hashedPassword = await hashPassword('Admin@123');

  const org = await prisma.organization.create({
    data: {
      name: 'Demo School',
      slug: 'demo-school',
      email: 'admin@demoschool.com',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@demoschool.com',
      password: hashedPassword,
      role: 'admin',
      org_id: org.id,
    },
  });

  // Seed default grade levels
  const defaultGrades = [
    'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    'Class 11', 'Class 12',
  ];

  await prisma.gradeLevel.createMany({
    data: defaultGrades.map((name, i) => ({
      name,
      display_order: i,
      org_id: org.id,
    })),
  });

  console.log('Demo organization created successfully.');
  console.log('Org: Demo School (slug: demo-school)');
  console.log('Admin: admin@demoschool.com / Admin@123');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
