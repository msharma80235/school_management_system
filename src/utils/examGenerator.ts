// Generates gradable exam questions from extracted document text.
// Rule-based: works for English and Devanagari content without external APIs.
// The generated paper contains only questions — never the source text itself.

export interface GeneratedQuestion {
  order: number;
  question_type: 'mcq' | 'fill_blank' | 'true_false' | 'short_note' | 'long_answer';
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  marks: number;
}

const STOPWORDS = new Set([
  // English
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'has', 'was', 'were', 'are', 'is', 'for', 'not',
  'but', 'his', 'her', 'they', 'them', 'their', 'you', 'your', 'what', 'when', 'then', 'than', 'will',
  'would', 'there', 'here', 'been', 'being', 'into', 'over', 'under', 'about', 'also', 'very', 'more',
  // Hindi (common function words)
  'है', 'हैं', 'था', 'थी', 'थे', 'और', 'की', 'का', 'के', 'को', 'में', 'से', 'पर', 'यह', 'वह', 'तो',
  'ही', 'भी', 'ने', 'हो', 'कर', 'एक', 'कि', 'जो', 'उस', 'इस', 'अपने', 'लिए', 'गया', 'गई', 'रहा', 'रही',
  'नहीं', 'मैं', 'हम', 'तुम', 'आप', 'कोई', 'कुछ', 'सब', 'अब', 'तब', 'जब', 'क्या', 'हुआ', 'हुई', 'वाले',
]);

// Strip print artifacts, URLs, page furniture — the noise in real PDFs
function cleanLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 0 &&
      !/\.indd|reprint|https?:\/\/|www\.|\d{2}-\d{2}-\d{4}|\d{2}:\d{2}:\d{2}/i.test(l) &&
      !/^[\d\s.|•·–-]+$/.test(l) &&              // page numbers, dot leaders
      !/^\.{3,}/.test(l)
    );
}

// 'hi' when the text is predominantly Devanagari, else 'en'
export function detectLanguage(text: string): 'hi' | 'en' {
  const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return devanagari > latin ? 'hi' : 'en';
}

function scriptRatio(s: string, lang: 'hi' | 'en'): number {
  const target = lang === 'hi' ? (s.match(/[\u0900-\u097F]/g) || []).length : (s.match(/[A-Za-z]/g) || []).length;
  const letters = (s.match(/\p{L}/gu) || []).length;
  return letters === 0 ? 0 : target / letters;
}

function splitSentences(text: string, lang: 'hi' | 'en'): string[] {
  return text
    .split(/(?<=[.!?।])\s+|\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => {
      const words = s.split(' ');
      // keep only sentences written in the document's language
      return words.length >= 5 && words.length <= 30 && !/^\d/.test(s) && scriptRatio(s, lang) >= 0.8;
    });
}

function stripPunct(w: string): string {
  return w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

// Meaningful words: long enough, not stopwords, mostly letters
function contentWords(sentence: string, lang: 'hi' | 'en'): string[] {
  const scriptRe = lang === 'hi' ? /^[\u0900-\u097F]+$/ : /^[A-Za-z][A-Za-z'-]*$/;
  return sentence
    .split(/\s+/)
    .map(stripPunct)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()) && scriptRe.test(w));
}

