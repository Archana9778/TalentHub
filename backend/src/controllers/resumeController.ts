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
import { ResumeDocument } from '../types';

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

  // ── Parse resume and update user profile ─────────────────────────────────
  const existingSkills = req.user.skills || [];
  const parsedData = AzureDocumentIntelligenceService.parseResumeFile(
    safeFilename,
    existingSkills,
    req.user.experience?.length ? req.user.experience.length * 2 : 4
  );

  let updatedUser = req.user;
  try {
    const mergedSkills = Array.from(new Set([...existingSkills, ...parsedData.extractedSkills]));
    const result = await db.updateUser(req.user.id, {
      resumeUrl: blobName,
      resumeOriginalName: originalName,
      parsedResumeData: parsedData,
      skills: mergedSkills,
    });
    if (result) updatedUser = result;
  } catch (userDbErr) {
    console.error('[resumeController] User record update failed after blob upload — cleaning up blob:', blobName, userDbErr);
    await BlobStorageService.deleteBlob(blobName);
    if (typeof (db as any).markResumeDeleted === 'function') {
      await (db as any).markResumeDeleted(doc.id).catch(() => {});
    }
    res.status(500).json({ message: 'Failed to update user profile with resume details.' });
    return;
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
    message: 'Resume uploaded successfully to private cloud storage and parsed.',
    resume: savedDoc,
    blobName,
    resumeUrl: sasUrl,
    downloadUrl: sasUrl,
    originalName,
    fileSizeBytes: validation.fileSizeBytes || buffer.length,
    checksumSha256: validation.checksum,
    parsedData,
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

// ─── GET /api/resume/history/:candidateId? ─────────────────────────────────

export const getResumeHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const rawCandidateId = req.params?.candidateId;
  const requestedCandidateId = typeof rawCandidateId === 'string'
    ? rawCandidateId.trim()
    : (Array.isArray(rawCandidateId) ? rawCandidateId[0]?.trim() : undefined);
  const targetCandidateId = requestedCandidateId || req.user.id;

  // ── Authorization check ──────────────────────────────────────────────────
  if (req.user.role === 'candidate') {
    // Candidates can only access their own resume history
    if (requestedCandidateId && requestedCandidateId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: Candidates can only access their own resume history.' });
      return;
    }
  } else if (req.user.role === 'recruiter') {
    // Recruiters must specify a candidate and can only view history if the candidate applied to a job managed by this recruiter
    if (!requestedCandidateId) {
      res.status(400).json({ message: 'Candidate ID is required to retrieve resume history.' });
      return;
    }

    const applications = await db.getApplicationsByCandidateId(targetCandidateId);
    let managesCandidateJob = false;
    for (const app of applications) {
      const job = await db.getJobById(app.jobId);
      if (job && job.recruiterId === req.user.id) {
        managesCandidateJob = true;
        break;
      }
    }

    if (!managesCandidateJob) {
      res.status(403).json({
        message: 'Forbidden: You can only access resume history for candidates who applied to jobs you manage.',
      });
      return;
    }
  } else if (req.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: Insufficient permissions to access resume history.' });
    return;
  }

  // Verify candidate exists
  const candidateUser = await db.getUserById(targetCandidateId);
  if (!candidateUser || (candidateUser.role !== 'candidate' && req.user.role !== 'candidate')) {
    res.status(404).json({ message: 'Candidate not found.' });
    return;
  }

  try {
    if (typeof (db as any).getResumeHistory === 'function') {
      const history = await (db as any).getResumeHistory(targetCandidateId);
      res.json({ total: history.length, history });
      return;
    }

    if (candidateUser.resumeUrl) {
      res.json({
        total: 1,
        history: [
          {
            id: candidateUser.id,
            candidateId: candidateUser.id,
            originalFilename: candidateUser.resumeOriginalName || 'resume.pdf',
            blobName: candidateUser.resumeUrl,
            isCurrent: true,
          },
        ],
      });
      return;
    }

    res.json({ total: 0, history: [] });
  } catch (err) {
    console.error('[resumeController] getResumeHistory error for target:', targetCandidateId, err);
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

    const rawParam = req.params?.id || req.params?.candidateId;
    const targetId = (typeof rawParam === 'string' ? rawParam.trim() : (Array.isArray(rawParam) ? rawParam[0]?.trim() : undefined)) || req.user.id;

    let blobName = '';
    let originalFilename = 'resume.pdf';
    let candidateId = targetId;

    // 1. Check if targetId matches a resume document in resume_documents
    if (typeof (db as any).getResumeDocById === 'function') {
      const doc = await (db as any).getResumeDocById(targetId);
      if (doc && doc.uploadStatus !== 'deleted') {
        blobName = doc.blobName;
        originalFilename = doc.originalFilename;
        candidateId = doc.candidateId;
      }
    }

    // 2. Check if targetId matches an application ID
    if (!blobName) {
      const app = await db.getApplicationById(targetId);
      if (app && app.resumeUrl) {
        blobName = extractBlobName(app.resumeUrl);
        originalFilename = app.candidateName ? `${app.candidateName.replace(/\s+/g, '_')}_Resume.pdf` : 'resume.pdf';
        candidateId = app.candidateId;
      }
    }

    // 3. Check current resume document for candidate
    if (!blobName && typeof (db as any).getCurrentResume === 'function') {
      const currentDoc = await (db as any).getCurrentResume(targetId);
      if (currentDoc && currentDoc.uploadStatus !== 'deleted') {
        blobName = currentDoc.blobName;
        originalFilename = currentDoc.originalFilename;
        candidateId = currentDoc.candidateId;
      }
    }

    // 4. Check candidate user profile
    if (!blobName) {
      const targetUser = await db.getUserById(targetId);
      if (targetUser && targetUser.resumeUrl) {
        blobName = extractBlobName(targetUser.resumeUrl);
        originalFilename = targetUser.resumeOriginalName || 'resume.pdf';
        candidateId = targetUser.id;
      }
    }

    if (!blobName) {
      res.status(404).json({ message: 'No resume found for the requested candidate or document.' });
      return;
    }

    // ── Authorization check (strictly before SAS generation) ──────────────────
    let isAuthorized = false;

    if (req.user.role === 'admin') {
      // Administrators follow existing policy: authorized to access candidate documents
      isAuthorized = true;
    } else if (req.user.role === 'candidate') {
      // Candidates can ONLY access their own resume
      if (req.user.id === candidateId) {
        isAuthorized = true;
      }
    } else if (req.user.role === 'recruiter') {
      // Recruiters can ONLY access resumes of candidates who applied to jobs managed by this recruiter
      const applications = await db.getApplicationsByCandidateId(candidateId);
      for (const app of applications) {
        const job = await db.getJobById(app.jobId);
        if (job && job.recruiterId === req.user.id) {
          isAuthorized = true;
          break;
        }
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ message: 'Forbidden: You are not authorized to access this candidate’s resume.' });
      return;
    }

    // ── Direct Streaming (if explicitly requested) ───────────────────────────
    if (req.query.stream === 'true') {
      try {
        const fileBuffer = await BlobStorageService.downloadBlobToBuffer(blobName);
        const isPdf = originalFilename.toLowerCase().endsWith('.pdf');
        res.setHeader('Content-Type', isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
        res.send(fileBuffer);
        return;
      } catch (streamErr: any) {
        if (streamErr?.statusCode === 404 || streamErr?.message?.includes('BlobNotFound')) {
          res.status(404).json({ message: 'Resume document file could not be found in storage.' });
          return;
        }
        throw streamErr;
      }
    }

    // ── Generate short-lived read-only SAS URL on demand ─────────────────────
    const expiryMinutes = config.storage.sasExpiryMinutes;
    const sasUrl = await BlobStorageService.generateReadSasUrl(blobName, expiryMinutes);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    if (req.query.redirect === 'true') {
      res.redirect(sasUrl);
      return;
    }

    // Return temporary URL without storing it permanently anywhere
    res.json({
      message: 'Temporary secure resume download URL generated.',
      candidateId,
      originalName: originalFilename,
      filename: originalFilename,
      downloadUrl: sasUrl,
      expiresInMinutes: expiryMinutes,
      expiresAt,
    });
  } catch (err: any) {
    const safeError = (err?.message || 'Failed to generate secure resume download link.')
      .replace(/sig=[^&]+/g, 'sig=REDACTED');
    console.error('[ResumeController] Error generating resume download link:', safeError);
    res.status(500).json({
      message: 'Failed to generate secure resume download link.',
      error: safeError,
    });
  }
};

export const getResumeDownloadUrl = downloadResume;

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
