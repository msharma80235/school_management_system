import request from 'supertest';
import type { Request, Response } from 'express';
import app from '../app';
import prisma from '../prisma/client';
import { createOrgAdmin, createTestTeacher, cleanDatabase } from './helpers';
import { hashPassword } from '../utils/password';
import { rateLimit } from '../middleware/rateLimit';
import { gateUpload } from '../utils/uploadGuard';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// ── JWT production-secret enforcement ────────────────────────────────────────
describe('Phase 0 — JWT production secret enforcement', () => {
  const original = { env: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
  afterEach(() => {
    process.env.NODE_ENV = original.env;
    if (original.secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original.secret;
  });

  it('throws when loaded in production without a real secret', () => {
    jest.isolateModules(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => require('../utils/jwt')).toThrow(/JWT_SECRET must be set/);
    });
  });

  it('throws when the production secret is the known default', () => {
    jest.isolateModules(() => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'default-secret';
      expect(() => require('../utils/jwt')).toThrow(/JWT_SECRET must be set/);
    });
  });

  it('loads fine in production with a real secret', () => {
    jest.isolateModules(() => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a-strong-unique-production-secret';
      expect(() => require('../utils/jwt')).not.toThrow();
    });
  });
});

// ── Rate limiter ─────────────────────────────────────────────────────────────
describe('Phase 0 — auth rate limiter', () => {
  const original = process.env.NODE_ENV;
  beforeAll(() => { process.env.NODE_ENV = 'development'; }); // limiter is a no-op under 'test'
  afterAll(() => { process.env.NODE_ENV = original; });

  function fakeRes() {
    const res: Partial<Response> & { statusCode?: number; body?: any } = {};
    res.setHeader = jest.fn() as any;
    res.status = ((code: number) => { res.statusCode = code; return res as Response; }) as any;
    res.json = ((body: any) => { res.body = body; return res as Response; }) as any;
    return res as Response & { statusCode?: number; body?: any };
  }

  it('allows requests under the cap, then blocks with 429', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 3, blockMs: 60_000 });
    const req = { ip: '10.0.0.1', socket: {} } as unknown as Request;

    let allowed = 0;
    let blocked = 0;
    for (let i = 0; i < 5; i++) {
      const res = fakeRes();
      const next = jest.fn();
      mw(req, res, next);
      if (next.mock.calls.length) allowed++;
      else if (res.statusCode === 429) blocked++;
    }
    expect(allowed).toBe(3);
    expect(blocked).toBe(2);
  });

  it('keys independently per IP', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 1, blockMs: 60_000 });
    const resA = fakeRes(); const nextA = jest.fn();
    mw({ ip: '1.1.1.1', socket: {} } as any, resA, nextA);
    const resB = fakeRes(); const nextB = jest.fn();
    mw({ ip: '2.2.2.2', socket: {} } as any, resB, nextB);
    expect(nextA).toHaveBeenCalled();
    expect(nextB).toHaveBeenCalled(); // different IP is not blocked
  });
});

// ── Upload safety gate (high-risk path) ──────────────────────────────────────
describe('Phase 0 — upload safety gate', () => {
  it('passes clean metadata', async () => {
    const gate = await gateUpload('Grade 5 Science revision notes on plants');
    expect(gate.ok).toBe(true);
  });

  it('blocks metadata containing adult terms', async () => {
    const gate = await gateUpload('pornography for kids');
    expect(gate.ok).toBe(false);
    expect(gate.categories).toContain('adult');
  });
});

// ── Audit trail on privileged actions ────────────────────────────────────────
describe('Phase 0 — audit trail', () => {
  it('writes an audit row when an admin toggles a moderator', async () => {
    const { org, token } = await createOrgAdmin('aud');
    const target = await prisma.user.create({
      data: { name: 'Teacher T', email: 't@org-aud.com', password: await hashPassword('x123456'), role: 'teacher', org_id: org.id },
    });

    const res = await request(app)
      .patch(`/api/org-users/${target.id}/moderator`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const logs = await prisma.auditLog.findMany({ where: { org_id: org.id, action: 'user.moderator_grant' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].target_id).toBe(target.id);
    expect(logs[0].actor_role).toBe('admin');
  });

  it('exposes the trail to admins via GET /api/audit', async () => {
    const { org, token } = await createOrgAdmin('list');
    const target = await prisma.user.create({
      data: { name: 'U', email: 'u@org-list.com', password: await hashPassword('x123456'), role: 'teacher', org_id: org.id },
    });
    await request(app).patch(`/api/org-users/${target.id}/lock`).set('Authorization', `Bearer ${token}`);

    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.logs[0].action).toBe('user.lock');
  });

  it('scopes the trail to the caller org', async () => {
    const a = await createOrgAdmin('A');
    const b = await createOrgAdmin('B');
    const tA = await prisma.user.create({ data: { name: 'ta', email: 'ta@a.com', password: await hashPassword('x123456'), role: 'teacher', org_id: a.org.id } });
    await request(app).patch(`/api/org-users/${tA.id}/lock`).set('Authorization', `Bearer ${a.token}`);

    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(0); // org B sees nothing from org A
  });

  it('denies non-admins access to the trail', async () => {
    const { token } = await createTestTeacher();
    const res = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
