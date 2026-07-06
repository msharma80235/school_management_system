import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { uploadDocument, listDocuments, updateDocument, deleteDocument } from '../controllers/document.controller';
import { authenticate, authorize } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Allowed file types: PDF, images, Word, Excel'));
  },
});

const router = Router();
router.use(authenticate);

// Everyone authenticated can list — the controller filters by role/audience
router.get('/', listDocuments);

// Admins publish directly; teacher/staff submissions go through moderator approval
router.post('/', authorize('admin', 'teacher', 'staff'), upload.single('file'), uploadDocument);
router.put('/:id', authorize('admin'), updateDocument);
router.delete('/:id', authorize('admin'), deleteDocument);

// Clean 400s for multer errors
router.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    res.status(400).json({ error: err.message || 'File upload failed' });
    return;
  }
  next();
});

export default router;
