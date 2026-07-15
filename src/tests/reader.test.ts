import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { generateToken } from '../utils/jwt';
import { hashPassword } from '../utils/password';
import { detectChapters } from '../utils/chapters';
import { summarize, explainText } from '../utils/explain';
import { createOrgAdmin, cleanDatabase } from './helpers';

// pdfjs-dist ships as ESM using `import.meta`, which ts-jest's CommonJS
// transpile can't run — so under jest we mock the PDF text extractor and feed
// it a known book. (The real extractor is exercised at runtime via tsx.)
const CH1 = [
  'Chapter 1',
  'Photosynthesis is the process by which green plants prepare their own food using sunlight.',
  'The green pigment called chlorophyll absorbs light energy from the bright morning sun.',
  'Plants take carbon dioxide from the surrounding air through tiny pores called stomata.',
  'Water travels upward from the roots into the leaves through very narrow tubes.',
  'During this process the plants release oxygen which humans and animals need to breathe.',
  'Photosynthesis mainly happens inside the green leaves during the bright daytime hours.',
];
const CH2 = [
  'Chapter 2',
  'The water cycle describes how water moves around our whole planet every single day.',
  'Heat from the sun causes water in the oceans and rivers to evaporate into vapour.',
  'The rising vapour cools down high in the sky and forms tiny floating droplets.',
  'These droplets join together into clouds that slowly drift across the wide open sky.',
  'When the clouds become heavy the water falls back to earth as rain or snow.',
  'Rivers carry the fallen water back towards the sea and the cycle begins again.',
];

jest.mock('../utils/pdfText', () => ({
  extractPdfText: jest.fn(async () => ({
    text: [
      'Chapter 1',
      'Photosynthesis is the process by which green plants prepare their own food using sunlight.',
      'The green pigment called chlorophyll absorbs light energy from the bright morning sun.',
      'Plants take carbon dioxide from the surrounding air through tiny pores called stomata.',
      'Water travels upward from the roots into the leaves through very narrow tubes.',
      'During this process the plants release oxygen which humans and animals need to breathe.',
      'Photosynthesis mainly happens inside the green leaves during the bright daytime hours.',
      'Chapter 2',
      'The water cycle describes how water moves around our whole planet every single day.',
      'Heat from the sun causes water in the oceans and rivers to evaporate into vapour.',
      'The rising vapour cools down high in the sky and forms tiny floating droplets.',
      'These droplets join together into clouds that slowly drift across the wide open sky.',
      'When the clouds become heavy the water falls back to earth as rain or snow.',
      'Rivers carry the fallen water back towards the sea and the cycle begins again.',
    ].join('\n'),
    pages: 1,
  })),
}));

const uploadsDir = path.resolve('uploads');

// The extractor is mocked, so the on-disk file just has to EXIST for the
// fs.existsSync guard in loadBookChapters — its bytes are never parsed.
function makeBookPdf(name: string): string {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, name), '%PDF-1.4 stub');
  return name;
}

async function makeBook(orgId: string, classId?: string): Promise<string> {
  const fileName = await makeBookPdf(`book-${Date.now()}.pdf`);
  const book = await prisma.book.create({
    data: { title: 'Science Reader', author: 'A. Teacher', total_copies: 1, file_path: fileName, approval_status: 'approved', class_id: classId || null, org_id: orgId },
  });
  return book.id;
}

async function makeStudent(orgId: string, classId: string) {
  const user = await prisma.user.create({ data: { name: 'Stu', email: `stu-${Date.now()}@t.com`, password: await hashPassword('x123456'), role: 'student', org_id: orgId } });
  await prisma.student.create({ data: { first_name: 'Stu', last_name: 'D', roll_number: `R${Date.now()}`, date_of_birth: '2014-01-01', gender: 'male', class_id: classId, parent_name: 'P', parent_phone: '0', org_id: orgId, user_id: user.id } });
  return generateToken({ userId: user.id, email: user.email, role: 'student', orgId });
}

// A CHAT_AGENT_CMD may be configured in the developer's .env; unset it so the
// default explanation path is deterministically rule-based. Individual tests
// opt back in by pointing it at a fixture.
const AGENT_FIXTURE = path.resolve(__dirname, 'fixtures/fake-explain-agent.js');
const UNSAFE_FIXTURE = path.resolve(__dirname, 'fixtures/fake-explain-unsafe.js');
let savedAgentCmd: string | undefined;

beforeEach(async () => { savedAgentCmd = process.env.CHAT_AGENT_CMD; delete process.env.CHAT_AGENT_CMD; await cleanDatabase(); });
afterEach(() => { if (savedAgentCmd === undefined) delete process.env.CHAT_AGENT_CMD; else process.env.CHAT_AGENT_CMD = savedAgentCmd; });
afterAll(async () => { await cleanDatabase(); await prisma.$disconnect(); });

