import { Router } from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  uploadCandidateResume,
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.post('/resume', authenticateToken, uploadResume.single('resume'), uploadCandidateResume);

export default router;

