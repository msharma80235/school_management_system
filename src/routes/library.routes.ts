import { Router } from 'express';
import { issueBook, returnBook, payFine, listLoans, myLoans } from '../controllers/library.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Student view (before the admin routes)
router.get('/my-loans', authorize('student'), myLoans);

// Circulation desk — admins and teachers
router.get('/loans', authorize('admin', 'teacher'), listLoans);
router.post('/issue', authorize('admin', 'teacher'), issueBook);
router.post('/loans/:id/return', authorize('admin', 'teacher'), returnBook);
router.patch('/loans/:id/pay-fine', authorize('admin', 'teacher'), payFine);

export default router;
