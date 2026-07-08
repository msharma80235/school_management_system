import { Router } from 'express';
import {
  listMyNotifications, unreadCount, markRead, markAllRead, getPreferences, updatePreference,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Every authenticated user manages their own notifications — no role gate.
router.use(authenticate);

router.get('/', listMyNotifications);
router.get('/unread-count', unreadCount);
router.post('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreference);

export default router;
