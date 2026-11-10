import { Router } from 'express';
import {
  uploadResume as uploadResumeController,
  getMyResume,
  getResumeHistory,
  downloadResume,
  getResumeDownloadUrl,
  parseResume,
} from '../controllers/resumeController';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';

const router = Router();

// All resume routes require authentication
router.use(authenticateToken);

/**
 * POST /api/resume/upload
 * Candidate uploads resume (PDF/DOCX)
 */
router.post(
  '/upload',
  requireRoles('candidate'),
  uploadResume.single('resume'),
  uploadResumeController
);

/**
 * GET /api/resume/my
 * Current resume metadata for authenticated candidate
 */
router.get('/my', requireRoles('candidate'), getMyResume);

/**
 * GET /api/resume/history
 * All resume version records for authenticated candidate
 */
router.get('/history', requireRoles('candidate'), getResumeHistory);

/**
 * GET /api/resume/download
 * Secure authenticated resume download (own resume)
 */
router.get('/download', downloadResume);

/**
 * GET /api/resume/download/:id
 * Secure authorized resume download for candidate / recruiter / admin
 */
router.get('/download/:id', getResumeDownloadUrl);

/**
 * POST /api/resume/parse
 * AI heuristic parsing test endpoint
 */
router.post('/parse', uploadResume.single('resume'), parseResume);

export default router;
