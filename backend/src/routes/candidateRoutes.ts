import { Router } from 'express';
import {
  getCandidateProfile,
  updateCandidateProfile,
  getCandidateEducation,
  addCandidateEducation,
  updateCandidateEducation,
  deleteCandidateEducation,
  getCandidateExperience,
  addCandidateExperience,
  updateCandidateExperience,
  deleteCandidateExperience,
} from '../controllers/candidateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Candidate Profile Endpoints
router.get('/profile', authenticateToken, getCandidateProfile);
router.put('/profile', authenticateToken, updateCandidateProfile);

// Education Endpoints
router.get('/education', authenticateToken, getCandidateEducation);
router.post('/education', authenticateToken, addCandidateEducation);
router.put('/education/:id', authenticateToken, updateCandidateEducation);
router.patch('/education/:id', authenticateToken, updateCandidateEducation);
router.delete('/education/:id', authenticateToken, deleteCandidateEducation);

// Work Experience Endpoints
router.get('/experience', authenticateToken, getCandidateExperience);
router.post('/experience', authenticateToken, addCandidateExperience);
router.put('/experience/:id', authenticateToken, updateCandidateExperience);
router.patch('/experience/:id', authenticateToken, updateCandidateExperience);
router.delete('/experience/:id', authenticateToken, deleteCandidateExperience);

export default router;

