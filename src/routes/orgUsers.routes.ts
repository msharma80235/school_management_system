import { Router } from 'express';
import { listOrgUsers, toggleUserActive, toggleUserLock, toggleUserModerator, resetUserPassword } from '../controllers/orgUsers.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/', listOrgUsers);
router.patch('/:id/status', toggleUserActive);
router.patch('/:id/lock', toggleUserLock);
router.patch('/:id/moderator', toggleUserModerator);
router.post('/:id/reset-password', resetUserPassword);

export default router;
