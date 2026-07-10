import prisma from '../prisma/client';
import { ScanConfig } from './contentSafety';

export interface OrgSafety {
  scan: ScanConfig;            // extra terms + muted categories for scanText
  blockReviewUploads: boolean; // reject 'review' uploads at the gate, not just 'flagged'
}

const DEFAULT: OrgSafety = { scan: {}, blockReviewUploads: false };

function parseJsonArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Load an org's SafetySetting and shape it into the runtime config the scanner
// and upload gate consume. Missing row or unset org -> built-in defaults.
export async function loadOrgSafety(orgId?: string | null): Promise<OrgSafety> {
  if (!orgId) return DEFAULT;
  const row = await prisma.safetySetting.findUnique({ where: { org_id: orgId } });
  if (!row) return DEFAULT;
  return {
    scan: {
      extraTerms: parseJsonArray(row.extra_terms)
        .filter((t) => t && typeof t.term === 'string' && t.term.trim())
        .map((t) => ({ term: String(t.term).trim(), category: String(t.category || 'custom'), severity: t.severity === 'review' ? 'review' : 'flagged' })),
      mutedCategories: parseJsonArray(row.muted_categories).map((c) => String(c)),
    },
    blockReviewUploads: !!row.block_review_uploads,
  };
}
