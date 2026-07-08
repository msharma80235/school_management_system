import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Admins read their org's trail; superadmin reads the whole platform's.
router.get('/', authenticate, authorize('admin', 'superadmin'), listAuditLogs);

export default router;