// Replace the whole word only (substring replace corrupts words in scripts
// where \b boundaries don't apply, like Devanagari)
function blankToken(sentence: string, target: string, replacement: string): string {
  const parts = sentence.split(/(\s+)/);
  const idx = parts.findIndex((p) => stripPunct(p) === target);
  if (idx === -1) return sentence;
  parts[idx] = parts[idx].replace(target, replacement);
  return parts.join('');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Most frequent content words across the text — the document's key terms
function keyTerms(sentences: string[], count: number, lang: 'hi' | 'en'): string[] {
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of contentWords(s, lang)) {
      const key = w.toLowerCase();
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .filter(([w]) => w.length >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count * 3)
    .map(([w]) => w);
}

// Question prompts in the document's own language — a Hindi file produces a
// question paper written entirely in Hindi.
const PROMPTS = {
  en: {
    mcq: (s: string) => `Choose the correct word to complete the sentence:\n"${s}"`,
    fill: (s: string) => `Fill in the blank:\n"${s}"`,
    tf: (s: string) => `True or False:\n"${s}"`,
    tfOptions: ['True', 'False'],
  },
  hi: {
    mcq: (s: string) => `सही शब्द चुनकर वाक्य पूरा कीजिए:\n"${s}"`,
    fill: (s: string) => `रिक्त स्थान की पूर्ति कीजिए:\n"${s}"`,
    tf: (s: string) => `सही या गलत लिखिए:\n"${s}"`,
    tfOptions: ['सही', 'गलत'],
  },
};

// Objective quiz: MCQ cloze, fill-in-the-blank, and true/false — each with a
// stored correct answer so it can be graded consistently.
export function generateQuiz(text: string, count: number): GeneratedQuestion[] {
  const lang = detectLanguage(text);
  const p = PROMPTS[lang];
  const sentences = shuffle(splitSentences(cleanLines(text).join('\n'), lang));
  const wordPool = [...new Set(sentences.flatMap((s) => contentWords(s, lang)))];
  const questions: GeneratedQuestion[] = [];
  const usedWords = new Set<string>();

  for (const sentence of sentences) {
    if (questions.length >= count) break;
    const words = contentWords(sentence, lang).filter((w) => !usedWords.has(w.toLowerCase()));
    if (words.length === 0) continue;

    // blank the longest content word — usually the most meaningful one
    const target = words.sort((a, b) => b.length - a.length)[0];
    usedWords.add(target.toLowerCase());
    const blanked = blankToken(sentence, target, '__________');
    if (blanked === sentence) continue;

    const kind = questions.length % 3; // rotate mcq / fill_blank / true_false
    if (kind === 0) {
      const distractors = shuffle(
        wordPool.filter((w) => w.toLowerCase() !== target.toLowerCase() && Math.abs(w.length - target.length) <= 3)
      ).slice(0, 3);
      if (distractors.length < 3) continue;
      questions.push({
        order: questions.length + 1,
        question_type: 'mcq',
        question_text: p.mcq(blanked),
        options: shuffle([target, ...distractors]),
        correct_answer: target,
        marks: 1,
      });
    } else if (kind === 1) {
      questions.push({
        order: questions.length + 1,
        question_type: 'fill_blank',
        question_text: p.fill(blanked),
        options: null,
        correct_answer: target,
        marks: 1,
      });
    } else {
      const makeFalse = Math.random() < 0.5;
      const replacement = shuffle(wordPool.filter((w) => w.toLowerCase() !== target.toLowerCase()))[0];
      const statement = makeFalse && replacement ? blankToken(sentence, target, replacement) : sentence;
      questions.push({
        order: questions.length + 1,
        question_type: 'true_false',
        question_text: p.tf(statement),
        options: [...p.tfOptions],
        correct_answer: makeFalse && replacement ? p.tfOptions[1] : p.tfOptions[0],
        marks: 1,
      });
    }
  }

  return questions;
}

// Subjective test: open-ended questions built around the document's key terms
// and general comprehension — no sentences copied from the source.
export function generateSubjective(text: string, count: number): GeneratedQuestion[] {
  const lang = detectLanguage(text);
  const sentences = splitSentences(cleanLines(text).join('\n'), lang);
  const terms = shuffle([...new Set(keyTerms(sentences, count, lang))]);

  const termTemplates = lang === 'hi'
    ? [
        (t: string) => `"${t}" पर संक्षिप्त टिप्पणी लिखिए।`,
        (t: string) => `पाठ में "${t}" का क्या महत्व है? समझाइए।`,
        (t: string) => `पाठ में "${t}" के विषय में क्या बताया गया है? अपने शब्दों में लिखिए।`,
        (t: string) => `पाठ में "${t}" का प्रयोग कैसे हुआ है? उदाहरण सहित उत्तर दीजिए।`,
        (t: string) => `"${t}" शब्द का प्रयोग करते हुए अपने दो वाक्य बनाइए।`,
      ]
    : [
        (t: string) => `Write a short note on "${t}".`,
        (t: string) => `Explain the meaning and importance of "${t}" as discussed in the lesson.`,
        (t: string) => `Describe, in your own words, what the lesson tells us about "${t}".`,
        (t: string) => `How is "${t}" used or presented in the lesson? Answer with examples.`,
        (t: string) => `Frame two sentences of your own using the word "${t}".`,
      ];
  const generalQuestions = lang === 'hi'
    ? [
        'पाठ का मुख्य भाव अपने शब्दों में लिखिए।',
        'इस पाठ से हमें क्या शिक्षा मिलती है? कारण सहित लिखिए।',
        'पाठ का जो भाग आपको सबसे अच्छा लगा, उसके बारे में लिखिए और बताइए कि वह आपको क्यों पसंद आया।',
        'इस पाठ से आपने क्या सीखा? विस्तार से लिखिए।',
      ]
    : [
        'Summarize the main idea of the lesson in your own words.',
        'What message or moral does this lesson convey? Explain with reasons.',
        'Describe your favourite part of the lesson and explain why you chose it.',
        'What did you learn from this lesson? Write in detail.',
      ];

  const questions: GeneratedQuestion[] = [];
  const general = shuffle(generalQuestions);

  for (let i = 0; i < count; i++) {
    // lead with comprehension questions, then key-term questions
    if (i < Math.min(2, count) && general[i]) {
      questions.push({
        order: i + 1,
        question_type: 'long_answer',
        question_text: general[i],
        options: null,
        correct_answer: null,
        marks: 5,
      });
    } else {
      const term = terms[i - 2];
      if (!term) break;
      const template = termTemplates[i % termTemplates.length];
      questions.push({
        order: i + 1,
        question_type: 'short_note',
        question_text: template(term),
        options: null,
        correct_answer: null,
        marks: 5,
      });
    }
  }

  return questions;
}
