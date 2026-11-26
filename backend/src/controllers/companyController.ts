import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { Company } from '../types';
import { BlobStorageService } from '../services/blobStorageService';
import { validateImageBuffer } from '../services/imageValidationService';
import { config } from '../config';

export function isAzureLogoBlob(ref?: string | null): boolean {
  if (!ref || typeof ref !== 'string') return false;
  const trimmed = ref.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) return false;
  if (trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('/api/')) return false;
  return trimmed.startsWith('logos/') || trimmed.startsWith('blob://');
}

export function extractLogoBlobName(ref?: string | null): string | null {
  if (!ref || !isAzureLogoBlob(ref)) return null;
  let trimmed = ref.trim();
  if (trimmed.startsWith('blob://')) {
    const parts = trimmed.replace('blob://', '').split('/');
    parts.shift(); // remove container name
    return parts.join('/');
  }
  return trimmed;
}

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

    // Prevent an existing recruiter from creating another company and changing their association
    if (req.user.role === 'recruiter' && req.user.companyId) {
      res.status(403).json({
        message: 'Forbidden: You are already associated with an existing company and cannot create another company.',
      });
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

    // Check trimmed, case-insensitive duplicate company name
    const existing = await db.getCompanyByName(name.trim());
    if (existing) {
      res.status(409).json({
        message: 'A company with this name already exists.',
      });
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

    try {
      await db.createActivityLog({
        id: `act-${uuidv4().substring(0, 8)}`,
        companyId: newCompany.id,
        actorUserId: req.user.id,
        actorName: req.user.name,
        action: 'CREATE',
        module: 'COMPANY',
        recordId: newCompany.id,
        recordName: newCompany.name,
        oldValues: null,
        newValues: {
          id: newCompany.id,
          name: newCompany.name,
          industry: newCompany.industry,
          location: newCompany.location,
          email: newCompany.email,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('Failed to log company creation activity:', logErr);
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
    // Admin can edit any company; recruiter can only edit their own company if they have company admin role
    if (req.user.role !== 'admin') {
      if (req.user.companyId !== id) {
        res.status(403).json({
          message: 'Forbidden: You do not have permission to manage accounts or details for another company.',
        });
        return;
      }
      if (req.user.companyRole !== 'admin') {
        res.status(403).json({
          message: 'Forbidden: Only company administrators can update company details.',
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
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ message: 'Company name cannot be empty.' });
        return;
      }
      if (name.trim().toLowerCase() !== target.name.trim().toLowerCase()) {
        const existing = await db.getCompanyByName(name.trim());
        if (existing && existing.id !== id) {
          res.status(409).json({ message: 'A company with this name already exists.' });
          return;
        }
      }
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

    // Preserve existing logo if incoming logo is the retrieval URL endpoint (e.g. /api/companies/:id/logo)
    let logoToUpdate = logo;
    if (logo !== undefined && typeof logo === 'string' && (logo.startsWith('/api/companies/') || logo.includes('/logo'))) {
      logoToUpdate = target.logo;
    }

    const updates: Partial<Company> = {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(logoToUpdate !== undefined && { logo: logoToUpdate }),
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

    try {
      const oldValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      for (const key of Object.keys(updates) as (keyof Company)[]) {
        if (key !== 'updatedAt' && updates[key] !== undefined && updates[key] !== (target as any)[key]) {
          oldValues[key] = (target as any)[key];
          newValues[key] = updates[key];
        }
      }
      if (Object.keys(newValues).length > 0) {
        await db.createActivityLog({
          id: `act-${uuidv4().substring(0, 8)}`,
          companyId: id,
          actorUserId: req.user.id,
          actorName: req.user.name,
          action: 'UPDATE',
          module: 'COMPANY',
          recordId: id,
          recordName: updates.name || target.name,
          oldValues,
          newValues,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (logErr) {
      console.error('Failed to log company update activity:', logErr);
    }

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

    // Isolation check: Recruiter can only upload for their own company; Admin can upload for any company
    if (req.user.role !== 'admin' && req.user.companyId !== id) {
      res.status(403).json({ message: 'Forbidden: You cannot upload logos for other companies.' });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ message: 'Please select an image file to upload as the company logo.' });
      return;
    }

    const validation = validateImageBuffer(
      req.file.buffer,
      req.file.originalname,
      config.storage.maxLogoSizeBytes
    );

    if (!validation.isValid) {
      res.status(400).json({ message: validation.error || 'Invalid image file.' });
      return;
    }

    const oldLogo = company.logo;
    const ext = validation.extension || path.extname(req.file.originalname).toLowerCase() || '.png';
    const safeBase = path.basename(req.file.originalname, path.extname(req.file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50) || 'logo';
    const uniqueFilename = `${Date.now()}-${uuidv4().substring(0, 8)}-${safeBase}${ext}`;
    const blobName = `logos/${id}/${uniqueFilename}`;

    // 1. Upload new blob successfully to talenthub-company-logos
    await BlobStorageService.uploadLogoBuffer(blobName, validation.buffer, validation.mimeType, {
      companyId: id,
      originalFilename: req.file.originalname,
    });

    let updated: Company;
    try {
      // 2. Update company and related job references in database
      const result = await db.updateCompany(id, { logo: blobName });
      if (!result) {
        throw new Error('Failed to update company in database');
      }
      updated = result;

      const jobs = await db.getJobsByCompanyId(id);
      for (const j of jobs) {
        await db.updateJob(j.id, { companyLogo: blobName });
      }
    } catch (dbErr) {
      // If the database update fails, clean up the newly uploaded blob and preserve the old logo
      console.error('[companyController] Database update failed after logo upload — cleaning up blob:', blobName, dbErr);
      await BlobStorageService.deleteBlob(blobName, config.storage.logoContainerName).catch((cleanupErr) => {
        console.warn('[companyController] Failed to clean up newly uploaded blob after DB error:', cleanupErr);
      });
      res.status(500).json({ message: 'Failed to update company logo in database', error: (dbErr as any).message });
      return;
    }

    // 3. Delete old Azure blob only after the database update succeeds
    if (oldLogo && isAzureLogoBlob(oldLogo)) {
      const oldBlobName = extractLogoBlobName(oldLogo);
      if (oldBlobName && oldBlobName !== blobName) {
        await BlobStorageService.deleteBlob(oldBlobName, config.storage.logoContainerName).catch((err) => {
          console.warn('[companyController] Warning: Could not delete old logo blob:', oldBlobName, err);
        });
      }
    }

    const displayUrl = `/api/companies/${id}/logo?t=${Date.now()}`;
    res.json({
      message: 'Company logo uploaded and updated successfully.',
      logoUrl: displayUrl,
      company: updated,
    });
  } catch (err: any) {
    console.error('[companyController] uploadCompanyLogo error:', err);
    res.status(500).json({ message: 'Error uploading company logo', error: err.message });
  }
};

export const getCompanyLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const company = await db.getCompanyById(id);

    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    if (!company.logo || company.logo.trim() === '') {
      res.status(404).json({ message: 'Company logo not found.' });
      return;
    }

    const logo = company.logo.trim();

    // 1. External URL compatibility (Unsplash, external CDNs, etc.)
    if (logo.startsWith('http://') || logo.startsWith('https://')) {
      res.redirect(302, logo);
      return;
    }

    // 2. Legacy local /uploads compatibility
    if (logo.startsWith('/uploads/') || logo.startsWith('uploads/')) {
      const relativePath = logo.startsWith('/') ? logo.substring(1) : logo;
      const localFilePath = path.resolve(__dirname, '../../', relativePath);
      if (fs.existsSync(localFilePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(localFilePath);
        return;
      }
      res.status(404).json({ message: 'Legacy logo file not found.' });
      return;
    }

    // 3. Azure Blob reference
    const blobName = extractLogoBlobName(logo);
    if (!blobName) {
      res.status(404).json({ message: 'Invalid company logo reference.' });
      return;
    }

    try {
      const blobData = await BlobStorageService.downloadBlobWithProperties(
        blobName,
        config.storage.logoContainerName
      );

      // Handle conditional requests (ETag)
      if (blobData.etag && req.headers['if-none-match'] === blobData.etag) {
        res.status(304).end();
        return;
      }

      if (blobData.etag) {
        res.setHeader('ETag', blobData.etag);
      }
      if (blobData.lastModified) {
        res.setHeader('Last-Modified', blobData.lastModified.toUTCString());
      }

      res.setHeader('Content-Type', blobData.contentType || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      res.setHeader('Content-Length', String(blobData.contentLength || blobData.buffer.length));
      res.send(blobData.buffer);
    } catch (blobErr: any) {
      console.warn(`[companyController] Logo blob '${blobName}' not found or error:`, blobErr.message || blobErr);
      res.status(404).json({ message: 'Company logo image not found in storage.' });
    }
  } catch (err: any) {
    console.error('[companyController] getCompanyLogo error:', err);
    res.status(500).json({ message: 'Error retrieving company logo', error: err.message });
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
    const company = await db.getCompanyById(id);
    if (!company) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    const oldLogo = company.logo;
    const deleted = await db.deleteCompany(id);
    if (!deleted) {
      res.status(404).json({ message: 'Company not found.' });
      return;
    }

    // Safely delete associated Azure logo blob if it exists
    if (oldLogo && isAzureLogoBlob(oldLogo)) {
      const blobName = extractLogoBlobName(oldLogo);
      if (blobName) {
        await BlobStorageService.deleteBlob(blobName, config.storage.logoContainerName).catch((err) => {
          console.warn('[companyController] Warning: Could not delete logo blob during company deletion:', blobName, err);
        });
      }
    }

    res.json({ message: 'Company deleted successfully.' });
  } catch (err: any) {
    console.error('[companyController] deleteCompany error:', err);
    res.status(500).json({ message: 'Error deleting company', error: err.message });
  }
};
