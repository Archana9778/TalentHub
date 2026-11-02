import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Application, ApplicationStage } from '../types';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';

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

  db.createApplication(newApplication);

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

  const applications = db.getApplicationsByCandidateId(req.user.id);
  res.json({ total: applications.length, applications });
};

export const getJobApplicants = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { jobId, stage } = req.query;
  let applications = db.getApplications();

  // If specific job is requested
  if (jobId && typeof jobId === 'string') {
    applications = applications.filter((a) => a.jobId === jobId);
  } else if (req.user.role === 'recruiter') {
    // Only return applications for jobs belonging to this recruiter
    const recruiterJobs = db.getJobs().filter((j) => j.recruiterId === req.user!.id);
    const recruiterJobIds = new Set(recruiterJobs.map((j) => j.id));
    applications = applications.filter((a) => recruiterJobIds.has(a.jobId));
  }

  if (stage && typeof stage === 'string' && stage !== 'all') {
    applications = applications.filter((a) => a.stage === stage);
  }

  // Sort descending by matchScore
  applications.sort((a, b) => b.matchScore - a.matchScore);

  res.json({ total: applications.length, applications });
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

  // Check access permissions
  if (
    req.user.role === 'candidate' &&
    application.candidateId !== req.user.id
  ) {
    res.status(403).json({ message: 'Forbidden: You cannot access another candidate\'s application.' });
    return;
  }

  const candidateProfile = db.getUserById(application.candidateId);
  const targetJob = db.getJobById(application.jobId);

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
};

export const updateApplicationStage = (req: AuthRequest, res: Response): void => {
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

  const application = db.getApplicationById(id);
  if (!application) {
    res.status(404).json({ message: 'Application not found.' });
    return;
  }

  const timelineEntry = {
    stage: stage as ApplicationStage,
    changedBy: req.user.id,
    changedByName: req.user.name,
    changedAt: new Date().toISOString(),
    comment: comment || `Status moved to ${stage} by ${req.user.name}`,
  };

  const updatedTimeline = [...application.timeline, timelineEntry];

  const updated = db.updateApplication(id, {
    stage: stage as ApplicationStage,
    timeline: updatedTimeline,
    ...(interviewDate && { interviewDate }),
    ...(interviewType && { interviewType }),
    ...(recruiterNotes !== undefined && { recruiterNotes }),
  });

  res.json({
    message: `Candidate application moved to stage: ${stage}`,
    application: updated,
  });
};
