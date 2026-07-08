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

async function waitFor<T>(fn: () => Promise<T>, ms = 2000): Promise<T> {
  const start = Date.now();
  let last = await fn();
  while (!last && Date.now() - start < ms) {
    await new Promise((r) => setTimeout(r, 40));
    last = await fn();
  }
  return last;
}

async function seed(orgId: string) {
  const cls = await prisma.class.create({ data: { name: 'Class 5', section: 'A', academic_year: '2026', org_id: orgId } });
  const subject = await prisma.subject.create({ data: { name: 'Science', code: 'SCI', org_id: orgId } });
  const studentUser = await prisma.user.create({
    data: { name: 'Sam', email: `sam-${Date.now()}@x.com`, password: await hashPassword('x123456'), role: 'student', org_id: orgId },
  });
  const parentUser = await prisma.user.create({
    data: { name: 'Pat', email: `pat-${Date.now()}@x.com`, password: await hashPassword('x123456'), role: 'parent', org_id: orgId },
  });
  const student = await prisma.student.create({
    data: {
      first_name: 'Sam', last_name: 'Lee', roll_number: `R-${Date.now()}`, date_of_birth: '2014-01-01',
      gender: 'male', class_id: cls.id, parent_name: 'Pat', parent_phone: '0', org_id: orgId, user_id: studentUser.id,
    },
  });
  await prisma.parentStudent.create({ data: { parent_id: parentUser.id, student_id: student.id } });
  const studentToken = generateToken({ userId: studentUser.id, email: studentUser.email, role: 'student', orgId });
  return { cls, subject, student, studentUser, parentUser, studentToken };
}

// ── Assignment submissions ───────────────────────────────────────────────────
describe('Phase 2 — assignment submissions', () => {
  it('lets a student submit, a teacher grade, and notifies student + parent', async () => {
    const { org, token: adminToken } = await createOrgAdmin('sub');
    const { cls, subject, student, studentUser, parentUser, studentToken } = await seed(org.id);
    const hw = await prisma.homework.create({
      data: { title: 'Plant lab', class_id: cls.id, subject_id: subject.id, due_date: '2026-08-01', org_id: org.id },
    });

    const submit = await request(app).post(`/api/homework/${hw.id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`).field('note', 'My completed plant lab notes');
    expect(submit.status).toBe(201);

    const list = await request(app).get(`/api/homework/${hw.id}/submissions`).set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.submissions).toHaveLength(1);
    const subId = list.body.submissions[0].id;

    const grade = await request(app).patch(`/api/submissions/${subId}/grade`)
      .set('Authorization', `Bearer ${adminToken}`).send({ grade: 8, max_grade: 10, feedback: 'Nice work' });
    expect(grade.status).toBe(200);
    expect(grade.body.submission.status).toBe('graded');

    // Student sees the grade
    const mine = await request(app).get(`/api/homework/${hw.id}/my-submission`).set('Authorization', `Bearer ${studentToken}`);
    expect(mine.body.submission.grade).toBe(8);
    expect(mine.body.submission.status).toBe('graded');

    // Both student and parent were notified
    const studentNote = await waitFor(() => prisma.notification.findFirst({ where: { user_id: studentUser.id, category: 'marks' } }));
    const parentNote = await waitFor(() => prisma.notification.findFirst({ where: { user_id: parentUser.id, category: 'marks' } }));
    expect(studentNote).toBeTruthy();
    expect(parentNote).toBeTruthy();
  });

  it('blocks a submission whose note contains inappropriate content', async () => {
    const { org } = await createOrgAdmin('subx');
    const { cls, subject, studentToken } = await seed(org.id);
    const hw = await prisma.homework.create({
      data: { title: 'Essay', class_id: cls.id, subject_id: subject.id, due_date: '2026-08-01', org_id: org.id },
    });
    const res = await request(app).post(`/api/homework/${hw.id}/submit`)
      .set('Authorization', `Bearer ${studentToken}`).field('note', 'this is pornography');
    expect(res.status).toBe(400);
  });

  it('does not let a graded submission be changed', async () => {
    const { org, token: adminToken } = await createOrgAdmin('sub2');
    const { cls, subject, studentToken } = await seed(org.id);
    const hw = await prisma.homework.create({
      data: { title: 'Worksheet', class_id: cls.id, subject_id: subject.id, due_date: '2026-08-01', org_id: org.id },
    });
    await request(app).post(`/api/homework/${hw.id}/submit`).set('Authorization', `Bearer ${studentToken}`).field('note', 'v1');
    const list = await request(app).get(`/api/homework/${hw.id}/submissions`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).patch(`/api/submissions/${list.body.submissions[0].id}/grade`).set('Authorization', `Bearer ${adminToken}`).send({ grade: 5 });

    const again = await request(app).post(`/api/homework/${hw.id}/submit`).set('Authorization', `Bearer ${studentToken}`).field('note', 'v2');
    expect(again.status).toBe(400);
  });
});

