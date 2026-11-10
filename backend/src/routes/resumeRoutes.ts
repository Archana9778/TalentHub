import { Router } from 'express';
import {
  uploadResume as uploadResumeController,
  parseResume,
  downloadResume,
} from '../controllers/resumeController';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';

const router = Router();

// Candidate uploads resume (PDF/DOCX)
router.post(
  '/upload',
  authenticateToken,
  requireRoles('candidate'),
  uploadResume.single('resume'),
  uploadResumeController
);

// Heuristic parser test endpoint
router.post(
  '/parse',
  authenticateToken,
  uploadResume.single('resume'),
  parseResume
);

// Secure authenticated resume download (own resume)
router.get(
  '/download',
  authenticateToken,
  downloadResume
);

// Secure authorized resume download for specific candidate (recruiter / admin / candidate)
router.get(
  '/download/:candidateId',
  authenticateToken,
  downloadResume
);

export default router;
