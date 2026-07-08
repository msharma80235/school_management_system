import { Router } from 'express';
import { registerOrganization, getOrganization, updateOrganization } from '../controllers/org.controller';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

// Public
router.post('/register', authRateLimit, registerOrganization);

// Authenticated
router.get('/me', authenticate, getOrganization);
router.put('/me', authenticate, authorize('admin'), updateOrganization);

export default router;
