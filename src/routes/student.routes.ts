import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { createStudent, listStudents, getStudent, updateStudent, transferStudent, deleteStudent, uploadStudentPhoto, removeStudentPhoto } from '../controllers/student.controller';
import { authenticate, authorize } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `student-photo-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB is plenty for a passport photo
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only JPG and PNG photos are allowed'));
  },
});

const router = Router();

router.use(authenticate);

router.post('/', createStudent);
router.get('/', listStudents);
router.get('/:id', getStudent);
router.put('/:id', updateStudent);
router.post('/:id/photo', authorize('admin', 'teacher'), upload.single('photo'), uploadStudentPhoto);
router.delete('/:id/photo', authorize('admin', 'teacher'), removeStudentPhoto);
router.patch('/:id/transfer', authorize('admin'), transferStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

// Clean 400s for multer errors
router.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    res.status(400).json({ error: err.message || 'Photo upload failed' });
    return;
  }
  next();
});

export default router;
