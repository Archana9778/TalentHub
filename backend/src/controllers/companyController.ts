import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Company } from '../types';

export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const companies = await db.getCompanies();
    res.json({ total: companies.length, companies });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving companies', error: err.message });
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const company = await db.getCompanyById(id);
    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }
    const allJobs = await db.getJobs();
    const jobs = allJobs.filter((j) => j.companyId === id);
    res.json({ company, jobs });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving company details', error: err.message });
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
  } catch (err: any) {
    res.status(500).json({ message: 'Error creating company', error: err.message });
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
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating company', error: err.message });
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
    res.status(500).json({ message: 'Error deleting company', error: err.message });
  }
};
