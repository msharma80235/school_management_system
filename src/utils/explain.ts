// Produces a plain-language explanation of a chapter's text so a learner can
// listen and understand it. Two tiers, same discipline as the help chat:
//   1. If CHAT_AGENT_CMD is configured, ask the LOCAL AI to explain simply.
//      Its reply is kid-safety-scanned; a flagged reply is discarded.
//   2. Otherwise (or on any failure) fall back to a rule-based extractive
//      summary — top sentences + key points + key terms. No external services.

import { execFile } from 'child_process';
import { detectLanguage } from './examGenerator';
import { scanText } from './contentSafety';

export interface Explanation {
  summary: string;       // a few sentences a TTS voice can read
  key_points: string[];  // short bullets
  key_terms: string[];   // the chapter's important words
  source: 'ai' | 'rule_based';
  language: 'hi' | 'en';
}

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'was', 'were', 'are', 'is', 'for', 'not',
  'but', 'his', 'her', 'they', 'them', 'their', 'you', 'your', 'what', 'when', 'then', 'than', 'will', 'can',
  'would', 'there', 'here', 'been', 'being', 'into', 'over', 'under', 'about', 'also', 'very', 'more', 'such',
  'है', 'हैं', 'था', 'थी', 'थे', 'और', 'की', 'का', 'के', 'को', 'में', 'से', 'पर', 'यह', 'वह', 'तो',
  'ही', 'भी', 'ने', 'हो', 'कर', 'एक', 'कि', 'जो', 'उस', 'इस', 'अपने', 'लिए', 'गया', 'गई', 'रहा', 'रही',
]);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?।])\s+/)
    .map(clean)
    .filter((s) => {
      const words = s.split(' ').length;
      return words >= 4 && words <= 40 && !/\.indd|reprint|https?:\/\//i.test(s);
    });
}

function contentWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// Extractive summary: rank sentences by summed term frequency, keep the top few
// in their original order so the summary still reads coherently.
export function summarize(text: string, maxSentences = 4): Explanation {
  const language = detectLanguage(text);
  const sentences = splitSentences(text);

  const freq = new Map<string, number>();
  for (const s of sentences) for (const w of contentWords(s)) freq.set(w, (freq.get(w) || 0) + 1);

  const key_terms = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);

  const scored = sentences.map((s, i) => {
    const words = contentWords(s);
    const score = words.reduce((sum, w) => sum + (freq.get(w) || 0), 0) / (words.length || 1);
    return { s, i, score };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, maxSentences).sort((a, b) => a.i - b.i);

  const summary = top.map((t) => t.s).join(' ');
  const key_points = top.map((t) => t.s);

  return { summary: summary || clean(text).slice(0, 300), key_points, key_terms, source: 'rule_based', language };
}

const EXPLAIN_GROUNDING =
  'You are a friendly teacher for school students. Explain the following lesson text in simple, clear ' +
  'language a child can understand. Give a short summary of a few sentences, then a few key points. ' +
  'Do not add anything not supported by the text. Keep it appropriate for kids. Lesson text: ';

// Ask the optional local AI to explain. Same contract as CHAT_AGENT_CMD elsewhere:
// run without a shell, text appended as the final arg, plain-text answer on stdout.
function askLocalAi(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmdline = (process.env.CHAT_AGENT_CMD || '').trim();
    if (!cmdline) { reject(new Error('not configured')); return; }
    const [cmd, ...args] = cmdline.split(/\s+/);
    const timeout = parseInt(process.env.CHAT_AGENT_TIMEOUT_MS || '', 10) || 30000;
    execFile(cmd, [...args, EXPLAIN_GROUNDING + text.slice(0, 6000)], { timeout, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) { reject(err); return; }
      const answer = String(stdout).trim();
      if (!answer) { reject(new Error('empty')); return; }
      resolve(answer.slice(0, 4000));
    });
  });
}

// Explain a chapter: local AI when available (safety-scanned), else rule-based.
export async function explainText(text: string): Promise<Explanation> {
  const fallback = summarize(text);
  if (!(process.env.CHAT_AGENT_CMD || '').trim()) return fallback;
  try {
    const aiRaw = await askLocalAi(text);
    // Kid-safety gate on the AI's own words; a flagged reply is discarded.
    if (scanText(aiRaw).status === 'flagged') return fallback;
    // Split the AI reply into a lead summary + remaining bullet points.
    const paras = aiRaw.split(/\n+/).map(clean).filter(Boolean);
    const summary = paras[0] || aiRaw;
    const key_points = paras.slice(1, 6).map((p) => p.replace(/^[-*•\d.)\s]+/, '')).filter(Boolean);
    return { summary, key_points: key_points.length ? key_points : fallback.key_points, key_terms: fallback.key_terms, source: 'ai', language: fallback.language };
  } catch {
    return fallback;
  }
}
