import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createExam, listExams, deleteExam, submitForApproval, approveMarks, rejectMarks, bulkApprove, approvalSummary, importExamFile, generateExamQuestions, getExamQuestions, downloadExamPaperPdf } from '../controllers/exam.controller';
import { getQuizForStudent, submitQuiz, getMyQuizResult, listQuizAttempts, getMyQuizzes } from '../controllers/quiz.controller';
import { authenticate, authorize } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `exam-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
    else cb(new Error('Only PDF files are supported for exam import'));
  },
});

const router = Router();
router.use(authenticate);

router.post('/', authorize('admin', 'teacher'), createExam);
router.post('/import-file', authorize('admin', 'teacher'), upload.single('file'), importExamFile);
router.post('/generate-questions', authorize('admin', 'teacher'), generateExamQuestions);
router.get('/', listExams);
router.get('/my-quizzes', authorize('student'), getMyQuizzes);
router.get('/:id/questions', authorize('admin', 'teacher', 'volunteer'), getExamQuestions);
router.get('/:id/paper.pdf', authorize('admin', 'teacher', 'volunteer'), downloadExamPaperPdf);
router.get('/approval-summary', approvalSummary);
router.delete('/:id', authorize('admin'), deleteExam);
router.patch('/:id/submit', authorize('admin', 'teacher'), submitForApproval);
router.patch('/:id/approve', authorize('admin'), approveMarks);
router.patch('/:id/reject', authorize('admin'), rejectMarks);
router.post('/bulk-approve', authorize('admin'), bulkApprove);

// Online quiz (quiz-format exams)
router.get('/:id/quiz', authorize('student'), getQuizForStudent);
router.post('/:id/quiz/submit', authorize('student'), submitQuiz);
router.get('/:id/quiz/result', authorize('student'), getMyQuizResult);
router.get('/:id/quiz/attempts', authorize('admin', 'teacher'), listQuizAttempts);

// Clean 400s for multer errors
router.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    res.status(400).json({ error: err.message || 'File upload failed' });
    return;
  }
  next();
});

export default router;
