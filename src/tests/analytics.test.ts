import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { createOrgAdmin, createTestTeacher, cleanDatabase } from './helpers';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// A date string `d` days before today (always inside the trend window).
function daysAgo(d: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

async function makeStudent(orgId: string, classId: string, roll: string, first: string) {
  return prisma.student.create({
    data: {
      first_name: first, last_name: 'Test', roll_number: roll, date_of_birth: '2014-01-01',
      gender: 'male', class_id: classId, parent_name: 'P', parent_phone: '0', org_id: orgId,
    },
  });
}

async function seed(orgId: string) {
  const cls = await prisma.class.create({ data: { name: 'Class 3', section: 'A', academic_year: '2026', org_id: orgId } });
  const subject = await prisma.subject.create({ data: { name: 'Math', code: 'M', org_id: orgId } });
  const exam = await prisma.exam.create({
    data: { name: 'Term 1', exam_type: 'mid_term_written', term: 'term1', class_id: cls.id, subject_id: subject.id, max_marks: 100, approval_status: 'approved', org_id: orgId },
  });

  const bad = await makeStudent(orgId, cls.id, 'S-BAD', 'Bad');
  const good = await makeStudent(orgId, cls.id, 'S-GOOD', 'Good');

  // Attendance: bad absent 6 days, good present 6 days
  for (let i = 0; i < 6; i++) {
    await prisma.attendance.create({ data: { student_id: bad.id, class_id: cls.id, date: daysAgo(i), status: 'absent', org_id: orgId } });
    await prisma.attendance.create({ data: { student_id: good.id, class_id: cls.id, date: daysAgo(i), status: 'present', org_id: orgId } });
  }
  // Marks: bad 20/100, good 90/100
  await prisma.mark.create({ data: { student_id: bad.id, exam_id: exam.id, marks_obtained: 20, org_id: orgId } });
  await prisma.mark.create({ data: { student_id: good.id, exam_id: exam.id, marks_obtained: 90, org_id: orgId } });

  return { cls, subject, exam, bad, good };
}

describe('Phase 4 — analytics', () => {
  it('overview reports counts and attendance rate', async () => {
    const { org, token } = await createOrgAdmin('an1');
    await seed(org.id);
    const res = await request(app).get('/api/analytics/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.students).toBe(2);
    expect(res.body.attendanceRate).toBe(50); // 6 present of 12
  });

  it('attendance trend returns monthly rates', async () => {
    const { org, token } = await createOrgAdmin('an2');
    await seed(org.id);
    const res = await request(app).get('/api/analytics/attendance-trend?months=6').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.trend)).toBe(true);
    const total = res.body.trend.reduce((s: number, m: any) => s + m.total, 0);
    expect(total).toBe(12);
  });

  it('grade distribution buckets marks and averages subjects', async () => {
    const { org, token } = await createOrgAdmin('an3');
    await seed(org.id);
    const res = await request(app).get('/api/analytics/grade-distribution').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const b90 = res.body.buckets.find((b: any) => b.label === '90–100');
    const b0 = res.body.buckets.find((b: any) => b.label === '0–39');
    expect(b90.count).toBe(1);
    expect(b0.count).toBe(1);
    expect(res.body.subjects[0].average).toBe(55); // (90+20)/2
  });

  it('at-risk flags the struggling student, not the strong one', async () => {
    const { org, token } = await createOrgAdmin('an4');
    const { bad, good } = await seed(org.id);
    const res = await request(app).get('/api/analytics/at-risk').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = res.body.at_risk.map((r: any) => r.id);
    expect(ids).toContain(bad.id);
    expect(ids).not.toContain(good.id);
    const badRow = res.body.at_risk.find((r: any) => r.id === bad.id);
    expect(badRow.reasons.length).toBeGreaterThanOrEqual(2); // low attendance + low average
  });

  it('exports a students CSV', async () => {
    const { org, token } = await createOrgAdmin('an5');
    await seed(org.id);
    const res = await request(app).get('/api/analytics/export/students.csv').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toBe('Roll Number,Name,Class,Attendance %,Average %');
    expect(res.text).toContain('S-GOOD');
    expect(res.text).toContain('S-BAD');
  });

  it('denies non-admins', async () => {
    const { token } = await createTestTeacher();
    const res = await request(app).get('/api/analytics/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