// ── Unit: chapter detection + summary ────────────────────────────────────────
describe('chapter detection', () => {
  it('splits text into chapters on headings', () => {
    const chapters = detectChapters([...CH1, ...CH2].join('\n'));
    expect(chapters.length).toBe(2);
    expect(chapters[0].title).toMatch(/Chapter 1/i);
    expect(chapters[1].title).toMatch(/Chapter 2/i);
    expect(chapters[0].word_count).toBeGreaterThan(40);
  });

  it('falls back to equal parts when no headings exist', () => {
    const words = Array.from({ length: 1600 }, (_, i) => `word${i % 50}`).join(' ');
    const chapters = detectChapters(words);
    expect(chapters.length).toBeGreaterThan(1);
    expect(chapters[0].title).toMatch(/Part 1/);
  });

  it('summarize returns a rule-based explanation', () => {
    const ex = summarize(CH1.join(' '));
    expect(ex.source).toBe('rule_based');
    expect(ex.summary.length).toBeGreaterThan(0);
    expect(ex.key_terms).toContain('photosynthesis');
  });

  it('explainText uses the local AI when configured', async () => {
    process.env.CHAT_AGENT_CMD = `node ${AGENT_FIXTURE}`;
    const ex = await explainText(CH1.join(' '));
    expect(ex.source).toBe('ai');
    expect(ex.summary).toMatch(/photosynthesis/i);
  });

  it('discards an AI explanation that fails the kid-safety scan', async () => {
    process.env.CHAT_AGENT_CMD = `node ${UNSAFE_FIXTURE}`;
    const ex = await explainText(CH1.join(' '));
    expect(ex.source).toBe('rule_based'); // flagged reply thrown away, fell back
  });
});

// ── Staff: chapter-wise quiz from a library book ─────────────────────────────
describe('chapter-wise quiz (staff)', () => {
  it('lists a book\'s chapters and generates a quiz from one chapter', async () => {
    const { org, token } = await createOrgAdmin('cq1');
    const bookId = await makeBook(org.id);

    const chaptersRes = await request(app).get(`/api/exams/book-chapters?book_id=${bookId}`).set('Authorization', `Bearer ${token}`);
    expect(chaptersRes.status).toBe(200);
    expect(chaptersRes.body.chapters.length).toBe(2);
    // metadata only — no full text leaks to the client
    expect(chaptersRes.body.chapters[0]).not.toHaveProperty('text');

    const gen = await request(app).post('/api/exams/generate-from-book').set('Authorization', `Bearer ${token}`)
      .send({ book_id: bookId, chapter_index: 1, format: 'quiz', count: 5 });
    expect(gen.status).toBe(200);
    expect(gen.body.questions.length).toBeGreaterThanOrEqual(3);
    expect(gen.body.chapter.index).toBe(1);
    expect(gen.body.source_book).toBe('Science Reader');
  });

  it('404s an unknown book and 404s an out-of-range chapter', async () => {
    const { org, token } = await createOrgAdmin('cq2');
    const bookId = await makeBook(org.id);
    const missing = await request(app).get('/api/exams/book-chapters?book_id=nope').set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    const badChapter = await request(app).post('/api/exams/generate-from-book').set('Authorization', `Bearer ${token}`)
      .send({ book_id: bookId, chapter_index: 99, format: 'quiz' });
    expect(badChapter.status).toBe(404);
  });
});

// ── Student: read & explain ──────────────────────────────────────────────────
describe('student reader', () => {
  it('lists readable books, surfaces class books first, reads a chapter with explanation', async () => {
    const { org } = await createOrgAdmin('rd1');
    const cls = await prisma.class.create({ data: { name: 'C', section: 'A', academic_year: '2026', org_id: org.id } });
    const bookId = await makeBook(org.id, cls.id);
    const stuToken = await makeStudent(org.id, cls.id);

    const books = await request(app).get('/api/reader/books').set('Authorization', `Bearer ${stuToken}`);
    expect(books.status).toBe(200);
    expect(books.body.books).toHaveLength(1);
    expect(books.body.books[0].for_my_class).toBe(true);

    const chapters = await request(app).get(`/api/reader/books/${bookId}/chapters`).set('Authorization', `Bearer ${stuToken}`);
    expect(chapters.status).toBe(200);
    expect(chapters.body.chapters.length).toBe(2);

    const chapter = await request(app).get(`/api/reader/books/${bookId}/chapters/1`).set('Authorization', `Bearer ${stuToken}`);
    expect(chapter.status).toBe(200);
    expect(chapter.body.text).toMatch(/Photosynthesis/i);
    expect(chapter.body.explanation.summary.length).toBeGreaterThan(0);
    expect(chapter.body.explanation.source).toBe('rule_based'); // no AI configured in tests
  });

  it('does not list unapproved books and blocks reading them', async () => {
    const { org } = await createOrgAdmin('rd2');
    const cls = await prisma.class.create({ data: { name: 'C', section: 'A', academic_year: '2026', org_id: org.id } });
    const fileName = await makeBookPdf(`pending-${Date.now()}.pdf`);
    const pending = await prisma.book.create({ data: { title: 'Pending', author: 'X', total_copies: 1, file_path: fileName, approval_status: 'pending', org_id: org.id } });
    const stuToken = await makeStudent(org.id, cls.id);

    const books = await request(app).get('/api/reader/books').set('Authorization', `Bearer ${stuToken}`);
    expect(books.body.books).toHaveLength(0);
    const blocked = await request(app).get(`/api/reader/books/${pending.id}/chapters`).set('Authorization', `Bearer ${stuToken}`);
    expect(blocked.status).toBe(404);
  });

  it('forbids non-students from the reader and students from the staff generator', async () => {
    const { org, token } = await createOrgAdmin('rd3');
    const cls = await prisma.class.create({ data: { name: 'C', section: 'A', academic_year: '2026', org_id: org.id } });
    const stuToken = await makeStudent(org.id, cls.id);

    const adminOnReader = await request(app).get('/api/reader/books').set('Authorization', `Bearer ${token}`);
    expect(adminOnReader.status).toBe(403);
    const studentOnGen = await request(app).post('/api/exams/generate-from-book').set('Authorization', `Bearer ${stuToken}`).send({ book_id: 'x', format: 'quiz' });
    expect(studentOnGen.status).toBe(403);
  });
});
