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

// ==========================================
// CANDIDATE EDUCATION CONTROLLERS
// ==========================================

/**
 * GET /api/candidate/education
 * Retrieves all education records for the authenticated candidate.
 */
export const getCandidateEducation = async (req: AuthRequest, res: Response): Promise<void> => {
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
    if (req.user.role !== 'candidate' && req.user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Access restricted to candidates.' });
      return;
    }

    const education = await db.getCandidateEducation(req.user.id);
    res.json({ education });
  } catch (error: any) {
    console.error('[Candidate Education] Error retrieving education:', error);
    res.status(500).json({ message: 'Server error while retrieving education records.', error: error.message });
  }
};

/**
 * POST /api/candidate/education
 * Creates a new education record for the authenticated candidate.
 */
export const addCandidateEducation = async (req: AuthRequest, res: Response): Promise<void> => {
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
      res.status(403).json({ message: 'Forbidden: Only candidates can add education records.' });
      return;
    }

    const {
      institution,
      school,
      degree,
      fieldOfStudy,
      startDate,
      endDate,
      isCurrent,
      grade,
      description,
    } = req.body;

    const finalInstitution = (institution || school || '').trim();
    if (!finalInstitution) {
      res.status(400).json({ message: 'Institution / School name is required.' });
      return;
    }
    if (finalInstitution.length > 200) {
      res.status(400).json({ message: 'Institution name cannot exceed 200 characters.' });
      return;
    }

    const finalDegree = (degree || '').trim();
    if (!finalDegree) {
      res.status(400).json({ message: 'Degree or qualification is required.' });
      return;
    }
    if (finalDegree.length > 150) {
      res.status(400).json({ message: 'Degree cannot exceed 150 characters.' });
      return;
    }

    if (fieldOfStudy && String(fieldOfStudy).trim().length > 150) {
      res.status(400).json({ message: 'Field of study cannot exceed 150 characters.' });
      return;
    }

    if (grade && String(grade).trim().length > 50) {
      res.status(400).json({ message: 'Grade / CGPA cannot exceed 50 characters.' });
      return;
    }

    if (description && String(description).trim().length > 3000) {
      res.status(400).json({ message: 'Description cannot exceed 3000 characters.' });
      return;
    }

    const newRecord = await db.createCandidateEducation(req.user.id, {
      institution: finalInstitution,
      degree: finalDegree,
      fieldOfStudy: fieldOfStudy ? String(fieldOfStudy).trim() : undefined,
      startDate: startDate ? String(startDate).trim() : undefined,
      endDate: isCurrent ? undefined : (endDate ? String(endDate).trim() : undefined),
      isCurrent: Boolean(isCurrent),
      grade: grade ? String(grade).trim() : undefined,
      description: description ? String(description).trim() : undefined,
    });

    res.status(201).json({
      message: 'Education record added successfully.',
      education: newRecord,
    });
  } catch (error: any) {
    console.error('[Candidate Education] Error adding education:', error);
    res.status(500).json({ message: 'Server error while adding education record.', error: error.message });
  }
};

/**
 * PUT/PATCH /api/candidate/education/:id
 * Updates an existing education record belonging to the authenticated candidate.
 */
