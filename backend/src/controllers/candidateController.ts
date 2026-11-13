import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { CandidateProfile, User, UserEducation, UserExperience } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_REGEX = /^[0-9+\-().\s]+$/;

export function formatCandidateProfile(user: User): CandidateProfile {
  // Ensure education and experience items have id attributes
  const education = (user.education || []).map((edu, idx) => ({
    ...edu,
    id: edu.id || `edu-${idx + 1}-${user.id.substring(0, 8)}`,
  }));

  const experience = (user.experience || []).map((exp, idx) => ({
    ...exp,
    id: exp.id || `exp-${idx + 1}-${user.id.substring(0, 8)}`,
  }));

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
    experience,
    education,
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
 * Validates required and optional fields, saves in database, returns updated profile.
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

    // Skills, experience, education processing
    let processedSkills: string[] | undefined = undefined;
    if (skills !== undefined) {
      if (!Array.isArray(skills) || skills.some((s) => typeof s !== 'string')) {
        res.status(400).json({ message: 'Skills must be an array of strings.' });
        return;
      }
      const seen = new Set<string>();
      const sanitized: string[] = [];
      for (const s of skills) {
        const trimmed = s.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          sanitized.push(trimmed);
        }
      }
      processedSkills = sanitized;
    }

    let processedExperience: UserExperience[] | undefined = undefined;
    if (experience !== undefined) {
      if (!Array.isArray(experience)) {
        res.status(400).json({ message: 'Experience must be an array.' });
        return;
      }
      processedExperience = experience.map((exp: any) => ({
        id: exp.id || `exp-${uuidv4()}`,
        title: String(exp.title || '').trim(),
        company: String(exp.company || '').trim(),
        employmentType: exp.employmentType ? String(exp.employmentType).trim() : undefined,
        location: exp.location ? String(exp.location).trim() : undefined,
        startDate: exp.startDate ? String(exp.startDate).trim() : undefined,
        endDate: exp.endDate ? String(exp.endDate).trim() : undefined,
        currentlyWorking: Boolean(exp.currentlyWorking),
        period: exp.period ? String(exp.period).trim() : (
          `${exp.startDate || ''} - ${exp.currentlyWorking ? 'Present' : (exp.endDate || '')}`.trim() || 'N/A'
        ),
        description: exp.description ? String(exp.description).trim() : '',
      }));
    }

    let processedEducation: UserEducation[] | undefined = undefined;
    if (education !== undefined) {
      if (!Array.isArray(education)) {
        res.status(400).json({ message: 'Education must be an array.' });
        return;
      }
      processedEducation = education.map((edu: any) => ({
        id: edu.id || `edu-${uuidv4()}`,
        degree: String(edu.degree || '').trim(),
        school: String(edu.school || '').trim(),
        fieldOfStudy: edu.fieldOfStudy ? String(edu.fieldOfStudy).trim() : undefined,
        startDate: edu.startDate ? String(edu.startDate).trim() : undefined,
        endDate: edu.endDate ? String(edu.endDate).trim() : undefined,
        year: edu.year ? String(edu.year).trim() : (edu.endDate ? String(edu.endDate).substring(0, 4) : 'N/A'),
        grade: edu.grade ? String(edu.grade).trim() : undefined,
        description: edu.description ? String(edu.description).trim() : undefined,
      }));
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
      ...(processedSkills !== undefined && { skills: processedSkills }),
      ...(processedExperience !== undefined && { experience: processedExperience }),
      ...(processedEducation !== undefined && { education: processedEducation }),
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

// ─── Technical Skills Endpoints ───────────────────────────────────────────────

/**
 * POST /api/candidate/skills
 * Adds a new technical skill to candidate profile.
 * Trims whitespace, prevents empty and duplicate skills.
 */
export const addSkill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage technical skills.' });
      return;
    }

    const { skill } = req.body;
    if (skill === undefined || typeof skill !== 'string' || !skill.trim()) {
      res.status(400).json({ message: 'Skill name is required and cannot be empty.' });
      return;
    }

    const trimmed = skill.trim();
    if (trimmed.length > 100) {
      res.status(400).json({ message: 'Skill name cannot exceed 100 characters.' });
      return;
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const currentSkills = user.skills || [];
    const isDuplicate = currentSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      res.status(400).json({ message: 'Skill already exists in your profile.' });
      return;
    }

    const updatedSkills = [...currentSkills, trimmed];
    await db.updateUser(req.user.id, { skills: updatedSkills });

    res.status(200).json({
      message: 'Technical skill added successfully.',
      skills: updatedSkills,
    });
  } catch (error: any) {
    console.error('[Candidate Skills] Error adding skill:', error);
    res.status(500).json({ message: 'Server error while adding skill.', error: error.message });
  }
};

