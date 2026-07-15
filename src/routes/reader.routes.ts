import { Router } from 'express';
import { listReadableBooks, getBookChapters, getChapter } from '../controllers/reader.controller';
import { authenticate, authorize } from '../middleware/auth';

// Student self-study reader: listen to a book chapter and get a plain-language
// explanation. Read-only; students only.
const router = Router();
router.use(authenticate, authorize('student'));

router.get('/books', listReadableBooks);
router.get('/books/:id/chapters', getBookChapters);
router.get('/books/:id/chapters/:index', getChapter);

export default router;
