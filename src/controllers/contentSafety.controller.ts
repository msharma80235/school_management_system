import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { extractPdfText } from '../utils/pdfText';
import prisma from '../prisma/client';
import { scanText, imageOutcome, unscannableOutcome, ScanOutcome, ScanConfig } from '../utils/contentSafety';
import { scanImage } from '../utils/imageScan';
import { scanFileForMalware, AvStatus } from '../utils/malwareScan';
import { loadOrgSafety } from '../utils/safetyConfig';
import { audit } from '../utils/audit';

interface SourceItem {
  source_type: string;
  source_id: string;
  title: string;
  file_path: string | null;
  text: string;          // metadata text always scanned
}

async function extractFileText(fileName: string): Promise<{ text: string | null; kind: 'pdf' | 'image' | 'other' | 'missing' }> {
  const full = path.resolve('uploads', path.basename(fileName));
  if (!fs.existsSync(full)) return { text: null, kind: 'missing' };
  const ext = path.extname(full).toLowerCase();
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return { text: null, kind: 'image' };
  if (ext !== '.pdf') return { text: null, kind: 'other' };
  try {
    const parsed = await extractPdfText(fs.readFileSync(full));
    return { text: parsed.text || '', kind: 'pdf' };
  } catch {
    return { text: null, kind: 'other' };
  }
}

// Gather every uploaded/authored piece of content in the org
async function collectSources(orgId: string): Promise<SourceItem[]> {
  const [books, documents, exams, students, config] = await Promise.all([
    prisma.book.findMany({ where: { org_id: orgId } }),
    prisma.schoolDocument.findMany({ where: { org_id: orgId } }),
    prisma.exam.findMany({ where: { org_id: orgId }, include: { questions: true } }),
    prisma.student.findMany({ where: { org_id: orgId, photo_path: { not: null } } }),
    prisma.reportCardConfig.findUnique({ where: { org_id: orgId } }),
  ]);

  const items: SourceItem[] = [];

  for (const b of books) {
    items.push({
      source_type: 'book',
      source_id: b.id,
      title: `${b.title} — ${b.author}`,
      file_path: b.file_path,
      text: [b.title, b.author, b.publisher, b.custom_category].filter(Boolean).join(' '),
    });
  }

  for (const d of documents) {
    items.push({
      source_type: 'document',
      source_id: d.id,
      title: d.title,
      file_path: d.file_path,
      text: [d.title, d.description, d.category].filter(Boolean).join(' '),
    });
  }

  for (const e of exams) {
    if (e.question_paper_path) {
      items.push({
        source_type: 'exam_paper',
        source_id: e.id,
        title: `${e.name} (uploaded paper)`,
        file_path: e.question_paper_path,
        text: e.name,
      });
    }
    if (e.questions.length > 0) {
      const qText = e.questions
        .map((q) => [q.question_text, q.options || '', q.correct_answer || ''].join(' '))
        .join('\n');
      items.push({
        source_type: 'exam_questions',
        source_id: e.id,
        title: `${e.name} (${e.questions.length} generated questions)`,
        file_path: null,
        text: `${e.name}\n${qText}`,
      });
    }
  }

  for (const s of students) {
    items.push({
      source_type: 'student_photo',
      source_id: s.id,
      title: `Photo: ${s.first_name} ${s.last_name} (${s.roll_number})`,
      file_path: s.photo_path,
      text: '',
    });
  }

  if (config?.institute_logo) {
    items.push({
      source_type: 'org_logo',
      source_id: config.id,
      title: 'Organization logo (report cards)',
      file_path: config.institute_logo,
      text: '',
    });
  }

  return items;
}

interface ItemScan { outcome: ScanOutcome; av_status: AvStatus | null; }

