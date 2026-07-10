import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { generateToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';
import { scanText } from '../utils/contentSafety';
import { createOrgAdmin, cleanDatabase } from './helpers';

const AV_CMD = `node ${path.resolve(__dirname, 'fixtures/fake-av.js')}`;
const IMG_CMD = `node ${path.resolve(__dirname, 'fixtures/fake-image-scan.js')}`;
const uploadsDir = path.resolve('uploads');

function writeUpload(name: string, content = 'hello'): string {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, name), content);
  return name;
}
function rmUpload(name: string) { try { fs.unlinkSync(path.join(uploadsDir, name)); } catch { /* ignore */ } }

beforeEach(async () => { await cleanDatabase(); });
afterEach(() => { delete process.env.AV_SCAN_CMD; delete process.env.IMAGE_SCAN_CMD; });
afterAll(async () => { await cleanDatabase(); await prisma.$disconnect(); });

// ── Configurable scanner (unit) ──────────────────────────────────────────────
describe('Phase 7 — configurable content scanner', () => {
  it('flags a custom term that the built-in lists do not contain', () => {
    const clean = scanText('the wombat runs fast');
    expect(clean.status).toBe('clean');

    const tuned = scanText('the wombat runs fast', {
      extraTerms: [{ term: 'wombat', category: 'custom', severity: 'flagged' }],
    });
    expect(tuned.status).toBe('flagged');
    expect(tuned.categories).toContain('custom');
  });

  it('mutes a built-in category so it stops firing', () => {
    const base = scanText('a lesson about the bomb and terrorism');
    expect(base.status).toBe('review'); // violence category

    const muted = scanText('a lesson about the bomb and terrorism', { mutedCategories: ['violence'] });
    expect(muted.status).toBe('clean');
  });
});

// ── Upload gate: malware + image + custom terms ───────────────────────────────
describe('Phase 7 — upload gate hardening', () => {
  const { gateUpload } = require('../utils/uploadGuard');

  it('blocks an infected file and deletes it from disk', async () => {
    process.env.AV_SCAN_CMD = AV_CMD;
    const name = writeUpload('virus-payload.pdf', 'x');
    const gate = await gateUpload('homework notes', name);
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/malware/i);
    expect(fs.existsSync(path.join(uploadsDir, name))).toBe(false);
    rmUpload(name);
  });

  it('lets a clean file through when the AV scanner reports OK', async () => {
    process.env.AV_SCAN_CMD = AV_CMD;
    const name = writeUpload('safe-notes.pdf', 'x');
    const gate = await gateUpload('homework notes', name);
    expect(gate.ok).toBe(true);
    rmUpload(name);
  });

  it('blocks an image the classifier flags', async () => {
    process.env.IMAGE_SCAN_CMD = IMG_CMD;
    const name = writeUpload('bad-photo.jpg', 'x');
    const gate = await gateUpload('a photo', name);
    expect(gate.ok).toBe(false);
    expect(gate.error).toMatch(/image/i);
    expect(fs.existsSync(path.join(uploadsDir, name))).toBe(false);
    rmUpload(name);
  });

  it("applies an org's custom blocked term at the gate", async () => {
    const { org } = await createOrgAdmin('safe-terms');
    await prisma.safetySetting.create({
      data: { org_id: org.id, extra_terms: JSON.stringify([{ term: 'contraband', category: 'custom', severity: 'flagged' }]), muted_categories: '[]' },
    });
    const gate = await gateUpload('selling contraband to students', null, org.id);
    expect(gate.ok).toBe(false);
    expect(gate.categories).toContain('custom');
  });

  it('blocks review-level uploads when the org opts in', async () => {
    const { org } = await createOrgAdmin('strict');
    // Without the flag, a violence term is review-level and allowed through.
    const allowed = await gateUpload('a history note about terrorism', null, org.id);
    expect(allowed.ok).toBe(true);

    await prisma.safetySetting.create({ data: { org_id: org.id, block_review_uploads: true } });
    const blocked = await gateUpload('a history note about terrorism', null, org.id);
    expect(blocked.ok).toBe(false);
  });
});

// ── Settings, report, assurance, export APIs ──────────────────────────────────
describe('Phase 7 — safety APIs', () => {
  it('saves and reads back per-org safety settings (admin only)', async () => {
    const { org, token } = await createOrgAdmin('api1');

    const save = await request(app).put('/api/safety/settings').set('Authorization', `Bearer ${token}`)
      .send({ extra_terms: [{ term: 'Contraband', category: 'custom', severity: 'flagged' }, { term: 'contraband' }], muted_categories: ['violence', 'bogus'], block_review_uploads: true });
    expect(save.status).toBe(200);
    // duplicate term de-duped, lowercased; bogus muted category dropped
    expect(save.body.settings.extra_terms).toHaveLength(1);
    expect(save.body.settings.extra_terms[0].term).toBe('contraband');
    expect(save.body.settings.muted_categories).toEqual(['violence']);
    expect(save.body.settings.block_review_uploads).toBe(true);

    const get = await request(app).get('/api/safety/settings').set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.settings.block_review_uploads).toBe(true);
    expect(get.body.categories).toContain('adult');

    const setting = await prisma.safetySetting.findUnique({ where: { org_id: org.id } });
    expect(setting).not.toBeNull();
  });

  it('forbids non-admins from reading settings', async () => {
    const { org } = await createOrgAdmin('api2');
    const teacher = await prisma.user.create({ data: { name: 'T', email: 't@api2.com', password: await hashPassword('x123456'), role: 'teacher', org_id: org.id } });
    const tToken = generateToken({ userId: teacher.id, email: teacher.email, role: 'teacher', orgId: org.id });
    const res = await request(app).get('/api/safety/settings').set('Authorization', `Bearer ${tToken}`);
    expect(res.status).toBe(403);
  });

  it('returns a safety report with scan + adapter posture', async () => {
    const { token } = await createOrgAdmin('api3');
    const res = await request(app).get('/api/safety/report').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.scan).toHaveProperty('flagged');
    expect(res.body.adapters).toHaveProperty('malware');
  });

  it('exposes parent-visible assurances to any org member', async () => {
    const { org } = await createOrgAdmin('api4');
    const parent = await prisma.user.create({ data: { name: 'P', email: 'p@api4.com', password: await hashPassword('x123456'), role: 'parent', org_id: org.id } });
    const pToken = generateToken({ userId: parent.id, email: parent.email, role: 'parent', orgId: org.id });
    const res = await request(app).get('/api/safety/assurance').set('Authorization', `Bearer ${pToken}`);
    expect(res.status).toBe(200);
    expect(res.body.assurances.upload_scanning).toBe(true);
    expect(res.body.assurances.data_ownership).toBe(true);
    expect(typeof res.body.statement).toBe('string');
  });

  it('exports the org dataset as a JSON download and records the job', async () => {
    const { org, token } = await createOrgAdmin('api5');
    await prisma.class.create({ data: { name: 'C1', section: 'A', academic_year: '2026', org_id: org.id } });

    const res = await request(app).post('/api/safety/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=".*export.*\.json"/);
    const bundle = JSON.parse(res.text);
    expect(bundle.organization.id).toBe(org.id);
    expect(bundle.counts.classes).toBe(1);
    // No password hashes leak in the user records.
    expect(JSON.stringify(bundle.data.users)).not.toMatch(/password/);

    const jobs = await request(app).get('/api/safety/exports').set('Authorization', `Bearer ${token}`);
    expect(jobs.body.exports).toHaveLength(1);
    expect(jobs.body.exports[0].record_count).toBeGreaterThanOrEqual(1);
  });
});
