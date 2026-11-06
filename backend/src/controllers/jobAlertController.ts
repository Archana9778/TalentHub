import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { JobAlert } from '../types';

export const getMyAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const alerts = await db.getJobAlerts(req.user.id);
    res.json({ total: alerts.length, alerts });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving job alerts', error: err.message });
  }
};

export const createAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { title, keywords, category, location, jobType, frequency } = req.body;

    const newAlert: JobAlert = {
      id: `alert-${uuidv4().substring(0, 8)}`,
      userId: req.user.id,
      title: title || `${keywords || 'General'} Alerts`,
      keywords: keywords || '',
      category: category || 'all',
      location: location || '',
      jobType: jobType || 'all',
      frequency: frequency === 'weekly' ? 'weekly' : 'daily',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await db.createJobAlert(newAlert);
    res.status(201).json({ message: 'Job alert configured successfully.', alert: newAlert });
  } catch (err: any) {
    res.status(500).json({ message: 'Error creating job alert', error: err.message });
  }
};

export const toggleAlertStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ message: 'isActive must be a boolean.' });
      return;
    }
    const updated = await db.updateJobAlert(id, req.user!.id, { isActive });
    if (!updated) {
      res.status(404).json({ message: 'Job alert not found.' });
      return;
    }
    res.json({ message: 'Alert updated.', alert: updated });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating alert status', error: err.message });
  }
};

export const deleteAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const deleted = await db.deleteJobAlert(id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ message: 'Alert not found.' });
      return;
    }
    res.json({ message: 'Job alert deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Error deleting job alert', error: err.message });
  }
};
