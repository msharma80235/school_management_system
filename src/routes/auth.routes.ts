import { Router } from 'express';
import { login, logout, me, changePassword, lookupOrg, superLogin } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/super-login', superLogin);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.put('/change-password', authenticate, changePassword);
router.get('/org/:slug', lookupOrg);

export default router;
