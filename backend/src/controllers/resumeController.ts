/**
 * TalentHub Resume Controller
 *
 * Endpoints:
 *   POST   /api/resume/upload           – Candidate uploads a new resume
 *   GET    /api/resume/my               – Candidate gets their current resume metadata
 *   GET    /api/resume/history          – Candidate gets their full resume version history
 *   GET    /api/resume/download/:id?    – Candidate (or authorised recruiter/admin) gets a SAS URL
 *   POST   /api/resume/parse            – AI parse simulation (unchanged from original)
 *
 * Authorization rules:
 *   - Only the candidate who owns the resume can upload and view their own resume metadata.
 *   - Recruiters can access a candidate's resume download only when they manage a job
 *     the candidate applied to.
 *   - Admins can access any resume download.
 *   - No public, unauthenticated resume routes.
 */
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { config } from '../config';
import { validateResumeBuffer, sanitizeFilename, ResumeValidationService } from '../services/resumeValidationService';
import {
  uploadResumeBuffer,
  generateReadSasUrl,
  deleteBlob,
  downloadBlobToBuffer,
  BlobStorageService,
} from '../services/blobStorageService';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';
import { AzureDocumentIntelligenceService as AzureExtractionService } from '../services/azureDocumentIntelligenceService';
import { ResumeDocument, ExtractedCandidateProfile } from '../types';

/**
 * Helper to extract the relative blob name from a stored resumeUrl (which might be a full URL, relative path, or blob name).
 */
function extractBlobName(rawUrl: string): string {
  if (!rawUrl) return '';

  const containerName = config.storage.containerName;
  const containerIdx = rawUrl.indexOf(`/${containerName}/`);
  if (containerIdx !== -1) {
    const afterContainer = rawUrl.substring(containerIdx + containerName.length + 2);
    return afterContainer.split('?')[0];
  }

  if (rawUrl.startsWith('blob://')) {
    const afterBlob = rawUrl.replace('blob://', '');
    const slashIdx = afterBlob.indexOf('/');
    return slashIdx !== -1 ? afterBlob.substring(slashIdx + 1) : afterBlob;
  }

  if (rawUrl.startsWith('/uploads/resumes/')) {
    return rawUrl.replace('/uploads/resumes/', '');
  }

  return rawUrl.split('?')[0];
}

/**
 * POST /api/resume/upload
 * Candidate-authenticated resume upload in PDF or DOCX format.
 * Validates file content, uploads to private Azure Blob Storage/Azurite, and saves metadata.
 */
