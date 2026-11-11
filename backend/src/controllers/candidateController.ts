import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { CandidateProfile, User } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_REGEX = /^[0-9+\-().\s]+$/;

export function formatCandidateProfile(user: User): CandidateProfile {
  return {
    id: user.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || user.contactNumber || undefined,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.substring(0, 10) : undefined,
    gender: user.gender || undefined,
    title: user.title || user.designation || undefined,
    location: user.location || undefined,
    bio: user.bio || undefined,
    skills: user.skills || [],
    experience: user.experience || [],
    education: user.education || [],
    resumeUrl: user.resumeUrl || undefined,
    resumeOriginalName: user.resumeOriginalName || undefined,
    avatarUrl: user.avatarUrl || undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * GET /api/candidate/profile
 * Retrieves the authenticated candidate's personal profile.
 * Never returns password hashes.
 */
export const getCandidateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }

    if (req.user.role !== 'candidate' && req.user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Access restricted to candidates.' });
      return;
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    if (user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: User is not a candidate.' });
      return;
    }

    const profile = formatCandidateProfile(user);
    res.json({ profile });
  } catch (error: any) {
    console.error('[Candidate Profile] Error retrieving profile:', error);
    res.status(500).json({ message: 'Server error while retrieving candidate profile.', error: error.message });
  }
};

/**
 * PUT /api/candidate/profile
 * Updates the authenticated candidate's personal information.
 * Validates required and optional fields, saves in MySQL, returns updated profile.
 */
export const updateCandidateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }

    // Role-based security: strictly forbid recruiters or other unauthorized roles
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Recruiters and unauthorized roles cannot modify candidate personal details.' });
      return;
    }

    const {
      id: bodyId,
      userId: bodyUserId,
      name,
      email,
      phone,
      dateOfBirth,
      gender,
      title,
      location,
      bio,
      skills,
      experience,
      education,
    } = req.body;

    // Security check: Candidate A cannot update Candidate B's profile
    if ((bodyId && bodyId !== req.user.id) || (bodyUserId && bodyUserId !== req.user.id)) {
      res.status(403).json({ message: "Forbidden: You cannot modify another candidate's profile." });
      return;
    }

    // Field Validation 1: Full name (required)
    if (name === undefined || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ message: 'Full name is required.' });
      return;
    }
    if (name.trim().length > 150) {
      res.status(400).json({ message: 'Full name cannot exceed 150 characters.' });
      return;
    }

    // Field Validation 2: Email (required & valid format)
    if (email === undefined || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ message: 'Email address is required.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({ message: 'Please provide a valid email address.' });
      return;
    }

    // Check email uniqueness if email is changed
    const existingWithEmail = await db.getUserByEmail(normalizedEmail);
    if (existingWithEmail && existingWithEmail.id !== req.user.id) {
      res.status(400).json({ message: 'Email address is already in use by another account.' });
      return;
    }

    // Field Validation 3: Phone number (optional, but validated if provided)
    let formattedPhone: string | null = null;
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      if (typeof phone !== 'string') {
        res.status(400).json({ message: 'Please provide a valid phone number.' });
        return;
      }
      const trimmedPhone = phone.trim();
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 20 || !PHONE_CHARS_REGEX.test(trimmedPhone)) {
        res.status(400).json({ message: 'Please provide a valid phone number.' });
        return;
      }
      formattedPhone = trimmedPhone;
    }

    // Field Validation 4: Date of birth (optional, but must be in the past if provided)
    let formattedDob: string | null = null;
    if (dateOfBirth !== undefined && dateOfBirth !== null && String(dateOfBirth).trim() !== '') {
      const dobStr = String(dateOfBirth).trim();
      const dobDate = new Date(dobStr);
      if (isNaN(dobDate.getTime())) {
        res.status(400).json({ message: 'Please provide a valid date of birth (YYYY-MM-DD).' });
        return;
      }
      const now = new Date();
      if (dobDate >= now) {
        res.status(400).json({ message: 'Date of birth must be in the past.' });
        return;
      }
      // Check maximum age (e.g. at most 130 years ago)
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 130);
      if (dobDate < minDate) {
        res.status(400).json({ message: 'Please provide a realistic date of birth.' });
        return;
      }
      formattedDob = dobStr.substring(0, 10);
    }

    // Field Validation 5: Gender (optional, max 32 chars)
    let formattedGender: string | null = null;
    if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
      if (typeof gender !== 'string' || gender.trim().length > 32) {
        res.status(400).json({ message: 'Gender must be a valid string up to 32 characters.' });
        return;
      }
      formattedGender = gender.trim();
    }

    // Field Validation 6: Headline / Title (optional, max 150 chars)
    if (title !== undefined && title !== null && typeof title === 'string' && title.trim().length > 150) {
      res.status(400).json({ message: 'Professional headline cannot exceed 150 characters.' });
      return;
    }

    // Field Validation 7: Location (optional, max 150 chars)
    if (location !== undefined && location !== null && typeof location === 'string' && location.trim().length > 150) {
      res.status(400).json({ message: 'Location cannot exceed 150 characters.' });
      return;
    }

    // Field Validation 8: Professional summary / Bio (optional, max 3000 chars)
    if (bio !== undefined && bio !== null && typeof bio === 'string' && bio.trim().length > 3000) {
      res.status(400).json({ message: 'Professional summary cannot exceed 3000 characters.' });
      return;
    }

    // Skills, experience, education type checks if provided
    if (skills !== undefined && (!Array.isArray(skills) || skills.some((s) => typeof s !== 'string'))) {
      res.status(400).json({ message: 'Skills must be an array of strings.' });
      return;
    }
    if (experience !== undefined && !Array.isArray(experience)) {
      res.status(400).json({ message: 'Experience must be an array.' });
      return;
    }
    if (education !== undefined && !Array.isArray(education)) {
      res.status(400).json({ message: 'Education must be an array.' });
      return;
    }

    // Build updates payload
    const updates: Partial<User> = {
      name: name.trim(),
      email: normalizedEmail,
      phone: formattedPhone || (phone === '' ? undefined : undefined),
      dateOfBirth: formattedDob || (dateOfBirth === '' ? undefined : undefined),
      gender: formattedGender || (gender === '' ? undefined : undefined),
      ...(title !== undefined && { title: typeof title === 'string' ? title.trim() : undefined }),
      ...(location !== undefined && { location: typeof location === 'string' ? location.trim() : undefined }),
      ...(bio !== undefined && { bio: typeof bio === 'string' ? bio.trim() : undefined }),
      ...(skills !== undefined && { skills }),
      ...(experience !== undefined && { experience }),
      ...(education !== undefined && { education }),
      updatedAt: new Date().toISOString(),
    };

    const updatedUser = await db.updateUser(req.user.id, updates);
    if (!updatedUser) {
      res.status(404).json({ message: 'Candidate profile not found to update.' });
      return;
    }

    const profile = formatCandidateProfile(updatedUser);
    res.json({
      message: 'Candidate personal profile updated successfully.',
      profile,
    });
  } catch (error: any) {
    console.error('[Candidate Profile] Error updating profile:', error);
    res.status(500).json({ message: 'Server error while updating candidate profile.', error: error.message });
  }
};

