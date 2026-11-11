import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { ApplicationStage } from '../types';

export const getDashboardAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const user = req.user;

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
      const [allJobs, allApps] = await Promise.all([db.getJobs(), db.getApplications()]);
      const company = user.companyId ? await db.getCompanyById(user.companyId) : undefined;
      const companyRecruiters = user.companyId ? await db.getRecruiters(user.companyId) : [];
      const activeRecruiters = companyRecruiters.filter((r) => r.status === 'active');

      const companyJobs = user.companyId
        ? await db.getJobsByCompanyId(user.companyId)
        : allJobs.filter((j) => j.recruiterId === user.id);
      const myJobs = allJobs.filter((j) => j.recruiterId === user.id);

      const recruiterJobIds = new Set(myJobs.map((j) => j.id));
      const companyJobIds = new Set(companyJobs.map((j) => j.id));

      const companyApps = allApps.filter(
        (a) => companyJobIds.has(a.jobId) || (user.companyId && a.companyId === user.companyId)
      );
      const myApps = allApps.filter(
        (a) => recruiterJobIds.has(a.jobId) || a.assignedRecruiterId === user.id
      );

      const pipelineFunnel: Record<ApplicationStage, number> = {
        Applied: 0,
        Screening: 0,
        Interview: 0,
        Offer: 0,
        Hired: 0,
        Rejected: 0,
      };

      let totalMatchScore = 0;
      companyApps.forEach((a) => {
        if (pipelineFunnel[a.stage] !== undefined) {
          pipelineFunnel[a.stage] += 1;
        }
        totalMatchScore += a.matchScore || 0;
      });

      const averageMatchScore = companyApps.length > 0 ? Math.round(totalMatchScore / companyApps.length) : 0;

      res.json({
        analytics: {
          role: 'recruiter',
          company,
          totalRecruiters: companyRecruiters.length,
          activeRecruiters: activeRecruiters.length,
          totalCompanyJobs: companyJobs.length,
          assignedJobsCount: myJobs.length,
          myActiveJobs: myJobs.filter((j) => j.status === 'active').length,
          activeJobs: companyJobs.filter((j) => j.status === 'active').length,
          totalJobs: myJobs.length,
          totalApplicants: companyApps.length,
          myApplicantsCount: myApps.length,
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

    // Admin role — fetch everything in parallel
    const [allApps, allUsers, allCompanies, allJobs] = await Promise.all([
      db.getApplications(),
      db.getUsers(),
      db.getCompanies(),
      db.getJobs(),
    ]);

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
        stageCounts,
      },
    });
  } catch (err: any) {
    console.error('[analyticsController] getDashboardAnalytics error:', err);
    res.status(500).json({ message: 'Failed to retrieve analytics.', error: err.message });
  }
};
