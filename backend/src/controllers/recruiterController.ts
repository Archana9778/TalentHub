import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { User, UserStatus, CompanyRole } from '../types';

export const addRecruiter = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Authorization check: Must be company admin or platform admin
    if (req.user.role === 'recruiter') {
      if (req.user.companyRole !== 'admin') {
        res.status(403).json({
          message: 'Forbidden: Only company administrators can add recruiters to the company.',
        });
        return;
      }
    }

    const {
      name,
      email,
      password,
      contactNumber,
      phone,
      designation,
      title,
      role: rawRole,
      companyRole: rawCompanyRole,
      status: rawStatus,
      companyId: rawCompanyId,
    } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Full name is required.' });
      return;
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ message: 'A valid email address is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      return;
    }

    // Email uniqueness check
    const existingUser = await db.getUserByEmail(email.trim());
    if (existingUser) {
      res.status(409).json({ message: 'A user with this email address already exists.' });
      return;
    }

    // Determine target company:
    // If caller is recruiter, target company is STRICTLY caller's company
    let targetCompanyId = req.user.companyId;
    if (req.user.role === 'admin' && rawCompanyId) {
      targetCompanyId = rawCompanyId;
    }

    if (!targetCompanyId) {
      res.status(400).json({ message: 'Target company must be specified.' });
      return;
    }

    const company = await db.getCompanyById(targetCompanyId);
    if (!company) {
      res.status(404).json({ message: 'Specified company does not exist.' });
      return;
    }

    const assignedCompanyRole: CompanyRole =
      rawCompanyRole === 'admin' || rawRole === 'admin' ? 'admin' : 'recruiter';
    const assignedStatus: UserStatus = rawStatus === 'inactive' ? 'inactive' : 'active';
    const resolvedPhone = contactNumber || phone || '';
    const resolvedDesignation = designation || title || 'Technical Recruiter';

    const hashedPassword = await bcrypt.hash(password, 10);

    const newRecruiter: User = {
      id: `user-recruiter-${uuidv4().substring(0, 8)}`,
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      role: 'recruiter',
      companyRole: assignedCompanyRole,
      status: assignedStatus,
      companyId: company.id,
      companyName: company.name,
      phone: resolvedPhone.trim(),
      contactNumber: resolvedPhone.trim(),
      title: resolvedDesignation.trim(),
      designation: resolvedDesignation.trim(),
      location: company.location || 'Remote',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createUser(newRecruiter);

    const { password: _, ...safeRecruiter } = newRecruiter;
    res.status(201).json({
      message: 'Recruiter added to company successfully.',
      recruiter: safeRecruiter,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error adding recruiter', error: err.message });
  }
};

export const getRecruiters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { status, search, companyId } = req.query;

    let recruiters = await db.getRecruiters();

    // Company data isolation:
    if (req.user.role === 'recruiter') {
      // Strictly isolate to the recruiter's company
      recruiters = recruiters.filter((r) => r.companyId === req.user!.companyId);
    } else if (req.user.role === 'admin' && companyId && typeof companyId === 'string') {
      recruiters = recruiters.filter((r) => r.companyId === companyId);
    }

    if (status && typeof status === 'string' && status !== 'all') {
      recruiters = recruiters.filter((r) => r.status === status);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      recruiters = recruiters.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.designation && r.designation.toLowerCase().includes(q))
      );
    }

    const safeRecruiters = recruiters.map(({ password, ...rest }) => rest);

    res.json({
      total: safeRecruiters.length,
      recruiters: safeRecruiters,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving recruiters', error: err.message });
  }
};

export const getRecruiterById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const recruiter = await db.getUserById(id);

    if (!recruiter || recruiter.role !== 'recruiter') {
      res.status(404).json({ message: 'Recruiter account not found.' });
      return;
    }

    // Cross-company isolation
    if (req.user.role === 'recruiter' && recruiter.companyId !== req.user.companyId) {
      res.status(403).json({
        message: 'Forbidden: You cannot view recruiter accounts belonging to other companies.',
      });
      return;
    }

    const assignedJobs = await db.getJobsByRecruiterId(recruiter.id);
    const { password: _, ...safeRecruiter } = recruiter;

    res.json({
      recruiter: safeRecruiter,
      assignedJobs,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving recruiter details', error: err.message });
  }
};

