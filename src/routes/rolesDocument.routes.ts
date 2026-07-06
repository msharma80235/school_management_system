import { Router } from 'express';
import { getRolesDocument, saveRolesDocument } from '../controllers/rolesDocument.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/', getRolesDocument);
router.put('/', saveRolesDocument);

export default router;
