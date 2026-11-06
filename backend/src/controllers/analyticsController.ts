import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { ApplicationStage } from '../types';

export const getDashboardAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = req.user;
    const allJobs = await db.getJobs();
    const allApps = await db.getApplications();
    const allUsers = await db.getUsers();
    const allCompanies = await db.getCompanies();

    if (user.role === 'candidate') {
      const myApps = await db.getApplicationsByCandidateId(user.id);
      const totalApplications = myApps.length;
      const underReview = myApps.filter((a) => a.stage === 'Applied' || a.stage === 'Screening').length;
      const interviewsScheduled = myApps.filter((a) => a.stage === 'Interview').length;
      const offersReceived = myApps.filter((a) => a.stage === 'Offer' || a.stage === 'Hired').length;
      const rejectedApplications = myApps.filter((a) => a.stage === 'Rejected').length;
      const activeApplications = totalApplications - rejectedApplications;

      res.json({
        analytics: {
          role: 'candidate',
          totalApplications,
          underReview,
          interviewsScheduled,
          offersReceived,
          rejectedApplications,
          activeApplications,
        },
      });
      return;
    }

    if (user.role === 'recruiter') {
      const recruiterJobs = allJobs.filter((j) => j.recruiterId === user.id);
      const recruiterJobIds = new Set(recruiterJobs.map((j) => j.id));
      const recruiterApps = allApps.filter((a) => recruiterJobIds.has(a.jobId));

      const pipelineFunnel: Record<ApplicationStage, number> = {
        Applied: 0,
        Screening: 0,
        Interview: 0,
        Offer: 0,
        Hired: 0,
        Rejected: 0,
      };

      let totalMatchScore = 0;
      recruiterApps.forEach((a) => {
        if (pipelineFunnel[a.stage] !== undefined) {
          pipelineFunnel[a.stage] += 1;
        }
        totalMatchScore += a.matchScore;
      });

      const averageMatchScore = recruiterApps.length > 0 ? Math.round(totalMatchScore / recruiterApps.length) : 0;

      res.json({
        analytics: {
          role: 'recruiter',
          activeJobs: recruiterJobs.filter((j) => j.status === 'active').length,
          totalJobs: recruiterJobs.length,
          totalApplicants: recruiterApps.length,
          candidatesUnderScreening: pipelineFunnel['Screening'],
          interviewsInProgress: pipelineFunnel['Interview'],
          offersExtended: pipelineFunnel['Offer'],
          hiresCompleted: pipelineFunnel['Hired'],
          averageMatchScore,
          pipelineFunnel,
        },
      });
      return;
    }

    // Admin role
    const stageCounts: Record<ApplicationStage, number> = {
      Applied: 0,
      Screening: 0,
      Interview: 0,
      Offer: 0,
      Hired: 0,
      Rejected: 0,
    };
    allApps.forEach((a) => {
      if (stageCounts[a.stage] !== undefined) stageCounts[a.stage] += 1;
    });

    res.json({
      analytics: {
        role: 'admin',
        totalUsers: allUsers.length,
        totalCandidates: allUsers.filter((u) => u.role === 'candidate').length,
        totalRecruiters: allUsers.filter((u) => u.role === 'recruiter').length,
        totalCompanies: allCompanies.length,
        totalJobs: allJobs.length,
        activeJobs: allJobs.filter((j) => j.status === 'active').length,
        totalApplications: allApps.length,
        pipelineFunnel: stageCounts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving dashboard analytics', error: err.message });
  }
};
