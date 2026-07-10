import { Router } from 'express';
import { submitEnquiry, listAdmissions, updateStage, convertAdmission } from '../controllers/admission.controller';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

// Public enquiry (rate-limited against spam/abuse)
router.post('/enquiry/:slug', authRateLimit, submitEnquiry);

// Admin management
router.get('/', authenticate, authorize('admin'), listAdmissions);
router.patch('/:id/stage', authenticate, authorize('admin'), updateStage);
router.post('/:id/convert', authenticate, authorize('admin'), convertAdmission);

export default router;
