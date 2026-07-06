import { Router } from 'express';
import { askChatAgent } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Any signed-in user can ask the help agent
router.post('/ask', authenticate, askChatAgent);

export default router;
