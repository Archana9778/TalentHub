import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Application, ApplicationStage } from '../types';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';

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
    const existingApps = await db.getApplicationsByCandidateId(req.user.id);
    const existingApp = existingApps.find((a) => a.jobId === jobId);

    if (existingApp) {
      res.status(409).json({ message: 'You have already submitted an application for this position.' });
      return;
    }

    let resumeUrl = req.user.resumeUrl || '/uploads/resumes/default-profile-resume.pdf';
    if (req.file) {
      resumeUrl = `/uploads/resumes/${req.file.filename}`;
    }

    // Candidate skills and experience calculation
    const candidateSkills = req.user.skills && req.user.skills.length > 0
      ? req.user.skills
      : ['React', 'TypeScript', 'Node.js', 'Java'];
    const candidateYears = req.user.experience ? Math.max(req.user.experience.length * 2, 3) : 4;

    const matchDetails = AzureDocumentIntelligenceService.computeMatchScore(
      candidateSkills,
      candidateYears,
      job
    );

    const newApplication: Application = {
      id: `app-${uuidv4().substring(0, 8)}`,
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.companyName,
      candidateId: req.user.id,
      candidateName: req.user.name,
      candidateEmail: req.user.email,
      candidatePhone: req.user.phone,
      candidateAvatar: req.user.avatarUrl,
      candidateTitle: req.user.title,
      resumeUrl,
      coverLetter: coverLetter || '',
      stage: 'Applied',
      matchScore: matchDetails.score,
      matchDetails,
      recruiterNotes: 'Application received and processed by Azure AI Document Intelligence.',
      timeline: [
        {
          stage: 'Applied',
          changedBy: req.user.id,
          changedByName: req.user.name,
          changedAt: new Date().toISOString(),
          comment: 'Candidate submitted online application via TalentHub portal.',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createApplication(newApplication);

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
    if (req.user.role !== 'admin' && req.user.id !== candidateId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const applications = await db.getApplicationsByCandidateId(candidateId);
    res.json({ total: applications.length, applications });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving applications', error: err.message });
  }
};

export const getJobApplicants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const rawJobId = req.params.jobId || req.query.jobId;
    const jobId = Array.isArray(rawJobId) ? rawJobId[0] : (rawJobId as string | undefined);
    const stage = req.query.stage;
    let applications = await db.getApplications();

    // If specific job is requested
    if (jobId && typeof jobId === 'string' && jobId !== 'all') {
      applications = applications.filter((a) => a.jobId === jobId);
    }
    if (req.user.role === 'recruiter') {
      // Recruiters may only view applicants for their own jobs, including filtered queries.
      const recruiterJobs = (await db.getJobs()).filter((j) => j.recruiterId === req.user!.id);
      const recruiterJobIds = new Set(recruiterJobs.map((j) => j.id));
      applications = applications.filter((a) => recruiterJobIds.has(a.jobId));
    }

    if (stage && typeof stage === 'string' && stage !== 'all') {
      applications = applications.filter((a) => a.stage === stage);
    }

    // Sort descending by matchScore
    applications.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ total: applications.length, applications });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving applicants', error: err.message });
  }
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

    // Check access permissions
    const applicationJob = await db.getJobById(application.jobId);
    const canView = req.user.role === 'admin' ||
      (req.user.role === 'candidate' && application.candidateId === req.user.id) ||
      (req.user.role === 'recruiter' && applicationJob?.recruiterId === req.user.id);
    if (!canView) {
      res.status(403).json({ message: 'Forbidden: You cannot access another candidate\'s application.' });
      return;
    }

    const candidateProfile = await db.getUserById(application.candidateId);
    const targetJob = await db.getJobById(application.jobId);

    res.json({
      application,
      candidate: candidateProfile ? {
        id: candidateProfile.id,
        name: candidateProfile.name,
        email: candidateProfile.email,
        phone: candidateProfile.phone,
        title: candidateProfile.title,
        bio: candidateProfile.bio,
        skills: candidateProfile.skills,
        experience: candidateProfile.experience,
        education: candidateProfile.education,
        avatarUrl: candidateProfile.avatarUrl,
      } : null,
      job: targetJob,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving application', error: err.message });
  }
};

export const updateApplicationStage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const { stage, comment, interviewDate, interviewType, recruiterNotes } = req.body;

    const validStages: ApplicationStage[] = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
    if (!validStages.includes(stage)) {
      res.status(400).json({
        message: `Invalid stage. Must be one of: ${validStages.join(', ')}`,
      });
      return;
    }

    const application = await db.getApplicationById(id);
    if (!application) {
      res.status(404).json({ message: 'Application not found.' });
      return;
    }

    if (req.user.role === 'recruiter') {
      const job = await db.getJobById(application.jobId);
      if (!job || job.recruiterId !== req.user.id) {
        res.status(403).json({ message: 'Forbidden: You can only update applications for your own jobs.' });
        return;
      }
    }

    const timelineEntry = {
      stage: stage as ApplicationStage,
      changedBy: req.user.id,
      changedByName: req.user.name,
      changedAt: new Date().toISOString(),
      comment: comment || `Status moved to ${stage} by ${req.user.name}`,
    };

    const updatedTimeline = [...(application.timeline || []), timelineEntry];

    const updated = await db.updateApplication(
      id,
      {
        stage: stage as ApplicationStage,
        timeline: updatedTimeline,
        ...(interviewDate && { interviewDate }),
        ...(interviewType && { interviewType }),
        ...(recruiterNotes !== undefined && { recruiterNotes }),
      },
      {
        fromStage: application.stage,
        toStage: stage,
        changedByUserId: req.user.id,
        changedByName: req.user.name,
        comment: comment || `Status moved to ${stage} by ${req.user.name}`,
        interviewType: interviewType || undefined,
        interviewDate: interviewDate || undefined,
      }
    );

    res.json({
      message: `Candidate application moved to stage: ${stage}`,
      application: updated,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating application stage', error: err.message });
  }
};

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

    const job = req.user.role === 'recruiter' ? await db.getJobById(application.jobId) : undefined;
    const canView = req.user.role === 'admin' ||
      (req.user.role === 'candidate' && application.candidateId === req.user.id) ||
      (req.user.role === 'recruiter' && job?.recruiterId === req.user.id);
    if (!canView) {
      res.status(403).json({ message: 'Forbidden: You cannot access this application audit history.' });
      return;
    }

    // Try relational stage history first, fallback to JSON timeline
    const history = await db.getApplicationStageHistory(id);
    const timeline = history && history.length > 0 ? history : (application.timeline || []);

    res.json({
      total: timeline.length,
      timeline,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving audit timeline', error: err.message });
  }
};
