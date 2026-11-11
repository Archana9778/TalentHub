import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Company } from '../types';

export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;
    const companies = await db.getCompanies({
      search: typeof search === 'string' ? search : undefined,
      status: typeof status === 'string' ? status : undefined,
    });
    res.json({ total: companies.length, companies });
  } catch (err: any) {
    console.error('[companyController] getAllCompanies error:', err);
    res.status(500).json({ message: 'Error retrieving companies', error: err.message });
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [company, allJobs] = await Promise.all([
      db.getCompanyById(id),
      db.getJobs(),
    ]);

    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    const jobs = allJobs.filter((j) => j.companyId === id);
    const companyRecruiters = await db.getRecruiters(id);
    const activeRecruiters = companyRecruiters.filter((r) => r.status === 'active');

    res.json({
      company,
      jobs,
      stats: {
        totalJobs: jobs.length,
        totalRecruiters: companyRecruiters.length,
        activeRecruiters: activeRecruiters.length,
      },
    });
  } catch (err: any) {
    console.error('[companyController] getCompanyById error:', err);
    res.status(500).json({ message: 'Error retrieving company details', error: err.message });
  }
};

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const {
      name,
      description,
      logo,
      website,
      location,
      industry,
      size,
      email,
      contactNumber,
      phone,
      address,
    } = req.body;

    // Form validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Company name is required.' });
      return;
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ message: 'Company description is required.' });
      return;
    }

    const compEmail = (email || '').trim();
    if (compEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(compEmail)) {
      res.status(400).json({ message: 'Please provide a valid company email address.' });
      return;
    }

    const resolvedPhone = contactNumber || phone || '';

    const newCompany: Company = {
      id: `comp-${uuidv4().substring(0, 8)}`,
      name: name.trim(),
      description: description.trim(),
      logo: logo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      website: website ? website.trim() : '',
      email: compEmail,
      contactNumber: resolvedPhone ? resolvedPhone.trim() : '',
      phone: resolvedPhone ? resolvedPhone.trim() : '',
      address: address ? address.trim() : '',
      location: location ? location.trim() : 'United States',
      industry: industry ? industry.trim() : 'Technology',
      size: size ? size.trim() : '50-200 employees',
      verified: req.user.role === 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createCompany(newCompany);

    // If creator is a recruiter, associate them with this new company as company admin
    if (req.user.role === 'recruiter') {
      await db.updateUser(req.user.id, {
        companyId: newCompany.id,
        companyName: newCompany.name,
        companyRole: 'admin',
      });
    }

    res.status(201).json({
      message: 'Company created successfully.',
      company: newCompany,
    });
  } catch (err: any) {
    console.error('[companyController] createCompany error:', err);
    res.status(500).json({ message: 'Error creating company', error: err.message });
  }
};

export const updateCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const target = await db.getCompanyById(id);

    if (!target) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    // Cross-company isolation & RBAC:
    // Admin can edit any company; recruiter can only edit their own company if they have company admin role or belong to it
    if (req.user.role !== 'admin') {
      if (req.user.companyId !== id) {
        res.status(403).json({
          message: 'Forbidden: You do not have permission to manage accounts or details for another company.',
        });
        return;
      }
    }

    const {
      name,
      description,
      logo,
      website,
      location,
      industry,
      size,
      email,
      contactNumber,
      phone,
      address,
    } = req.body;

    // Validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      res.status(400).json({ message: 'Company name cannot be empty.' });
      return;
    }

    if (description !== undefined && (typeof description !== 'string' || description.trim().length === 0)) {
      res.status(400).json({ message: 'Company description cannot be empty.' });
      return;
    }

    const compEmail = email !== undefined ? (email || '').trim() : undefined;
    if (compEmail !== undefined && compEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(compEmail)) {
      res.status(400).json({ message: 'Please provide a valid company email address.' });
      return;
    }

    const resolvedPhone = contactNumber !== undefined ? contactNumber : phone;

    const updates: Partial<Company> = {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(logo !== undefined && { logo }),
      ...(website !== undefined && { website: website.trim() }),
      ...(compEmail !== undefined && { email: compEmail }),
      ...(resolvedPhone !== undefined && { contactNumber: resolvedPhone.trim(), phone: resolvedPhone.trim() }),
      ...(address !== undefined && { address: address.trim() }),
      ...(location !== undefined && { location: location.trim() }),
      ...(industry !== undefined && { industry: industry.trim() }),
      ...(size !== undefined && { size: size.trim() }),
      updatedAt: new Date().toISOString(),
    };

    const updated = await db.updateCompany(id, updates);

    // If company name was updated, update associated jobs and users
    if (name && name.trim() !== target.name) {
      const jobs = await db.getJobsByCompanyId(id);
      for (const j of jobs) {
        await db.updateJob(j.id, { companyName: name.trim() });
      }
      const recruiters = await db.getRecruiters(id);
      for (const r of recruiters) {
        await db.updateUser(r.id, { companyName: name.trim() });
      }
    }

    res.json({
      message: 'Company profile updated successfully.',
      company: updated,
    });
  } catch (err: any) {
    console.error('[companyController] updateCompany error:', err);
    res.status(500).json({ message: 'Error updating company', error: err.message });
  }
};

export const uploadCompanyLogo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const company = await db.getCompanyById(id);

    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    // Isolation check
    if (req.user.role !== 'admin' && req.user.companyId !== id) {
      res.status(403).json({ message: 'Forbidden: You cannot upload logos for other companies.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: 'Please select an image file to upload as the company logo.' });
      return;
    }

    const logoUrl = `/uploads/${req.file.filename}`;
    const updated = await db.updateCompany(id, { logo: logoUrl });

    // Update company logo on active jobs
    const jobs = await db.getJobsByCompanyId(id);
    for (const j of jobs) {
      await db.updateJob(j.id, { companyLogo: logoUrl });
    }

    res.json({
      message: 'Company logo uploaded and updated successfully.',
      logoUrl,
      company: updated,
    });
  } catch (err: any) {
    console.error('[companyController] uploadCompanyLogo error:', err);
    res.status(500).json({ message: 'Error uploading company logo', error: err.message });
  }
};

export const getCompanyRecruiters = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const id = req.params.id as string;
    const company = await db.getCompanyById(id);

    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    // Cross-company isolation
    if (req.user.role !== 'admin' && req.user.companyId !== id) {
      res.status(403).json({
        message: 'Forbidden: You cannot view recruiter accounts for other companies.',
      });
      return;
    }

    const recruiters = await db.getRecruiters(id);
    const safeRecruiters = recruiters.map(({ password, ...rest }) => rest);

    res.json({
      total: safeRecruiters.length,
      recruiters: safeRecruiters,
    });
  } catch (err: any) {
    console.error('[companyController] getCompanyRecruiters error:', err);
    res.status(500).json({ message: 'Error retrieving recruiters', error: err.message });
  }
};

export const deleteCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const deleted = await db.deleteCompany(id);
    if (!deleted) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }
    res.json({ message: 'Company deleted successfully.' });
  } catch (err: any) {
    console.error('[companyController] deleteCompany error:', err);
    res.status(500).json({ message: 'Error deleting company', error: err.message });
  }
};
