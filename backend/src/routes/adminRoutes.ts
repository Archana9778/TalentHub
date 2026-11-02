import { Router } from 'express';
import {
  getSystemStatistics,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  getReportedJobs,
  updateReportStatus,
} from '../controllers/adminController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

// All admin endpoints require 'admin' role
router.use(authenticateToken, requireRoles('admin'));

router.get('/statistics', getSystemStatistics);
router.get('/users', getAllUsers);
router.patch('/users/:id', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/reported-jobs', getReportedJobs);
router.patch('/reported-jobs/:id', updateReportStatus);

export default router;

