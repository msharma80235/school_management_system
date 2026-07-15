import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { extractPdfText } from '../utils/pdfText';
import PDFDocument from 'pdfkit';
import prisma from '../prisma/client';
import { canAccessClass } from '../utils/classAccess';
import { generateQuiz, generateSubjective, GeneratedQuestion } from '../utils/examGenerator';
import { scanText } from '../utils/contentSafety';
import { chapterSummaries } from '../utils/chapters';
import { loadBookChapters } from '../utils/bookReader';
import { notify } from '../utils/notify';

// On marks approval, tell the affected students and their parents. Runs after
// the response is sent, so a slow notify never delays the admin's action.
async function notifyMarksApproved(examId: string, examName: string, orgId: string | null | undefined): Promise<void> {
  const marks = await prisma.mark.findMany({ where: { exam_id: examId }, select: { student_id: true } });
  const studentIds = [...new Set(marks.map((m) => m.student_id))];
  if (studentIds.length === 0) return;

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, first_name: true, last_name: true, user_id: true, parent_links: { select: { parent_id: true } } },
  });

  await Promise.all(students.map(async (s) => {
    const childName = `${s.first_name} ${s.last_name}`.trim();
    // Notify the student (on their own account).
    if (s.user_id) {
      await notify({
        userId: s.user_id, orgId, category: 'marks',
        title: `Marks published: ${examName}`,
        body: `Your marks for "${examName}" have been approved and are now on your report card.`,
        link: '/student/dashboard',
      });
    }
    // Notify each linked parent.
    await Promise.all(s.parent_links.map((p) => notify({
      userId: p.parent_id, orgId, category: 'marks',
      title: `Marks published: ${examName}`,
      body: `${childName}'s marks for "${examName}" have been approved and are now on the report card.`,
      link: '/parent/dashboard',
    })));
  }));
}