export const uploadResume = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'candidate') {
    res.status(403).json({ message: 'Only candidates can upload resumes.' });
    return;
  }

  if (!req.file || !req.file.buffer) {
    res.status(400).json({ message: 'No resume file provided. Send the file as multipart/form-data with field name "resume".' });
    return;
  }

  const buffer = req.file.buffer;
  const originalName = req.file.originalname || 'resume.pdf';

  // ── Validation ────────────────────────────────────────────────────────────
  const validation = await validateResumeBuffer(buffer, originalName, config.storage.maxResumeSizeBytes);

  if (!validation.valid) {
    const statusMap: Record<string, number> = {
      TOO_LARGE: 413,
      EMPTY: 400,
      BAD_EXTENSION: 415,
      BAD_MIME: 415,
      BAD_CONTENT: 400,
      CORRUPT: 400,
    };
    const status = validation.statusCode || statusMap[validation.errorCode ?? ''] || 400;
    res.status(status).json({
      message: validation.errorMessage || validation.error,
      error: validation.errorMessage || validation.error,
    });
    return;
  }

  // ── Blob upload ───────────────────────────────────────────────────────────
  const safeFilename = sanitizeFilename(originalName);
  const blobName = `resumes/${req.user.id}/${Date.now()}-${uuidv4()}-${safeFilename}`;
  let blobUploaded = false;

  try {
    await BlobStorageService.uploadResumeBuffer(blobName, buffer, validation.mimeType!, {
      originalName,
      candidateId: req.user.id,
      checksumSha256: validation.checksum || '',
      uploadedAt: new Date().toISOString(),
    });
    blobUploaded = true;
  } catch (err: any) {
    console.error('[resumeController] Blob upload failed:', err);
    res.status(503).json({ message: 'Resume storage is temporarily unavailable. Please try again later.' });
    return;
  }

  // ── Database records (both resume_documents and users table) ───────────────
  const docId = `rdoc-${uuidv4().substring(0, 12)}`;
  const doc: ResumeDocument = {
    id: docId,
    candidateId: req.user.id,
    originalFilename: safeFilename,
    blobName,
    containerName: config.storage.containerName,
    fileExtension: validation.extension!,
    mimeType: validation.mimeType!,
    fileSizeBytes: buffer.length,
    checksumSha256: validation.checksum!,
    uploadStatus: 'uploaded',
    extractionStatus: 'processing',
    isCurrent: true,
    uploadedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  let savedDoc: ResumeDocument = doc;
  try {
    if (typeof (db as any).createResumeDocument === 'function') {
      savedDoc = await (db as any).createResumeDocument(doc);
    }
  } catch (dbErr) {
    console.error('[resumeController] DB insert into resume_documents failed — cleaning up blob:', blobName, dbErr);
    await BlobStorageService.deleteBlob(blobName);
    res.status(500).json({ message: 'Resume was uploaded but could not be saved. The file has been removed. Please try again.' });
    return;
  }

  // ── Azure AI Document Intelligence Extraction ──────────────────────────
  let extractionResult: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    data?: ExtractedCandidateProfile;
    error?: string;
  } = { status: 'pending' };

  try {
    const ext = await AzureExtractionService.extractCandidateDetails(
      buffer,
      safeFilename,
      validation.mimeType!
    );
    extractionResult = {
      status: ext.status,
      data: ext.data,
      error: ext.error,
    };
  } catch (extErr: any) {
    console.error('[resumeController] Document Intelligence extraction failed:', extErr);
    extractionResult = {
      status: 'failed',
      error: extErr.message || 'Azure AI Document Intelligence service error.',
    };
  }

  // Update resume document with extraction results
  try {
    if (typeof (db as any).updateResumeExtraction === 'function') {
      await (db as any).updateResumeExtraction(
        savedDoc.id,
        extractionResult.status,
        extractionResult.data,
        extractionResult.error
      );
    }
    savedDoc.extractionStatus = extractionResult.status;
    savedDoc.extractedData = extractionResult.data;
    savedDoc.extractionError = extractionResult.error;
  } catch (updateExtErr) {
    console.warn('[resumeController] Warning: Could not persist extraction status on resume document:', updateExtErr);
  }

  // ── Candidate Profile Update Logic ──────────────────────────────────────
  // Requirement 10: Do NOT overwrite manually verified candidate information without confirmation.
  const isCandidateVerified = Boolean(req.user.isProfileVerified || (req.user as any).isVerified);
  let updatedUser = req.user;

  if (isCandidateVerified) {
    console.log(`[resumeController] Candidate "${req.user.id}" profile is already verified by recruiter. Preserving existing profile without automated overwrite.`);
    try {
      const result = await db.updateUser(req.user.id, {
        resumeUrl: blobName,
        resumeOriginalName: originalName,
      });
      if (result) updatedUser = result;
    } catch (userDbErr) {
      console.warn('[resumeController] Could not update resume URL on verified candidate:', userDbErr);
    }
  } else {
    // Unverified candidate profile: merge extracted information safely
    const existingSkills = req.user.skills || [];
    const extractedSkills = extractionResult.data?.skills || [];
    const mergedSkills = Array.from(new Set([...existingSkills, ...extractedSkills]));

    const profileUpdates: any = {
      resumeUrl: blobName,
      resumeOriginalName: originalName,
      skills: mergedSkills,
    };

    if (extractionResult.data?.summary && !req.user.bio) {
      profileUpdates.bio = extractionResult.data.summary;
    }
    if (extractionResult.data?.phone && !req.user.phone) {
      profileUpdates.phone = extractionResult.data.phone;
    }
    if (extractionResult.data?.location && !req.user.location) {
      profileUpdates.location = extractionResult.data.location;
    }
    if (extractionResult.data?.experience?.length && (!req.user.experience || req.user.experience.length === 0)) {
      profileUpdates.experience = extractionResult.data.experience.map((exp) => ({
        title: exp.title,
        company: exp.company,
        period: exp.duration,
        description: exp.description || '',
      }));
      profileUpdates.title = extractionResult.data.experience[0].title;
    }
    if (extractionResult.data?.education?.length && (!req.user.education || req.user.education.length === 0)) {
      profileUpdates.education = extractionResult.data.education.map((edu) => ({
        degree: edu.degree,
        school: edu.institution,
        year: edu.year,
      }));
    }
    if (extractionResult.data?.certifications?.length && (!req.user.certifications || req.user.certifications.length === 0)) {
      profileUpdates.certifications = extractionResult.data.certifications;
    }

    // Retain legacy parsedResumeData for backwards compatibility
    profileUpdates.parsedResumeData = {
      fullName: extractionResult.data?.fullName || req.user.name,
      email: extractionResult.data?.email || req.user.email,
      phone: extractionResult.data?.phone || req.user.phone || '',
      summary: extractionResult.data?.summary || '',
      extractedSkills: mergedSkills,
      experienceYears: extractionResult.data?.experience?.length ? extractionResult.data.experience.length * 2 : 4,
      educationLevel: extractionResult.data?.education?.[0]?.degree || 'Bachelor Degree',
      extractedAt: new Date().toISOString(),
    };

    try {
      const result = await db.updateUser(req.user.id, profileUpdates);
      if (result) updatedUser = result;
    } catch (userDbErr) {
      console.error('[resumeController] User record update failed after blob upload:', userDbErr);
    }
  }

  // Generate initial secure SAS URL
  let sasUrl = '';
  try {
    sasUrl = await BlobStorageService.generateReadSasUrl(blobName, config.storage.sasExpiryMinutes);
  } catch (sasErr) {
    console.warn('[resumeController] Warning: Could not generate initial SAS URL:', sasErr);
  }

  const { password: _password, ...safeUser } = updatedUser || {};

  res.status(200).json({
    message: 'Resume uploaded successfully to private cloud storage and processed with Azure AI Document Intelligence.',
    resume: savedDoc,
    blobName,
    resumeUrl: sasUrl || `/api/resume/${savedDoc.id}/download`,
    downloadUrl: sasUrl || `/api/resume/${savedDoc.id}/download`,
    originalName,
    fileSizeBytes: validation.fileSizeBytes || buffer.length,
    checksumSha256: validation.checksum,
    extractionStatus: extractionResult.status,
    extractedProfile: extractionResult.data,
    extractionError: extractionResult.error,
    user: safeUser,
  });
};

