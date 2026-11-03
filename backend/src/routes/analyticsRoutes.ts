import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analyticsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticateToken, getDashboardAnalytics);

export default router;

