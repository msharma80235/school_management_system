import { Router } from 'express';
import { createParent, listParents, getParent, linkStudent, unlinkStudent, getMyChildren, getChildAttendance } from '../controllers/parent.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Admin routes - manage parent accounts
router.post('/', authenticate, authorize('admin'), createParent);
router.get('/', authenticate, authorize('admin'), listParents);
router.post('/:id/link', authenticate, authorize('admin'), linkStudent);
router.delete('/:id/unlink/:studentId', authenticate, authorize('admin'), unlinkStudent);

// Parent-facing routes
router.get('/my-children', authenticate, authorize('parent'), getMyChildren);
router.get('/my-children/:studentId/attendance', authenticate, authorize('parent'), getChildAttendance);

// Parent detail view (registered after /my-children so it never shadows it)
router.get('/:id', authenticate, authorize('admin'), getParent);

export default router;
