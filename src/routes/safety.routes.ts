import { Router } from 'express';
import { getSettings, updateSettings, getReport, getAssurance, runExport, listExports } from '../controllers/safety.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Parent-visible safety posture — any authenticated org member.
router.get('/assurance', getAssurance);

// Everything else is admin-only.
router.get('/settings', authorize('admin'), getSettings);
router.put('/settings', authorize('admin'), updateSettings);
router.get('/report', authorize('admin'), getReport);
router.post('/export', authorize('admin'), runExport);
router.get('/exports', authorize('admin'), listExports);

export default router;
