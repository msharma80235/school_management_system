import { Router } from 'express';
import { createSubject, listSubjects, updateSubject, deleteSubject, assignSubjectsToClass, getClassSubjects } from '../controllers/subject.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/', authorize('admin'), createSubject);
router.get('/', listSubjects);
router.put('/:id', authorize('admin'), updateSubject);
router.delete('/:id', authorize('admin'), deleteSubject);
router.post('/assign', authorize('admin'), assignSubjectsToClass);
router.get('/class/:classId', getClassSubjects);

export default router;
