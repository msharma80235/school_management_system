import { Router } from 'express';
import { markAttendance, getAttendance, getAttendanceSummary } from '../controllers/attendance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', authorize('admin', 'teacher', 'volunteer'), markAttendance);
router.get('/', authorize('admin', 'teacher', 'volunteer'), getAttendance);
router.get('/summary/:classId', authorize('admin', 'teacher', 'volunteer'), getAttendanceSummary);

export default router;
