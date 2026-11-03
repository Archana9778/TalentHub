import { Router } from 'express';
import { uploadResume as uploadResumeController, parseResume } from '../controllers/resumeController';
import { authenticateToken } from '../middleware/auth';
import { uploadResume } from '../middleware/upload';

const router = Router();

router.post('/upload', authenticateToken, uploadResume.single('resume'), uploadResumeController);
router.post('/parse', authenticateToken, uploadResume.single('resume'), parseResume);

export default router;

