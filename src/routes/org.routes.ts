import { Router } from 'express';
import { registerOrganization, getOrganization, updateOrganization } from '../controllers/org.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public
router.post('/register', registerOrganization);

// Authenticated
router.get('/me', authenticate, getOrganization);
router.put('/me', authenticate, authorize('admin'), updateOrganization);

export default router;
