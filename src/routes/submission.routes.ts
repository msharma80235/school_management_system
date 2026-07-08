import { Router } from 'express';
import { gradeSubmission } from '../controllers/submission.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.patch('/:id/grade', authorize('admin', 'teacher'), gradeSubmission);

export default router;
