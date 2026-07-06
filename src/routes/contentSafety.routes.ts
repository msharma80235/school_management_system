import { Router } from 'express';
import { runScan, listResults, markSafe } from '../controllers/contentSafety.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/', listResults);
router.post('/scan', runScan);
router.patch('/:id/safe', markSafe);

export default router;
