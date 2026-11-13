import { Router } from 'express';
import {
  getCandidateProfile,
  updateCandidateProfile,
  addSkill,
  removeSkill,
  addEducation,
  updateEducation,
  deleteEducation,
  addExperience,
  updateExperience,
  deleteExperience,
} from '../controllers/candidateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Candidate Profile Endpoints
router.get('/profile', authenticateToken, getCandidateProfile);
router.put('/profile', authenticateToken, updateCandidateProfile);

// Skills Management Endpoints
router.post('/skills', authenticateToken, addSkill);
router.delete('/skills/:skill', authenticateToken, removeSkill);
router.delete('/skills', authenticateToken, removeSkill);

// Educational Qualifications Endpoints
router.post('/education', authenticateToken, addEducation);
router.put('/education/:id', authenticateToken, updateEducation);
router.delete('/education/:id', authenticateToken, deleteEducation);

// Work Experience Endpoints
router.post('/experience', authenticateToken, addExperience);
router.put('/experience/:id', authenticateToken, updateExperience);
router.delete('/experience/:id', authenticateToken, deleteExperience);

export default router;