// ─── GET /api/resume/my ──────────────────────────────────────────────────────

export const getMyResume = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'candidate') {
    res.status(403).json({ message: 'Only candidates can access this endpoint.' });
    return;
  }

  try {
    if (typeof (db as any).getCurrentResume === 'function') {
      const resume = await (db as any).getCurrentResume(req.user.id);
      if (resume) {
        res.json({ resume });
        return;
      }
    }

    if (req.user.resumeUrl) {
      res.json({
        resume: {
          id: req.user.id,
          candidateId: req.user.id,
          originalFilename: req.user.resumeOriginalName || 'resume.pdf',
          blobName: req.user.resumeUrl,
          isCurrent: true,
        },
      });
      return;
    }

    res.json({ resume: null, message: 'No resume uploaded yet.' });
  } catch (err) {
    console.error('[resumeController] getMyResume error:', err);
    res.status(500).json({ message: 'Failed to retrieve resume.' });
  }
};

// ─── GET /api/resume/history ─────────────────────────────────────────────────

export const getResumeHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'candidate') {
    res.status(403).json({ message: 'Only candidates can access their resume history.' });
    return;
  }

  try {
    if (typeof (db as any).getResumeHistory === 'function') {
      const history = await (db as any).getResumeHistory(req.user.id);
      res.json({ total: history.length, history });
      return;
    }

    if (req.user.resumeUrl) {
      res.json({
        total: 1,
        history: [
          {
            id: req.user.id,
            candidateId: req.user.id,
            originalFilename: req.user.resumeOriginalName || 'resume.pdf',
            blobName: req.user.resumeUrl,
            isCurrent: true,
          },
        ],
      });
      return;
    }

    res.json({ total: 0, history: [] });
  } catch (err) {
    console.error('[resumeController] getResumeHistory error:', err);
    res.status(500).json({ message: 'Failed to retrieve resume history.' });
  }
};

