import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createBook, listBooks, updateBook, deleteBook, getMyBooks, getChildBooks, uploadBookFile, removeBookFile } from '../controllers/book.controller';
import { authenticate, authorize } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `book-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB for scanned copies
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, JPG, and PNG files are allowed'));
  },
});

const router = Router();
router.use(authenticate);

// Student/parent views (before /:id routes)
router.get('/my', authorize('student'), getMyBooks);
router.get('/child/:studentId', authorize('parent'), getChildBooks);

// Admin/teacher management
router.post('/', authorize('admin', 'teacher'), createBook);
router.get('/', authorize('admin', 'teacher'), listBooks);
router.put('/:id', authorize('admin', 'teacher'), updateBook);
router.delete('/:id', authorize('admin'), deleteBook);
router.post('/:id/file', authorize('admin', 'teacher'), upload.single('file'), uploadBookFile);
router.delete('/:id/file', authorize('admin', 'teacher'), removeBookFile);

// Turn multer/file-filter errors into clean 400 responses
router.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    res.status(400).json({ error: err.message || 'File upload failed' });
    return;
  }
  next();
});

export default router;
