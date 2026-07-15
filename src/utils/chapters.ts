// Splits a book's extracted PDF text into chapters. Heuristic and offline —
// works for English and Hindi (Devanagari) headings. When no chapter headings
// are found (common in scanned or free-form PDFs), the text is divided into
// roughly equal "Part N" segments so the reader/quiz still has usable sections.

import { detectLanguage } from './examGenerator';

export interface Chapter {
  index: number;      // 1-based
  title: string;
  text: string;       // the chapter's body (kept server-side; endpoints choose what to expose)
  word_count: number;
  preview: string;    // first ~160 chars, for pickers
}

// A line that looks like a chapter/lesson/unit heading.
//   English:  "Chapter 3", "CHAPTER III", "Lesson 2 — ...", "Unit 4:", "3. Photosynthesis"
//   Hindi:    "अध्याय 3", "पाठ 2", "इकाई 4"
const HEADING_RE = new RegExp(
  '^(?:' +
    '(?:chapter|lesson|unit)\\s+(?:\\d{1,3}|[ivxlcIVXLC]{1,6})' +   // English keyword + number
    '|(?:अध्याय|पाठ|इकाई)\\s*[-–:]?\\s*\\d{1,3}' +                  // Hindi keyword + number
    '|\\d{1,2}\\.\\s+\\p{Lu}[\\p{L} ,\'-]{3,60}' +                   // "3. Photosynthesis"
  ')\\b',
  'iu'
);

const wordCount = (s: string) => (s.match(/\S+/g) || []).length;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// Print artifacts / page furniture that should never be treated as a heading.
function isNoise(line: string): boolean {
  return (
    line.length === 0 ||
    /\.indd|reprint|https?:\/\/|www\.|\d{2}-\d{2}-\d{4}|\d{2}:\d{2}:\d{2}/i.test(line) ||
    /^[\d\s.|•·–-]+$/.test(line)
  );
}

export function detectChapters(rawText: string): Chapter[] {
  const lines = rawText.split('\n');
  const heads: { line: number; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = clean(lines[i]);
    if (isNoise(line) || line.length > 80) continue;
    if (HEADING_RE.test(line)) heads.push({ line: i, title: line.slice(0, 80) });
  }

  // Need at least two real headings for a chapter split to be meaningful.
  if (heads.length >= 2) {
    const chapters: Chapter[] = [];
    for (let h = 0; h < heads.length; h++) {
      const from = heads[h].line;
      const to = h + 1 < heads.length ? heads[h + 1].line : lines.length;
      const body = clean(lines.slice(from, to).join('\n'));
      if (wordCount(body) < 40) continue; // skip a heading with almost no body (e.g. a table-of-contents line)
      chapters.push({
        index: chapters.length + 1,
        title: heads[h].title,
        text: body,
        word_count: wordCount(body),
        preview: body.slice(0, 160),
      });
    }
    if (chapters.length >= 2) return chapters;
  }

  // Fallback: no usable headings — split into equal parts sized to the book.
  return splitIntoParts(rawText);
}

function splitIntoParts(rawText: string): Chapter[] {
  const body = clean(rawText);
  const total = wordCount(body);
  if (total === 0) return [];
  const lang = detectLanguage(rawText);
  const label = lang === 'hi' ? 'भाग' : 'Part';

  const parts = Math.min(Math.max(Math.round(total / 700), 1), 12); // ~700 words/part, 1–12 parts
  if (parts === 1) {
    return [{ index: 1, title: lang === 'hi' ? 'पूरी पुस्तक' : 'Full text', text: body, word_count: total, preview: body.slice(0, 160) }];
  }
  const words = body.split(/\s+/);
  const per = Math.ceil(words.length / parts);
  const chapters: Chapter[] = [];
  for (let i = 0; i < parts; i++) {
    const seg = clean(words.slice(i * per, (i + 1) * per).join(' '));
    if (!seg) continue;
    chapters.push({
      index: chapters.length + 1,
      title: `${label} ${chapters.length + 1}`,
      text: seg,
      word_count: wordCount(seg),
      preview: seg.slice(0, 160),
    });
  }
  return chapters;
}

// Metadata-only view for list endpoints (no full text sent to the client).
export function chapterSummaries(chapters: Chapter[]) {
  return chapters.map((c) => ({ index: c.index, title: c.title, word_count: c.word_count, preview: c.preview }));
}
