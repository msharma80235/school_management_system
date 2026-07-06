import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { getReportCard, getClassReportSummary, getReportConfig, updateReportConfig, downloadReportCardPDF, uploadLogo } from '../controllers/reportCard.controller';
import { authenticate, authorize } from '../middleware/auth';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();
router.use(authenticate);

router.get('/student/:studentId', getReportCard);
router.get('/student/:studentId/pdf', downloadReportCardPDF);
router.get('/class/:classId/summary', getClassReportSummary);
router.get('/config', getReportConfig);
router.put('/config', authorize('admin'), updateReportConfig);
router.post('/logo', authorize('admin'), upload.single('logo'), uploadLogo);

export default router;
