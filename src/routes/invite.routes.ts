import { Router } from 'express';
import { createInvite, listInvites, revokeInvite, lookupInvite, acceptInvite } from '../controllers/invite.controller';
import { authenticate, authorize } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

// Public join-by-code endpoints (rate-limited against code-guessing)
router.get('/lookup/:code', authRateLimit, lookupInvite);
router.post('/accept/:code', authRateLimit, acceptInvite);

// Admin management
router.post('/', authenticate, authorize('admin'), createInvite);
router.get('/', authenticate, authorize('admin'), listInvites);
router.delete('/:id', authenticate, authorize('admin'), revokeInvite);

export default router;
