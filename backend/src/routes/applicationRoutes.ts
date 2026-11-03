import { Router } from 'express';
import {
  applyForJob,
  getCandidateApplications,
  getJobApplicants,
  getApplicationById,
  updateApplicationStage,
  getApplicationAuditTimeline,
} from '../controllers/applicationController';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';

const router = Router();

// Candidate endpoints
router.post('/apply', authenticateToken, requireRoles('candidate'), uploadResume.single('resume'), applyForJob);
router.post('/', authenticateToken, requireRoles('candidate'), uploadResume.single('resume'), applyForJob);
router.get('/my-applications', authenticateToken, requireRoles('candidate'), getCandidateApplications);
router.get('/candidate/:candidateId', authenticateToken, getCandidateApplications);

// Recruiter / Admin endpoints
router.get('/applicants', authenticateToken, requireRoles('recruiter', 'admin'), getJobApplicants);
router.get('/job/:jobId', authenticateToken, requireRoles('recruiter', 'admin'), getJobApplicants);
router.get('/:id', authenticateToken, getApplicationById);
router.get('/:id/audit', authenticateToken, getApplicationAuditTimeline);
router.patch('/:id/stage', authenticateToken, requireRoles('recruiter', 'admin'), updateApplicationStage);
router.put('/:id/stage', authenticateToken, requireRoles('recruiter', 'admin'), updateApplicationStage);

export default router;
