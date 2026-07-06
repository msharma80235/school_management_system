import { Router } from 'express';
import { platformStats, listOrgs, toggleOrgStatus, resetOrgAdminPassword, listOrgAdmins, createOrgAdmin, updateOrgAdmin, toggleOrgAdminStatus } from '../controllers/super.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('superadmin'));

router.get('/stats', platformStats);
router.get('/orgs', listOrgs);
router.patch('/orgs/:id/status', toggleOrgStatus);
router.post('/orgs/:id/reset-admin-password', resetOrgAdminPassword);
router.get('/orgs/:id/admins', listOrgAdmins);
router.post('/orgs/:id/admins', createOrgAdmin);
router.put('/orgs/:id/admins/:adminId', updateOrgAdmin);
router.patch('/orgs/:id/admins/:adminId/status', toggleOrgAdminStatus);

export default router;
