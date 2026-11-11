import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { JobCategory } from '../types';

export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await db.getCategories();
    res.json({ total: categories.length, categories });
  } catch (err: any) {
    console.error('[categoryController] getAllCategories error:', err);
    res.status(500).json({ message: 'Error retrieving categories', error: err.message });
  }
};

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, icon } = req.body;
    if (!name) {
      res.status(400).json({ message: 'Category name is required.' });
      return;
    }

    const newCat: JobCategory = {
      id: `cat-${uuidv4().substring(0, 8)}`,
      name,
      description: description || '',
      icon: icon || 'Briefcase',
      jobCount: 0,
    };

    await db.createCategory(newCat);
    res.status(201).json({ message: 'Category created successfully.', category: newCat });
  } catch (err: any) {
    console.error('[categoryController] createCategory error:', err);
    res.status(500).json({ message: 'Error creating category', error: err.message });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await db.updateCategory(id, req.body);
    if (!updated) {
      res.status(404).json({ message: 'Category not found.' });
      return;
    }
    res.json({ message: 'Category updated successfully.', category: updated });
  } catch (err: any) {
    console.error('[categoryController] updateCategory error:', err);
    res.status(500).json({ message: 'Error updating category', error: err.message });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const deleted = await db.deleteCategory(id);
    if (!deleted) {
      res.status(404).json({ message: 'Category not found.' });
      return;
    }
    res.json({ message: 'Category deleted successfully.' });
  } catch (err: any) {
    console.error('[categoryController] deleteCategory error:', err);
    res.status(500).json({ message: 'Error deleting category', error: err.message });
  }
};
