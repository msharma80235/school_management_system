import { Router } from 'express';
import { markVolunteerAttendance, getVolunteerAttendance, getMyVolunteerAttendance } from '../controllers/volunteerAttendance.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Volunteers can only view their own attendance
router.get('/my', authorize('volunteer'), getMyVolunteerAttendance);

// Only admin and teachers can record volunteer attendance
router.post('/', authorize('admin', 'teacher'), markVolunteerAttendance);
router.get('/', authorize('admin', 'teacher'), getVolunteerAttendance);

export default router;