export const updateCandidateEducation = async (req: AuthRequest, res: Response): Promise<void> => {
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
      res.status(403).json({ message: 'Forbidden: Only candidates can update education records.' });
      return;
    }

    const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id);
    if (!id) {
      res.status(400).json({ message: 'Education ID is required.' });
      return;
    }

    const existing = await db.getCandidateEducationById(id, req.user.id);
    if (!existing) {
      res.status(404).json({ message: 'Education record not found or does not belong to you.' });
      return;
    }

    const {
      institution,
      school,
      degree,
      fieldOfStudy,
      startDate,
      endDate,
      isCurrent,
      grade,
      description,
    } = req.body;

    const updates: any = {};

    if (institution !== undefined || school !== undefined) {
      const inst = (institution !== undefined ? institution : school || '').trim();
      if (!inst) {
        res.status(400).json({ message: 'Institution cannot be empty.' });
        return;
      }
      if (inst.length > 200) {
        res.status(400).json({ message: 'Institution cannot exceed 200 characters.' });
        return;
      }
      updates.institution = inst;
    }

    if (degree !== undefined) {
      const deg = String(degree).trim();
      if (!deg) {
        res.status(400).json({ message: 'Degree cannot be empty.' });
        return;
      }
      if (deg.length > 150) {
        res.status(400).json({ message: 'Degree cannot exceed 150 characters.' });
        return;
      }
      updates.degree = deg;
    }

    if (fieldOfStudy !== undefined) {
      const fos = String(fieldOfStudy).trim();
      if (fos.length > 150) {
        res.status(400).json({ message: 'Field of study cannot exceed 150 characters.' });
        return;
      }
      updates.fieldOfStudy = fos || undefined;
    }

    if (startDate !== undefined) updates.startDate = startDate ? String(startDate).trim() : undefined;
    if (endDate !== undefined) updates.endDate = endDate ? String(endDate).trim() : undefined;
    if (isCurrent !== undefined) {
      updates.isCurrent = Boolean(isCurrent);
      if (updates.isCurrent) updates.endDate = undefined;
    }
    if (grade !== undefined) {
      const grd = String(grade).trim();
      if (grd.length > 50) {
        res.status(400).json({ message: 'Grade cannot exceed 50 characters.' });
        return;
      }
      updates.grade = grd || undefined;
    }
    if (description !== undefined) {
      const desc = String(description).trim();
      if (desc.length > 3000) {
        res.status(400).json({ message: 'Description cannot exceed 3000 characters.' });
        return;
      }
      updates.description = desc || undefined;
    }

    const updated = await db.updateCandidateEducation(id, req.user.id, updates);
    res.json({
      message: 'Education record updated successfully.',
      education: updated,
    });
  } catch (error: any) {
    console.error('[Candidate Education] Error updating education:', error);
    res.status(500).json({ message: 'Server error while updating education record.', error: error.message });
  }
};

/**
 * DELETE /api/candidate/education/:id
 * Deletes an education record belonging to the authenticated candidate.
 */
export const deleteCandidateEducation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can delete education records.' });
      return;
    }

    const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id);
    if (!id) {
      res.status(400).json({ message: 'Education ID is required.' });
      return;
    }

    const existing = await db.getCandidateEducationById(id, req.user.id);
    if (!existing) {
      res.status(404).json({ message: 'Education record not found or does not belong to you.' });
      return;
    }

    const deleted = await db.deleteCandidateEducation(id, req.user.id);
    if (!deleted) {
      res.status(404).json({ message: 'Education record not found.' });
      return;
    }

    res.json({ message: 'Education record deleted successfully.' });
  } catch (error: any) {
    console.error('[Candidate Education] Error deleting education:', error);
    res.status(500).json({ message: 'Server error while deleting education record.', error: error.message });
  }
};

// ==========================================
// CANDIDATE WORK EXPERIENCE CONTROLLERS
// ==========================================

/**
 * GET /api/candidate/experience
 * Retrieves all work experience records for the authenticated candidate.
 */
export const getCandidateExperience = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate' && req.user.role !== 'admin') {
      res.status(403).json({ message: 'Forbidden: Access restricted to candidates.' });
      return;
    }

    const experience = await db.getCandidateExperience(req.user.id);
    res.json({ experience });
  } catch (error: any) {
    console.error('[Candidate Experience] Error retrieving experience:', error);
    res.status(500).json({ message: 'Server error while retrieving work experience records.', error: error.message });
  }
};

/**
 * POST /api/candidate/experience
 * Creates a new work experience record for the authenticated candidate.
 */
export const addCandidateExperience = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can add work experience records.' });
      return;
    }

    const {
      company,
      title,
      employmentType,
      location,
      startDate,
      endDate,
      isCurrent,
      description,
    } = req.body;

    const finalCompany = (company || '').trim();
    if (!finalCompany) {
      res.status(400).json({ message: 'Company name is required.' });
      return;
    }
    if (finalCompany.length > 200) {
      res.status(400).json({ message: 'Company name cannot exceed 200 characters.' });
      return;
    }

    const finalTitle = (title || '').trim();
    if (!finalTitle) {
      res.status(400).json({ message: 'Job title / Designation is required.' });
      return;
    }
    if (finalTitle.length > 150) {
      res.status(400).json({ message: 'Job title cannot exceed 150 characters.' });
      return;
    }

    if (employmentType && String(employmentType).trim().length > 50) {
      res.status(400).json({ message: 'Employment type cannot exceed 50 characters.' });
      return;
    }

    if (location && String(location).trim().length > 150) {
      res.status(400).json({ message: 'Location cannot exceed 150 characters.' });
      return;
    }

    if (description && String(description).trim().length > 5000) {
      res.status(400).json({ message: 'Job description cannot exceed 5000 characters.' });
      return;
    }

    const newRecord = await db.createCandidateExperience(req.user.id, {
      company: finalCompany,
      title: finalTitle,
      employmentType: employmentType ? String(employmentType).trim() : undefined,
      location: location ? String(location).trim() : undefined,
      startDate: startDate ? String(startDate).trim() : undefined,
      endDate: isCurrent ? undefined : (endDate ? String(endDate).trim() : undefined),
      isCurrent: Boolean(isCurrent),
      description: description ? String(description).trim() : '',
    });

    res.status(201).json({
      message: 'Work experience record added successfully.',
      experience: newRecord,
    });
  } catch (error: any) {
    console.error('[Candidate Experience] Error adding experience:', error);
    res.status(500).json({ message: 'Server error while adding work experience record.', error: error.message });
  }
};

