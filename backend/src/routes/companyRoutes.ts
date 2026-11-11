import { Router } from 'express';
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  uploadCompanyLogo,
  getCompanyRecruiters,
} from '../controllers/companyController';
import { authenticateToken, requireRoles } from '../middleware/auth';
import { uploadLogo } from '../middleware/upload';

const router = Router();

// Public / Candidate view
router.get('/', getAllCompanies);
router.get('/:id', getCompanyById);

// Recruiter & Admin management
router.post('/', authenticateToken, requireRoles('recruiter', 'admin'), createCompany);
router.put('/:id', authenticateToken, requireRoles('recruiter', 'admin'), updateCompany);
router.post('/:id/logo', authenticateToken, requireRoles('recruiter', 'admin'), uploadLogo.single('logo'), uploadCompanyLogo);
router.get('/:id/recruiters', authenticateToken, requireRoles('recruiter', 'admin'), getCompanyRecruiters);

// Admin-only deletion
router.delete('/:id', authenticateToken, requireRoles('admin'), deleteCompany);

export default router;
