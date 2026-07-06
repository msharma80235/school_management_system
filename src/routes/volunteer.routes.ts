import { Router } from 'express';
import { createVolunteer, listVolunteers, toggleVolunteerStatus } from '../controllers/volunteer.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.post('/', createVolunteer);
router.get('/', listVolunteers);
router.patch('/:id/status', toggleVolunteerStatus);

export default router;