/**
 * PUT/PATCH /api/candidate/experience/:id
 * Updates an existing work experience record belonging to the authenticated candidate.
 */
export const updateCandidateExperience = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can update work experience records.' });
      return;
    }

    const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id);
    if (!id) {
      res.status(400).json({ message: 'Experience ID is required.' });
      return;
    }

    const existing = await db.getCandidateExperienceById(id, req.user.id);
    if (!existing) {
      res.status(404).json({ message: 'Work experience record not found or does not belong to you.' });
      return;
    }

    const {
      company,
      title,
      employmentType,
      location,
      startDate,
      endDate,
      isCurrent,
      description,
    } = req.body;

    const updates: any = {};

    if (company !== undefined) {
      const comp = String(company).trim();
      if (!comp) {
        res.status(400).json({ message: 'Company name cannot be empty.' });
        return;
      }
      if (comp.length > 200) {
        res.status(400).json({ message: 'Company name cannot exceed 200 characters.' });
        return;
      }
      updates.company = comp;
    }

    if (title !== undefined) {
      const tit = String(title).trim();
      if (!tit) {
        res.status(400).json({ message: 'Job title cannot be empty.' });
        return;
      }
      if (tit.length > 150) {
        res.status(400).json({ message: 'Job title cannot exceed 150 characters.' });
        return;
      }
      updates.title = tit;
    }

    if (employmentType !== undefined) {
      const et = String(employmentType).trim();
      if (et.length > 50) {
        res.status(400).json({ message: 'Employment type cannot exceed 50 characters.' });
        return;
      }
      updates.employmentType = et || undefined;
    }

    if (location !== undefined) {
      const loc = String(location).trim();
      if (loc.length > 150) {
        res.status(400).json({ message: 'Location cannot exceed 150 characters.' });
        return;
      }
      updates.location = loc || undefined;
    }

    if (startDate !== undefined) updates.startDate = startDate ? String(startDate).trim() : undefined;
    if (endDate !== undefined) updates.endDate = endDate ? String(endDate).trim() : undefined;
    if (isCurrent !== undefined) {
      updates.isCurrent = Boolean(isCurrent);
      if (updates.isCurrent) updates.endDate = undefined;
    }
    if (description !== undefined) {
      const desc = String(description).trim();
      if (desc.length > 5000) {
        res.status(400).json({ message: 'Job description cannot exceed 5000 characters.' });
        return;
      }
      updates.description = desc;
    }

    const updated = await db.updateCandidateExperience(id, req.user.id, updates);
    res.json({
      message: 'Work experience record updated successfully.',
      experience: updated,
    });
  } catch (error: any) {
    console.error('[Candidate Experience] Error updating experience:', error);
    res.status(500).json({ message: 'Server error while updating work experience record.', error: error.message });
  }
};

/**
 * DELETE /api/candidate/experience/:id
 * Deletes a work experience record belonging to the authenticated candidate.
 */
export const deleteCandidateExperience = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Authentication required.' });
      return;
    }
    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Forbidden: Only candidates can delete work experience records.' });
      return;
    }

    const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id);
    if (!id) {
      res.status(400).json({ message: 'Experience ID is required.' });
      return;
    }

    const existing = await db.getCandidateExperienceById(id, req.user.id);
    if (!existing) {
      res.status(404).json({ message: 'Work experience record not found or does not belong to you.' });
      return;
    }

    const deleted = await db.deleteCandidateExperience(id, req.user.id);
    if (!deleted) {
      res.status(404).json({ message: 'Work experience record not found.' });
      return;
    }

    res.json({ message: 'Work experience record deleted successfully.' });
  } catch (error: any) {
    console.error('[Candidate Experience] Error deleting experience:', error);
    res.status(500).json({ message: 'Server error while deleting work experience record.', error: error.message });
  }
};

