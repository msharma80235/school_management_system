import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { audit } from '../utils/audit';
import { avConfigured } from '../utils/malwareScan';
import { imageScanConfigured } from '../utils/imageScan';

const CATEGORIES = ['adult', 'profanity', 'violence', 'substances'];

// ── Per-org safety settings ──────────────────────────────────────────────────

function shapeSetting(row: any) {
  return {
    extra_terms: row?.extra_terms ? safeJson(row.extra_terms, []) : [],
    muted_categories: row?.muted_categories ? safeJson(row.muted_categories, []) : [],
    block_review_uploads: !!row?.block_review_uploads,
    updated_at: row?.updated_at || null,
  };
}

function safeJson(raw: string, fallback: any) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const row = await prisma.safetySetting.findUnique({ where: { org_id: req.user!.orgId } });
    res.json({
      settings: shapeSetting(row),
      categories: CATEGORIES,
      adapters: { malware: avConfigured(), image: imageScanConfigured() },
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Validate + normalize an incoming extra_terms array.
function cleanTerms(input: unknown): { term: string; category: string; severity: 'flagged' | 'review' }[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: { term: string; category: string; severity: 'flagged' | 'review' }[] = [];
  for (const t of input) {
    const term = String((t as any)?.term || '').trim().toLowerCase();
    if (!term || term.length > 60 || seen.has(term)) continue;
    seen.add(term);
    out.push({
      term,
      category: String((t as any)?.category || 'custom').trim().slice(0, 30) || 'custom',
      severity: (t as any)?.severity === 'review' ? 'review' : 'flagged',
    });
    if (out.length >= 200) break;
  }
  return out;
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const extra = cleanTerms(req.body.extra_terms);
    const muted = Array.isArray(req.body.muted_categories)
      ? [...new Set(req.body.muted_categories.map((c: unknown) => String(c)).filter((c: string) => CATEGORIES.includes(c)))]
      : [];
    const blockReview = !!req.body.block_review_uploads;

    const data = {
      extra_terms: JSON.stringify(extra),
      muted_categories: JSON.stringify(muted),
      block_review_uploads: blockReview,
      updated_by: req.user!.userId,
    };
    const row = await prisma.safetySetting.upsert({
      where: { org_id: orgId }, update: data, create: { org_id: orgId, ...data },
    });
    await audit(req, 'safety.settings_updated', {
      summary: `Updated content-safety settings (${extra.length} custom terms, ${muted.length} muted, review-block ${blockReview ? 'on' : 'off'})`,
    });
    res.json({ message: 'Safety settings saved', settings: shapeSetting(row) });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Safety audit report ──────────────────────────────────────────────────────

export async function getReport(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const [results, exports, safetyEvents, setting] = await Promise.all([
      prisma.contentScanResult.findMany({ where: { org_id: orgId } }),
      prisma.dataExport.findMany({ where: { org_id: orgId }, orderBy: { created_at: 'desc' }, take: 5 }),
      prisma.auditLog.findMany({
        where: { org_id: orgId, action: { startsWith: 'safety.' } },
        orderBy: { created_at: 'desc' }, take: 10,
      }),
      prisma.safetySetting.findUnique({ where: { org_id: orgId } }),
    ]);

    const scan = {
      total: results.length,
      flagged: results.filter((r) => r.status === 'flagged').length,
      review: results.filter((r) => r.status === 'review').length,
      clean: results.filter((r) => r.status === 'clean').length,
      unresolved: results.filter((r) => r.status !== 'clean' && !r.resolution).length,
      malware_detected: results.filter((r) => r.av_status === 'infected').length,
      last_scanned: results.reduce<string | null>((max, r) => {
        const t = r.scanned_at.toISOString();
        return !max || t > max ? t : max;
      }, null),
    };

    res.json({
      scan,
      settings: shapeSetting(setting),
      adapters: {
        malware: avConfigured(),
        image: imageScanConfigured(),
      },
      recent_exports: exports.map((e) => ({ id: e.id, scope: e.scope, record_count: e.record_count, byte_size: e.byte_size, created_at: e.created_at })),
      recent_events: safetyEvents.map((e) => ({ action: e.action, summary: e.summary, actor_role: e.actor_role, at: e.created_at })),
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Lightweight, parent-visible safety assurances — no counts of specific
// flagged items, just the posture (what protections are on). Any org member.
export async function getAssurance(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const [setting, lastScan] = await Promise.all([
      prisma.safetySetting.findUnique({ where: { org_id: orgId } }),
      prisma.contentScanResult.findFirst({ where: { org_id: orgId }, orderBy: { scanned_at: 'desc' } }),
    ]);
    res.json({
      assurances: {
        upload_scanning: true,
        malware_scanning: avConfigured(),
        image_analysis: imageScanConfigured(),
        custom_wordlist: !!(setting?.extra_terms && setting.extra_terms !== '[]'),
        strict_uploads: !!setting?.block_review_uploads,
        data_ownership: true,
        last_content_review: lastScan?.scanned_at || null,
      },
      statement: 'Uploads are scanned for inappropriate content before they are saved, and this school owns and can export all of its data at any time.',
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Self-serve data export / backup ──────────────────────────────────────────

// Build a JSON bundle of the org's data (the data-ownership proof point). User
// passwords are never included. Records a DataExport row for the audit trail.
export async function runExport(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }

    const [users, classes, students, subjects, exams, marks, attendance, homework, books, documents, admissions, bookLoans] = await Promise.all([
      prisma.user.findMany({ where: { org_id: orgId }, select: { id: true, name: true, email: true, role: true, subject: true, phone: true, is_active: true, created_at: true } }),
      prisma.class.findMany({ where: { org_id: orgId } }),
      prisma.student.findMany({ where: { org_id: orgId } }),
      prisma.subject.findMany({ where: { org_id: orgId } }),
      prisma.exam.findMany({ where: { org_id: orgId }, include: { questions: true } }),
      prisma.mark.findMany({ where: { org_id: orgId } }),
      prisma.attendance.findMany({ where: { org_id: orgId } }),
      prisma.homework.findMany({ where: { org_id: orgId } }),
      prisma.book.findMany({ where: { org_id: orgId } }),
      prisma.schoolDocument.findMany({ where: { org_id: orgId } }),
      prisma.admission.findMany({ where: { org_id: orgId } }),
      prisma.bookLoan.findMany({ where: { org_id: orgId } }),
    ]);

    const collections: Record<string, any[]> = {
      users, classes, students, subjects, exams, marks, attendance, homework, books, documents, admissions, bookLoans,
    };
    const record_count = Object.values(collections).reduce((n, arr) => n + arr.length, 0);

    const bundle = {
      exported_at: new Date().toISOString(),
      organization: { id: org.id, name: org.name, slug: org.slug, email: org.email },
      counts: Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length])),
      data: collections,
    };
    const json = JSON.stringify(bundle, null, 2);
    const byte_size = Buffer.byteLength(json, 'utf8');

    await prisma.dataExport.create({ data: { org_id: orgId, requested_by: req.user!.userId, scope: 'full', record_count, byte_size } });
    await audit(req, 'safety.data_exported', { summary: `Exported ${record_count} records (${Math.round(byte_size / 1024)} KB)` });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${org.slug}-export-${stamp}.json"`);
    res.send(json);
  } catch (error) {
    console.error('data export error:', error);
    res.status(500).json({ error: 'Data export failed' });
  }
}

export async function listExports(req: Request, res: Response): Promise<void> {
  try {
    const exports = await prisma.dataExport.findMany({ where: { org_id: req.user!.orgId }, orderBy: { created_at: 'desc' }, take: 50 });
    res.json({ exports });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
