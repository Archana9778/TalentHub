import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import {
  Application,
  ApplicationStage,
  ApplicationStatusHistory,
  StageTimelineItem,
} from '../types';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';
import { MatchingService } from '../services/matchingService';

// Controlled status transition rules:
// Applied -> Screening
// Screening -> Interview | Rejected
// Interview -> Offer | Rejected
// Offer -> Hired | Rejected
export const ALLOWED_STATUS_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  Applied: ['Screening'],
  Screening: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Hired', 'Rejected'],
  Hired: [],
  Rejected: [],
};

export const applyForJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { jobId, coverLetter } = req.body;
    const job = await db.getJobById(jobId);

    if (!job) {
      res.status(404).json({ message: 'Target job posting not found.' });
      return;
    }

    if (job.status !== 'active') {
      res.status(400).json({ message: 'This job posting is no longer accepting applications.' });
      return;
    }

    // Check if candidate already applied
    const candidateApps = await db.getApplicationsByCandidateId(req.user.id);
    const existingApp = candidateApps.find((a) => a.jobId === jobId);

    if (existingApp) {
      res.status(409).json({ message: 'You have already submitted an application for this position.' });
      return;
    }

    let resumeUrl = req.user.resumeUrl || '/uploads/resumes/sample-alex-morgan-resume.pdf';
    if (req.file) {
      resumeUrl = `/uploads/${req.file.filename}`;
    }

    // Candidate skills and experience calculation
    const candidateSkills =
      req.user.skills && req.user.skills.length > 0
        ? req.user.skills
        : ['React', 'TypeScript', 'Node.js', 'Java'];
    const candidateYears = req.user.experience ? Math.max(req.user.experience.length * 2, 3) : 4;

    const matchDetails = MatchingService.computeCandidateJobMatch(req.user, job);

    const appId = `app-${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    const initialTimelineItem: StageTimelineItem = {
      stage: 'Applied',
      previousStage: 'None',
      changedBy: req.user.id,
      changedByName: req.user.name,
      changedAt: now,
      comment: 'Candidate submitted online application via TalentHub portal.',
      reason: 'Initial job application submission',
    };

    const newApplication: Application = {
      id: appId,
      jobId: job.id,
      jobTitle: job.title,
      companyId: job.companyId,
      companyName: job.companyName,
      candidateId: req.user.id,
      candidateName: req.user.name,
      candidateEmail: req.user.email,
      candidatePhone: req.user.phone || req.user.contactNumber,
      candidateAvatar: req.user.avatarUrl,
      candidateTitle: req.user.title || req.user.designation,
      resumeUrl,
      coverLetter: coverLetter || '',
      stage: 'Applied',
      matchScore: matchDetails.score,
      matchDetails,
      recruiterNotes: 'Application received and processed by Azure AI Document Intelligence.',
      assignedRecruiterId: job.recruiterId,
      assignedRecruiterName: job.recruiterName,
      timeline: [initialTimelineItem],
      createdAt: now,
      updatedAt: now,
    };

    await db.createApplication(newApplication);

    // Store in persistent application status history
    const historyEntry: ApplicationStatusHistory = {
      id: `hist-${uuidv4().substring(0, 8)}`,
      applicationId: appId,
      previousStatus: 'None',
      newStatus: 'Applied',
      changedBy: req.user.id,
      changedByName: req.user.name,
      timestamp: now,
      reason: 'Application submitted via TalentHub portal.',
    };
    await db.createApplicationHistory(historyEntry);

    res.status(201).json({
      message: 'Application submitted successfully.',
      application: newApplication,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error submitting application', error: err.message });
  }
};

export const getCandidateApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const rawCandidateId = req.params.candidateId;
    const candidateId = (typeof rawCandidateId === 'string' ? rawCandidateId : undefined) || req.user.id;

    // Security: Candidate can only view their own applications
    if (req.user.role === 'candidate' && req.user.id !== candidateId) {
      res.status(403).json({
        message: 'Forbidden: Candidates can view only their own applications.',
      });
      return;
    }

    const applications = await db.getApplicationsByCandidateId(candidateId);
    res.json({ total: applications.length, applications });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving applications', error: err.message });
  }
};

export const getAllApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    let applications = await db.getApplications();

    // Company-level isolation and Role checks:
    if (req.user.role === 'candidate') {
      applications = applications.filter((a) => a.candidateId === req.user!.id);
    } else if (req.user.role === 'recruiter') {
      // Only return applications belonging to recruiter's company
      const recruiterCompanyId = req.user.companyId;
      const allJobs = await db.getJobs();
      const jobMap = new Map(allJobs.map((j) => [j.id, j]));
      applications = applications.filter((a) => {
        if (a.companyId) {
          return a.companyId === recruiterCompanyId;
        }
        const job = jobMap.get(a.jobId);
        return job && job.companyId === recruiterCompanyId;
      });
    }

    const {
      search,
      jobId,
      stage,
      status,
      startDate,
      endDate,
      assignedRecruiterId,
      sortBy,
      sortOrder,
    } = req.query;

    // Job Filter
    if (jobId && typeof jobId === 'string' && jobId !== 'all') {
      applications = applications.filter((a) => a.jobId === jobId);
    }
    if (req.user.role === 'recruiter' && !req.user.companyId) {
      // When recruiter has no company affiliation, restrict strictly to their own posted jobs
      const allJobs = await db.getJobs();
      const recruiterJobs = allJobs.filter((j) => j.recruiterId === req.user!.id);
      const recruiterJobIds = new Set(recruiterJobs.map((j) => j.id));
      applications = applications.filter((a) => recruiterJobIds.has(a.jobId));
    }

    // Status Filter
    const statusFilter = status || stage;
    if (statusFilter && typeof statusFilter === 'string' && statusFilter !== 'all') {
      applications = applications.filter((a) => a.stage.toLowerCase() === statusFilter.toLowerCase());
    }

    // Assigned Recruiter Filter
    if (assignedRecruiterId && typeof assignedRecruiterId === 'string' && assignedRecruiterId !== 'all') {
      applications = applications.filter(
        (a) => a.assignedRecruiterId === assignedRecruiterId
      );
    }

    // Candidate Name or Email Search
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      applications = applications.filter(
        (a) =>
          a.candidateName.toLowerCase().includes(q) ||
          a.candidateEmail.toLowerCase().includes(q) ||
          a.jobTitle.toLowerCase().includes(q)
      );
    }

    // Application Date Filters
    if (startDate && typeof startDate === 'string') {
      const start = new Date(startDate).getTime();
      if (!isNaN(start)) {
        applications = applications.filter((a) => new Date(a.createdAt).getTime() >= start);
      }
    }

    if (endDate && typeof endDate === 'string') {
      const end = new Date(endDate).getTime();
      if (!isNaN(end)) {
        applications = applications.filter((a) => new Date(a.createdAt).getTime() <= end + 86400000);
      }
    }

    // Enrich applications with fresh dynamic matching score
    const enrichedApplications = await Promise.all(
      applications.map(async (app) => {
        try {
          const candidateUser = await db.getUserById(app.candidateId);
          const targetJob = await db.getJobById(app.jobId);
          if (candidateUser && targetJob) {
            const freshMatch = MatchingService.computeCandidateJobMatch(candidateUser, targetJob);
            return {
              ...app,
              matchScore: freshMatch.score,
              matchDetails: freshMatch,
            };
          }
        } catch {
          // fallback to stored application match score
        }
        return app;
      })
    );

    // Sorting (supports main's sort=lowest|recent|highest as well as feature/login's sortBy & sortOrder)
    const rawSort = (req.query.sort as string) || (sortBy as string);
    const order = sortOrder === 'asc' ? 1 : -1;
    const sort = (sortBy as string) || rawSort || 'date';

    if (rawSort === 'lowest') {
      enrichedApplications.sort((a, b) => a.matchScore - b.matchScore);
    } else if (rawSort === 'recent') {
      enrichedApplications.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });
    } else if (rawSort === 'highest') {
      enrichedApplications.sort((a, b) => b.matchScore - a.matchScore);
    } else if (sort === 'date') {
      enrichedApplications.sort(
        (a, b) => order * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
    } else if (sort === 'status') {
      enrichedApplications.sort((a, b) => order * a.stage.localeCompare(b.stage));
    } else if (sort === 'matchScore') {
      enrichedApplications.sort((a, b) => order * (a.matchScore - b.matchScore));
    } else if (sort === 'name') {
      enrichedApplications.sort((a, b) => order * a.candidateName.localeCompare(b.candidateName));
    }

    res.json({ total: enrichedApplications.length, sort: rawSort || sort, applications: enrichedApplications });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving applications', error: err.message });
  }
};

export const getJobApplicants = async (req: AuthRequest, res: Response): Promise<void> => {
  return getAllApplications(req, res);
};

export const getApplicationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const application = await db.getApplicationById(id);

    if (!application) {
      res.status(404).json({ message: 'Application not found.' });
      return;
    }

    const targetJob = await db.getJobById(application.jobId);

    // Security: Candidate can view ONLY their own application
    if (req.user.role === 'candidate' && application.candidateId !== req.user.id) {
      res.status(403).json({
        message: 'Forbidden: Candidates can view only their own applications.',
      });
      return;
    }

    // Security: Recruiter cannot access applications belonging to other companies
    if (req.user.role === 'recruiter') {
      const companyId = application.companyId || targetJob?.companyId;
      if (companyId !== req.user.companyId) {
        res.status(403).json({
          message: 'Forbidden: You cannot access applications belonging to other companies.',
        });
        return;
      }
    }

    const candidateProfile = await db.getUserById(application.candidateId);
    const history = await db.getApplicationHistory(application.id);

    // Compute fresh match details if profile and job exist
    let freshApp = application;
    if (candidateProfile && targetJob) {
      try {
        const freshMatch = MatchingService.computeCandidateJobMatch(candidateProfile, targetJob);
        freshApp = {
          ...application,
          matchScore: freshMatch.score,
          matchDetails: freshMatch,
        };
      } catch {
        // preserve existing matchDetails on error
      }
    }

    res.json({
      application: freshApp,
      candidate: candidateProfile
        ? {
            id: candidateProfile.id,
            name: candidateProfile.name,
            email: candidateProfile.email,
            phone: candidateProfile.phone || candidateProfile.contactNumber,
            title: candidateProfile.title || candidateProfile.designation,
            location: candidateProfile.location,
            bio: candidateProfile.bio,
            dateOfBirth: candidateProfile.dateOfBirth,
            gender: candidateProfile.gender,
            resumeUrl: candidateProfile.resumeUrl,
            resumeOriginalName: candidateProfile.resumeOriginalName,
            skills: candidateProfile.skills,
            experience: candidateProfile.experience,
            education: candidateProfile.education,
            avatarUrl: candidateProfile.avatarUrl,
          }
        : null,
      job: targetJob,
      history: history.length > 0 ? history : application.timeline,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving application details', error: err.message });
  }
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Candidates cannot update application status
    if (req.user.role === 'candidate') {
      res.status(403).json({ message: 'Forbidden: Candidates cannot update application statuses.' });
      return;
    }

    const id = req.params.id as string;
    const application = await db.getApplicationById(id);

    if (!application) {
      res.status(404).json({ message: 'Application not found.' });
      return;
    }

    const job = await db.getJobById(application.jobId);

    // Cross-company authorization check:
    if (req.user.role === 'recruiter') {
      const companyId = application.companyId || job?.companyId;
      if (companyId !== req.user.companyId) {
        res.status(403).json({
          message: 'Forbidden: Recruiters cannot update unauthorized applications from other companies.',
        });
        return;
      }
    }

    const rawStage = req.body.status || req.body.stage;
    const targetStage = rawStage as ApplicationStage;

    const validStages: ApplicationStage[] = [
      'Applied',
      'Screening',
      'Interview',
      'Offer',
      'Hired',
      'Rejected',
    ];

    if (!validStages.includes(targetStage)) {
      res.status(400).json({
        message: `Invalid status. Must be one of: ${validStages.join(', ')}`,
      });
      return;
    }

    const currentStage = application.stage;

    // If already at target stage, just return current
    if (currentStage === targetStage) {
      res.json({
        message: `Application is already at status: ${targetStage}`,
        application,
      });
      return;
    }

    const {
      comment,
      reason,
      rejectionReason,
      adminOverride,
      adminOverrideReason,
      interviewDate,
      interviewType,
      recruiterNotes,
    } = req.body;

    // Validate controlled status transitions:
    const allowedNextStages = ALLOWED_STATUS_TRANSITIONS[currentStage] || [];
    const isStandardTransitionAllowed = allowedNextStages.includes(targetStage);

    if (!isStandardTransitionAllowed) {
      // Check if caller is authorized administrator performing a status correction
      const isCallerAdmin =
        req.user.role === 'admin' ||
        (req.user.role === 'recruiter' && req.user.companyRole === 'admin');

      if (isCallerAdmin && adminOverride) {
        const overrideReason = adminOverrideReason || reason || comment;
        if (!overrideReason || overrideReason.trim().length === 0) {
          res.status(400).json({
            message: 'An administrative status correction requires a recorded reason.',
          });
          return;
        }
      } else {
        res.status(400).json({
          message: `Invalid status transition from "${currentStage}" to "${targetStage}". Allowed transitions from "${currentStage}": [${
            allowedNextStages.join(', ') || 'None (terminal stage)'
          }].`,
        });
        return;
      }
    }

    // Requirement: Require a rejection reason when moving an application to Rejected
    if (targetStage === 'Rejected') {
      const effectiveRejectionReason = rejectionReason || reason || comment;
      if (!effectiveRejectionReason || effectiveRejectionReason.trim().length === 0) {
        res.status(400).json({
          message: 'A rejection reason is required when moving an application to Rejected.',
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const effectiveReason =
      rejectionReason ||
      adminOverrideReason ||
      reason ||
      comment ||
      `Status transitioned from ${currentStage} to ${targetStage} by ${req.user.name}.`;

    // Persistent Audit History Entry
    const historyEntry: ApplicationStatusHistory = {
      id: `hist-${uuidv4().substring(0, 8)}`,
      applicationId: application.id,
      previousStatus: currentStage,
      newStatus: targetStage,
      changedBy: req.user.id,
      changedByName: req.user.name,
      timestamp: now,
      reason: effectiveReason,
      comments: comment,
      isAdminOverride: Boolean(adminOverride && !isStandardTransitionAllowed),
      interviewDate: targetStage === 'Interview' ? interviewDate : undefined,
      interviewType: targetStage === 'Interview' ? interviewType : undefined,
    };

    await db.createApplicationHistory(historyEntry);

    const timelineEntry: StageTimelineItem = {
      stage: targetStage,
      previousStage: currentStage,
      changedBy: req.user.id,
      changedByName: req.user.name,
      changedAt: now,
      comment: effectiveReason,
      reason: effectiveReason,
      isAdminOverride: Boolean(adminOverride && !isStandardTransitionAllowed),
    };

    const updatedTimeline = [...(application.timeline || []), timelineEntry];

    const updated = await db.updateApplication(
      id,
      {
        stage: targetStage,
        timeline: updatedTimeline,
        ...(interviewDate && { interviewDate }),
        ...(interviewType && { interviewType }),
        ...(recruiterNotes !== undefined && { recruiterNotes }),
        updatedAt: now,
      },
      {
        fromStage: currentStage,
        toStage: targetStage,
        changedByUserId: req.user.id,
        changedByName: req.user.name,
        comment: effectiveReason,
        interviewType: targetStage === 'Interview' ? interviewType : undefined,
        interviewDate: targetStage === 'Interview' ? interviewDate : undefined,
      }
    );

    res.json({
      message: `Candidate application moved to status: ${targetStage}`,
      application: updated,
      historyEntry,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating application status', error: err.message });
  }
};

export const updateApplicationStage = updateApplicationStatus;

export const getApplicationAuditTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const application = await db.getApplicationById(id);

    if (!application) {
      res.status(404).json({ message: 'Application not found.' });
      return;
    }

    // Security: Candidate can view only their own application history
    if (req.user.role === 'candidate' && application.candidateId !== req.user.id) {
      res.status(403).json({
        message: 'Forbidden: Candidates can view only their own application history.',
      });
      return;
    }

    // Security: Recruiter cannot view applications belonging to other companies
    if (req.user.role === 'recruiter') {
      const job = await db.getJobById(application.jobId);
      const companyId = application.companyId || job?.companyId;
      if (companyId !== req.user.companyId) {
        res.status(403).json({
          message: 'Forbidden: You cannot view application history for other companies.',
        });
        return;
      }
    }

    const persistentHistory = await db.getApplicationHistory(id);
    const stageHistory = persistentHistory.length === 0 ? await db.getApplicationStageHistory(id) : [];
    const sourceHistory = persistentHistory.length > 0 ? persistentHistory : stageHistory;

    // If persistent or stage history exists, return it; otherwise return structured timeline
    const resultHistory =
      sourceHistory.length > 0
        ? sourceHistory
        : (application.timeline || []).map((item, idx) => ({
            id: `timeline-${idx}`,
            applicationId: application.id,
            previousStatus:
              item.previousStage ||
              (idx === 0 ? 'None' : application.timeline[idx - 1]?.stage || 'None'),
            newStatus: item.stage,
            changedBy: item.changedBy,
            changedByName: item.changedByName,
            timestamp: item.changedAt,
            reason: item.comment || item.reason,
            comments: item.comment,
            isAdminOverride: item.isAdminOverride,
          }));

    res.json({
      total: resultHistory.length,
      history: resultHistory,
      timeline: application.timeline || [],
      auditTimeline: resultHistory,
      applicationId: application.id,
      jobTitle: application.jobTitle,
      candidateName: application.candidateName,
      currentStage: application.stage,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving audit timeline', error: err.message });
  }
};
