import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { createOrgAdmin, cleanDatabase } from './helpers';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

const enquiry = {
  student_name: 'Riya Kapoor',
  guardian_name: 'Anil Kapoor',
  email: 'anil@example.com',
  grade_applying: 'Class 1',
  message: 'Interested in admission for the new session.',
};

describe('Phase 3 — public enquiry', () => {
  it('accepts an enquiry for a real org and stores it', async () => {
    const { org } = await createOrgAdmin('adm');
    const res = await request(app).post(`/api/admissions/enquiry/${org.slug}`).send(enquiry);
    expect(res.status).toBe(201);

    const rows = await prisma.admission.findMany({ where: { org_id: org.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].stage).toBe('enquiry');
    expect(rows[0].student_name).toBe('Riya Kapoor');
  });

  it('rejects an unknown org', async () => {
    const res = await request(app).post('/api/admissions/enquiry/no-such-school').send(enquiry);
    expect(res.status).toBe(404);
  });

  it('requires a contact method', async () => {
    const { org } = await createOrgAdmin('adm2');
    const res = await request(app).post(`/api/admissions/enquiry/${org.slug}`)
      .send({ student_name: 'A', guardian_name: 'B' });
    expect(res.status).toBe(400);
  });

  it('blocks inappropriate content', async () => {
    const { org } = await createOrgAdmin('adm3');
    const res = await request(app).post(`/api/admissions/enquiry/${org.slug}`)
      .send({ ...enquiry, message: 'this is pornography' });
    expect(res.status).toBe(400);
  });
});

describe('Phase 3 — admin funnel', () => {
  it('lists with counts, moves stage, and only admins can', async () => {
    const { org, token } = await createOrgAdmin('fun');
    await request(app).post(`/api/admissions/enquiry/${org.slug}`).send(enquiry);

    const list = await request(app).get('/api/admissions').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.admissions).toHaveLength(1);
    expect(list.body.counts.enquiry).toBe(1);
    const id = list.body.admissions[0].id;

    const move = await request(app).patch(`/api/admissions/${id}/stage`)
      .set('Authorization', `Bearer ${token}`).send({ stage: 'accepted', decision_note: 'Welcome' });
    expect(move.status).toBe(200);
    expect(move.body.admission.stage).toBe('accepted');

    // Unauthenticated cannot list
    const noAuth = await request(app).get('/api/admissions');
    expect(noAuth.status).toBe(401);
  });

  it('rejects an invalid stage', async () => {
    const { org, token } = await createOrgAdmin('fun2');
    await request(app).post(`/api/admissions/enquiry/${org.slug}`).send(enquiry);
    const list = await request(app).get('/api/admissions').set('Authorization', `Bearer ${token}`);
    const res = await request(app).patch(`/api/admissions/${list.body.admissions[0].id}/stage`)
      .set('Authorization', `Bearer ${token}`).send({ stage: 'nonsense' });
    expect(res.status).toBe(400);
  });
});

describe('Phase 3 — convert to enrolled student', () => {
  it('creates a student, links the admission, and issues a parent invite', async () => {
    const { org, token } = await createOrgAdmin('conv');
    const cls = await prisma.class.create({ data: { name: 'Class 1', section: 'A', academic_year: '2026', org_id: org.id } });
    await request(app).post(`/api/admissions/enquiry/${org.slug}`).send(enquiry);
    const list = await request(app).get('/api/admissions').set('Authorization', `Bearer ${token}`);
    const id = list.body.admissions[0].id;

    const res = await request(app).post(`/api/admissions/${id}/convert`)
      .set('Authorization', `Bearer ${token}`).send({ class_id: cls.id, create_parent_invite: true });
    expect(res.status).toBe(201);
    expect(res.body.student.first_name).toBe('Riya');
    expect(res.body.student.last_name).toBe('Kapoor');
    expect(res.body.invite?.code).toBeTruthy();

    // Admission is now enrolled and linked to the student
    const admission = await prisma.admission.findUnique({ where: { id } });
    expect(admission?.stage).toBe('enrolled');
    expect(admission?.student_id).toBe(res.body.student.id);

    // A parent invitation was created for the guardian, linked to the student
    const invite = await prisma.invitation.findFirst({ where: { org_id: org.id, role: 'parent', student_id: res.body.student.id } });
    expect(invite?.email).toBe('anil@example.com');
  });

  it('rejects conversion into a class that does not exist', async () => {
    const { org, token } = await createOrgAdmin('conv2');
    await request(app).post(`/api/admissions/enquiry/${org.slug}`).send(enquiry);
    const list = await request(app).get('/api/admissions').set('Authorization', `Bearer ${token}`);
    const res = await request(app).post(`/api/admissions/${list.body.admissions[0].id}/convert`)
      .set('Authorization', `Bearer ${token}`).send({ class_id: 'nope' });
    expect(res.status).toBe(404);
  });
});
