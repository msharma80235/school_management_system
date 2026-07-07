// Upload-time safety gate. Runs the content-safety scanner BEFORE anything
// is saved: uploads flagged for adult content or profanity are rejected and
// the file is removed from disk — they never enter the system. Review-level
// matches (violence/substances, often legitimate in lessons) are allowed
// through and surface later on the admin's Content Safety page.

import fs from 'fs';
import path from 'path';
import { scanText } from './contentSafety';
import { extractPdfText } from './pdfText';

export interface UploadGate {
  ok: boolean;
  error?: string;
  categories?: string[];
  terms?: string[];
}

function removeUpload(fileName: string) {
  fs.unlink(path.resolve('uploads', path.basename(fileName)), () => {});
}

// Scan metadata text plus (when it's a PDF) the file's extracted text.
// If flagged, the stored file is deleted and a descriptive error returned.
export async function gateUpload(metadataText: string, uploadedFileName?: string | null): Promise<UploadGate> {
  let combined = metadataText || '';

  if (uploadedFileName && path.extname(uploadedFileName).toLowerCase() === '.pdf') {
    try {
      const full = path.resolve('uploads', path.basename(uploadedFileName));
      if (fs.existsSync(full)) {
        const parsed = await extractPdfText(fs.readFileSync(full));
        combined += `\n${parsed.text}`;
      }
    } catch {
      // unreadable PDFs pass the gate; the Content Safety page queues them for manual review
    }
  }

  const outcome = scanText(combined);
  if (outcome.status !== 'flagged') return { ok: true };

  if (uploadedFileName) removeUpload(uploadedFileName);

  const categories = [...new Set(outcome.matches.filter((m) => ['adult', 'profanity'].includes(m.category)).map((m) => m.category))];
  const terms = outcome.matches.filter((m) => categories.includes(m.category)).slice(0, 5).map((m) => m.term);

  return {
    ok: false,
    categories,
    terms,
    error: `Upload blocked: this content is inappropriate for kids and students (${categories.join(', ')} — e.g. ${terms.slice(0, 3).map((t) => `"${t}"`).join(', ')}). Remove that content and try again.`,
  };
}