// ─── GET /api/resume/download/:id? ───────────────────────────────────────────

export const downloadResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const rawParam = req.params.id || req.params.candidateId;
    const targetId = (typeof rawParam === 'string' ? rawParam : (Array.isArray(rawParam) ? rawParam[0] : undefined)) || req.user.id;

    let blobName = '';
    let originalFilename = 'resume.pdf';
    let candidateId = targetId;

    // First check if targetId matches a resume document in resume_documents
    if (typeof (db as any).getResumeDocById === 'function' && targetId.startsWith('rdoc-')) {
      const doc = await (db as any).getResumeDocById(targetId);
      if (doc && doc.uploadStatus !== 'deleted') {
        blobName = doc.blobName;
        originalFilename = doc.originalFilename;
        candidateId = doc.candidateId;
      }
    }

    // If not found as doc, try finding candidate user record
    if (!blobName) {
      const targetUser = await db.getUserById(targetId);
      if (targetUser && targetUser.resumeUrl) {
        blobName = extractBlobName(targetUser.resumeUrl);
        originalFilename = targetUser.resumeOriginalName || 'resume.pdf';
        candidateId = targetUser.id;
      }
    }

    // If still not found and targetId could be a candidateId, check current resume document
    if (!blobName && typeof (db as any).getCurrentResume === 'function') {
      const currentDoc = await (db as any).getCurrentResume(targetId);
      if (currentDoc && currentDoc.uploadStatus !== 'deleted') {
        blobName = currentDoc.blobName;
        originalFilename = currentDoc.originalFilename;
        candidateId = currentDoc.candidateId;
      }
    }

    if (!blobName) {
      res.status(404).json({ message: 'No resume found for the requested candidate.' });
      return;
    }

    // Authorization check
    let isAuthorized = false;

    if (req.user.role === 'admin') {
      isAuthorized = true;
    } else if (req.user.id === candidateId) {
      isAuthorized = true;
    } else if (req.user.role === 'recruiter') {
      // Check if candidate applied to any job managed by this recruiter
      const applications = await db.getApplicationsByCandidateId(candidateId);
      for (const app of applications) {
        const job = await db.getJobById(app.jobId);
        if (job && (job.recruiterId === req.user.id || (req.user.companyId && job.companyId === req.user.companyId))) {
          isAuthorized = true;
          break;
        }
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ message: 'Forbidden: You are not authorized to access this candidate’s resume.' });
      return;
    }

    // Stream directly if requested
    if (req.query.stream === 'true') {
      const fileBuffer = await BlobStorageService.downloadBlobToBuffer(blobName);
      const isPdf = originalFilename.toLowerCase().endsWith('.pdf');
      res.setHeader('Content-Type', isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
      res.send(fileBuffer);
      return;
    }

    // Generate secure short-lived SAS URL
    const sasUrl = await BlobStorageService.generateReadSasUrl(blobName, config.storage.sasExpiryMinutes);

    if (req.query.redirect === 'true') {
      res.redirect(sasUrl);
      return;
    }

    res.json({
      message: 'Short-lived download URL generated.',
      candidateId,
      originalName: originalFilename,
      filename: originalFilename,
      downloadUrl: sasUrl,
      expiresInMinutes: config.storage.sasExpiryMinutes,
    });
  } catch (err: any) {
    console.error('[ResumeController] Error generating resume download link:', err);
    res.status(500).json({
      message: 'Failed to generate secure resume download link.',
      error: err.message,
    });
  }
};

export const getResumeDownloadUrl = downloadResume;

// ─── DELETE /api/resume/:id? ─────────────────────────────────────────────────

