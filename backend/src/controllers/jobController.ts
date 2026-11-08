import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Job, ReportedJob } from '../types';

export const getAllJobs = (req: Request, res: Response): void => {
  try {
    let jobs = db.getJobs();

    const {
      search,
      category,
      location,
      workplaceType,
      jobType,
      experienceLevel,
      minSalary,
      maxSalary,
      status,
      featuredOnly,
      companyId,
      recruiterId,
    } = req.query;

    // Status filter (defaults to active unless specified)
    if (status) {
      jobs = jobs.filter((j) => j.status === status);
    } else {
      jobs = jobs.filter((j) => j.status === 'active');
    }

    // Company filter
    if (companyId && typeof companyId === 'string' && companyId !== 'all') {
      jobs = jobs.filter((j) => j.companyId === companyId);
    }

    // Recruiter filter
    if (recruiterId && typeof recruiterId === 'string' && recruiterId !== 'all') {
      jobs = jobs.filter((j) => j.recruiterId === recruiterId);
    }

    // Keyword search over title, description, skills, company name
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.companyName.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q) ||
          j.skills.some((s) => s.toLowerCase().includes(q)) ||
          j.location.toLowerCase().includes(q)
      );
    }

    // Category
    if (category && typeof category === 'string' && category !== 'all') {
      jobs = jobs.filter((j) => j.categoryId === category || j.categoryName.toLowerCase() === category.toLowerCase());
    }

    // Location
    if (location && typeof location === 'string') {
      const loc = location.toLowerCase().trim();
      jobs = jobs.filter((j) => j.location.toLowerCase().includes(loc));
    }

    // Workplace type (Remote, On-site, Hybrid)
    if (workplaceType && typeof workplaceType === 'string' && workplaceType !== 'all') {
      jobs = jobs.filter((j) => j.workplaceType.toLowerCase() === workplaceType.toLowerCase());
    }

    // Job type (Full-time, Part-time, Contract, Internship)
    if (jobType && typeof jobType === 'string' && jobType !== 'all') {
      jobs = jobs.filter((j) => j.jobType.toLowerCase() === jobType.toLowerCase());
    }

    // Experience level
    if (experienceLevel && typeof experienceLevel === 'string' && experienceLevel !== 'all') {
      jobs = jobs.filter((j) => j.experienceLevel.toLowerCase() === experienceLevel.toLowerCase());
    }

    // Salary range
    if (minSalary) {
      const min = Number(minSalary);
      if (!isNaN(min)) jobs = jobs.filter((j) => j.salaryMax >= min);
    }
    if (maxSalary) {
      const max = Number(maxSalary);
      if (!isNaN(max)) jobs = jobs.filter((j) => j.salaryMin <= max);
    }

    if (featuredOnly === 'true') {
      jobs = jobs.filter((j) => j.isFeatured);
    }

    res.json({
      total: jobs.length,
      jobs,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving jobs', error: err.message });
  }
};

export const getJobById = (req: Request, res: Response): void => {
  const id = req.params.id as string;
  const job = db.getJobById(id);

  if (!job) {
    res.status(404).json({ message: 'Job posting not found.' });
    return;
  }

  // Increment view counter
  db.incrementJobViews(id);

  const company = db.getCompanyById(job.companyId);
  const recruiter = db.getUserById(job.recruiterId);

  res.json({
    job,
    company,
    recruiter: recruiter
      ? {
          id: recruiter.id,
          name: recruiter.name,
          email: recruiter.email,
          title: recruiter.title || recruiter.designation,
          phone: recruiter.phone || recruiter.contactNumber,
        }
      : null,
  });
};

