import { Response } from 'express';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { SkillComparisonService } from '../services/skillComparisonService';

/**
 * GET /api/jobs/:jobId/candidates/:candidateId/skill-match
 * Compares candidate skills against job requirements.
 * Returns matching skills, missing skills, additional skills, and matching percentage.
 */
export const getCandidateSkillMatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }

    const jobId = req.params.jobId as string;
    const candidateId = req.params.candidateId as string;

    if (!jobId || !candidateId) {
      res.status(400).json({ message: 'Job ID and Candidate ID are required parameters.' });
      return;
    }

    const job = await db.getJobById(jobId);
    if (!job) {
      res.status(404).json({ message: `Job requisition with ID "${jobId}" not found.` });
      return;
    }

    const candidate = await db.getUserById(candidateId);
    if (!candidate) {
      res.status(404).json({ message: `Candidate with ID "${candidateId}" not found.` });
      return;
    }

    // Recruiter authorization check:
    // Only admins, the recruiter assigned to the job, or the candidate themselves can access
    const isAuthorized =
      req.user.role === 'admin' ||
      (req.user.role === 'recruiter' && job.recruiterId === req.user.id) ||
      (req.user.role === 'candidate' && req.user.id === candidateId);

    if (!isAuthorized) {
      res.status(403).json({
        message: 'Forbidden: You do not have permission to view skill comparisons for this job candidate.',
      });
      return;
    }

    const result = await SkillComparisonService.compareCandidateToJob(jobId, candidateId);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      message: 'Failed to perform candidate skill comparison against job requirements.',
      error: err.message,
    });
  }
};

