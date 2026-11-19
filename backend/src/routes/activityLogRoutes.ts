import { Router } from 'express';
import { getActivityLogs } from '../controllers/activityLogController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

// Read-only activity logs endpoint (strictly for recruiters and admins)
router.get('/', authenticateToken, requireRoles('recruiter', 'admin'), getActivityLogs);

export default router;