// ── Online quiz ──────────────────────────────────────────────────────────────
describe('Phase 2 — online quiz', () => {
  async function makeQuiz(orgId: string, classId: string, subjectId: string) {
    return prisma.exam.create({
      data: {
        name: 'Science Quiz', exam_type: 'class_test', term: 'term1', class_id: classId, subject_id: subjectId,
        max_marks: 2, exam_format: 'quiz', org_id: orgId,
        questions: {
          create: [
            { order: 1, question_type: 'mcq', question_text: 'Sky colour?', options: JSON.stringify(['Blue', 'Green']), correct_answer: 'Blue', marks: 1 },
            { order: 2, question_type: 'true_false', question_text: 'Water is wet.', options: JSON.stringify(['True', 'False']), correct_answer: 'True', marks: 1 },
          ],
        },
      },
      include: { questions: true },
    });
  }

  it('serves the quiz without answers, auto-grades on submit, and writes a Mark', async () => {
    const { org, token: adminToken } = await createOrgAdmin('qz');
    const { cls, subject, student, studentToken } = await seed(org.id);
    const quiz = await makeQuiz(org.id, cls.id, subject.id);

    // Student view hides correct answers
    const view = await request(app).get(`/api/exams/${quiz.id}/quiz`).set('Authorization', `Bearer ${studentToken}`);
    expect(view.status).toBe(200);
    expect(view.body.questions).toHaveLength(2);
    expect(view.body.questions[0].correct_answer).toBeUndefined();

    const q = quiz.questions;
    const submit = await request(app).post(`/api/exams/${quiz.id}/quiz/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [
        { question_id: q.find((x) => x.order === 1)!.id, answer: 'Blue' },   // correct
        { question_id: q.find((x) => x.order === 2)!.id, answer: 'False' },  // wrong
      ] });
    expect(submit.status).toBe(200);
    expect(submit.body.score).toBe(1);
    expect(submit.body.max_score).toBe(2);

    // Score landed in the gradebook as a Mark
    const mark = await prisma.mark.findUnique({ where: { student_id_exam_id: { student_id: student.id, exam_id: quiz.id } } });
    expect(mark?.marks_obtained).toBe(1);

    // Result reveals correctness
    const result = await request(app).get(`/api/exams/${quiz.id}/quiz/result`).set('Authorization', `Bearer ${studentToken}`);
    expect(result.body.score).toBe(1);
    expect(result.body.questions.find((x: any) => x.order === 1).is_correct).toBe(true);
    expect(result.body.questions.find((x: any) => x.order === 2).is_correct).toBe(false);

    // Cannot submit twice
    const again = await request(app).post(`/api/exams/${quiz.id}/quiz/submit`).set('Authorization', `Bearer ${studentToken}`).send({ answers: [] });
    expect(again.status).toBe(400);

    // Teacher/admin sees the attempt
    const attempts = await request(app).get(`/api/exams/${quiz.id}/quiz/attempts`).set('Authorization', `Bearer ${adminToken}`);
    expect(attempts.body.attempts).toHaveLength(1);
    expect(attempts.body.attempts[0].score).toBe(1);
  });

  it('rejects taking a quiz from another class', async () => {
    const { org } = await createOrgAdmin('qz2');
    const { studentToken } = await seed(org.id);
    const otherClass = await prisma.class.create({ data: { name: 'Other', section: 'Z', academic_year: '2026', org_id: org.id } });
    const subject = await prisma.subject.create({ data: { name: 'Math', code: 'M', org_id: org.id } });
    const quiz = await makeQuiz(org.id, otherClass.id, subject.id);

    const view = await request(app).get(`/api/exams/${quiz.id}/quiz`).set('Authorization', `Bearer ${studentToken}`);
    expect(view.status).toBe(403);
  });
});
