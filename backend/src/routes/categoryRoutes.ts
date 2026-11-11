import { Router } from 'express';
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} from '../controllers/categoryController';
import { authenticateToken, requireRoles } from '../middleware/auth';

const router = Router();

router.get('/', getAllCategories);
router.post('/', authenticateToken, requireRoles('admin'), createCategory);
router.put('/:id', authenticateToken, requireRoles('admin'), updateCategory);
router.patch('/:id/toggle', authenticateToken, requireRoles('admin'), toggleCategoryStatus);
router.delete('/:id', authenticateToken, requireRoles('admin'), deleteCategory);

export default router;

