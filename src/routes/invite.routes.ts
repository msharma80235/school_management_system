import { Router } from 'express';
import { createInvite, listInvites, revokeInvite, lookupInvite, acceptInvite } from '../controllers/invite.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public join-by-code endpoints
router.get('/lookup/:code', lookupInvite);
router.post('/accept/:code', acceptInvite);

// Admin management
router.post('/', authenticate, authorize('admin'), createInvite);
router.get('/', authenticate, authorize('admin'), listInvites);
router.delete('/:id', authenticate, authorize('admin'), revokeInvite);

export default router;
