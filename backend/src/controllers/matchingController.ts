import { Response } from 'express';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { MatchingService } from '../services/matchingService';

/**
 * GET /api/jobs/:jobId/matches
 * Retrieves all applicants for a job, ranked by matching score.
 * Query parameters:
 *  - sort: 'highest' (default) | 'lowest' | 'recent'
 *  - stage: 'all' | ApplicationStage
 */
export const getJobMatches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const jobId = req.params.jobId as string;
    const sortParam = (req.query.sort as string) || 'highest';
    const sort = sortParam === 'lowest' || sortParam === 'recent' ? sortParam : 'highest';
    const stage = (req.query.stage as string) || 'all';

    const job = await db.getJobById(jobId);
    if (!job) {
      res.status(404).json({ message: `Job posting with ID ${jobId} not found.` });
      return;
    }

    // Recruiter authorization: recruiter can only view matches for their own jobs
    if (req.user.role === 'recruiter' && job.recruiterId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to view matches for this requisition.' });
      return;
    }

    const matches = await MatchingService.getJobMatches(jobId, sort, stage);

    res.json({
      total: matches.length,
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.companyName,
      sort,
      stage,
      matches,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error computing candidate job matches', error: err.message });
  }
};

/**
 * GET /api/jobs/:jobId/matches/:candidateId
 * Retrieves detailed matching score breakdown between candidate and job.
 */
export const getJobCandidateMatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const jobId = req.params.jobId as string;
    const candidateId = req.params.candidateId as string;

    const job = await db.getJobById(jobId);
    if (!job) {
      res.status(404).json({ message: `Job posting with ID ${jobId} not found.` });
      return;
    }

    // Access control: admin, recruiter who owns the job, or the candidate themselves
    const canAccess =
      req.user.role === 'admin' ||
      (req.user.role === 'recruiter' && job.recruiterId === req.user.id) ||
      (req.user.role === 'candidate' && req.user.id === candidateId);

    if (!canAccess) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to view this match analysis.' });
      return;
    }

    const matchResult = await MatchingService.getCandidateMatchForJob(jobId, candidateId);

    res.json(matchResult);
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving candidate match breakdown', error: err.message });
  }
};
