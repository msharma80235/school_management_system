import { Router } from 'express';
import { createStaff, listStaff, toggleStaffStatus, addAssignment, removeAssignment, getMyAssignments } from '../controllers/staff.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Staff view their own duties (before /:id routes)
router.get('/my-assignments', authorize('staff'), getMyAssignments);

// Admin management
router.post('/', authorize('admin'), createStaff);
router.get('/', authorize('admin'), listStaff);
router.patch('/:id/status', authorize('admin'), toggleStaffStatus);
router.post('/:id/assignments', authorize('admin'), addAssignment);
router.delete('/assignments/:assignmentId', authorize('admin'), removeAssignment);

export default router;
