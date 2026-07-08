import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createHomework, listHomework, updateHomework, deleteHomework, getMyHomework, getChildHomework } from '../controllers/homework.controller';
import { submitHomework, listSubmissions, getMySubmission } from '../controllers/submission.controller';
import { authenticate, authorize } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `submission-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Allowed file types: PDF, JPG, PNG, DOC, DOCX, TXT'));
  },
});

const router = Router();
router.use(authenticate);

// Student/parent views (before /:id routes)
router.get('/my', authorize('student'), getMyHomework);
router.get('/child/:studentId', authorize('parent'), getChildHomework);

// Student submissions
router.post('/:id/submit', authorize('student'), upload.single('file'), submitHomework);
router.get('/:id/my-submission', authorize('student'), getMySubmission);
router.get('/:id/submissions', authorize('admin', 'teacher'), listSubmissions);

// Admin/teacher management (volunteers get read-only access to the list)
router.post('/', authorize('admin', 'teacher'), createHomework);
router.get('/', authorize('admin', 'teacher', 'volunteer'), listHomework);
router.put('/:id', authorize('admin', 'teacher'), updateHomework);
router.delete('/:id', authorize('admin', 'teacher'), deleteHomework);

// Clean 400s for multer/file-filter errors
router.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    res.status(400).json({ error: err.message || 'File upload failed' });
    return;
  }
  next();
});

export default router;
