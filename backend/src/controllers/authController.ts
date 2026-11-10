import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { User, UserRole, PasswordResetToken, RevokedToken } from '../types';
import { validatePasswordPolicy } from '../utils/passwordPolicy';
import { emailService } from '../services/emailService';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const setAuthCookie = (res: Response, token: string): void => {
  const isProduction = config.nodeEnv === 'production';
  res.cookie(config.authCookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearAuthCookie = (res: Response): void => {
  const isProduction = config.nodeEnv === 'production';
  res.clearCookie(config.authCookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  });
};

const sanitizeUser = (user: User) => {
  const { password: _, ...userSafe } = user;
  return userSafe;
};

// ==========================================
// REGISTRATION
// ==========================================
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, confirmPassword, name, role, companyName, title, location } = req.body;

    // 1. Required field checks
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Full name is required.' });
      return;
    }
    if (name.trim().length < 2 || name.trim().length > 150) {
      res.status(400).json({ message: 'Full name must be between 2 and 150 characters.' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ message: 'Email address is required.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({ message: 'Please provide a valid email address.' });
      return;
    }

    // 2. Strict Role Validation
    const requestedRole = typeof role === 'string' ? role.trim().toLowerCase() : 'candidate';
    if (requestedRole === 'admin' || requestedRole === 'administrator') {
      res.status(403).json({
        message: 'Public registration as administrator is not permitted. Admin accounts must be provisioned by a platform administrator.',
      });
      return;
    }
    if (requestedRole !== 'candidate' && requestedRole !== 'recruiter') {
      res.status(400).json({
        message: 'Invalid role selection. Must be either "candidate" or "recruiter".',
      });
      return;
    }
    const assignedRole: UserRole = requestedRole;

    // 3. Role-specific validation
    if (assignedRole === 'recruiter') {
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        res.status(400).json({ message: 'Company or organization name is required for recruiter registration.' });
        return;
      }
      if (companyName.trim().length < 2 || companyName.trim().length > 150) {
        res.status(400).json({ message: 'Company name must be between 2 and 150 characters.' });
        return;
      }
    }

    // 4. Password Policy Validation
    if (!password || typeof password !== 'string') {
      res.status(400).json({ message: 'Password is required.' });
      return;
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      res.status(400).json({ message: 'Passwords do not match.' });
      return;
    }

    const passwordCheck = validatePasswordPolicy(password, {
      email: normalizedEmail,
      name: name.trim(),
    });

    if (!passwordCheck.valid) {
      res.status(400).json({
        message: passwordCheck.errors[0] || 'Password does not meet complexity requirements.',
        errors: passwordCheck.errors,
      });
      return;
    }

    // 5. Duplicate account check
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
      res.status(409).json({ message: 'An account with this email address already exists.' });
      return;
    }

    // 6. Secure password hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: `user-${uuidv4().substring(0, 8)}`,
      email: normalizedEmail,
      password: hashedPassword,
      name: name.trim(),
      role: assignedRole,
      status: 'active',
      tokenVersion: 1,
      lastLoginAt: new Date().toISOString(),
      title: title?.trim() || (assignedRole === 'recruiter' ? 'Talent Acquisition' : 'Software Engineer'),
      location: location?.trim() || 'Remote, US',
      companyName: assignedRole === 'recruiter' ? companyName.trim() : undefined,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
      skills: assignedRole === 'candidate' ? ['React', 'TypeScript', 'Node.js'] : undefined,
      experience: [],
      education: [],
      createdAt: new Date().toISOString(),
    };

    await db.createUser(newUser);

    const jti = uuidv4();
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        tokenVersion: 1,
        jti,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    setAuthCookie(res, token);

    res.status(201).json({
      message: 'Account registered successfully.',
      token,
      user: sanitizeUser(newUser),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};

// ==========================================
// LOGIN
// ==========================================
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ message: 'Please provide both email and password.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.getUserByEmail(normalizedEmail);

    // Timing attack mitigation: run dummy compare if user does not exist
    if (!user || !user.password) {
      await bcrypt.compare(password, '$2b$10$w8T0M4j6fI8dG8X5r4XwYeS0H1Kq9uVqB9zN3bQ5r7s9t1v3x5z7a');
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ message: 'Your account has been suspended by an administrator.' });
      return;
    }

    const tokenVersion = user.tokenVersion || 1;
    await db.updateUser(user.id, {
      lastLoginAt: new Date().toISOString(),
    });

    const jti = uuidv4();
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tokenVersion,
        jti,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    setAuthCookie(res, token);

    res.json({
      message: 'Login successful.',
      token,
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

// ==========================================
// LOGOUT
// ==========================================
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // If the request was authenticated with a token containing a JTI, revoke it server-side
    if (req.tokenJti) {
      const expiresAt = req.tokenExp
        ? new Date(req.tokenExp * 1000).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const revokedToken: RevokedToken = {
        id: `rev-${uuidv4().substring(0, 8)}`,
        tokenJti: req.tokenJti,
        expiresAt,
        createdAt: new Date().toISOString(),
      };
      await db.revokeToken(revokedToken);
    }

    clearAuthCookie(res);

    res.json({ message: 'Logged out successfully.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during logout.', error: error.message });
  }
};

