import { Router } from 'express';
import { getModerationQueue, reviewBook, reviewDocument } from '../controllers/moderation.controller';
import { authenticate, requireModerator } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireModerator);

router.get('/queue', getModerationQueue);
router.patch('/books/:id', reviewBook);
router.patch('/documents/:id', reviewDocument);

export default router;