export const deleteResume = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const rawParam = req.params.id || req.params.candidateId;
  const targetId = (typeof rawParam === 'string' ? rawParam : (Array.isArray(rawParam) ? rawParam[0] : undefined));

  let doc: ResumeDocument | undefined;
  let candidateId = req.user.id;
  let blobName = '';

  try {
    if (targetId && targetId.startsWith('rdoc-')) {
      doc = await (db as any).getResumeDocById(targetId);
      if (doc) {
        candidateId = doc.candidateId;
        blobName = doc.blobName;
      }
    } else {
      const cId = targetId || req.user.id;
      doc = await (db as any).getCurrentResume(cId);
      if (doc) {
        candidateId = doc.candidateId;
        blobName = doc.blobName;
      } else {
        const u = await db.getUserById(cId);
        if (u && u.resumeUrl) {
          candidateId = u.id;
          blobName = extractBlobName(u.resumeUrl);
        }
      }
    }

    if (!doc && !blobName) {
      res.status(404).json({ message: 'Resume not found.' });
      return;
    }

    // Authorization: Candidate can only delete their own resume; Admin can delete any
    if (req.user.role !== 'admin' && req.user.id !== candidateId) {
      res.status(403).json({ message: 'Forbidden: You cannot delete another user’s resume.' });
      return;
    }

    // Mark as deleted in DB
    if (doc && typeof (db as any).markResumeDeleted === 'function') {
      await (db as any).markResumeDeleted(doc.id, candidateId);
    }

    // Delete blob if blobName exists
    if (blobName) {
      await BlobStorageService.deleteBlob(blobName).catch((err) => {
        console.warn('[resumeController] Warning: Could not delete blob from storage:', blobName, err);
      });
    }

    // If current resume was deleted, clear user's resumeUrl
    const currentUser = await db.getUserById(candidateId);
    if (currentUser && (currentUser.resumeUrl === blobName || (doc && currentUser.resumeUrl?.includes(doc.id)))) {
      await db.updateUser(candidateId, {
        resumeUrl: undefined,
        resumeOriginalName: undefined,
        parsedResumeData: undefined,
      });
    }

    res.json({ message: 'Resume deleted successfully.' });
  } catch (err: any) {
    console.error('[resumeController] deleteResume error:', err);
    res.status(500).json({ message: 'Failed to delete resume.', error: err.message });
  }
};

// ─── POST /api/resume/parse ──────────────────────────────────────────────────

export const parseResume = (req: AuthRequest, res: Response): void => {
  const filename = req.file?.originalname || req.body?.filename || 'Candidate_Resume.pdf';
  const parsed = AzureDocumentIntelligenceService.parseResumeFile(filename);
  res.json({
    parserEngine: 'Local heuristic parser',
    status: 'PARSED',
    extracted: parsed,
  });
};

// ─── GET /api/resume/candidate/:candidateId/extracted ────────────────────────

export const getCandidateExtractedResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const candidateId = String(req.params.candidateId || '');
    if (!candidateId) {
      res.status(400).json({ message: 'Candidate ID is required.' });
      return;
    }

    // Recruiters and Admins can view; candidates can view their own
    if (req.user?.role !== 'admin' && req.user?.role !== 'recruiter' && req.user?.id !== candidateId) {
      res.status(403).json({ message: 'Forbidden: Insufficient permissions to view candidate resume extraction.' });
      return;
    }

    let doc: ResumeDocument | undefined;
    if (typeof (db as any).getCurrentResume === 'function') {
      doc = await (db as any).getCurrentResume(candidateId);
    }

    const candidate = await db.getUserById(candidateId);
    if (!candidate) {
      res.status(404).json({ message: 'Candidate not found.' });
      return;
    }

    // If doc has extracted data, return it
    if (doc && doc.extractedData) {
      res.json({
        candidateId,
        resumeId: doc.id,
        filename: doc.originalFilename,
        status: doc.extractionStatus || 'completed',
        isVerified: Boolean(doc.isVerified || candidate.isProfileVerified),
        verifiedById: doc.verifiedById || candidate.verifiedById,
        verifiedByName: doc.verifiedByName || candidate.verifiedByName,
        verifiedAt: doc.verifiedAt || candidate.verifiedAt,
        extractedData: doc.extractedData,
        error: doc.extractionError,
      });
      return;
    }

    // Fallback synthesized from candidate profile records
    const synthesized: ExtractedCandidateProfile = {
      fullName: candidate.name,
      email: candidate.email,
      phone: candidate.phone || '',
      location: candidate.location || '',
      summary: candidate.bio || '',
      skills: candidate.skills || [],
      experience: (candidate.experience || []).map((e) => ({
        title: e.title,
        company: e.company,
        duration: e.period,
        description: e.description,
      })),
      education: (candidate.education || []).map((ed) => ({
        degree: ed.degree,
        institution: ed.school,
        year: ed.year,
      })),
      certifications: candidate.certifications || [],
      extractedAt: candidate.createdAt,
      modelUsed: 'profile-stored-records',
    };

    res.json({
      candidateId,
      resumeId: doc?.id || null,
      filename: doc?.originalFilename || candidate.resumeOriginalName || 'Resume',
      status: doc?.extractionStatus || (doc ? 'completed' : 'pending'),
      isVerified: Boolean(candidate.isProfileVerified),
      verifiedById: candidate.verifiedById,
      verifiedByName: candidate.verifiedByName,
      verifiedAt: candidate.verifiedAt,
      extractedData: synthesized,
      error: doc?.extractionError,
    });
  } catch (err: any) {
    console.error('[resumeController] getCandidateExtractedResume error:', err);
    res.status(500).json({ message: 'Failed to retrieve extracted resume data.', error: err.message });
  }
};