/**
 * DELETE /api/candidate/skills/:skill
 * Removes a technical skill from candidate profile.
 */
export const removeSkill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage technical skills.' });
      return;
    }

    const rawSkill = req.params.skill || req.body?.skill;
    if (!rawSkill || typeof rawSkill !== 'string') {
      res.status(400).json({ message: 'Skill name is required to remove.' });
      return;
    }

    const targetSkill = decodeURIComponent(rawSkill).trim();
    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const currentSkills = user.skills || [];
    const updatedSkills = currentSkills.filter((s) => s.toLowerCase() !== targetSkill.toLowerCase());

    await db.updateUser(req.user.id, { skills: updatedSkills });

    res.status(200).json({
      message: 'Technical skill removed successfully.',
      skills: updatedSkills,
    });
  } catch (error: any) {
    console.error('[Candidate Skills] Error removing skill:', error);
    res.status(500).json({ message: 'Server error while removing skill.', error: error.message });
  }
};

// ─── Educational Qualifications Endpoints ─────────────────────────────────────

/**
 * POST /api/candidate/education
 * Adds a new educational qualification.
 */
export const addEducation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage educational qualifications.' });
      return;
    }

    const { degree, school, fieldOfStudy, startDate, endDate, year, grade, description } = req.body;

    if (!degree || typeof degree !== 'string' || !degree.trim()) {
      res.status(400).json({ message: 'Degree or qualification is required.' });
      return;
    }
    if (!school || typeof school !== 'string' || !school.trim()) {
      res.status(400).json({ message: 'Institution or school name is required.' });
      return;
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const currentEdu = user.education || [];
    const newEntry: UserEducation = {
      id: `edu-${uuidv4()}`,
      degree: degree.trim(),
      school: school.trim(),
      fieldOfStudy: fieldOfStudy && typeof fieldOfStudy === 'string' ? fieldOfStudy.trim() : undefined,
      startDate: startDate && typeof startDate === 'string' ? startDate.trim() : undefined,
      endDate: endDate && typeof endDate === 'string' ? endDate.trim() : undefined,
      year: year && typeof year === 'string' ? year.trim() : (endDate ? String(endDate).substring(0, 4) : 'N/A'),
      grade: grade && typeof grade === 'string' ? grade.trim() : undefined,
      description: description && typeof description === 'string' ? description.trim() : undefined,
    };

    const updatedEdu = [...currentEdu, newEntry];
    await db.updateUser(req.user.id, { education: updatedEdu });

    res.status(201).json({
      message: 'Educational qualification added successfully.',
      education: updatedEdu,
      entry: newEntry,
    });
  } catch (error: any) {
    console.error('[Candidate Education] Error adding education:', error);
    res.status(500).json({ message: 'Server error while adding education.', error: error.message });
  }
};

/**
 * PUT /api/candidate/education/:id
 * Updates an existing educational qualification entry.
 */
