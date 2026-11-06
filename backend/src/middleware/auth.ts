import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../database/db';
import { User, UserRole } from '../types';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ message: 'Authentication required. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string; role: UserRole };
    const user = await db.getUserById(decoded.id);

    if (!user) {
      res.status(401).json({ message: 'User associated with token no longer exists.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ message: 'Account is suspended. Please contact platform support.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired authentication token.' });
    return;
  }
};

export const requireRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        message: `Forbidden: Access requires one of the following roles: [${roles.join(', ')}]. Your role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
};
