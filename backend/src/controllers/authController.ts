import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { User, UserRole } from '../types';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';

const validEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, companyName, title, location } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string' || !email.trim() || !password || !name.trim()) {
      res.status(400).json({ message: 'Email, password, and name are required.' });
      return;
    }
    if (!validEmail(email.trim()) || password.length < 8 || password.length > 128 || name.trim().length > 150) {
      res.status(400).json({ message: 'Provide a valid email, a password of 8–128 characters, and a name up to 150 characters.' });
      return;
    }

    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ message: 'An account with this email address already exists.' });
      return;
    }

    const assignedRole: UserRole = role === 'recruiter' ? 'recruiter' : 'candidate';
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser: User = {
      id: `user-${uuidv4().substring(0, 8)}`,
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      role: assignedRole,
      status: 'active',
      title: title || (assignedRole === 'recruiter' ? 'Talent Acquisition' : 'Software Engineer'),
      location: location || 'Remote, US',
      companyName: assignedRole === 'recruiter' ? (companyName || 'Independent Tech') : undefined,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      skills: assignedRole === 'candidate' ? ['React', 'TypeScript', 'Node.js'] : undefined,
      experience: [],
      education: [],
      createdAt: new Date().toISOString(),
    };

    await db.createUser(newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    const { password: _, ...userSafe } = newUser;
    res.status(201).json({
      message: 'Account registered successfully.',
      token,
      user: userSafe,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Please provide both email and password.' });
      return;
    }
    if (typeof email !== 'string' || typeof password !== 'string' || !validEmail(email.trim()) || password.length > 128) {
      res.status(400).json({ message: 'Provide a valid email and password.' });
      return;
    }

    const user = await db.getUserByEmail(email);
    if (!user || !user.password) {
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

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    const { password: _, ...userSafe } = user;
    res.json({
      message: 'Login successful.',
      token,
      user: userSafe,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

export const getMe = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { password: _, ...userSafe } = req.user;
  res.json({ user: userSafe });
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const { name, title, location, phone, bio, skills, experience, education, avatarUrl, companyName } = req.body;
  if ((name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 150)) ||
      (skills !== undefined && (!Array.isArray(skills) || skills.some((skill: unknown) => typeof skill !== 'string'))) ||
      (experience !== undefined && !Array.isArray(experience)) ||
      (education !== undefined && !Array.isArray(education))) {
    res.status(400).json({ message: 'Profile fields have invalid types or exceed supported limits.' });
    return;
  }

  const updated = await db.updateUser(req.user.id, {
    ...(name !== undefined && { name: name.trim() }),
    ...(title !== undefined && { title }),
    ...(location !== undefined && { location }),
    ...(phone !== undefined && { phone }),
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

  const { password: _, ...userSafe } = updated;
  res.json({
    message: 'Profile updated successfully.',
    user: userSafe,
  });
};

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

  // Auto-merge newly parsed skills into candidate's skill set if missing
  const currentSkills = new Set(req.user.skills || []);
  parsedData.extractedSkills.forEach((s) => currentSkills.add(s));

  const updated = await db.updateUser(req.user.id, {
    resumeUrl: relativeUrl,
    resumeOriginalName: req.file.originalname,
    parsedResumeData: parsedData,
    skills: Array.from(currentSkills),
  });

  const { password: _, ...userSafe } = updated!;
  res.json({
    message: 'Resume uploaded and analyzed via Azure AI Document Intelligence.',
    resumeUrl: relativeUrl,
    parsedData,
    user: userSafe,
  });
};
