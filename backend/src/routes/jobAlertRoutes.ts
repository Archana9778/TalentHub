import { Router } from 'express';
import {
  getMyAlerts,
  createAlert,
  toggleAlertStatus,
  deleteAlert,
} from '../controllers/jobAlertController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, requireRoles('candidate'), getMyAlerts);
router.post('/', authenticateToken, requireRoles('candidate'), createAlert);
router.patch('/:id/toggle', authenticateToken, requireRoles('candidate'), toggleAlertStatus);
router.delete('/:id', authenticateToken, requireRoles('candidate'), deleteAlert);

export default router;

