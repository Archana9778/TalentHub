import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Company } from '../types';

export const getAllCompanies = (req: Request, res: Response): void => {
  const companies = db.getCompanies();
  res.json({ total: companies.length, companies });
};

export const getCompanyById = (req: Request, res: Response): void => {
  const id = req.params.id as string;
  const company = db.getCompanyById(id);
  if (!company) {
    res.status(404).json({ message: 'Company not found.' });
    return;
  }
  const jobs = db.getJobs().filter((j) => j.companyId === id);
  res.json({ company, jobs });
};

export const createCompany = (req: AuthRequest, res: Response): void => {
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

  db.createCompany(newCompany);
  res.status(201).json({ message: 'Company created successfully.', company: newCompany });
};

export const updateCompany = (req: AuthRequest, res: Response): void => {
  const id = req.params.id as string;
  const updated = db.updateCompany(id, req.body);
  if (!updated) {
    res.status(404).json({ message: 'Company not found.' });
    return;
  }
  res.json({ message: 'Company updated successfully.', company: updated });
};

export const deleteCompany = (req: AuthRequest, res: Response): void => {
  const id = req.params.id as string;
  const deleted = db.deleteCompany(id);
  if (!deleted) {
    res.status(404).json({ message: 'Company not found.' });
    return;
  }
  res.json({ message: 'Company deleted successfully.' });
};
