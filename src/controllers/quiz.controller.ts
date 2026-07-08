import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { canAccessClass } from '../utils/classAccess';

const OBJECTIVE = ['mcq', 'fill_blank', 'true_false'];
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

async function studentFor(req: Request) {
  return prisma.student.findFirst({ where: { user_id: req.user!.userId, org_id: req.user!.orgId } });
}

// Student: fetch a quiz to take. Questions are returned WITHOUT correct answers.
// Creates the attempt (start clock) on first fetch; blocks if already submitted.
export async function getQuizForStudent(req: Request, res: Response): Promise<void> {
  try {
    const examId = req.params.id as string;
    const student = await studentFor(req);
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, org_id: req.user!.orgId },
      include: { subject: { select: { name: true } }, questions: { orderBy: { order: 'asc' } } },
    });
    if (!exam) { res.status(404).json({ error: 'Quiz not found' }); return; }
    if (exam.exam_format !== 'quiz') { res.status(400).json({ error: 'This exam is not an online quiz' }); return; }
    if (exam.class_id !== student.class_id) { res.status(403).json({ error: 'This quiz is not for your class' }); return; }
    if (exam.questions.length === 0) { res.status(400).json({ error: 'This quiz has no questions yet' }); return; }

    let attempt = await prisma.quizAttempt.findUnique({
      where: { exam_id_student_id: { exam_id: examId, student_id: student.id } },
    });
    if (attempt?.submitted_at) { res.status(400).json({ error: 'You have already submitted this quiz', submitted: true }); return; }
    if (!attempt) {
      attempt = await prisma.quizAttempt.create({ data: { exam_id: examId, student_id: student.id, org_id: req.user!.orgId! } });
    }

    res.json({
      exam: {
        id: exam.id, name: exam.name, subject: exam.subject,
        time_limit_min: exam.time_limit_min, total_marks: exam.questions.reduce((s, q) => s + q.marks, 0),
      },
      started_at: attempt.started_at,
      questions: exam.questions.map((q) => ({
        id: q.id, order: q.order, question_type: q.question_type, question_text: q.question_text,
        options: q.options ? JSON.parse(q.options) : null, marks: q.marks,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student: submit answers → auto-grade objective questions → store attempt +
// responses → write the score back as a Mark so it flows into the gradebook.
export async function submitQuiz(req: Request, res: Response): Promise<void> {
  try {
    const examId = req.params.id as string;
    const { answers } = req.body as { answers: { question_id: string; answer: string }[] };
    const orgId = req.user!.orgId!;

    const student = await studentFor(req);
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, org_id: orgId },
      include: { questions: true },
    });
    if (!exam) { res.status(404).json({ error: 'Quiz not found' }); return; }
    if (exam.exam_format !== 'quiz') { res.status(400).json({ error: 'This exam is not an online quiz' }); return; }
    if (exam.class_id !== student.class_id) { res.status(403).json({ error: 'This quiz is not for your class' }); return; }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { exam_id_student_id: { exam_id: examId, student_id: student.id } },
    });
    if (attempt?.submitted_at) { res.status(400).json({ error: 'You have already submitted this quiz' }); return; }

    const answerMap = new Map((answers || []).map((a) => [a.question_id, a.answer]));

    let score = 0;
    let maxScore = 0;
    const responses = exam.questions.map((q) => {
      maxScore += q.marks;
      const given = answerMap.get(q.id) ?? null;
      const objective = OBJECTIVE.includes(q.question_type) && q.correct_answer != null;
      let is_correct: boolean | null = null;
      let awarded = 0;
      if (objective) {
        is_correct = norm(given) === norm(q.correct_answer);
        awarded = is_correct ? q.marks : 0;
        score += awarded;
      }
      return { question_id: q.id, answer: given, is_correct, awarded };
    });

    // Persist the attempt + responses together.
    const attemptId = attempt
      ? attempt.id
      : (await prisma.quizAttempt.create({ data: { exam_id: examId, student_id: student.id, org_id: orgId } })).id;

    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { submitted_at: new Date(), score, max_score: maxScore },
    });
    await prisma.$transaction(responses.map((r) => prisma.quizResponse.create({ data: { attempt_id: attemptId, ...r } })));

    // Write the score into the gradebook as a Mark (clamped to the exam's max).
    const markValue = Math.min(score, exam.max_marks);
    await prisma.mark.upsert({
      where: { student_id_exam_id: { student_id: student.id, exam_id: examId } },
      create: { student_id: student.id, exam_id: examId, marks_obtained: markValue, remarks: 'Auto-graded quiz', org_id: orgId },
      update: { marks_obtained: markValue, remarks: 'Auto-graded quiz' },
    });

    res.json({ message: 'Quiz submitted', score, max_score: maxScore });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student: their own graded result, with correct answers now revealed.
export async function getMyQuizResult(req: Request, res: Response): Promise<void> {
  try {
    const examId = req.params.id as string;
    const student = await studentFor(req);
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { exam_id_student_id: { exam_id: examId, student_id: student.id } },
      include: { responses: true, exam: { include: { questions: { orderBy: { order: 'asc' } } } } },
    });
    if (!attempt || !attempt.submitted_at) { res.status(404).json({ error: 'No submitted attempt found' }); return; }

    const byQuestion = new Map(attempt.responses.map((r) => [r.question_id, r]));
    const questions = attempt.exam.questions.map((q) => {
      const r = byQuestion.get(q.id);
      return {
        id: q.id, order: q.order, question_type: q.question_type, question_text: q.question_text,
        options: q.options ? JSON.parse(q.options) : null, marks: q.marks,
        correct_answer: q.correct_answer, your_answer: r?.answer ?? null,
        is_correct: r?.is_correct ?? null, awarded: r?.awarded ?? 0,
      };
    });

    res.json({
      exam: { id: attempt.exam.id, name: attempt.exam.name },
      score: attempt.score, max_score: attempt.max_score, submitted_at: attempt.submitted_at, questions,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Student: quizzes available for my class, each with my attempt summary.
export async function getMyQuizzes(req: Request, res: Response): Promise<void> {
  try {
    const student = await studentFor(req);
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const exams = await prisma.exam.findMany({
      where: { org_id: req.user!.orgId, class_id: student.class_id, exam_format: 'quiz' },
      include: {
        subject: { select: { name: true, code: true } },
        _count: { select: { questions: true } },
        quiz_attempts: { where: { student_id: student.id }, select: { submitted_at: true, score: true, max_score: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const quizzes = exams
      .filter((e) => e._count.questions > 0)
      .map((e) => ({
        id: e.id, name: e.name, subject: e.subject, time_limit_min: e.time_limit_min,
        question_count: e._count.questions,
        attempt: e.quiz_attempts[0]?.submitted_at ? e.quiz_attempts[0] : null,
      }));

    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Teacher/admin: every student's attempt at this quiz.
export async function listQuizAttempts(req: Request, res: Response): Promise<void> {
  try {
    const examId = req.params.id as string;
    const exam = await prisma.exam.findFirst({ where: { id: examId, org_id: req.user!.orgId } });
    if (!exam) { res.status(404).json({ error: 'Quiz not found' }); return; }
    if (!(await canAccessClass(req.user!, exam.class_id))) {
      res.status(403).json({ error: 'You are not assigned to this class' }); return;
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { exam_id: examId },
      include: { student: { select: { first_name: true, last_name: true, roll_number: true } } },
      orderBy: { submitted_at: 'desc' },
    });

    res.json({ attempts });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
