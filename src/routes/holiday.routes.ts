import { Router } from 'express';
import { createHoliday, listHolidays, deleteHoliday } from '../controllers/holiday.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Everyone can view the calendar; only admins can change it
router.get('/', listHolidays);
router.post('/', authorize('admin'), createHoliday);
router.delete('/:id', authorize('admin'), deleteHoliday);

export default router;
