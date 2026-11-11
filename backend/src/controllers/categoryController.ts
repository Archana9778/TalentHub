import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { JobCategory } from '../types';

export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await db.getCategories(includeInactive);
    res.json({ total: categories.length, categories });
  } catch (err) {
    console.error('[categoryController] getAllCategories error:', err);
    res.status(500).json({ message: 'Failed to retrieve categories.' });
  }
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, icon } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Category name is required.' });
      return;
    }

    // Duplicate name check
    const existing = await db.getCategoryByName(name.trim());
    if (existing) {
      res.status(409).json({ message: `A category named "${name.trim()}" already exists.` });
      return;
    }

    const newCat: JobCategory = {
      id: `cat-${uuidv4().substring(0, 8)}`,
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon || 'Briefcase',
      jobCount: 0,
      isActive: true,
    };

    await db.createCategory(newCat);
    res.status(201).json({ message: 'Category created successfully.', category: newCat });
  } catch (err) {
    console.error('[categoryController] createCategory error:', err);
    res.status(500).json({ message: 'Failed to create category.' });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, description, icon, isActive } = req.body;

    // Name uniqueness check if name is being changed
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        res.status(400).json({ message: 'Category name cannot be empty.' });
        return;
      }
      const existing = await db.getCategoryByName(trimmedName, id);
      if (existing) {
        res.status(409).json({ message: `A category named "${trimmedName}" already exists.` });
        return;
      }
    }

    const updates: Partial<JobCategory> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const updated = await db.updateCategory(id, updates);
    if (!updated) {
      res.status(404).json({ message: 'Category not found.' });
      return;
    }
    res.json({ message: 'Category updated successfully.', category: updated });
  } catch (err) {
    console.error('[categoryController] updateCategory error:', err);
    res.status(500).json({ message: 'Failed to update category.' });
  }
};

export const toggleCategoryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const category = await db.getCategoryById(id);
    if (!category) {
      res.status(404).json({ message: 'Category not found.' });
      return;
    }

    const newActive = !(category.isActive !== false); // flip
    const updated = await db.updateCategory(id, { isActive: newActive });
    res.json({
      message: `Category ${newActive ? 'activated' : 'deactivated'} successfully.`,
      category: updated,
    });
  } catch (err) {
    console.error('[categoryController] toggleCategoryStatus error:', err);
    res.status(500).json({ message: 'Failed to toggle category status.' });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Safe deactivation: check if any jobs reference this category
    const jobCount = await db.getCategoryJobCount(id);
    if (jobCount > 0) {
      res.status(409).json({
        message: `Cannot delete category: ${jobCount} job(s) are associated with it. Deactivate it instead.`,
      });
      return;
    }

    const deleted = await db.deleteCategory(id);
    if (!deleted) {
      res.status(404).json({ message: 'Category not found.' });
      return;
    }
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('[categoryController] deleteCategory error:', err);
    res.status(500).json({ message: 'Failed to delete category.' });
  }
};
