import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

// Pluggable image content-safety analysis, same adapter discipline as the AI
// chat (CHAT_AGENT_CMD) and SMS (SMS_CMD). Rules can't read pictures, so images
// are queued for manual review by default. An operator opts in to automatic
// analysis by pointing IMAGE_SCAN_CMD at any LOCAL model/classifier:
//
//   IMAGE_SCAN_CMD=python3 /path/to/nsfw_classify.py
//   IMAGE_SCAN_TIMEOUT_MS=30000   # optional, default 30s
//
// Run WITHOUT a shell; the absolute image path is appended as the final arg.
// The command must print ONE line to stdout — the verdict:
//   "clean"                     -> safe
//   "flagged: <label> [score]"  -> block/flag (e.g. "flagged: nudity 0.98")
//   "review: <label>"           -> needs a human
// Anything unrecognized (or a non-zero exit) falls back to manual review, so a
// broken classifier never auto-approves an image. Config lives in .env.

export type ImageStatus = 'clean' | 'flagged' | 'review';
export interface ImageVerdict {
  status: ImageStatus;
  label?: string;
  note: string;
  analyzed: boolean; // true only when a configured model actually ran
}

export function imageScanConfigured(): boolean {
  return !!(process.env.IMAGE_SCAN_CMD || '').trim();
}

const manual = (kind: string): ImageVerdict => ({
  status: 'review',
  analyzed: false,
  note: `${kind} is an image — no image classifier is configured, please review it manually`,
});

// Analyze an image at an absolute path. Falls back to a manual-review verdict
// when unconfigured, the file is missing, or the classifier errors/misbehaves.
export function scanImage(absPath: string, kind = 'This file'): Promise<ImageVerdict> {
  return new Promise((resolve) => {
    const cmdline = (process.env.IMAGE_SCAN_CMD || '').trim();
    if (!cmdline) { resolve(manual(kind)); return; }
    if (!absPath || !fs.existsSync(absPath)) { resolve(manual(kind)); return; }

    const [cmd, ...args] = cmdline.split(/\s+/);
    const timeout = parseInt(process.env.IMAGE_SCAN_TIMEOUT_MS || '', 10) || 30000;
    execFile(cmd, [...args, path.resolve(absPath)], { timeout, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) {
        console.error('image scan error:', (err as Error).message);
        resolve({ ...manual(kind), note: `${kind} could not be analyzed (classifier error) — please review it manually` });
        return;
      }
      const line = String(stdout || '').trim().split('\n')[0].trim();
      const lower = line.toLowerCase();
      if (lower === 'clean') { resolve({ status: 'clean', analyzed: true, note: `${kind} was analyzed and looks appropriate` }); return; }
      const m = line.match(/^(flagged|review)\s*[:\-]?\s*(.*)$/i);
      if (m) {
        const status = m[1].toLowerCase() as ImageStatus;
        const label = m[2].trim() || undefined;
        resolve({
          status,
          label,
          analyzed: true,
          note: status === 'flagged'
            ? `${kind} was flagged by the image classifier${label ? ` (${label})` : ''}`
            : `${kind} needs review${label ? ` (${label})` : ''}`,
        });
        return;
      }
      // Unrecognized output — be conservative.
      resolve({ ...manual(kind), note: `${kind} returned an unrecognized verdict — please review it manually` });
    });
  });
}
