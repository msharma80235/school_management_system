import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { loadBookChapters } from '../utils/bookReader';
import { chapterSummaries } from '../utils/chapters';
import { explainText } from '../utils/explain';

// Books a student can read: approved books in their org that have an uploaded
// file. Books tied to the student's own class are surfaced first.
export async function listReadableBooks(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const student = await prisma.student.findFirst({ where: { user_id: req.user!.userId }, select: { class_id: true } });

    const books = await prisma.book.findMany({
      where: { org_id: orgId, approval_status: 'approved', file_path: { not: null } },
      select: { id: true, title: true, author: true, class_id: true, subject: { select: { name: true } } },
      orderBy: { title: 'asc' },
    });

    const shaped = books
      .map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        subject: b.subject?.name || null,
        for_my_class: !!(student?.class_id && b.class_id === student.class_id),
      }))
      .sort((a, b) => Number(b.for_my_class) - Number(a.for_my_class) || a.title.localeCompare(b.title));

    res.json({ books: shaped });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Only approved books are readable by students.
async function assertReadable(bookId: string, orgId: string | undefined): Promise<boolean> {
  const book = await prisma.book.findFirst({ where: { id: bookId, org_id: orgId, approval_status: 'approved' }, select: { id: true } });
  return !!book;
}

export async function getBookChapters(req: Request, res: Response): Promise<void> {
  try {
    const bookId = req.params.id as string;
    if (!(await assertReadable(bookId, req.user!.orgId))) { res.status(404).json({ error: 'Book not found' }); return; }

    const result = await loadBookChapters(bookId, req.user!.orgId);
    if ('error' in result) { res.status(result.status).json({ error: result.error }); return; }

    res.json({ book: result.book, chapters: chapterSummaries(result.chapters) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read the book' });
  }
}

// A single chapter: the readable text (for the read-aloud voice) plus a
// plain-language explanation (local AI when configured, else rule-based).
export async function getChapter(req: Request, res: Response): Promise<void> {
  try {
    const bookId = req.params.id as string;
    const index = parseInt(req.params.index);
    if (!(await assertReadable(bookId, req.user!.orgId))) { res.status(404).json({ error: 'Book not found' }); return; }

    const result = await loadBookChapters(bookId, req.user!.orgId);
    if ('error' in result) { res.status(result.status).json({ error: result.error }); return; }

    const chapter = result.chapters.find((c) => c.index === index);
    if (!chapter) { res.status(404).json({ error: 'Chapter not found' }); return; }

    const explanation = await explainText(chapter.text);

    res.json({
      book: result.book,
      chapter: { index: chapter.index, title: chapter.title, word_count: chapter.word_count },
      text: chapter.text,
      explanation,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read the chapter' });
  }
}
