import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Job, ReportedJob } from '../types';

export const getAllJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    let jobs = await db.getJobs();

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
      skills,
    } = req.query;

    // Status filter (defaults to active unless specified)
    if (status) {
      jobs = jobs.filter((j) => j.status === status);
    } else {
      jobs = jobs.filter((j) => j.status === 'active');
    }

    // ── Reusable safe-match helpers (used only inside this filter pipeline) ──
    //
    // matchStr: returns true when `val` is a non-empty string that contains `q`.
    //   Guards against null / undefined / non-string values without throwing.
    const matchStr = (val: unknown, q: string): boolean =>
      typeof val === 'string' && val.toLowerCase().includes(q);

    // matchArr: returns true when at least one element of `arr` is a string
    //   that contains `q`.  Safe against null, undefined, non-array, and
    //   array elements that are not strings (numbers, objects, etc.).
    const matchArr = (arr: unknown, q: string): boolean =>
      Array.isArray(arr) &&
      (arr as unknown[]).some((el) => matchStr(el, q));

    // Keyword search — case-insensitive partial match.
    // Fields searched (all that exist on the Job model as text):
    //   • title          (string, required)
    //   • companyName    (string, required)
    //   • description    (string, required)
    //   • categoryName   (string, required)
    //   • location       (string, required) ← added; also used by the
    //                       dedicated location filter below for exact scoping
    //   • skills[]       (string[], required)
    //   • requirements[] (string[], required)
    //   • benefits[]     (string[], required)
    //
    // Note: 'responsibilities' is not a field in the Job data model and is
    // therefore not included. Add it here if the model is extended later.
    //
    // Empty or whitespace-only queries are ignored — no jobs are filtered out.
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      if (q.length > 0) {
        jobs = jobs.filter((j) =>
          matchStr(j.title,        q) ||
          matchStr(j.companyName,  q) ||
          matchStr(j.description,  q) ||
          matchStr(j.categoryName, q) ||
          matchStr(j.location,     q) ||
          matchArr(j.skills,       q) ||
          matchArr(j.requirements, q) ||
          matchArr(j.benefits,     q)
        );
      }
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

    // Skills filter — comma-separated list; job matches when it contains ANY selected skill (OR logic)
    // Uses the same matchArr helper defined in the search block above for safe element-level checking.
    if (skills && typeof skills === 'string') {
      const skillList = skills
        .split(',')
        .map((s) => s.toLowerCase().trim())
        .filter(Boolean);
      if (skillList.length > 0) {
        jobs = jobs.filter((j) =>
          skillList.some((sk) => matchArr(j.skills, sk))
        );
      }
    }

    res.json({
      total: jobs.length,
      jobs,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving jobs', error: err.message });
  }
};

export const getJobById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const job = await db.getJobById(id);

    if (!job) {
      res.status(404).json({ message: 'Job posting not found.' });
      return;
    }

    // Increment view counter
    await db.incrementJobViews(id);

    const company = await db.getCompanyById(job.companyId);
    res.json({ job, company });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving job details', error: err.message });
  }
};

export const createJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const {
      title,
      companyId,
      companyName,
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
    } = req.body;

    if (!title || !description || !location) {
      res.status(400).json({ message: 'Title, description, and location are required.' });
      return;
    }

    const category = categoryId ? await db.getCategoryById(categoryId) : undefined;
    const resolvedCategoryName = category ? category.name : categoryName || 'Full Stack & Web Engineering';
    const resolvedCategoryId = category ? category.id : categoryId || 'cat-1';

    const newJob: Job = {
      id: `job-${uuidv4().substring(0, 8)}`,
      title,
      companyId: companyId || req.user.companyId || 'comp-1',
      companyName: companyName || req.user.companyName || 'CloudScale Technologies',
      companyLogo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      recruiterId: req.user.id,
      recruiterName: req.user.name,
      categoryId: resolvedCategoryId,
      categoryName: resolvedCategoryName,
      location,
      workplaceType: workplaceType || 'Hybrid',
      jobType: jobType || 'Full-time',
      experienceLevel: experienceLevel || 'Mid-level',
      salaryMin: Number(salaryMin) || 100000,
      salaryMax: Number(salaryMax) || 140000,
      salaryCurrency: salaryCurrency || 'USD',
      description,
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

    await db.createJob(newJob);

    res.status(201).json({
      message: 'Job created successfully.',
      job: newJob,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error creating job', error: err.message });
  }
};

export const updateJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const existing = await db.getJobById(id);

    if (!existing) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    // Recruiter can only edit their own jobs, Admin can edit any
    if (req.user.role !== 'admin' && existing.recruiterId !== req.user.id) {
      res.status(403).json({ message: 'You do not have permission to edit this job posting.' });
      return;
    }

    const updated = await db.updateJob(id, req.body);
    res.json({ message: 'Job updated successfully.', job: updated });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating job', error: err.message });
  }
};

export const deleteJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const existing = await db.getJobById(id);

    if (!existing) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    if (req.user.role !== 'admin' && existing.recruiterId !== req.user.id) {
      res.status(403).json({ message: 'You do not have permission to delete this job posting.' });
      return;
    }

    await db.deleteJob(id);
    res.json({ message: 'Job posting deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Error deleting job', error: err.message });
  }
};

export const getRecruiterJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    let jobs = await db.getJobs();
    if (req.user.role !== 'admin') {
      jobs = jobs.filter((j) => j.recruiterId === req.user!.id);
    }

    res.json({ total: jobs.length, jobs });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving recruiter jobs', error: err.message });
  }
};

export const reportJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { jobId, reason, details } = req.body;
    const targetJob = await db.getJobById(jobId);

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

    await db.createReportedJob(report);
    res.status(201).json({ message: 'Job has been reported for administrator moderation.', report });
  } catch (err: any) {
    res.status(500).json({ message: 'Error reporting job', error: err.message });
  }
};
