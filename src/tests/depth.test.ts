import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { createOrgAdmin, cleanDatabase } from './helpers';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

const isoDaysFromNow = (d: number) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

async function makeStudent(orgId: string, classId: string, roll: string) {
  return prisma.student.create({
    data: { first_name: 'S', last_name: roll, roll_number: roll, date_of_birth: '2014-01-01', gender: 'male', class_id: classId, parent_name: 'P', parent_phone: '0', org_id: orgId },
  });
}

// ── Library circulation ──────────────────────────────────────────────────────
describe('Phase 5 — library circulation', () => {
  async function seed(orgId: string, copies = 1) {
    const cls = await prisma.class.create({ data: { name: 'C', section: 'A', academic_year: '2026', org_id: orgId } });
    const book = await prisma.book.create({ data: { title: 'Algebra', author: 'X', total_copies: copies, org_id: orgId } });
    const student = await makeStudent(orgId, cls.id, 'R1');
    return { cls, book, student };
  }

  it('issues a book and blocks when no copies remain', async () => {
    const { org, token } = await createOrgAdmin('lib1');
    const { book, student } = await seed(org.id, 1);
    const s2 = await makeStudent(org.id, (await prisma.class.findFirst({ where: { org_id: org.id } }))!.id, 'R2');

    const issue = await request(app).post('/api/library/issue').set('Authorization', `Bearer ${token}`)
      .send({ book_id: book.id, student_id: student.id, due_date: isoDaysFromNow(7) });
    expect(issue.status).toBe(201);

    const noCopies = await request(app).post('/api/library/issue').set('Authorization', `Bearer ${token}`)
      .send({ book_id: book.id, student_id: s2.id, due_date: isoDaysFromNow(7) });
    expect(noCopies.status).toBe(409);
  });

  it('blocks issuing the same book to the same student twice', async () => {
    const { org, token } = await createOrgAdmin('lib2');
    const { book, student } = await seed(org.id, 3);
    await request(app).post('/api/library/issue').set('Authorization', `Bearer ${token}`).send({ book_id: book.id, student_id: student.id, due_date: isoDaysFromNow(7) });
    const again = await request(app).post('/api/library/issue').set('Authorization', `Bearer ${token}`).send({ book_id: book.id, student_id: student.id, due_date: isoDaysFromNow(7) });
    expect(again.status).toBe(409);
  });

  it('computes a fine on an overdue return and can mark it paid', async () => {
    const { org, token } = await createOrgAdmin('lib3');
    const { book, student } = await seed(org.id, 1);
    // Create an overdue loan directly (due 3 days ago)
    const loan = await prisma.bookLoan.create({ data: { book_id: book.id, student_id: student.id, due_date: isoDaysFromNow(-3), org_id: org.id } });

    const ret = await request(app).post(`/api/library/loans/${loan.id}/return`).set('Authorization', `Bearer ${token}`);
    expect(ret.status).toBe(200);
    expect(ret.body.loan.fine).toBe(3);
    expect(ret.body.loan.fine_paid).toBe(false);

    const pay = await request(app).patch(`/api/library/loans/${loan.id}/pay-fine`).set('Authorization', `Bearer ${token}`);
    expect(pay.body.loan.fine_paid).toBe(true);
  });

  it('lists loans with an overdue summary and serves a student their loans', async () => {
    const { org, token } = await createOrgAdmin('lib4');
    const { cls, book } = await seed(org.id, 2);
    const studentUser = await prisma.user.create({ data: { name: 'Stu', email: 'stu@lib4.com', password: await hashPassword('x123456'), role: 'student', org_id: org.id } });
    const student = await prisma.student.create({ data: { first_name: 'Stu', last_name: 'D', roll_number: 'RS', date_of_birth: '2014-01-01', gender: 'male', class_id: cls.id, parent_name: 'P', parent_phone: '0', org_id: org.id, user_id: studentUser.id } });
    await prisma.bookLoan.create({ data: { book_id: book.id, student_id: student.id, due_date: isoDaysFromNow(-1), org_id: org.id } });

    const list = await request(app).get('/api/library/loans?status=overdue').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.summary.overdue).toBe(1);
    expect(list.body.loans[0].current_fine).toBeGreaterThanOrEqual(1);

    const stuToken = generateToken({ userId: studentUser.id, email: studentUser.email, role: 'student', orgId: org.id });
    const mine = await request(app).get('/api/library/my-loans').set('Authorization', `Bearer ${stuToken}`);
    expect(mine.body.loans).toHaveLength(1);
  });
});

