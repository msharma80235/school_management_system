import { Router } from 'express';
import { overview, attendanceTrend, gradeDistribution, atRisk, exportStudentsCsv } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/overview', overview);
router.get('/attendance-trend', attendanceTrend);
router.get('/grade-distribution', gradeDistribution);
router.get('/at-risk', atRisk);
router.get('/export/students.csv', exportStudentsCsv);

export default router;
