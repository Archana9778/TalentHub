import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { JobAlert } from '../types';

export const getMyAlerts = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const alerts = db.getJobAlerts(req.user.id);
  res.json({ total: alerts.length, alerts });
};

export const createAlert = (req: AuthRequest, res: Response): void => {
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

  db.createJobAlert(newAlert);
  res.status(201).json({ message: 'Job alert configured successfully.', alert: newAlert });
};

export const toggleAlertStatus = (req: AuthRequest, res: Response): void => {
  const id = req.params.id as string;
  const { isActive } = req.body;

  const updated = db.updateJobAlert(id, { isActive });
  if (!updated) {
    res.status(404).json({ message: 'Job alert not found.' });
    return;
  }
  res.json({ message: 'Alert updated.', alert: updated });
};

export const deleteAlert = (req: AuthRequest, res: Response): void => {
  const id = req.params.id as string;
  const deleted = db.deleteJobAlert(id);
  if (!deleted) {
    res.status(404).json({ message: 'Alert not found.' });
    return;
  }
  res.json({ message: 'Job alert deleted successfully.' });
};
