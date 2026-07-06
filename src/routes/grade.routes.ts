import { Router } from 'express';
import { createGrade, listGrades, updateGrade, deleteGrade } from '../controllers/grade.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, listGrades);
router.post('/', authenticate, authorize('admin'), createGrade);
router.put('/:id', authenticate, authorize('admin'), updateGrade);
router.delete('/:id', authenticate, authorize('admin'), deleteGrade);

export default router;