export const updateEducation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage educational qualifications.' });
      return;
    }

    const { id } = req.params;
    const { degree, school, fieldOfStudy, startDate, endDate, year, grade, description } = req.body;

    if (degree !== undefined && (typeof degree !== 'string' || !degree.trim())) {
      res.status(400).json({ message: 'Degree or qualification cannot be empty.' });
      return;
    }
    if (school !== undefined && (typeof school !== 'string' || !school.trim())) {
      res.status(400).json({ message: 'Institution or school name cannot be empty.' });
      return;
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const currentEdu = user.education || [];
    const idx = currentEdu.findIndex((e) => e.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Educational qualification entry not found.' });
      return;
    }

    const existing = currentEdu[idx];
    const updatedEntry: UserEducation = {
      ...existing,
      ...(degree !== undefined && { degree: degree.trim() }),
      ...(school !== undefined && { school: school.trim() }),
      ...(fieldOfStudy !== undefined && { fieldOfStudy: fieldOfStudy ? fieldOfStudy.trim() : undefined }),
      ...(startDate !== undefined && { startDate: startDate ? startDate.trim() : undefined }),
      ...(endDate !== undefined && { endDate: endDate ? endDate.trim() : undefined }),
      ...(year !== undefined && { year: year ? year.trim() : (endDate ? String(endDate).substring(0, 4) : 'N/A') }),
      ...(grade !== undefined && { grade: grade ? grade.trim() : undefined }),
      ...(description !== undefined && { description: description ? description.trim() : undefined }),
    };

    const updatedEdu = [...currentEdu];
    updatedEdu[idx] = updatedEntry;
    await db.updateUser(req.user.id, { education: updatedEdu });

    res.status(200).json({
      message: 'Educational qualification updated successfully.',
      education: updatedEdu,
      entry: updatedEntry,
    });
  } catch (error: any) {
    console.error('[Candidate Education] Error updating education:', error);
    res.status(500).json({ message: 'Server error while updating education.', error: error.message });
  }
};

/**
 * DELETE /api/candidate/education/:id
 * Deletes an educational qualification entry.
 */
export const deleteEducation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage educational qualifications.' });
      return;
    }

    const { id } = req.params;
    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const currentEdu = user.education || [];
    const exists = currentEdu.some((e) => e.id === id);
    if (!exists) {
      res.status(404).json({ message: 'Educational qualification entry not found.' });
      return;
    }

    const updatedEdu = currentEdu.filter((e) => e.id !== id);
    await db.updateUser(req.user.id, { education: updatedEdu });

    res.status(200).json({
      message: 'Educational qualification deleted successfully.',
      education: updatedEdu,
    });
  } catch (error: any) {
    console.error('[Candidate Education] Error deleting education:', error);
    res.status(500).json({ message: 'Server error while deleting education.', error: error.message });
  }
};

// ─── Work Experience Endpoints ────────────────────────────────────────────────

/**
 * POST /api/candidate/experience
 * Adds a new work experience entry.
 */
export const addExperience = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage work experience.' });
      return;
    }

    const {
      title,
      company,
      employmentType,
      location,
      startDate,
      endDate,
      currentlyWorking,
      description,
      period,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ message: 'Job title is required.' });
      return;
    }
    if (!company || typeof company !== 'string' || !company.trim()) {
      res.status(400).json({ message: 'Company name is required.' });
      return;
    }

    // Validate dates if both provided and not currently working
    const isCurrent = Boolean(currentlyWorking);
    if (startDate && endDate && !isCurrent) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
        res.status(400).json({ message: 'End date cannot be earlier than start date.' });
        return;
      }
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const computedPeriod =
      period && typeof period === 'string' && period.trim()
        ? period.trim()
        : `${startDate || ''} - ${isCurrent ? 'Present' : (endDate || '')}`.trim() || 'N/A';

    const newEntry: UserExperience = {
      id: `exp-${uuidv4()}`,
      title: title.trim(),
      company: company.trim(),
      employmentType: employmentType && typeof employmentType === 'string' ? employmentType.trim() : undefined,
      location: location && typeof location === 'string' ? location.trim() : undefined,
      startDate: startDate && typeof startDate === 'string' ? startDate.trim() : undefined,
      endDate: isCurrent ? undefined : (endDate && typeof endDate === 'string' ? endDate.trim() : undefined),
      currentlyWorking: isCurrent,
      period: computedPeriod,
      description: description && typeof description === 'string' ? description.trim() : '',
    };

    const currentExp = user.experience || [];
    const updatedExp = [...currentExp, newEntry];
    await db.updateUser(req.user.id, { experience: updatedExp });

    res.status(201).json({
      message: 'Work experience added successfully.',
      experience: updatedExp,
      entry: newEntry,
    });
  } catch (error: any) {
    console.error('[Candidate Experience] Error adding experience:', error);
    res.status(500).json({ message: 'Server error while adding experience.', error: error.message });
  }
};

