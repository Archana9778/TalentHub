import { Router } from 'express';
import { getCandidateProfile, updateCandidateProfile } from '../controllers/candidateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Candidate Profile Endpoints
router.get('/profile', authenticateToken, getCandidateProfile);
router.put('/profile', authenticateToken, updateCandidateProfile);

export default router;