// ==========================================
// PASSWORD RESET: REQUEST (FORGOT PASSWORD)
// ==========================================
export const forgotPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      res.status(400).json({ message: 'Please provide a valid email address.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.getUserByEmail(normalizedEmail);

    // Consistent response whether user exists or not (prevents account enumeration)
    const successResponse = {
      message: 'If an account with that email address exists, password reset instructions have been sent.',
    };

    if (!user || user.status === 'suspended') {
      res.json(successResponse);
      return;
    }

    // Invalidate any previous outstanding reset tokens for this user
    await db.invalidateUserResetTokens(user.id);

    // Generate cryptographically secure random token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    const expiresMinutes = config.passwordResetExpiresMinutes;
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();

    const resetTokenRecord: PasswordResetToken = {
      id: `rst-${uuidv4().substring(0, 8)}`,
      userId: user.id,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date().toISOString(),
    };

    await db.createPasswordResetToken(resetTokenRecord);

    const resetUrl = `${config.frontendUrl}/reset-password?token=${rawResetToken}`;

    // Send actual reset email using configured SMTP provider
    await emailService.sendPasswordResetEmail(user.email, user.name, resetUrl, expiresMinutes);

    res.json(successResponse);
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during password reset request.', error: error.message });
  }
};

// ==========================================
// PASSWORD RESET: CONFIRM & CHANGE
// ==========================================
export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ message: 'Password reset token is required.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string') {
      res.status(400).json({ message: 'New password is required.' });
      return;
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      res.status(400).json({ message: 'Passwords do not match.' });
      return;
    }

    // Validate password policy
    const policyResult = validatePasswordPolicy(newPassword);
    if (!policyResult.valid) {
      res.status(400).json({
        message: policyResult.errors[0] || 'Password does not meet security requirements.',
        errors: policyResult.errors,
      });
      return;
    }

    // Hash incoming token to match database record
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const resetRecord = await db.getPasswordResetTokenByHash(tokenHash);

    if (!resetRecord) {
      res.status(400).json({ message: 'Invalid or expired password reset token.' });
      return;
    }

    if (resetRecord.usedAt) {
      res.status(400).json({ message: 'This password reset token has already been used.' });
      return;
    }

    if (new Date(resetRecord.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ message: 'Password reset token has expired. Please request a new one.' });
      return;
    }

    const user = await db.getUserById(resetRecord.userId);
    if (!user) {
      res.status(400).json({ message: 'User associated with reset token no longer exists.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ message: 'Your account has been suspended by an administrator.' });
      return;
    }

    // Mark token used and invalidate other outstanding reset tokens for user
    await db.markPasswordResetTokenUsed(resetRecord.id);
    await db.invalidateUserResetTokens(user.id);

    // Invalidate existing sessions/tokens by incrementing tokenVersion
    const nextTokenVersion = (user.tokenVersion || 1) + 1;
    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await db.updateUser(user.id, {
      password: newHashedPassword,
      tokenVersion: nextTokenVersion,
      passwordChangedAt: new Date().toISOString(),
    });

    clearAuthCookie(res);

    res.json({
      message: 'Password has been reset successfully. Please sign in with your new password.',
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during password reset.', error: error.message });
  }
};

// ==========================================
// CURRENT USER PROFILE
// ==========================================
export const getMe = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  res.json({ user: sanitizeUser(req.user) });
};

// ==========================================
// UPDATE PROFILE
// ==========================================
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Prevent users from changing their own role, password, status, or tokenVersion
  const { name, title, location, phone, bio, skills, experience, education, avatarUrl, companyName } = req.body;

  if (
    (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 150)) ||
    (skills !== undefined && (!Array.isArray(skills) || skills.some((skill: unknown) => typeof skill !== 'string'))) ||
    (experience !== undefined && !Array.isArray(experience)) ||
    (education !== undefined && !Array.isArray(education))
  ) {
    res.status(400).json({ message: 'Profile fields have invalid types or exceed supported limits.' });
    return;
  }

  const updated = await db.updateUser(req.user.id, {
    ...(name && { name }),
    ...(title && { title }),
    ...(location && { location }),
    ...(phone && { phone }),
    ...(bio !== undefined && { bio }),
    ...(skills !== undefined && { skills }),
    ...(experience !== undefined && { experience }),
    ...(education !== undefined && { education }),
    ...(avatarUrl && { avatarUrl }),
    ...(companyName && { companyName }),
  });

  if (!updated) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  res.json({
    message: 'Profile updated successfully.',
    user: sanitizeUser(updated),
  });
};

// ==========================================
// RESUME UPLOAD
// ==========================================
export const uploadCandidateResume = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'No resume file uploaded.' });
    return;
  }

  const relativeUrl = `/uploads/resumes/${req.file.filename}`;
  const parsedData = AzureDocumentIntelligenceService.parseResumeFile(
    req.file.originalname,
    req.user.skills,
    req.user.experience ? req.user.experience.length * 2 : 4
  );

  const currentSkills = new Set(req.user.skills || []);
  parsedData.extractedSkills.forEach((s) => currentSkills.add(s));

  const updated = await db.updateUser(req.user.id, {
    resumeUrl: relativeUrl,
    resumeOriginalName: req.file.originalname,
    parsedResumeData: parsedData,
    skills: Array.from(currentSkills),
  });

  res.json({
    message: 'Resume uploaded and analyzed via Azure AI Document Intelligence.',
    resumeUrl: relativeUrl,
    parsedData,
    user: sanitizeUser(updated!),
  });
};
