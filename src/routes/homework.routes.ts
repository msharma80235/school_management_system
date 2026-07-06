import { Router } from 'express';
import { createHomework, listHomework, updateHomework, deleteHomework, getMyHomework, getChildHomework } from '../controllers/homework.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Student/parent views (before /:id routes)
router.get('/my', authorize('student'), getMyHomework);
router.get('/child/:studentId', authorize('parent'), getChildHomework);

// Admin/teacher management (volunteers get read-only access to the list)
router.post('/', authorize('admin', 'teacher'), createHomework);
router.get('/', authorize('admin', 'teacher', 'volunteer'), listHomework);
router.put('/:id', authorize('admin', 'teacher'), updateHomework);
router.delete('/:id', authorize('admin', 'teacher'), deleteHomework);

export default router;
