import { Router } from 'express';
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
} from '../controllers/companyController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

router.get('/', getAllCompanies);
router.get('/:id', getCompanyById);
router.post('/', authenticateToken, requireRoles('recruiter', 'admin'), createCompany);
router.put('/:id', authenticateToken, requireRoles('admin'), updateCompany);
router.delete('/:id', authenticateToken, requireRoles('admin'), deleteCompany);

export default router;