export const createJob = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const {
    title,
    companyId: rawCompanyId,
    categoryId,
    categoryName,
    location,
    workplaceType,
    jobType,
    experienceLevel,
    salaryMin,
    salaryMax,
    salaryCurrency,
    description,
    requirements,
    skills,
    benefits,
    isFeatured,
    expiresAt,
    assignedRecruiterId,
  } = req.body;

  if (!title || !description || !location) {
    res.status(400).json({ message: 'Title, description, and location are required.' });
    return;
  }

  // Determine target company:
  // If caller is recruiter, target company is strictly caller's company!
  let resolvedCompanyId = req.user.companyId;
  if (req.user.role === 'admin' && rawCompanyId) {
    resolvedCompanyId = rawCompanyId;
  }

  if (!resolvedCompanyId) {
    res.status(400).json({ message: 'Company must be associated with the job posting.' });
    return;
  }

  const company = db.getCompanyById(resolvedCompanyId);
  if (!company) {
    res.status(404).json({ message: 'Associated company profile does not exist.' });
    return;
  }

  // Determine assigned recruiter:
  let targetRecruiter = req.user;
  if (assignedRecruiterId && assignedRecruiterId !== req.user.id) {
    // Only company admin or platform admin can assign to another recruiter initially
    if (req.user.role === 'recruiter' && req.user.companyRole !== 'admin') {
      res.status(403).json({
        message: 'Only company administrators can assign jobs to other recruiters.',
      });
      return;
    }
    const foundRecruiter = db.getUserById(assignedRecruiterId);
    if (!foundRecruiter || foundRecruiter.role !== 'recruiter') {
      res.status(400).json({ message: 'Selected assigned recruiter does not exist.' });
      return;
    }
    if (foundRecruiter.companyId !== resolvedCompanyId) {
      res.status(400).json({
        message: 'Assigned recruiter must belong to the same company.',
      });
      return;
    }
    targetRecruiter = foundRecruiter;
  }

  const category = categoryId ? db.getCategoryById(categoryId) : undefined;
  const resolvedCategoryName = category ? category.name : categoryName || 'Full Stack & Web Engineering';
  const resolvedCategoryId = category ? category.id : categoryId || 'cat-1';

  const newJob: Job = {
    id: `job-${uuidv4().substring(0, 8)}`,
    title: title.trim(),
    companyId: company.id,
    companyName: company.name,
    companyLogo: company.logo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
    recruiterId: targetRecruiter.id,
    recruiterName: targetRecruiter.name,
    categoryId: resolvedCategoryId,
    categoryName: resolvedCategoryName,
    location: location.trim(),
    workplaceType: workplaceType || 'Hybrid',
    jobType: jobType || 'Full-time',
    experienceLevel: experienceLevel || 'Mid-level',
    salaryMin: Number(salaryMin) || 100000,
    salaryMax: Number(salaryMax) || 140000,
    salaryCurrency: salaryCurrency || 'USD',
    description: description.trim(),
    requirements: Array.isArray(requirements) ? requirements : requirements ? [requirements] : [],
    skills: Array.isArray(skills) ? skills : skills ? skills.split(',').map((s: string) => s.trim()) : [],
    benefits: Array.isArray(benefits) ? benefits : benefits ? [benefits] : [],
    status: 'active',
    isFeatured: Boolean(isFeatured),
    applicantsCount: 0,
    viewsCount: 1,
    expiresAt: expiresAt || '2026-12-31T23:59:59Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createJob(newJob);

  res.status(201).json({
    message: 'Job created successfully.',
    job: newJob,
  });
};

export const updateJob = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = req.params.id as string;
  const existing = db.getJobById(id);

  if (!existing) {
    res.status(404).json({ message: 'Job not found.' });
    return;
  }

  // Cross-company isolation & RBAC:
  if (req.user.role === 'recruiter') {
    if (existing.companyId !== req.user.companyId) {
      res.status(403).json({
        message: 'Forbidden: You cannot modify jobs belonging to other companies.',
      });
      return;
    }
    // Recruiter can edit if assigned or if company admin
    if (existing.recruiterId !== req.user.id && req.user.companyRole !== 'admin') {
      res.status(403).json({
        message: 'Forbidden: You do not have permission to edit this job posting.',
      });
      return;
    }
  }

  const updated = db.updateJob(id, req.body);
  res.json({ message: 'Job updated successfully.', job: updated });
};

export const deleteJob = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = req.params.id as string;
  const existing = db.getJobById(id);

  if (!existing) {
    res.status(404).json({ message: 'Job not found.' });
    return;
  }

  // Cross-company isolation & RBAC:
  if (req.user.role === 'recruiter') {
    if (existing.companyId !== req.user.companyId) {
      res.status(403).json({
        message: 'Forbidden: You cannot delete jobs belonging to other companies.',
      });
      return;
    }
    if (existing.recruiterId !== req.user.id && req.user.companyRole !== 'admin') {
      res.status(403).json({
        message: 'Forbidden: You do not have permission to delete this job posting.',
      });
      return;
    }
  }

  db.deleteJob(id);
  res.json({ message: 'Job posting deleted successfully.' });
};

