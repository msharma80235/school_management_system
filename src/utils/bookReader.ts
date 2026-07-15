// Shared helper: load a library book's PDF, extract its text, and split it into
// chapters. Used by both the staff chapter-quiz flow and the student reader.

import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client';
import { extractPdfText } from './pdfText';
import { detectChapters, Chapter } from './chapters';

export type BookChapters =
  | { book: { id: string; title: string; author: string }; chapters: Chapter[] }
  | { error: string; status: number };

export async function loadBookChapters(bookId: string, orgId: string | undefined): Promise<BookChapters> {
  const book = await prisma.book.findFirst({ where: { id: bookId, org_id: orgId } });
  if (!book) return { error: 'Book not found', status: 404 };
  if (!book.file_path) return { error: 'This book has no uploaded file to read from', status: 400 };

  const full = path.resolve('uploads', path.basename(book.file_path));
  if (!fs.existsSync(full)) return { error: 'The book file is missing from storage', status: 404 };

  let text = '';
  try {
    const parsed = await extractPdfText(fs.readFileSync(full));
    text = parsed.text || '';
  } catch { /* handled by the length check below */ }
  if (text.trim().length < 100) return { error: 'Not enough readable text in this book (scanned copies are not supported)', status: 422 };

  return { book: { id: book.id, title: book.title, author: book.author }, chapters: detectChapters(text) };
}
