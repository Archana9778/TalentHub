import { Request, Response } from 'express';
import { db } from '../database/db';
import { AuthRequest } from '../middleware/auth';
import { ApplicationStage, SystemStats } from '../types';

export const getSystemStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await db.getUsers();
    const jobs = await db.getJobs();
    const applications = await db.getApplications();
    const companies = await db.getCompanies();
    const reports = await db.getReportedJobs();

    const candidatesCount = users.filter((u) => u.role === 'candidate').length;
    const recruitersCount = users.filter((u) => u.role === 'recruiter').length;
    const activeJobsCount = jobs.filter((j) => j.status === 'active').length;
    const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

    const stageCounts: Record<ApplicationStage, number> = {
      Applied: 0,
      Screening: 0,
      Interview: 0,
      Offer: 0,
      Hired: 0,
      Rejected: 0,
    };

    applications.forEach((a) => {
      if (stageCounts[a.stage] !== undefined) {
        stageCounts[a.stage] += 1;
      }
    });

    // Calculate top skills demanded in jobs
    const skillFreqMap: Record<string, number> = {};
    jobs.forEach((j) => {
      j.skills.forEach((s) => {
        skillFreqMap[s] = (skillFreqMap[s] || 0) + 1;
      });
    });

    const topSkillsInDemand = Object.entries(skillFreqMap)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const stats: SystemStats = {
      totalUsers: users.length,
      totalCandidates: candidatesCount,
      totalRecruiters: recruitersCount,
      totalCompanies: companies.length,
      totalJobs: jobs.length,
      activeJobs: activeJobsCount,
      totalApplications: applications.length,
      pendingReports: pendingReportsCount,
      stageCounts,
      topSkillsInDemand,
      timeToHireDaysAverage: 18.5,
    };

    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving system statistics', error: err.message });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, status, search } = req.query;
    let users = await db.getUsers();

    if (role && typeof role === 'string' && role !== 'all') {
      users = users.filter((u) => u.role === role);
    }

    if (status && typeof status === 'string' && status !== 'all') {
      users = users.filter((u) => u.status === status);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.companyName && u.companyName.toLowerCase().includes(q))
      );
    }

    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json({ total: safeUsers.length, users: safeUsers });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving users', error: err.message });
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status, role } = req.body;
    if ((status !== undefined && !['active', 'suspended'].includes(status)) ||
        (role !== undefined && !['candidate', 'recruiter', 'admin'].includes(role))) {
      res.status(400).json({ message: 'Status or role is invalid.' });
      return;
    }

    const target = await db.getUserById(id);
    if (!target) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    // Prevent admin from locking themselves out
    if (target.id === req.user?.id && status === 'suspended') {
      res.status(400).json({ message: 'Cannot suspend your own admin account.' });
      return;
    }

    const updated = await db.updateUser(id, {
      ...(status && { status }),
      ...(role && { role }),
    });

    const { password: _, ...safeUser } = updated!;
    res.json({ message: 'User state updated successfully.', user: safeUser });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating user status', error: err.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (id === req.user?.id) {
      res.status(400).json({ message: 'Cannot delete your own active admin account.' });
      return;
    }
    const deleted = await db.deleteUser(id);
    if (!deleted) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    res.json({ message: 'User deleted from TalentHub.' });
  } catch (err: any) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
};

export const getReportedJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reports = await db.getReportedJobs();
    res.json({ total: reports.length, reports });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving reported jobs', error: err.message });
  }
};

export const updateReportStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status, removeJob } = req.body;
    if (!['pending', 'resolved', 'dismissed'].includes(status) || (removeJob !== undefined && typeof removeJob !== 'boolean')) {
      res.status(400).json({ message: 'Report status or removeJob value is invalid.' });
      return;
    }

    const updated = await db.updateReportedJob(id, status);
    if (!updated) {
      res.status(404).json({ message: 'Report not found.' });
      return;
    }

    if (removeJob && updated.jobId) {
      await db.deleteJob(updated.jobId);
    }

    res.json({ message: 'Report status updated.', report: updated });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating report status', error: err.message });
  }
};
