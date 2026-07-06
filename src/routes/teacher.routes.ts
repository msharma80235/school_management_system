import { Router } from 'express';
import {
  createTeacher,
  listTeachers,
  getTeacher,
  updateTeacher,
  toggleTeacherStatus,
} from '../controllers/teacher.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.post('/', createTeacher);
router.get('/', listTeachers);
router.get('/:id', getTeacher);
router.put('/:id', updateTeacher);
router.patch('/:id/status', toggleTeacherStatus);

export default router;
