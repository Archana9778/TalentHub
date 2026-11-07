import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { JobAlert } from '../types';

export const getMyAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  try {
    const alerts = await db.getJobAlerts(req.user.id);
    res.json({ total: alerts.length, alerts });
  } catch (err) {
    console.error('[jobAlertController] getMyAlerts error:', err);
    res.status(500).json({ message: 'Failed to retrieve job alerts.' });
  }
};

export const createAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
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
  } catch (err) {
    console.error('[jobAlertController] createAlert error:', err);
    res.status(500).json({ message: 'Failed to create job alert.' });
  }
};

export const toggleAlertStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isActive } = req.body;

    const updated = await db.updateJobAlert(id, { isActive });
    if (!updated) {
      res.status(404).json({ message: 'Job alert not found.' });
      return;
    }
    res.json({ message: 'Alert updated.', alert: updated });
  } catch (err) {
    console.error('[jobAlertController] toggleAlertStatus error:', err);
    res.status(500).json({ message: 'Failed to update job alert.' });
  }
};

export const deleteAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const deleted = await db.deleteJobAlert(id);
    if (!deleted) {
      res.status(404).json({ message: 'Alert not found.' });
      return;
    }
    res.json({ message: 'Job alert deleted successfully.' });
  } catch (err) {
    console.error('[jobAlertController] deleteAlert error:', err);
    res.status(500).json({ message: 'Failed to delete job alert.' });
  }
};