// ── Timetable auto-generation ────────────────────────────────────────────────
describe('Phase 5 — timetable generation', () => {
  async function seedClass(orgId: string) {
    const cls = await prisma.class.create({ data: { name: 'Grade 4', section: 'A', academic_year: '2026', org_id: orgId } });
    const math = await prisma.subject.create({ data: { name: 'Math', code: 'M', org_id: orgId } });
    const sci = await prisma.subject.create({ data: { name: 'Science', code: 'S', org_id: orgId } });
    await prisma.classSubject.createMany({ data: [{ class_id: cls.id, subject_id: math.id }, { class_id: cls.id, subject_id: sci.id }] });
    const teacher = await prisma.user.create({ data: { name: 'MathT', email: `mt-${Date.now()}@x.com`, password: await hashPassword('x123456'), role: 'teacher', subject: 'Math', org_id: orgId } });
    await prisma.classTeacher.create({ data: { class_id: cls.id, teacher_id: teacher.id } });
    return { cls, math, sci, teacher };
  }

  it('generates a grid and assigns the matching subject teacher', async () => {
    const { org, token } = await createOrgAdmin('tt1');
    const { cls, math, teacher } = await seedClass(org.id);

    const res = await request(app).post('/api/schedules/generate').set('Authorization', `Bearer ${token}`)
      .send({ class_id: cls.id, periods_per_day: 4, days: [1, 2] });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(8);

    const slots = await prisma.classScheduleSlot.findMany({ where: { class_id: cls.id } });
    expect(slots).toHaveLength(8);
    // Math periods should be assigned to the Math teacher
    const mathSlots = slots.filter((s) => s.subject_id === math.id);
    expect(mathSlots.length).toBeGreaterThan(0);
    expect(mathSlots.every((s) => s.teacher_id === teacher.id)).toBe(true);
  });

  it('refuses to overwrite without replace, and regenerates with it', async () => {
    const { org, token } = await createOrgAdmin('tt2');
    const { cls } = await seedClass(org.id);
    await request(app).post('/api/schedules/generate').set('Authorization', `Bearer ${token}`).send({ class_id: cls.id, periods_per_day: 2, days: [1] });

    const blocked = await request(app).post('/api/schedules/generate').set('Authorization', `Bearer ${token}`).send({ class_id: cls.id, periods_per_day: 2, days: [1] });
    expect(blocked.status).toBe(409);

    const replaced = await request(app).post('/api/schedules/generate').set('Authorization', `Bearer ${token}`).send({ class_id: cls.id, periods_per_day: 2, days: [1], replace: true });
    expect(replaced.status).toBe(201);
    const count = await prisma.classScheduleSlot.count({ where: { class_id: cls.id } });
    expect(count).toBe(2);
  });

  it('requires the class to have subjects', async () => {
    const { org, token } = await createOrgAdmin('tt3');
    const cls = await prisma.class.create({ data: { name: 'Empty', section: 'A', academic_year: '2026', org_id: org.id } });
    const res = await request(app).post('/api/schedules/generate').set('Authorization', `Bearer ${token}`).send({ class_id: cls.id });
    expect(res.status).toBe(400);
  });

  it('leaves a teacher unassigned (with a warning) when a duty collides', async () => {
    const { org, token } = await createOrgAdmin('tt4');
    const { cls, teacher } = await seedClass(org.id);
    // A duty spanning both morning periods on day 1 (09:00–10:20), so the Math
    // teacher collides whichever period Math lands on.
    await prisma.teacherScheduleSlot.create({ data: { teacher_id: teacher.id, day_of_week: 1, start_time: '09:00', end_time: '10:20', title: 'Bus Duty', org_id: org.id } });

    const res = await request(app).post('/api/schedules/generate').set('Authorization', `Bearer ${token}`)
      .send({ class_id: cls.id, periods_per_day: 2, days: [1], start_time: '09:00', period_minutes: 40 });
    expect(res.status).toBe(201);
    expect(res.body.warnings.length).toBeGreaterThanOrEqual(1);
  });
});
