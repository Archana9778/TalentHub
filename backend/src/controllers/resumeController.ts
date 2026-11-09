/**
 * TalentHub Resume Controller
 *
 * Endpoints:
 *   POST   /api/resume/upload           – Candidate uploads a new resume
 *   GET    /api/resume/my               – Candidate gets their current resume metadata
 *   GET    /api/resume/history          – Candidate gets their full resume version history
 *   GET    /api/resume/download/:id     – Candidate (or authorised recruiter/admin) gets a SAS URL
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
import { validateResumeBuffer, sanitizeFilename } from '../services/resumeValidationService';
import { uploadResumeBuffer, generateReadSasUrl, deleteBlob } from '../services/blobStorageService';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';
import { ResumeDocument } from '../types';

// ─── POST /api/resume/upload ─────────────────────────────────────────────────

export const uploadResume = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'candidate') {
    res.status(403).json({ message: 'Only candidates can upload resumes.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'No resume file provided. Send the file as multipart/form-data with field name "resume".' });
    return;
  }

  const buffer = req.file.buffer;
  const originalName = req.file.originalname || 'resume';

  // ── Validation ────────────────────────────────────────────────────────────
  const validation = await validateResumeBuffer(buffer, originalName, config.storage.maxResumeSizeBytes);

  if (!validation.valid) {
    const statusMap: Record<string, number> = {
      TOO_LARGE: 413,
      EMPTY: 400,
      BAD_EXTENSION: 415,
      BAD_MIME: 415,
      BAD_CONTENT: 415,
      CORRUPT: 415,
    };
    const status = statusMap[validation.errorCode ?? ''] ?? 400;
    res.status(status).json({ message: validation.errorMessage });
    return;
  }

  // ── Blob upload ───────────────────────────────────────────────────────────
  const safeFilename = sanitizeFilename(originalName);
  const blobName = `${uuidv4()}/${safeFilename}`;
  let blobUploaded = false;

  try {
    await uploadResumeBuffer(blobName, buffer, validation.mimeType!, originalName);
    blobUploaded = true;
  } catch (err: any) {
    console.error('[resumeController] Blob upload failed:', err);
    res.status(503).json({ message: 'Resume storage is temporarily unavailable. Please try again later.' });
    return;
  }

  // ── Database record ───────────────────────────────────────────────────────
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

  let savedDoc: ResumeDocument;
  try {
    savedDoc = await db.createResumeDocument(doc);
  } catch (dbErr) {
    console.error('[resumeController] DB insert failed after blob upload — cleaning up blob:', blobName, dbErr);
    // Rollback: attempt to delete the orphaned blob
    await deleteBlob(blobName);
    res.status(500).json({ message: 'Resume was uploaded but could not be saved. The file has been removed. Please try again.' });
    return;
  }

  // ── Also update user skills via AI parser (backward-compat) ───────────────
  const parsedData = AzureDocumentIntelligenceService.parseResumeFile(
    safeFilename,
    req.user.skills,
    req.user.experience?.length ? req.user.experience.length * 2 : 4
  );

  try {
    const existingSkills = req.user.skills || [];
    await db.updateUser(req.user.id, {
      skills: Array.from(new Set([...existingSkills, ...parsedData.extractedSkills])),
    });
  } catch {
    // Non-fatal: skills update failure should not fail the upload response
  }

  const updatedUser = await db.getUserById(req.user.id);

  res.status(201).json({
    message: 'Resume uploaded and stored securely in Azure Blob Storage.',
    resume: savedDoc,
    parsedData,
    user: updatedUser,
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
    const resume = await db.getCurrentResume(req.user.id);
    if (!resume) {
      res.json({ resume: null, message: 'No resume uploaded yet.' });
      return;
    }
    res.json({ resume });
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
    const history = await db.getResumeHistory(req.user.id);
    res.json({ total: history.length, history });
  } catch (err) {
    console.error('[resumeController] getResumeHistory error:', err);
    res.status(500).json({ message: 'Failed to retrieve resume history.' });
  }
};

// ─── GET /api/resume/download/:id ────────────────────────────────────────────

export const getResumeDownloadUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  try {
    const id = req.params['id'] as string;
    const resumeDoc = await db.getResumeDocById(id);

    if (!resumeDoc || resumeDoc.uploadStatus === 'deleted') {
      res.status(404).json({ message: 'Resume document not found.' });
      return;
    }

    // Authorization check
    const user = req.user;

    if (user.role === 'candidate') {
      if (resumeDoc.candidateId !== user.id) {
        res.status(403).json({ message: 'Access denied: you can only access your own resumes.' });
        return;
      }
    } else if (user.role === 'recruiter') {
      // Recruiter can access if they manage a job this candidate applied to
      const applications = await db.getApplicationsByCandidateId(resumeDoc.candidateId);
      const recruiterJobs = await db.getJobs();
      const recruiterJobIds = new Set(
        recruiterJobs.filter((j) => j.recruiterId === user.id).map((j) => j.id)
      );
      const hasAccess = applications.some((app) => recruiterJobIds.has(app.jobId));

      if (!hasAccess) {
        res.status(403).json({ message: 'Access denied: you do not manage any jobs this candidate applied to.' });
        return;
      }
    }
    // Admin: unrestricted

    // Generate short-lived, read-only SAS URL (never logged)
    const sasUrl = await generateReadSasUrl(resumeDoc.blobName, config.storage.sasExpiryMinutes);

    res.json({
      message: 'Short-lived download URL generated.',
      downloadUrl: sasUrl,
      expiresInMinutes: config.storage.sasExpiryMinutes,
      filename: resumeDoc.originalFilename,
    });
  } catch (err) {
    console.error('[resumeController] getResumeDownloadUrl error:', err);
    res.status(500).json({ message: 'Failed to generate download URL.' });
  }
};

// ─── POST /api/resume/parse (unchanged AI simulation) ────────────────────────

export const parseResume = (req: AuthRequest, res: Response): void => {
  const filename = req.file?.originalname || req.body?.filename || 'Candidate_Resume.pdf';

  const parsed = AzureDocumentIntelligenceService.parseResumeFile(filename);
  res.json({
    parserEngine: 'Azure AI Document Intelligence (Simulated Production Service)',
    status: 'PARSED',
    extracted: parsed,
  });
};
