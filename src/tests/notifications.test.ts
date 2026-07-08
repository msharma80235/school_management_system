import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { createOrgAdmin, cleanDatabase } from './helpers';
import { notify } from '../utils/notify';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

async function makeUser(orgId: string, role: string, email: string) {
  const user = await prisma.user.create({
    data: { name: email.split('@')[0], email, password: await hashPassword('x123456'), role, org_id: orgId },
  });
  const token = generateToken({ userId: user.id, email: user.email, role: user.role, orgId });
  return { user, token };
}

async function waitFor<T>(fn: () => Promise<T>, ms = 2000): Promise<T> {
  const start = Date.now();
  let last = await fn();
  while (!last && Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 40));
    last = await fn();
  }
  return last;
}

// ── notify() service ─────────────────────────────────────────────────────────
describe('Phase 1 — notify() service', () => {
  it('creates an in-app notification by default', async () => {
    const { org } = await createOrgAdmin('n1');
    const { user } = await makeUser(org.id, 'teacher', 't@n1.com');

    await notify({ userId: user.id, orgId: org.id, category: 'general', title: 'Hello', body: 'World' });

    const rows = await prisma.notification.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Hello');
    expect(rows[0].read_at).toBeNull();
  });

  it('respects an in-app opt-out', async () => {
    const { org } = await createOrgAdmin('n2');
    const { user } = await makeUser(org.id, 'teacher', 't@n2.com');
    await prisma.notificationPreference.create({
      data: { user_id: user.id, category: 'marks', in_app: false, email: false, sms: false },
    });

    await notify({ userId: user.id, orgId: org.id, category: 'marks', title: 'Should not appear' });

    const rows = await prisma.notification.findMany({ where: { user_id: user.id } });
    expect(rows).toHaveLength(0);
  });
});

// ── Notification endpoints ───────────────────────────────────────────────────
describe('Phase 1 — notification endpoints', () => {
  it('lists, counts, and marks notifications read', async () => {
    const { org } = await createOrgAdmin('e1');
    const { user, token } = await makeUser(org.id, 'teacher', 't@e1.com');
    await notify({ userId: user.id, orgId: org.id, category: 'general', title: 'One' });
    await notify({ userId: user.id, orgId: org.id, category: 'general', title: 'Two' });

    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.notifications).toHaveLength(2);
    expect(list.body.unread).toBe(2);

    const id = list.body.notifications[0].id;
    const read = await request(app).patch(`/api/notifications/${id}/read`).set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);

    const count = await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${token}`);
    expect(count.body.unread).toBe(1);

    const all = await request(app).post('/api/notifications/read-all').set('Authorization', `Bearer ${token}`);
    expect(all.body.count).toBe(1);

    const after = await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${token}`);
    expect(after.body.unread).toBe(0);
  });

  it('cannot mark another user\'s notification read', async () => {
    const { org } = await createOrgAdmin('e2');
    const { user: owner } = await makeUser(org.id, 'teacher', 'owner@e2.com');
    const { token: otherToken } = await makeUser(org.id, 'teacher', 'other@e2.com');
    await notify({ userId: owner.id, orgId: org.id, category: 'general', title: 'Private' });
    const row = await prisma.notification.findFirst({ where: { user_id: owner.id } });

    const res = await request(app).patch(`/api/notifications/${row!.id}/read`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('returns all categories in preferences and updates one', async () => {
    const { org } = await createOrgAdmin('e3');
    const { token } = await makeUser(org.id, 'parent', 'p@e3.com');

    const get = await request(app).get('/api/notifications/preferences').set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.preferences).toHaveLength(5);
    expect(get.body.preferences.every((p: any) => p.in_app === true)).toBe(true);

    const put = await request(app).put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'marks', in_app: false, email: false, sms: false });
    expect(put.status).toBe(200);
    expect(put.body.preference.in_app).toBe(false);

    const rejects = await request(app).put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${token}`).send({ category: 'nonsense' });
    expect(rejects.status).toBe(400);
  });
});

// ── Marks-approval flow (Phase 1 exit criterion) ─────────────────────────────
describe('Phase 1 — marks approval notifies parent + student', () => {
  async function seedExam(org: any, opts: { pending?: boolean } = {}) {
    const cls = await prisma.class.create({ data: { name: 'Class 1', section: 'A', academic_year: '2026', org_id: org.id } });
    const subject = await prisma.subject.create({ data: { name: 'Math', code: 'MATH', org_id: org.id } });
    const { user: studentUser } = await makeUser(org.id, 'student', `stu-${Date.now()}@x.com`);
    const { user: parentUser } = await makeUser(org.id, 'parent', `par-${Date.now()}@x.com`);
    const student = await prisma.student.create({
      data: {
        first_name: 'Kid', last_name: 'One', roll_number: `R-${Date.now()}`, date_of_birth: '2015-01-01',
        gender: 'male', class_id: cls.id, parent_name: 'P', parent_phone: '000', org_id: org.id, user_id: studentUser.id,
      },
    });
    await prisma.parentStudent.create({ data: { parent_id: parentUser.id, student_id: student.id } });
    const exam = await prisma.exam.create({
      data: {
        name: 'Mid-Term', exam_type: 'mid_term_written', term: 'term1', class_id: cls.id, subject_id: subject.id,
        max_marks: 100, org_id: org.id, approval_status: opts.pending ? 'pending' : 'draft',
      },
    });
    await prisma.mark.create({ data: { student_id: student.id, exam_id: exam.id, marks_obtained: 90, org_id: org.id } });
    return { exam, studentUser, parentUser };
  }

  it('sends a marks notification to both the student and the parent on approval', async () => {
    const { org, token } = await createOrgAdmin('mk');
    const { exam, studentUser, parentUser } = await seedExam(org, { pending: true });

    const res = await request(app).patch(`/api/exams/${exam.id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const parentNote = await waitFor(() =>
      prisma.notification.findFirst({ where: { user_id: parentUser.id, category: 'marks' } }));
    const studentNote = await waitFor(() =>
      prisma.notification.findFirst({ where: { user_id: studentUser.id, category: 'marks' } }));

    expect(parentNote).toBeTruthy();
    expect(parentNote!.title).toContain('Mid-Term');
    expect(studentNote).toBeTruthy();
  });

  it('does not create an in-app notification for a parent who opted out', async () => {
    const { org, token } = await createOrgAdmin('mk2');
    const { exam, parentUser } = await seedExam(org, { pending: true });
    await prisma.notificationPreference.create({
      data: { user_id: parentUser.id, category: 'marks', in_app: false, email: false, sms: false },
    });

    await request(app).patch(`/api/exams/${exam.id}/approve`).set('Authorization', `Bearer ${token}`);
    // give the fire-and-forget notify a moment to (not) write
    await new Promise((r) => setTimeout(r, 300));

    const rows = await prisma.notification.findMany({ where: { user_id: parentUser.id } });
    expect(rows).toHaveLength(0);
  });
});
