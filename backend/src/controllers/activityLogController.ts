import { Response } from 'express';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { ActivityAction, ActivityLogFilter } from '../types';

export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }

    // Role-based access control
    if (req.user.role === 'candidate') {
      res.status(403).json({ message: 'Forbidden: Candidates cannot access activity logs.' });
      return;
    }

    const {
      action,
      module: moduleParam,
      actor,
      startDate,
      endDate,
      companyId: queryCompanyId,
      page: queryPage,
      limit: queryLimit,
    } = req.query;

    const page = Math.max(1, parseInt(queryPage as string, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryLimit as string, 10) || 20));

    let effectiveCompanyId: string | undefined;

    if (req.user.role === 'recruiter') {
      // Strictly isolate to the recruiter's company; NEVER trust client-supplied companyId
      if (!req.user.companyId) {
        res.status(403).json({ message: 'Forbidden: Recruiter is not associated with any company.' });
        return;
      }
      effectiveCompanyId = req.user.companyId;
    } else if (req.user.role === 'admin') {
      // Platform Admin can view all or optionally filter by companyId
      if (queryCompanyId && typeof queryCompanyId === 'string' && queryCompanyId !== 'all') {
        effectiveCompanyId = queryCompanyId;
      }
    }

    const filter: ActivityLogFilter = {
      companyId: effectiveCompanyId,
      action: action && typeof action === 'string' && action !== 'all' ? (action.toUpperCase() as ActivityAction) : undefined,
      module: moduleParam && typeof moduleParam === 'string' && moduleParam !== 'all' ? moduleParam : undefined,
      actor: actor && typeof actor === 'string' && actor.trim() ? actor.trim() : undefined,
      startDate: startDate && typeof startDate === 'string' ? startDate : undefined,
      endDate: endDate && typeof endDate === 'string' ? endDate : undefined,
      page,
      limit,
    };

    const { logs, total } = await db.getActivityLogs(filter);
    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      logs,
      total,
      page,
      limit,
      totalPages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    console.error('[activityLogController] getActivityLogs error:', err);
    res.status(500).json({ message: 'Error retrieving activity logs', error: err.message });
  }
};
