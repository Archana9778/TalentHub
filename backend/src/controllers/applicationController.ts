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

// Controlled status transition rules:
// Applied → Screening
// Screening → Interview | Rejected
// Interview → Offer | Rejected
// Offer → Hired | Rejected
export const ALLOWED_STATUS_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  Applied: ['Screening'],
  Screening: ['Interview', 'Rejected'],
  Interview: ['Offer', 'Rejected'],
  Offer: ['Hired', 'Rejected'],
  Hired: [],
  Rejected: [],
};

export const applyForJob = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { jobId, coverLetter } = req.body;
  const job = db.getJobById(jobId);

  if (!job) {
    res.status(404).json({ message: 'Target job posting not found.' });
    return;
  }

  if (job.status !== 'active') {
    res.status(400).json({ message: 'This job posting is no longer accepting applications.' });
    return;
  }

  // Check if candidate already applied
  const existingApp = db
    .getApplicationsByCandidateId(req.user.id)
    .find((a) => a.jobId === jobId);

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

  const matchDetails = AzureDocumentIntelligenceService.computeMatchScore(
    candidateSkills,
    candidateYears,
    job
  );

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

  db.createApplication(newApplication);

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
  db.createApplicationHistory(historyEntry);

  res.status(201).json({
    message: 'Application submitted successfully.',
    application: newApplication,
  });
};

export const getCandidateApplications = (req: AuthRequest, res: Response): void => {
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

  const applications = db.getApplicationsByCandidateId(candidateId);
  res.json({ total: applications.length, applications });
};

export const getAllApplications = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  let applications = db.getApplications();

  // Company-level isolation and Role checks:
  if (req.user.role === 'candidate') {
    applications = applications.filter((a) => a.candidateId === req.user!.id);
  } else if (req.user.role === 'recruiter') {
    // Only return applications belonging to recruiter's company
    const recruiterCompanyId = req.user.companyId;
    applications = applications.filter((a) => {
      if (a.companyId) {
        return a.companyId === recruiterCompanyId;
      }
      const job = db.getJobById(a.jobId);
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

  // Sorting
  const order = sortOrder === 'asc' ? 1 : -1;
  const sort = (sortBy as string) || 'date';

  if (sort === 'date') {
    applications.sort(
      (a, b) => order * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    );
  } else if (sort === 'status') {
    applications.sort((a, b) => order * a.stage.localeCompare(b.stage));
  } else if (sort === 'matchScore') {
    applications.sort((a, b) => order * (a.matchScore - b.matchScore));
  } else if (sort === 'name') {
    applications.sort((a, b) => order * a.candidateName.localeCompare(b.candidateName));
  }

  res.json({ total: applications.length, applications });
};

export const getJobApplicants = (req: AuthRequest, res: Response): void => {
  // Delegate to getAllApplications with backward-compatible response
  return getAllApplications(req, res);
};

export const getApplicationById = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = req.params.id as string;
  const application = db.getApplicationById(id);

  if (!application) {
    res.status(404).json({ message: 'Application not found.' });
    return;
  }

  const targetJob = db.getJobById(application.jobId);

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

  const candidateProfile = db.getUserById(application.candidateId);
  const history = db.getApplicationHistory(application.id);

  res.json({
    application,
    candidate: candidateProfile
      ? {
          id: candidateProfile.id,
          name: candidateProfile.name,
          email: candidateProfile.email,
          phone: candidateProfile.phone || candidateProfile.contactNumber,
          title: candidateProfile.title || candidateProfile.designation,
          bio: candidateProfile.bio,
          skills: candidateProfile.skills,
          experience: candidateProfile.experience,
          education: candidateProfile.education,
          avatarUrl: candidateProfile.avatarUrl,
        }
      : null,
    job: targetJob,
    history: history.length > 0 ? history : application.timeline,
  });
};

export const updateApplicationStatus = (req: AuthRequest, res: Response): void => {
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
  const application = db.getApplicationById(id);

  if (!application) {
    res.status(404).json({ message: 'Application not found.' });
    return;
  }

  const job = db.getJobById(application.jobId);

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

  db.createApplicationHistory(historyEntry);

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

  const updatedTimeline = [...application.timeline, timelineEntry];

  const updated = db.updateApplication(id, {
    stage: targetStage,
    timeline: updatedTimeline,
    ...(interviewDate && { interviewDate }),
    ...(interviewType && { interviewType }),
    ...(recruiterNotes !== undefined && { recruiterNotes }),
    updatedAt: now,
  });

  res.json({
    message: `Candidate application moved to status: ${targetStage}`,
    application: updated,
    historyEntry,
  });
};

export const getApplicationAuditTimeline = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = req.params.id as string;
  const application = db.getApplicationById(id);

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
    const job = db.getJobById(application.jobId);
    const companyId = application.companyId || job?.companyId;
    if (companyId !== req.user.companyId) {
      res.status(403).json({
        message: 'Forbidden: You cannot view application history for other companies.',
      });
      return;
    }
  }

  const persistentHistory = db.getApplicationHistory(id);

  // If persistent history exists, return it; otherwise return structured timeline
  const resultHistory =
    persistentHistory.length > 0
      ? persistentHistory
      : application.timeline.map((item, idx) => ({
          id: `timeline-${idx}`,
          applicationId: application.id,
          previousStatus: item.previousStage || (idx === 0 ? 'None' : application.timeline[idx - 1].stage),
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
    timeline: application.timeline,
  });
};
