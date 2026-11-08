import { Router } from 'express';
import {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  assignJob,
  getRecruiterJobs,
  reportJob,
} from '../controllers/jobController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

// Public / Candidate view
router.get('/', getAllJobs);
router.get('/recruiter/my-jobs', authenticateToken, requireRoles('recruiter', 'admin'), getRecruiterJobs);
router.get('/:id', getJobById);

// Recruiter / Admin job management
router.post('/', authenticateToken, requireRoles('recruiter', 'admin'), createJob);
router.put('/:id', authenticateToken, requireRoles('recruiter', 'admin'), updateJob);
router.delete('/:id', authenticateToken, requireRoles('recruiter', 'admin'), deleteJob);
router.patch('/:id/assign', authenticateToken, requireRoles('recruiter', 'admin'), assignJob);

// Reporting jobs
router.post('/report', authenticateToken, reportJob);

export default router;