/**
 * PUT /api/candidate/experience/:id
 * Updates an existing work experience entry.
 */
export const updateExperience = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage work experience.' });
      return;
    }

    const { id } = req.params;
    const {
      title,
      company,
      employmentType,
      location,
      startDate,
      endDate,
      currentlyWorking,
      description,
      period,
    } = req.body;

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      res.status(400).json({ message: 'Job title cannot be empty.' });
      return;
    }
    if (company !== undefined && (typeof company !== 'string' || !company.trim())) {
      res.status(400).json({ message: 'Company name cannot be empty.' });
      return;
    }

    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const currentExp = user.experience || [];
    const idx = currentExp.findIndex((e) => e.id === id);
    if (idx === -1) {
      res.status(404).json({ message: 'Work experience entry not found.' });
      return;
    }

    const existing = currentExp[idx];
    const isCurrent = currentlyWorking !== undefined ? Boolean(currentlyWorking) : Boolean(existing.currentlyWorking);
    const effStartDate = startDate !== undefined ? startDate : existing.startDate;
    const effEndDate = isCurrent ? undefined : (endDate !== undefined ? endDate : existing.endDate);

    if (effStartDate && effEndDate && !isCurrent) {
      const start = new Date(effStartDate);
      const end = new Date(effEndDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
        res.status(400).json({ message: 'End date cannot be earlier than start date.' });
        return;
      }
    }

    const computedPeriod =
      period !== undefined
        ? (typeof period === 'string' ? period.trim() : 'N/A')
        : `${effStartDate || ''} - ${isCurrent ? 'Present' : (effEndDate || '')}`.trim() || existing.period || 'N/A';

    const updatedEntry: UserExperience = {
      ...existing,
      ...(title !== undefined && { title: title.trim() }),
      ...(company !== undefined && { company: company.trim() }),
      ...(employmentType !== undefined && { employmentType: employmentType ? employmentType.trim() : undefined }),
      ...(location !== undefined && { location: location ? location.trim() : undefined }),
      ...(startDate !== undefined && { startDate: startDate ? startDate.trim() : undefined }),
      ...(endDate !== undefined && { endDate: isCurrent ? undefined : (endDate ? endDate.trim() : undefined) }),
      ...(currentlyWorking !== undefined && { currentlyWorking: isCurrent }),
      period: computedPeriod,
      ...(description !== undefined && { description: description ? description.trim() : '' }),
    };

    const updatedExp = [...currentExp];
    updatedExp[idx] = updatedEntry;
    await db.updateUser(req.user.id, { experience: updatedExp });

    res.status(200).json({
      message: 'Work experience updated successfully.',
      experience: updatedExp,
      entry: updatedEntry,
    });
  } catch (error: any) {
    console.error('[Candidate Experience] Error updating experience:', error);
    res.status(500).json({ message: 'Server error while updating experience.', error: error.message });
  }
};

/**
 * DELETE /api/candidate/experience/:id
 * Deletes a work experience entry.
 */
export const deleteExperience = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can manage work experience.' });
      return;
    }

    const { id } = req.params;
    const user = await db.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'Candidate profile not found.' });
      return;
    }

    const currentExp = user.experience || [];
    const exists = currentExp.some((e) => e.id === id);
    if (!exists) {
      res.status(404).json({ message: 'Work experience entry not found.' });
      return;
    }

    const updatedExp = currentExp.filter((e) => e.id !== id);
    await db.updateUser(req.user.id, { experience: updatedExp });

    res.status(200).json({
      message: 'Work experience deleted successfully.',
      experience: updatedExp,
    });
  } catch (error: any) {
    console.error('[Candidate Experience] Error deleting experience:', error);
    res.status(500).json({ message: 'Server error while deleting experience.', error: error.message });
  }
};
