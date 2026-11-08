import { Router } from 'express';
import {
  applyForJob,
  getCandidateApplications,
  getAllApplications,
  getJobApplicants,
  getApplicationById,
  updateApplicationStatus,
  getApplicationAuditTimeline,
} from '../controllers/applicationController';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';

const router = Router();

// Candidate application endpoints
router.post('/apply', authenticateToken, requireRoles('candidate'), uploadResume.single('resume'), applyForJob);
router.post('/', authenticateToken, requireRoles('candidate'), uploadResume.single('resume'), applyForJob);
router.get('/my-applications', authenticateToken, requireRoles('candidate'), getCandidateApplications);
router.get('/candidate/:candidateId', authenticateToken, getCandidateApplications);

// Application list & query endpoints (Recruiter / Admin / Candidate)
router.get('/', authenticateToken, getAllApplications);
router.get('/applicants', authenticateToken, requireRoles('recruiter', 'admin'), getJobApplicants);
router.get('/job/:jobId', authenticateToken, requireRoles('recruiter', 'admin'), getJobApplicants);

// Application details & history
router.get('/:id', authenticateToken, getApplicationById);
router.get('/:id/history', authenticateToken, getApplicationAuditTimeline);
router.get('/:id/audit', authenticateToken, getApplicationAuditTimeline);

// Status lifecycle progression endpoints
router.patch('/:id/status', authenticateToken, requireRoles('recruiter', 'admin'), updateApplicationStatus);
router.patch('/:id/stage', authenticateToken, requireRoles('recruiter', 'admin'), updateApplicationStatus);
router.put('/:id/stage', authenticateToken, requireRoles('recruiter', 'admin'), updateApplicationStatus);

export default router;
