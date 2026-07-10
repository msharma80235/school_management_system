// Upload-time safety gate. Runs BEFORE anything is saved, in three layers:
//   1. Malware scan (pluggable AV_SCAN_CMD) — infected files are rejected.
//   2. Image analysis (pluggable IMAGE_SCAN_CMD) — a flagged picture is rejected.
//   3. Content-safety text scan (built-in wordlists + the org's custom terms) —
//      uploads flagged for adult content or profanity are rejected.
// Rejected files are removed from disk so they never enter the system. Review-
// level text matches (violence/substances, often legitimate in lessons) are
// allowed through and surface later on the Content Safety page — unless the org
// has opted to block review-level uploads too.

import fs from 'fs';
import path from 'path';
import { scanText } from './contentSafety';
import { extractPdfText } from './pdfText';
import { scanFileForMalware } from './malwareScan';
import { scanImage } from './imageScan';
import { loadOrgSafety } from './safetyConfig';

export interface UploadGate {
  ok: boolean;
  error?: string;
  categories?: string[];
  terms?: string[];
}

function removeUpload(fileName: string) {
  // Synchronous so a rejected upload is guaranteed gone before we respond.
  try { fs.unlinkSync(path.resolve('uploads', path.basename(fileName))); } catch { /* already absent */ }
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// Scan metadata text plus (when it's a PDF) the file's extracted text, and when
// a file is attached also malware-scan it and (for images) run the image
// classifier. If rejected, the stored file is deleted and a descriptive error
// returned. Pass orgId to apply that org's custom terms / thresholds.
export async function gateUpload(metadataText: string, uploadedFileName?: string | null, orgId?: string | null): Promise<UploadGate> {
  const safety = await loadOrgSafety(orgId);
  const absPath = uploadedFileName ? path.resolve('uploads', path.basename(uploadedFileName)) : null;
  const ext = uploadedFileName ? path.extname(uploadedFileName).toLowerCase() : '';

  // 1. Malware scan (no-op unless AV_SCAN_CMD is configured).
  if (absPath && fs.existsSync(absPath)) {
    const av = await scanFileForMalware(absPath);
    if (av.status === 'infected') {
      removeUpload(uploadedFileName!);
      return { ok: false, error: `Upload blocked: the file failed a malware scan (${av.signature || 'threat detected'}). It was not saved.` };
    }
  }

  // 2. Image analysis (no-op unless IMAGE_SCAN_CMD is configured; otherwise the
  //    picture is allowed through and queued for manual review on the safety page).
  if (absPath && fs.existsSync(absPath) && IMAGE_EXTS.includes(ext)) {
    const verdict = await scanImage(absPath, 'The image');
    if (verdict.status === 'flagged') {
      removeUpload(uploadedFileName!);
      return { ok: false, error: `Upload blocked: the image was flagged as inappropriate${verdict.label ? ` (${verdict.label})` : ''}. It was not saved.` };
    }
  }

  // 3. Text content scan (metadata + PDF body), tuned by the org's settings.
  let combined = metadataText || '';
  if (absPath && ext === '.pdf') {
    try {
      if (fs.existsSync(absPath)) {
        const parsed = await extractPdfText(fs.readFileSync(absPath));
        combined += `\n${parsed.text}`;
      }
    } catch {
      // unreadable PDFs pass the gate; the Content Safety page queues them for manual review
    }
  }

  const outcome = scanText(combined, safety.scan);
  const reject = outcome.status === 'flagged' || (safety.blockReviewUploads && outcome.status === 'review');
  if (!reject) return { ok: true };

  if (uploadedFileName) removeUpload(uploadedFileName);

  // On a flagged rejection, name the flagged-severity categories (built-in
  // adult/profanity, plus any org custom terms); on a review-block rejection,
  // name whatever review categories triggered it.
  const REVIEW_CATS = ['violence', 'substances'];
  const blockedCats = outcome.status === 'flagged'
    ? outcome.categories.filter((c) => !REVIEW_CATS.includes(c))
    : outcome.categories;
  const categories = [...new Set(outcome.matches.filter((m) => blockedCats.includes(m.category)).map((m) => m.category))];
  const terms = outcome.matches.filter((m) => categories.includes(m.category)).slice(0, 5).map((m) => m.term);

  return {
    ok: false,
    categories,
    terms,
    error: `Upload blocked: this content is inappropriate for kids and students (${categories.join(', ')}${terms.length ? ` — e.g. ${terms.slice(0, 3).map((t) => `"${t}"`).join(', ')}` : ''}). Remove that content and try again.`,
  };
}
