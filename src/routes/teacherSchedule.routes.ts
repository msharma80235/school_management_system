import { Router } from 'express';
import { getViewableTeachers, getTeacherSchedule, createPersonalSlot, updatePersonalSlot, deletePersonalSlot } from '../controllers/teacherSchedule.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Viewing: teachers see their own, admin/staff/volunteer see all
router.get('/teachers', getViewableTeachers);
router.get('/', getTeacherSchedule);

// Admin manages personal slots (duties, meetings, office hours)
router.post('/', authorize('admin'), createPersonalSlot);
router.put('/:id', authorize('admin'), updatePersonalSlot);
router.delete('/:id', authorize('admin'), deletePersonalSlot);

export default router;
