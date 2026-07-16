import { Router } from 'express';
import { sendSupportRequest } from '../controllers/support.controller';
import { authenticate } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

// Contact/support — available to every signed-in user, any role. Rate-limited
// to curb accidental or abusive floods (a no-op under NODE_ENV=test).
const router = Router();
router.use(authenticate);
router.post('/', authRateLimit, sendSupportRequest);

export default router;