export const updateRecruiter = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const target = await db.getUserById(id);

    if (!target || target.role !== 'recruiter') {
      res.status(404).json({ message: 'Recruiter account not found.' });
      return;
    }

    // Cross-company isolation & RBAC
    if (req.user.role === 'recruiter') {
      if (target.companyId !== req.user.companyId) {
        res.status(403).json({
          message: 'Forbidden: You cannot modify accounts belonging to other companies.',
        });
        return;
      }
      if (req.user.companyRole !== 'admin' && req.user.id !== target.id) {
        res.status(403).json({
          message: 'Forbidden: Only company administrators can modify other recruiter accounts.',
        });
        return;
      }
    }

    const {
      name,
      email,
      password,
      contactNumber,
      phone,
      designation,
      title,
      companyRole,
      status,
    } = req.body;

    if (email && email.trim().toLowerCase() !== target.email.toLowerCase()) {
      const existing = await db.getUserByEmail(email.trim());
      if (existing && existing.id !== id) {
        res.status(409).json({ message: 'An account with this email address already exists.' });
        return;
      }
    }

    const updates: Partial<User> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ message: 'Full name cannot be empty.' });
        return;
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        res.status(400).json({ message: 'Invalid email address.' });
        return;
      }
      updates.email = email.trim().toLowerCase();
    }

    if (password) {
      if (password.length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters.' });
        return;
      }
      updates.password = await bcrypt.hash(password, 10);
    }

    const resolvedPhone = contactNumber !== undefined ? contactNumber : phone;
    if (resolvedPhone !== undefined) {
      updates.phone = resolvedPhone.trim();
      updates.contactNumber = resolvedPhone.trim();
    }

    const resolvedDesignation = designation !== undefined ? designation : title;
    if (resolvedDesignation !== undefined) {
      updates.title = resolvedDesignation.trim();
      updates.designation = resolvedDesignation.trim();
    }

    // Only company admins or platform admin can change companyRole or status
    if (req.user.role === 'admin' || (req.user.role === 'recruiter' && req.user.companyRole === 'admin')) {
      if (companyRole !== undefined) {
        updates.companyRole = companyRole;
      }
      if (status !== undefined) {
        updates.status = status;
      }
    }

    const updated = await db.updateUser(id, updates);
    if (!updated) {
      res.status(500).json({ message: 'Failed to update recruiter details.' });
      return;
    }

    // Update recruiter name in jobs if name changed
    if (updates.name) {
      const jobs = await db.getJobsByRecruiterId(id);
      for (const j of jobs) {
        await db.updateJob(j.id, { recruiterName: updates.name });
      }
    }

    const { password: _, ...safeRecruiter } = updated;
    res.json({
      message: 'Recruiter account updated successfully.',
      recruiter: safeRecruiter,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating recruiter', error: err.message });
  }
};

export const updateRecruiterStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const target = await db.getUserById(id);

    if (!target || target.role !== 'recruiter') {
      res.status(404).json({ message: 'Recruiter account not found.' });
      return;
    }

    // Isolation & authorization check:
    if (req.user.role === 'recruiter') {
      if (target.companyId !== req.user.companyId) {
        res.status(403).json({
          message: 'Forbidden: You cannot modify accounts belonging to other companies.',
        });
        return;
      }
      if (req.user.companyRole !== 'admin') {
        res.status(403).json({
          message: 'Forbidden: Only company administrators can activate or deactivate accounts.',
        });
        return;
      }
    }

    const { status } = req.body;
    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      res.status(400).json({
        message: 'Status must be one of: active, inactive, suspended.',
      });
      return;
    }

    // Prevent admin from locking out the sole active administrator of the company
    if (target.id === req.user.id && status !== 'active') {
      const companyRecruiters = await db.getRecruiters(target.companyId);
      const companyAdmins = companyRecruiters.filter((r) => r.companyRole === 'admin' && r.status === 'active');
      if (companyAdmins.length <= 1) {
        res.status(400).json({
          message: 'Cannot deactivate the sole active company administrator account.',
        });
        return;
      }
    }

    const updated = await db.updateUser(id, { status: status as UserStatus });
    if (!updated) {
      res.status(500).json({ message: 'Failed to update recruiter status.' });
      return;
    }

    const { password: _, ...safeRecruiter } = updated;
    res.json({
      message: `Recruiter account marked as ${status}.`,
      recruiter: safeRecruiter,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating recruiter status', error: err.message });
  }
};

export const getRecruiterJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const recruiter = await db.getUserById(id);

    if (!recruiter || recruiter.role !== 'recruiter') {
      res.status(404).json({ message: 'Recruiter account not found.' });
      return;
    }

    // Cross-company isolation
    if (req.user.role === 'recruiter' && recruiter.companyId !== req.user.companyId) {
      res.status(403).json({
        message: 'Forbidden: You cannot view jobs for recruiters of other companies.',
      });
      return;
    }

    const jobs = await db.getJobsByRecruiterId(id);
    res.json({
      total: jobs.length,
      jobs,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving recruiter jobs', error: err.message });
  }
};
