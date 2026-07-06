import { Router } from 'express';
import { createClass, listClasses, getClass, updateClass, deleteClass } from '../controllers/class.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', authorize('admin'), createClass);
router.get('/', listClasses);
router.get('/:id', getClass);
router.put('/:id', authorize('admin'), updateClass);
router.delete('/:id', authorize('admin'), deleteClass);

export default router;