async function scanItem(item: SourceItem, config: ScanConfig): Promise<ItemScan> {
  // Malware-scan the attached file first (no-op unless AV_SCAN_CMD is set).
  let av_status: AvStatus | null = null;
  if (item.file_path) {
    const abs = path.resolve('uploads', path.basename(item.file_path));
    if (fs.existsSync(abs)) {
      const res = await scanFileForMalware(abs);
      av_status = res.status;
      if (res.status === 'infected') {
        return { outcome: { status: 'flagged', categories: ['malware'], matches: [], note: `Malware detected (${res.signature || 'threat'})` }, av_status };
      }
    }
  }

  // Always scan the metadata text; a bad title alone should flag.
  const metaOutcome = scanText(item.text, config);
  if (!item.file_path) return { outcome: metaOutcome, av_status };

  const file = await extractFileText(item.file_path);
  if (file.kind === 'pdf' && file.text !== null) {
    return { outcome: scanText(`${item.text}\n${file.text}`, config), av_status };
  }
  if (metaOutcome.status === 'flagged') return { outcome: metaOutcome, av_status };
  if (file.kind === 'image') {
    const kind = item.source_type === 'student_photo' ? 'A student photo' : item.source_type === 'org_logo' ? 'The logo' : 'The attached file';
    // Runs the configured image classifier; falls back to manual-review when none is set.
    const v = await scanImage(path.resolve('uploads', path.basename(item.file_path)), kind);
    return { outcome: v.analyzed
      ? { status: v.status, categories: v.status === 'clean' ? [] : ['image'], matches: [], note: v.note }
      : imageOutcome(kind), av_status };
  }
  if (file.kind === 'other') return { outcome: unscannableOutcome(path.extname(item.file_path).replace('.', '') || 'this'), av_status };
  if (file.kind === 'missing') {
    return { outcome: { status: 'review', categories: [], matches: [], note: 'The referenced file is missing from storage' }, av_status };
  }
  return { outcome: metaOutcome, av_status };
}

// Run (or re-run) the full scan. Prior "marked safe" resolutions survive a
// re-scan so admins don't have to re-dismiss the same items every time.
export async function runScan(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const items = await collectSources(orgId);
    const safety = await loadOrgSafety(orgId);

    const previous = await prisma.contentScanResult.findMany({ where: { org_id: orgId } });
    const resolved = new Map(previous.filter((p) => p.resolution).map((p) => [`${p.source_type}:${p.source_id}`, p]));

    await prisma.contentScanResult.deleteMany({ where: { org_id: orgId } });

    let flagged = 0, review = 0, clean = 0;
    for (const item of items) {
      const { outcome, av_status } = await scanItem(item, safety.scan);
      if (outcome.status === 'flagged') flagged++;
      else if (outcome.status === 'review') review++;
      else clean++;

      const prior = resolved.get(`${item.source_type}:${item.source_id}`);
      await prisma.contentScanResult.create({
        data: {
          source_type: item.source_type,
          source_id: item.source_id,
          title: item.title,
          file_path: item.file_path,
          status: outcome.status,
          categories: outcome.categories.length ? JSON.stringify(outcome.categories) : null,
          matches: outcome.matches.length ? JSON.stringify(outcome.matches) : null,
          note: outcome.note,
          av_status,
          // keep the earlier human decision
          resolved_by: prior?.resolved_by || null,
          resolved_at: prior?.resolved_at || null,
          resolution: prior?.resolution || null,
          org_id: orgId,
        },
      });
    }

    res.json({
      message: `Scanned ${items.length} items`,
      summary: { total: items.length, flagged, review, clean },
    });
  } catch (error) {
    console.error('content scan error:', error);
    res.status(500).json({ error: 'Content scan failed' });
  }
}

export async function listResults(req: Request, res: Response): Promise<void> {
  try {
    const results = await prisma.contentScanResult.findMany({
      where: { org_id: req.user!.orgId },
      orderBy: [{ status: 'desc' }, { scanned_at: 'desc' }], // review > flagged > clean alphabetically — fix below
    });

    // Order: flagged first, then review, then clean; unresolved before resolved
    const rank: Record<string, number> = { flagged: 0, review: 1, clean: 2 };
    const sorted = results
      .map((r) => ({
        ...r,
        categories: r.categories ? JSON.parse(r.categories) : [],
        matches: r.matches ? JSON.parse(r.matches) : [],
      }))
      .sort((a, b) => (a.resolution ? 1 : 0) - (b.resolution ? 1 : 0) || rank[a.status] - rank[b.status]);

    const summary = {
      total: results.length,
      flagged: results.filter((r) => r.status === 'flagged').length,
      review: results.filter((r) => r.status === 'review').length,
      clean: results.filter((r) => r.status === 'clean').length,
      unresolved: results.filter((r) => r.status !== 'clean' && !r.resolution).length,
    };

    res.json({ results: sorted, summary });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Human decision: this item is fine for kids and students
export async function markSafe(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await prisma.contentScanResult.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!existing) { res.status(404).json({ error: 'Scan result not found' }); return; }

    const result = await prisma.contentScanResult.update({
      where: { id },
      data: { resolution: 'marked_safe', resolved_by: req.user!.userId, resolved_at: new Date() },
    });
    await audit(req, 'content.mark_safe', {
      targetType: result.source_type, targetId: result.source_id,
      summary: `Marked "${result.title}" safe (was ${result.status})`,
    });
    res.json({ message: `"${result.title}" marked safe`, result });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
