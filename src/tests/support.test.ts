import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { generateToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';
import { createOrgAdmin, cleanDatabase } from './helpers';

beforeEach(async () => { await cleanDatabase(); });
afterAll(async () => { await cleanDatabase(); await prisma.$disconnect(); });

async function makeUser(orgId: string, role: string, name = 'User') {
  const user = await prisma.user.create({
    data: { name, email: `${role}-${Date.now()}@t.com`, password: await hashPassword('x123456'), role, org_id: orgId },
  });
  return { user, token: generateToken({ userId: user.id, email: user.email, role, orgId }) };
}

describe('Contact support', () => {
  it('sends a support message and notifies the org admins in-app', async () => {
    const { org, admin } = await createOrgAdmin('sup1');
    const { token } = await makeUser(org.id, 'student', 'Sam Student');

    const res = await request(app).post('/api/support').set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Cannot open my report card', message: 'The report card page shows an error when I click download.', page: '/student/dashboard' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/administrator/i);

    const notes = await prisma.notification.findMany({ where: { user_id: admin.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toMatch(/Support request from Sam Student/);
    expect(notes[0].category).toBe('general');
  });

  it('notifies other admins but not the admin who sent it', async () => {
    const { org, admin, token } = await createOrgAdmin('sup2');
    const other = await prisma.user.create({ data: { name: 'Admin Two', email: 'a2@sup2.com', password: await hashPassword('x123456'), role: 'admin', org_id: org.id } });

    const res = await request(app).post('/api/support').set('Authorization', `Bearer ${token}`)
      .send({ message: 'A general question about the platform.' });
    expect(res.status).toBe(200);

    expect(await prisma.notification.count({ where: { user_id: other.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { user_id: admin.id } })).toBe(0); // sender not self-notified
  });

  it('rejects an empty or too-short message', async () => {
    const { org } = await createOrgAdmin('sup3');
    const { token } = await makeUser(org.id, 'parent');
    const res = await request(app).post('/api/support').set('Authorization', `Bearer ${token}`).send({ message: 'hi' });
    expect(res.status).toBe(400);
  });

  it('blocks a message that fails the kid-safety scan', async () => {
    const { org } = await createOrgAdmin('sup4');
    const { token } = await makeUser(org.id, 'teacher');
    const res = await request(app).post('/api/support').set('Authorization', `Bearer ${token}`)
      .send({ message: 'this website is fucking broken and useless' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/support').send({ message: 'Anonymous message here.' });
    expect(res.status).toBe(401);
  });
});
