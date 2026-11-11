import { Router } from 'express';
import {
  addRecruiter,
  getRecruiters,
  getRecruiterById,
  updateRecruiter,
  updateRecruiterStatus,
  getRecruiterJobs,
} from '../controllers/recruiterController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

// All recruiter endpoints require authenticated recruiter or platform admin
router.use(authenticateToken, requireRoles('recruiter', 'admin'));

router.post('/', addRecruiter);
router.get('/', getRecruiters);
router.get('/:id', getRecruiterById);
router.put('/:id', updateRecruiter);
router.patch('/:id/status', updateRecruiterStatus);
router.get('/:id/jobs', getRecruiterJobs);

export default router;
