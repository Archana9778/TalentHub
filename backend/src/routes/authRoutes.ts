import { Router } from 'express';
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  uploadCandidateResume,
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';
import {
  loginRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
} from '../middleware/rateLimiter';

const router = Router();

// Authentication lifecycle
router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);
router.post('/logout', authenticateToken, logout);

// Password recovery workflow
router.post('/forgot-password', passwordResetRateLimiter, forgotPassword);
router.post('/reset-password', passwordResetRateLimiter, resetPassword);

// Profile and session
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.post('/resume', authenticateToken, uploadResume.single('resume'), uploadCandidateResume);

export default router;