// ─── PUT /api/resume/candidate/:candidateId/extracted ────────────────────────

export const updateCandidateExtractedResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const candidateId = String(req.params.candidateId || '');
    const updatedData: ExtractedCandidateProfile = req.body;

    if (!candidateId || !updatedData) {
      res.status(400).json({ message: 'Candidate ID and updated extraction payload are required.' });
      return;
    }

    if (req.user?.role !== 'admin' && req.user?.role !== 'recruiter') {
      res.status(403).json({ message: 'Forbidden: Only recruiters and administrators can modify candidate extraction details.' });
      return;
    }

    const doc = await (db as any).getCurrentResume(candidateId);
    if (doc && typeof (db as any).updateResumeExtractedData === 'function') {
      await (db as any).updateResumeExtractedData(doc.id, updatedData);
    }

    res.json({
      message: 'Extracted candidate details updated successfully.',
      candidateId,
      extractedData: updatedData,
    });
  } catch (err: any) {
    console.error('[resumeController] updateCandidateExtractedResume error:', err);
    res.status(500).json({ message: 'Failed to update extracted resume data.', error: err.message });
  }
};

// ─── POST /api/resume/candidate/:candidateId/verify ──────────────────────────

export const verifyCandidateResumeData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const candidateId = String(req.params.candidateId || '');
    const { data, overwriteProfile, confirmOverwrite } = req.body;

    if (!candidateId || !data) {
      res.status(400).json({ message: 'Candidate ID and verified data payload are required.' });
      return;
    }

    if (req.user?.role !== 'admin' && req.user?.role !== 'recruiter') {
      res.status(403).json({ message: 'Forbidden: Only recruiters and administrators can verify candidate information.' });
      return;
    }

    const candidate = await db.getUserById(candidateId);
    if (!candidate) {
      res.status(404).json({ message: 'Candidate not found.' });
      return;
    }

    // Requirement 10: Do not overwrite manually verified candidate information without confirmation
    if (candidate.isProfileVerified && !confirmOverwrite) {
      res.status(409).json({
        requiresConfirmation: true,
        message: 'Candidate information has already been manually verified. Please confirm that you want to overwrite previously verified details.',
      });
      return;
    }

    const doc = await (db as any).getCurrentResume(candidateId);
    const docId = doc?.id || `rdoc-verified-${Date.now()}`;

    if (typeof (db as any).verifyResumeExtraction === 'function') {
      await (db as any).verifyResumeExtraction(
        docId,
        candidateId,
        req.user.id,
        req.user.name,
        data,
        overwriteProfile !== false
      );
    }

    res.json({
      message: 'Candidate profile verified and updated successfully.',
      candidateId,
      isVerified: true,
      verifiedById: req.user.id,
      verifiedByName: req.user.name,
      verifiedAt: new Date().toISOString(),
      verifiedData: data,
    });
  } catch (err: any) {
    console.error('[resumeController] verifyCandidateResumeData error:', err);
    res.status(500).json({ message: 'Failed to verify candidate resume data.', error: err.message });
  }
};
