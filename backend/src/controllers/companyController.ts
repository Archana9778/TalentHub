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
  } catch (err) {
    console.error('[companyController] getAllCompanies error:', err);
    res.status(500).json({ message: 'Failed to retrieve companies.' });
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const [company, jobs] = await Promise.all([
      db.getCompanyById(id),
      db.getJobs(),
    ]);
    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }
    const companyJobs = jobs.filter((j) => j.companyId === id);
    res.json({ company, jobs: companyJobs });
  } catch (err) {
    console.error('[companyController] getCompanyById error:', err);
    res.status(500).json({ message: 'Failed to retrieve company.' });
  }
};

export const createCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, logo, website, location, industry, size } = req.body;
    if (!name || !description) {
      res.status(400).json({ message: 'Company name and description are required.' });
      return;
    }

    const newCompany: Company = {
      id: `comp-${uuidv4().substring(0, 8)}`,
      name,
      description,
      logo: logo || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      website: website || '',
      location: location || 'United States',
      industry: industry || 'Technology',
      size: size || '50-200 employees',
      verified: req.user?.role === 'admin' ? true : false,
      createdAt: new Date().toISOString(),
    };

    await db.createCompany(newCompany);
    res.status(201).json({ message: 'Company created successfully.', company: newCompany });
  } catch (err) {
    console.error('[companyController] createCompany error:', err);
    res.status(500).json({ message: 'Failed to create company.' });
  }
};

export const updateCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await db.updateCompany(id, req.body);
    if (!updated) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }
    res.json({ message: 'Company updated successfully.', company: updated });
  } catch (err) {
    console.error('[companyController] updateCompany error:', err);
    res.status(500).json({ message: 'Failed to update company.' });
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
  } catch (err) {
    console.error('[companyController] deleteCompany error:', err);
    res.status(500).json({ message: 'Failed to delete company.' });
  }
};
