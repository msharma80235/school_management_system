import { Router } from 'express';
import { createStudentAccount, getMyProfile, getMyAttendance } from '../controllers/studentAccount.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Admin creates login for a student
router.post('/:id/account', authenticate, authorize('admin'), createStudentAccount);

// Student-facing
router.get('/my-profile', authenticate, authorize('student'), getMyProfile);
router.get('/my-attendance', authenticate, authorize('student'), getMyAttendance);

export default router;