export async function createExam(req: Request, res: Response): Promise<void> {
  try {
    const { name, exam_type, term, class_id, subject_id, max_marks, exam_date, question_paper_path, exam_format, questions, time_limit_min } = req.body;
    const orgId = req.user!.orgId;

    if (!name || !exam_type || !term || !class_id || !subject_id) {
      res.status(400).json({ error: 'All fields are required' }); return;
    }

    if (!(await canAccessClass(req.user!, class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    // With generated questions the total is the sum of question marks;
    // the exam contains only the questions, never the source document.
    const hasQuestions = Array.isArray(questions) && questions.length > 0;

    const examText = [name, ...(hasQuestions ? questions.map((q: GeneratedQuestion) => `${q.question_text} ${(q.options || []).join(' ')}`) : [])].join('\n');
    const gate = scanText(examText);
    if (gate.status === 'flagged') {
      res.status(400).json({ error: 'Blocked: the exam name or questions contain content inappropriate for kids and students.' });
      return;
    }

    const total = hasQuestions
      ? questions.reduce((sum: number, q: GeneratedQuestion) => sum + (q.marks || 1), 0)
      : parseInt(max_marks);
    if (!total || total <= 0) { res.status(400).json({ error: 'Max marks is required' }); return; }

    const exam = await prisma.exam.create({
      data: {
        name, exam_type, term, class_id, subject_id,
        max_marks: total,
        exam_date: exam_date || null,
        question_paper_path: hasQuestions ? null : (question_paper_path || null),
        exam_format: hasQuestions ? (exam_format || 'quiz') : null,
        time_limit_min: hasQuestions && exam_format === 'quiz' && time_limit_min ? parseInt(time_limit_min) : null,
        org_id: orgId,
        ...(hasQuestions && {
          questions: {
            create: questions.map((q: GeneratedQuestion, i: number) => ({
              order: q.order || i + 1,
              question_type: q.question_type,
              question_text: q.question_text,
              options: q.options ? JSON.stringify(q.options) : null,
              correct_answer: q.correct_answer || null,
              marks: q.marks || 1,
            })),
          },
        }),
      },
      include: {
        subject: { select: { name: true, code: true } },
        class: { select: { name: true, section: true } },
        _count: { select: { questions: true } },
      },
    });
    res.status(201).json({ message: hasQuestions ? `Exam created with ${exam._count.questions} questions` : 'Exam created', exam });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate a gradable question paper (quiz or subjective) from an uploaded file.
// Only the generated questions form the exam — the source text is not included.
export async function generateExamQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { file_path, format, count } = req.body;
    if (!file_path || !['quiz', 'subjective'].includes(format)) {
      res.status(400).json({ error: 'file_path and format (quiz | subjective) are required' });
      return;
    }

    const safeName = path.basename(String(file_path));
    const full = path.resolve('uploads', safeName);
    if (!fs.existsSync(full)) { res.status(404).json({ error: 'Uploaded file not found — read the file again' }); return; }

    let text = '';
    try {
      const parsed = await extractPdfText(fs.readFileSync(full));
      text = parsed.text || '';
    } catch { /* fall through to the empty-text error below */ }

    if (text.trim().length < 100) {
      res.status(422).json({ error: 'Not enough readable text in this file to generate questions (scanned copies are not supported)' });
      return;
    }

    const n = Math.min(Math.max(parseInt(count) || (format === 'quiz' ? 10 : 5), 3), 25);
    const questions = format === 'quiz' ? generateQuiz(text, n) : generateSubjective(text, n);

    if (questions.length < 3) {
      res.status(422).json({ error: 'Could not build enough questions from this file' });
      return;
    }

    res.json({
      format,
      questions,
      total_marks: questions.reduce((s, q) => s + q.marks, 0),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate questions' });
  }
}

// List the chapters detected in a library book, so a teacher can build a
// quiz from a specific chapter. Metadata only — no full text leaves the server.
export async function getBookChapters(req: Request, res: Response): Promise<void> {
  try {
    const bookId = String(req.query.book_id || '');
    if (!bookId) { res.status(400).json({ error: 'book_id is required' }); return; }

    const result = await loadBookChapters(bookId, req.user!.orgId);
    if ('error' in result) { res.status(result.status).json({ error: result.error }); return; }

    res.json({ book: result.book, chapters: chapterSummaries(result.chapters) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read the book' });
  }
}

// Generate a gradable quiz/subjective paper from ONE chapter of a library book.
// Returns the same shape as generateExamQuestions, so the existing review →
// create-exam flow consumes it unchanged. The source text never leaves the server.
export async function generateFromBook(req: Request, res: Response): Promise<void> {
  try {
    const { book_id, chapter_index, format, count } = req.body;
    if (!book_id || !['quiz', 'subjective'].includes(format)) {
      res.status(400).json({ error: 'book_id and format (quiz | subjective) are required' });
      return;
    }

    const result = await loadBookChapters(book_id, req.user!.orgId);
    if ('error' in result) { res.status(result.status).json({ error: result.error }); return; }

    const idx = parseInt(chapter_index);
    const chapter = result.chapters.find((c) => c.index === idx);
    if (!chapter) { res.status(404).json({ error: 'Chapter not found in this book' }); return; }
    if (chapter.text.trim().length < 100) {
      res.status(422).json({ error: 'Not enough readable text in this chapter to generate questions' });
      return;
    }

    const n = Math.min(Math.max(parseInt(count) || (format === 'quiz' ? 10 : 5), 3), 25);
    const questions = format === 'quiz' ? generateQuiz(chapter.text, n) : generateSubjective(chapter.text, n);
    if (questions.length < 3) { res.status(422).json({ error: 'Could not build enough questions from this chapter' }); return; }

    res.json({
      format,
      questions,
      total_marks: questions.reduce((s, q) => s + q.marks, 0),
      chapter: { index: chapter.index, title: chapter.title },
      source_book: result.book.title,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate questions from the book' });
  }
}

// Printable question paper PDF. Devanagari content is rendered with an
// embedded Noto Sans Devanagari font (PDFKit's built-in fonts are Latin-only).
export async function downloadExamPaperPdf(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const exam = await prisma.exam.findFirst({
      where: { id, org_id: req.user!.orgId },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true, section: true } },
        org: { select: { name: true } },
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }
    if (exam.questions.length === 0) { res.status(404).json({ error: 'This exam has no question paper' }); return; }

    const canSeeAnswers = req.user!.role === 'admin' || req.user!.role === 'teacher';
    const withAnswers = req.query.answers === '1' && canSeeAnswers;

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 55, right: 55 } });

    const devRegular = path.resolve('assets/fonts/NotoSansDevanagari-Regular.ttf');
    const devBold = path.resolve('assets/fonts/NotoSansDevanagari-Bold.ttf');
    const hasDevFonts = fs.existsSync(devRegular) && fs.existsSync(devBold);
    const isDev = (s: string) => /[ऀ-ॿ]/.test(s);
    const fontFor = (s: string, bold = false) =>
      hasDevFonts && isDev(s) ? (bold ? devBold : devRegular) : (bold ? 'Helvetica-Bold' : 'Helvetica');

    // HTTP headers are latin-1 only: ASCII fallback + RFC 5987 UTF-8 name
    const asciiName = exam.name.replace(/[^\x20-\x7E]+/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'question-paper';
    const utf8Name = encodeURIComponent(`${exam.name.slice(0, 60)}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName.slice(0, 60)}.pdf"; filename*=UTF-8''${utf8Name}`);
    doc.pipe(res);

    const cls = `${exam.class.name}${exam.class.section ? ` - ${exam.class.section}` : ''}`;
    const isHindiPaper = exam.questions.some((q) => isDev(q.question_text));

    // Header
    doc.font(fontFor(exam.org.name, true)).fontSize(16).fillColor('#1e1b4b').text(exam.org.name, { align: 'center' });
    doc.moveDown(0.3);
    doc.font(fontFor(exam.name, true)).fontSize(13).fillColor('#111827').text(exam.name, { align: 'center' });
    doc.moveDown(0.2);
    doc.font(fontFor(exam.subject.name)).fontSize(10).fillColor('#4b5563')
      .text(`${exam.subject.name}   |   ${cls}   |   ${isHindiPaper ? 'पूर्णांक' : 'Maximum Marks'}: ${exam.max_marks}${exam.exam_date ? `   |   ${isHindiPaper ? 'दिनांक' : 'Date'}: ${exam.exam_date}` : ''}`, { align: 'center' });
    doc.moveDown(0.4);
    doc.moveTo(55, doc.y).lineTo(540, doc.y).strokeColor('#c7d2fe').lineWidth(1).stroke();
    doc.moveDown(0.3);
    const instructions = isHindiPaper
      ? 'निर्देश: सभी प्रश्न अनिवार्य हैं। प्रत्येक प्रश्न के अंक उसके सामने दिए गए हैं।'
      : 'Instructions: All questions are compulsory. Marks for each question are shown alongside.';
    doc.font(fontFor(instructions)).fontSize(9).fillColor('#6b7280').text(instructions);
    doc.moveDown(0.8);

    // Questions
    for (const q of exam.questions) {
      const label = `${isDev(q.question_text) ? 'प्रश्न' : 'Q'}${q.order}. `;
      const marksTag = `[${q.marks}]`;
      doc.font(fontFor(q.question_text, true)).fontSize(11).fillColor('#111827');
      const startY = doc.y;
      doc.text(label, 55, startY, { continued: false, width: 445 });
      doc.font(fontFor(marksTag)).fontSize(9).fillColor('#6b7280').text(marksTag, 500, startY, { width: 40, align: 'right' });
      doc.font(fontFor(q.question_text)).fontSize(11).fillColor('#111827')
        .text(q.question_text.replace(/\n/g, ' '), 85, startY, { width: 410 });

      if (q.options) {
        const options: string[] = JSON.parse(q.options);
        doc.moveDown(0.2);
        const optLine = options.map((o, i) => `(${String.fromCharCode(97 + i)}) ${o}`).join('      ');
        doc.font(fontFor(optLine)).fontSize(10).fillColor('#374151').text(optLine, 85, doc.y, { width: 410 });
      }
      doc.moveDown(0.8);
      if (doc.y > 750) doc.addPage();
    }

    // Answer key (staff only, opt-in)
    if (withAnswers) {
      const answered = exam.questions.filter((q) => q.correct_answer);
      if (answered.length > 0) {
        doc.addPage();
        const keyTitle = isHindiPaper ? 'उत्तर कुंजी (केवल शिक्षक हेतु)' : 'Answer Key (for teachers only)';
        doc.font(fontFor(keyTitle, true)).fontSize(13).fillColor('#991b1b').text(keyTitle, { align: 'center' });
        doc.moveDown(0.8);
        for (const q of answered) {
          const line = `${q.order}.  ${q.correct_answer}`;
          doc.font(fontFor(line)).fontSize(11).fillColor('#111827').text(line, 85, doc.y, { width: 410 });
          doc.moveDown(0.3);
        }
      }
    }

    doc.end();
  } catch (error) {
    console.error('question paper pdf error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate question paper PDF' });
  }
}

// Question paper for an exam. Correct answers are only included for staff
// who grade (admin/teacher) — never for students or parents.
export async function getExamQuestions(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const exam = await prisma.exam.findFirst({
      where: { id, org_id: req.user!.orgId },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true, section: true } },
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

    const canSeeAnswers = req.user!.role === 'admin' || req.user!.role === 'teacher';
    const questions = exam.questions.map((q) => ({
      id: q.id,
      order: q.order,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options ? JSON.parse(q.options) : null,
      marks: q.marks,
      ...(canSeeAnswers && { correct_answer: q.correct_answer }),
    }));

    res.json({
      exam: {
        id: exam.id, name: exam.name, exam_format: exam.exam_format, max_marks: exam.max_marks,
        subject: exam.subject, class: exam.class,
      },
      questions,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Read an uploaded exam paper (PDF) and suggest exam details from its contents.
// Works with real question papers (finds marks/duration/questions) and falls
// back to filename-based suggestions for scans or book-style PDFs.
export async function importExamFile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'A PDF file is required' }); return; }

    const buffer = fs.readFileSync(path.resolve('uploads', req.file.filename));
    let text = '';
    let pages = 0;
    try {
      const parsed = await extractPdfText(buffer);
      text = parsed.text || '';
      pages = parsed.pages || 0;
    } catch {
      // unreadable/scanned PDF — keep the file, suggest from the filename
    }

    // Safety gate: a flagged file is deleted and never usable for exams
    const uploadScan = scanText(`${req.file.originalname}\n${text}`);
    if (uploadScan.status === 'flagged') {
      fs.unlink(path.resolve('uploads', req.file.filename), () => {});
      const cats = [...new Set(uploadScan.matches.filter((m) => ['adult', 'profanity'].includes(m.category)).map((m) => m.category))];
      res.status(400).json({ error: `Upload blocked: this file contains content inappropriate for kids and students (${cats.join(', ')}). It cannot be used to create an exam.` });
      return;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Title: first line that looks like a heading (letters, sensible length),
    // skipping print artifacts like "Chapter 1.indd 11-06-2025" or reprint stamps
    const headingLine = lines.find((l) =>
      /[A-Za-z]{3}/.test(l) && l.length >= 4 && l.length <= 80 && !/^\d+$/.test(l) &&
      !/\.indd|reprint|\d{2}-\d{2}-\d{4}|\d{2}:\d{2}:\d{2}|https?:\/\/|www\./i.test(l)
    );
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const name = headingLine || baseName;

    // Maximum marks: "Maximum Marks: 80", "Max. Marks - 100", "MM: 50"
    const marksMatch = text.match(/(?:max(?:imum)?\.?\s*marks?|M\.?M\.?)\s*[:\-–]?\s*(\d{1,3})/i);
    const max_marks = marksMatch ? parseInt(marksMatch[1]) : null;

    // Duration: "Time Allowed: 3 hours", "Time: 90 minutes"
    const timeMatch = text.match(/time\s*(?:allowed)?\s*[:\-–]?\s*([\d.]+\s*(?:hours?|hrs?|minutes?|mins?))/i);

    // Exam type hints in the text
    const lower = text.toLowerCase();
    let exam_type: string | null = null;
    if (/mid[\s-]?term/.test(lower)) exam_type = lower.includes('oral') ? 'midterm_oral' : 'midterm_written';
    else if (/final|annual/.test(lower)) exam_type = lower.includes('oral') ? 'final_oral' : 'final_written';
    else if (/class\s*test|unit\s*test|quiz/.test(lower)) exam_type = 'class_test';
    else if (/project|assignment/.test(lower)) exam_type = 'project';

    // Numbered questions: "1.", "Q1.", "Q. 2", "(3)"
    const questionLines = lines.filter((l) => /^(?:Q\.?\s*)?\(?\d{1,2}\)?[.)]\s/.test(l));

    const excerpt = lines.slice(0, 12).join('\n').slice(0, 500);

    res.json({
      message: 'File read successfully',
      file_path: req.file.filename,
      pages,
      text_found: text.trim().length > 0,
      suggested: {
        name: name.slice(0, 100),
        max_marks,
        exam_type,
        duration: timeMatch ? timeMatch[1] : null,
        questions_detected: questionLines.length,
      },
      excerpt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read the file' });
  }
}

export async function listExams(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, subject_id, term, exam_type, approval_status } = req.query;
    const where: any = { org_id: req.user!.orgId };
    if (class_id) where.class_id = class_id;
    if (subject_id) where.subject_id = subject_id;
    if (term) where.term = term;
    if (exam_type) where.exam_type = exam_type;
    if (approval_status) where.approval_status = approval_status;
    // Teachers only see exams for their assigned classes
    if (req.user!.role === 'teacher') where.class = { class_teachers: { some: { teacher_id: req.user!.userId } } };

    const exams = await prisma.exam.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true } },
        _count: { select: { marks: true, questions: true } },
      },
      orderBy: [{ term: 'asc' }, { exam_type: 'asc' }, { subject: { name: 'asc' } }],
    });
    res.json({ exams });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteExam(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const exam = await prisma.exam.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

    await prisma.mark.deleteMany({ where: { exam_id: id } });
    await prisma.examQuestion.deleteMany({ where: { exam_id: id } });
    await prisma.exam.delete({ where: { id } });
    res.json({ message: 'Exam deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Teacher submits marks for approval
export async function submitForApproval(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const exam = await prisma.exam.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

    if (!(await canAccessClass(req.user!, exam.class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    if (exam.approval_status !== 'draft' && exam.approval_status !== 'rejected') {
      res.status(400).json({ error: 'Only draft or rejected exams can be submitted' }); return;
    }

    const marksCount = await prisma.mark.count({ where: { exam_id: id } });
    if (marksCount === 0) {
      res.status(400).json({ error: 'Enter marks before submitting for approval' }); return;
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: { approval_status: 'pending', submitted_at: new Date(), rejection_note: null },
    });

    res.json({ message: 'Marks submitted for approval', exam: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin approves marks
export async function approveMarks(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const exam = await prisma.exam.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

    if (exam.approval_status !== 'pending') {
      res.status(400).json({ error: 'Only pending exams can be approved' }); return;
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: { approval_status: 'approved', approved_at: new Date() },
    });

    res.json({ message: 'Marks approved', exam: updated });

    // Fire notifications after responding (best-effort).
    notifyMarksApproved(updated.id, updated.name, req.user!.orgId).catch((e) => console.error('marks-approved notify:', e));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin rejects marks
export async function rejectMarks(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    const exam = await prisma.exam.findFirst({ where: { id, org_id: req.user!.orgId } });
    if (!exam) { res.status(404).json({ error: 'Exam not found' }); return; }

    if (exam.approval_status !== 'pending') {
      res.status(400).json({ error: 'Only pending exams can be rejected' }); return;
    }

    const updated = await prisma.exam.update({
      where: { id },
      data: { approval_status: 'rejected', rejection_note: reason || 'No reason given', approved_at: null },
    });

    res.json({ message: 'Marks rejected', exam: updated });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Bulk approve all pending exams for a class
export async function bulkApprove(req: Request, res: Response): Promise<void> {
  try {
    const { class_id } = req.body;
    const orgId = req.user!.orgId;

    // Capture which exams are about to be approved so we can notify for each.
    const toApprove = await prisma.exam.findMany({
      where: { class_id, org_id: orgId, approval_status: 'pending' },
      select: { id: true, name: true },
    });

    const result = await prisma.exam.updateMany({
      where: { class_id, org_id: orgId, approval_status: 'pending' },
      data: { approval_status: 'approved', approved_at: new Date() },
    });

    res.json({ message: `${result.count} exams approved`, count: result.count });

    Promise.all(toApprove.map((e) => notifyMarksApproved(e.id, e.name, orgId)))
      .catch((err) => console.error('bulk marks-approved notify:', err));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get approval summary counts
export async function approvalSummary(req: Request, res: Response): Promise<void> {
  try {
    const orgId = req.user!.orgId;
    const [draft, pending, approved, rejected] = await Promise.all([
      prisma.exam.count({ where: { org_id: orgId, approval_status: 'draft' } }),
      prisma.exam.count({ where: { org_id: orgId, approval_status: 'pending' } }),
      prisma.exam.count({ where: { org_id: orgId, approval_status: 'approved' } }),
      prisma.exam.count({ where: { org_id: orgId, approval_status: 'rejected' } }),
    ]);
    res.json({ draft, pending, approved, rejected, total: draft + pending + approved + rejected });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
