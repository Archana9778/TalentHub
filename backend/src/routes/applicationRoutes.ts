import { Router } from 'express';
import {
  applyForJob,
  getCandidateApplications,
  getJobApplicants,
  getApplicationById,
  updateApplicationStage,
} from '../controllers/applicationController';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';

const router = Router();

// Candidate endpoints
router.post('/apply', authenticateToken, requireRoles('candidate'), uploadResume.single('resume'), applyForJob);
router.get('/my-applications', authenticateToken, requireRoles('candidate'), getCandidateApplications);

// Recruiter / Admin endpoints
router.get('/applicants', authenticateToken, requireRoles('recruiter', 'admin'), getJobApplicants);
router.get('/:id', authenticateToken, getApplicationById);
router.patch('/:id/stage', authenticateToken, requireRoles('recruiter', 'admin'), updateApplicationStage);

export default router;

