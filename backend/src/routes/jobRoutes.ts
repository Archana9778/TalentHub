import { Router } from 'express';
import {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getRecruiterJobs,
  reportJob,
} from '../controllers/jobController';
import { getJobMatches, getJobCandidateMatch } from '../controllers/matchingController';
import { getCandidateSkillMatch } from '../controllers/skillComparisonController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

// Public / Candidate view
router.get('/', getAllJobs);
router.get('/recruiter/my-jobs', authenticateToken, requireRoles('recruiter', 'admin'), getRecruiterJobs);

// Candidate Matching & Ranking endpoints
router.get('/:jobId/matches', authenticateToken, requireRoles('recruiter', 'admin'), getJobMatches);
router.get('/:jobId/matches/:candidateId', authenticateToken, getJobCandidateMatch);

// Candidate Skills vs Job Requirements Comparison
router.get('/:jobId/candidates/:candidateId/skill-match', authenticateToken, getCandidateSkillMatch);

router.get('/:id', getJobById);

// Recruiter / Admin job management
router.post('/', authenticateToken, requireRoles('recruiter', 'admin'), createJob);
router.put('/:id', authenticateToken, requireRoles('recruiter', 'admin'), updateJob);
router.delete('/:id', authenticateToken, requireRoles('recruiter', 'admin'), deleteJob);

// Reporting jobs
router.post('/report', authenticateToken, reportJob);

export default router;

