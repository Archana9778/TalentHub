import { Router } from 'express';
import {
  uploadResume as uploadResumeController,
  getMyResume,
  getResumeHistory,
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
 * Upload (or replace) the authenticated candidate's resume.
 * Accepts: multipart/form-data, field name "resume".
 */
router.post(
  '/upload',
  requireRoles('candidate'),
  uploadResume.single('resume'),
  uploadResumeController
);

/**
 * GET /api/resume/my
 * Returns the current resume metadata for the authenticated candidate.
 */
router.get('/my', requireRoles('candidate'), getMyResume);

/**
 * GET /api/resume/history
 * Returns all resume version records for the authenticated candidate.
 */
router.get('/history', requireRoles('candidate'), getResumeHistory);

/**
 * GET /api/resume/download/:id
 * Generates a short-lived SAS URL for a specific resume document.
 * Candidates: own resumes only.
 * Recruiters: only if they manage a job the candidate applied to.
 * Admins: unrestricted.
 */
router.get('/download/:id', getResumeDownloadUrl);

/**
 * POST /api/resume/parse
 * Azure AI Document Intelligence simulation (no file storage).
 */
router.post('/parse', uploadResume.single('resume'), parseResume);

export default router;