export const assignJob = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const id = req.params.id as string;
  const { recruiterId } = req.body;

  if (!recruiterId || typeof recruiterId !== 'string') {
    res.status(400).json({ message: 'Target recruiterId is required.' });
    return;
  }

  const job = db.getJobById(id);
  if (!job) {
    res.status(404).json({ message: 'Job not found.' });
    return;
  }

  // Authorization check:
  if (req.user.role === 'recruiter') {
    // Must belong to the job's company
    if (job.companyId !== req.user.companyId) {
      res.status(403).json({
        message: 'Forbidden: You cannot manage jobs belonging to other companies.',
      });
      return;
    }
    // Must be company admin or the current assigned recruiter
    if (req.user.companyRole !== 'admin' && job.recruiterId !== req.user.id) {
      res.status(403).json({
        message: 'Forbidden: Only company administrators can reassign jobs.',
      });
      return;
    }
  }

  // Target recruiter validation:
  const targetRecruiter = db.getUserById(recruiterId);
  if (!targetRecruiter || targetRecruiter.role !== 'recruiter') {
    res.status(404).json({ message: 'Target recruiter account not found.' });
    return;
  }

  if (targetRecruiter.status !== 'active') {
    res.status(400).json({ message: 'Cannot assign job to an inactive recruiter.' });
    return;
  }

  // CRITICAL: Prevent cross-company assignment!
  if (targetRecruiter.companyId !== job.companyId) {
    res.status(400).json({
      message: 'Cannot reassign job: The target recruiter belongs to another company.',
    });
    return;
  }

  const updatedJob = db.updateJob(id, {
    recruiterId: targetRecruiter.id,
    recruiterName: targetRecruiter.name,
  });

  // Update applications for this job with the newly assigned recruiter
  const jobApplications = db.getApplicationsByJobId(id);
  jobApplications.forEach((app) => {
    db.updateApplication(app.id, {
      assignedRecruiterId: targetRecruiter.id,
      assignedRecruiterName: targetRecruiter.name,
    });
  });

  res.json({
    message: `Job posting successfully reassigned to ${targetRecruiter.name}.`,
    job: updatedJob,
  });
};

export const getRecruiterJobs = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { scope, companyId, recruiterId } = req.query;

  let jobs = db.getJobs();

  if (req.user.role === 'recruiter') {
    // Isolate to company
    jobs = jobs.filter((j) => j.companyId === req.user!.companyId);

    if (recruiterId && typeof recruiterId === 'string') {
      jobs = jobs.filter((j) => j.recruiterId === recruiterId);
    } else if (scope !== 'company') {
      // By default, return jobs assigned to the logged-in recruiter
      jobs = jobs.filter((j) => j.recruiterId === req.user!.id);
    }
  } else if (req.user.role === 'admin') {
    if (companyId && typeof companyId === 'string') {
      jobs = jobs.filter((j) => j.companyId === companyId);
    }
    if (recruiterId && typeof recruiterId === 'string') {
      jobs = jobs.filter((j) => j.recruiterId === recruiterId);
    }
  }

  res.json({ total: jobs.length, jobs });
};

export const reportJob = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { jobId, reason, details } = req.body;
  const targetJob = db.getJobById(jobId);

  if (!targetJob) {
    res.status(404).json({ message: 'Job to report does not exist.' });
    return;
  }

  const report: ReportedJob = {
    id: `rep-${uuidv4().substring(0, 8)}`,
    jobId,
    jobTitle: targetJob.title,
    companyName: targetJob.companyName,
    reportedByUserId: req.user.id,
    reportedByName: req.user.name,
    reason: reason || 'Suspicious or inaccurate information',
    details: details || 'Reported by candidate for admin review.',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  db.createReportedJob(report);
  res.status(201).json({ message: 'Job has been reported for administrator moderation.', report });
};
