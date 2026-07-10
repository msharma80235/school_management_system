import { Router } from 'express';
import { getViewableClasses, getSchedule, createSlot, updateSlot, deleteSlot, generateTimetable } from '../controllers/schedule.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Anyone in the org can view schedules for their classes
router.get('/classes', getViewableClasses);
router.get('/', getSchedule);

// Admin manages the schedule
router.post('/generate', authorize('admin'), generateTimetable);
router.post('/', authorize('admin'), createSlot);
router.put('/:id', authorize('admin'), updateSlot);
router.delete('/:id', authorize('admin'), deleteSlot);

export default router;
