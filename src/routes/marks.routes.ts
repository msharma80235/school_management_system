import { Router } from 'express';
import { enterMarks, getMarksForExam, getStudentMarks } from '../controllers/marks.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/', authorize('admin', 'teacher'), enterMarks);
router.get('/exam/:examId', getMarksForExam);
router.get('/student/:studentId', getStudentMarks);

export default router;
