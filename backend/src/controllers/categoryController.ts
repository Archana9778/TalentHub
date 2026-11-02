import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { JobCategory } from '../types';

export const getAllCategories = (req: Request, res: Response): void => {
  const categories = db.getCategories();
  res.json({ total: categories.length, categories });
};

export const createCategory = (req: AuthRequest, res: Response): void => {
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

  db.createCategory(newCat);
  res.status(201).json({ message: 'Category created successfully.', category: newCat });
};

export const updateCategory = (req: AuthRequest, res: Response): void => {
  const id = req.params.id as string;
  const updated = db.updateCategory(id, req.body);
  if (!updated) {
    res.status(404).json({ message: 'Category not found.' });
    return;
  }
  res.json({ message: 'Category updated successfully.', category: updated });
};

export const deleteCategory = (req: AuthRequest, res: Response): void => {
  const id = req.params.id as string;
  const deleted = db.deleteCategory(id);
  if (!deleted) {
    res.status(404).json({ message: 'Category not found.' });
    return;
  }
  res.json({ message: 'Category deleted successfully.' });
};
