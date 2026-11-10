import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../database/db';
import { User, UserRole } from '../types';

export interface AuthRequest extends Request {
  user?: User;
  tokenJti?: string;
  tokenExp?: number;
  rawToken?: string;
}

export interface JwtTokenPayload {
  id: string;
  email: string;
  role: UserRole;
  tokenVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

export const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.substring(0, idx).trim();
      const rawVal = pair.substring(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(rawVal);
      } catch {
        cookies[key] = rawVal;
      }
    }
  });
  return cookies;
};

export const extractToken = (req: Request): string | null => {
  // 1. Check Authorization Bearer header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Check HttpOnly cookie
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies[config.authCookieName]) {
      return cookies[config.authCookieName];
    }
  }

  return null;
};

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ message: 'Authentication required. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenPayload;

    // Check if token was explicitly revoked
    if (decoded.jti) {
      const isRevoked = await db.isTokenRevoked(decoded.jti);
      if (isRevoked) {
        res.status(401).json({ message: 'Authentication token has been revoked. Please sign in again.' });
        return;
      }
    }

    const user = await db.getUserById(decoded.id);

    if (!user) {
      res.status(401).json({ message: 'User associated with token no longer exists.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ message: 'Account is suspended. Please contact platform support.' });
      return;
    }

    // Verify tokenVersion matches user's current tokenVersion (handles password reset / global session invalidation)
    const tokenVersion = decoded.tokenVersion ?? 1;
    const currentVersion = user.tokenVersion ?? 1;
    if (tokenVersion !== currentVersion) {
      res.status(401).json({ message: 'Session has been invalidated. Please sign in again.' });
      return;
    }

    req.user = user;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp;
    req.rawToken = token;
    next();
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: 'Authentication token has expired. Please sign in again.' });
      return;
    }
    res.status(401).json({ message: 'Invalid authentication token.' });
    return;
  }
};

export const requireRoles = (...roles: (UserRole | 'administrator')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Normalize roles ('administrator' maps to 'admin')
    const normalizedTargetRoles = roles.map((r) => (r === 'administrator' ? 'admin' : r));
    const userRole = req.user.role === 'admin' ? 'admin' : req.user.role;

    if (!normalizedTargetRoles.includes(userRole)) {
      res.status(403).json({
        message: `Forbidden: Access requires one of the following roles: [${roles.join(', ')}]. Your role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
};
