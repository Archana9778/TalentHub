import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';
import { ResumeValidationService } from '../services/resumeValidationService';
import { BlobStorageService } from '../services/blobStorageService';
import { config } from '../config';

/**
 * Helper to extract the relative blob name from a stored resumeUrl (which might be a full URL, relative path, or blob name).
 */
function extractBlobName(rawUrl: string): string {
  if (!rawUrl) return '';
  
  // If rawUrl is a full URL e.g. http://127.0.0.1:10000/devstoreaccount1/talenthub-resumes/resumes/...
  const containerName = config.storage.containerName;
  const containerIdx = rawUrl.indexOf(`/${containerName}/`);
  if (containerIdx !== -1) {
    const afterContainer = rawUrl.substring(containerIdx + containerName.length + 2);
    // Strip query string if any
    return afterContainer.split('?')[0];
  }

  // If rawUrl begins with /uploads/resumes/
  if (rawUrl.startsWith('/uploads/resumes/')) {
    return rawUrl.replace('/uploads/resumes/', '');
  }

  // Strip query string if any
  return rawUrl.split('?')[0];
}

/**
 * POST /api/resume/upload
 * Candidate-authenticated resume upload in PDF or DOCX format.
 * Validates file content, uploads to private Azure Blob Storage/Azurite, and saves metadata.
 */
export const uploadResume = async (req: AuthRequest, res: Response): Promise<void> => {
  let uploadedBlobName: string | null = null;

  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    if (req.user.role !== 'candidate') {
      res.status(403).json({ message: 'Only candidates are permitted to upload resumes to their profile.' });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ message: 'No resume file uploaded or file buffer is empty.' });
      return;
    }

    // Comprehensive content, magic bytes, corruption, size, and extension validation
    const validation = await ResumeValidationService.validateResumeBuffer(
      req.file.buffer,
      req.file.originalname,
      config.storage.maxResumeSizeBytes
    );

    if (!validation.isValid) {
      res.status(validation.statusCode || 400).json({
        message: validation.error,
        error: validation.error,
      });
      return;
    }

    // Construct unique collision-free blob name: resumes/<candidateId>/<timestamp>-<uuid>-<sanitizedName>
    const blobName = `resumes/${req.user.id}/${Date.now()}-${uuidv4()}-${validation.sanitizedFilename}`;

    // Upload buffer to Azure Blob Storage / Azurite private container
    const uploadResult = await BlobStorageService.uploadResumeBuffer(
      blobName,
      req.file.buffer,
      validation.mimeType!,
      {
        candidateId: req.user.id,
        originalName: req.file.originalname,
        checksumSha256: validation.checksumSha256 || '',
        uploadedAt: new Date().toISOString(),
      }
    );
    uploadedBlobName = uploadResult.blobName;

    // Generate short-lived read-only SAS URL for initial secure access
    const sasUrl = await BlobStorageService.generateReadSasUrl(blobName, config.storage.sasExpiryMinutes);

    // Parse resume with local heuristic parser
    const existingSkills = req.user.skills || [];
    const parsedData = AzureDocumentIntelligenceService.parseResumeFile(
      req.file.originalname,
      existingSkills,
      req.user.experience?.length ? req.user.experience.length * 2 : 4
    );

    // Save resume reference and metadata in database
    try {
      const mergedSkills = Array.from(new Set([...existingSkills, ...parsedData.extractedSkills]));
      const updatedUser = await db.updateUser(req.user.id, {
        resumeUrl: blobName,
        resumeOriginalName: req.file.originalname,
        parsedResumeData: parsedData,
        skills: mergedSkills,
      });

      const { password: _password, ...safeUser } = updatedUser || {};

      res.status(200).json({
        message: 'Resume uploaded successfully to private cloud storage and parsed.',
        blobName,
        resumeUrl: sasUrl,
        originalName: req.file.originalname,
        fileSizeBytes: validation.fileSizeBytes,
        checksumSha256: validation.checksumSha256,
        parsedData,
        user: safeUser,
      });
    } catch (dbError: any) {
      // Rollback: delete uploaded blob to prevent orphaned blobs in cloud storage
      console.error('[ResumeController] Database update failed. Cleaning up uploaded blob:', uploadedBlobName);
      if (uploadedBlobName) {
        await BlobStorageService.deleteBlob(uploadedBlobName);
      }
      throw dbError;
    }
  } catch (err: any) {
    console.error('[ResumeController] Error uploading resume:', err);
    res.status(500).json({
      message: 'Failed to complete resume upload process.',
      error: err.message || 'Internal server error',
    });
  }
};

/**
 * POST /api/resume/parse
 * Test endpoint for parsing resume data without persistent storage.
 */
export const parseResume = (req: AuthRequest, res: Response): void => {
  const filename = req.file?.originalname || req.body?.filename || 'Candidate_Resume.pdf';
  const parsed = AzureDocumentIntelligenceService.parseResumeFile(filename);
  res.json({
    parserEngine: 'Local heuristic parser',
    status: 'PARSED',
    extracted: parsed,
  });
};

/**
 * GET /api/resume/download/:candidateId?
 * Authorized download access for resumes stored in Azure Blob Storage.
 * - Candidates can download their own resume.
 * - Recruiters can download resumes of candidates who applied to their jobs.
 * - Admins can download any candidate's resume.
 */
export const downloadResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    const rawParam = req.params.candidateId;
    const targetCandidateId = (typeof rawParam === 'string' ? rawParam : (Array.isArray(rawParam) ? rawParam[0] : undefined)) || req.user.id;
    const targetUser = await db.getUserById(targetCandidateId);

    if (!targetUser || !targetUser.resumeUrl) {
      res.status(404).json({ message: 'No resume found for the requested candidate.' });
      return;
    }

    // Authorization check
    let isAuthorized = false;

    if (req.user.role === 'admin') {
      isAuthorized = true;
    } else if (req.user.id === targetCandidateId) {
      isAuthorized = true;
    } else if (req.user.role === 'recruiter') {
      // Check if candidate applied to any job owned by this recruiter or recruiter's company
      const applications = await db.getApplicationsByCandidateId(targetCandidateId);
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

    const blobName = extractBlobName(targetUser.resumeUrl);

    // If client requested redirect or direct link
    if (req.query.stream === 'true') {
      // Direct stream through backend
      const fileBuffer = await BlobStorageService.downloadBlobToBuffer(blobName);
      const filename = targetUser.resumeOriginalName || 'resume.pdf';
      const isPdf = filename.toLowerCase().endsWith('.pdf');
      res.setHeader('Content-Type', isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
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
      candidateId: targetCandidateId,
      originalName: targetUser.resumeOriginalName || 'resume.pdf',
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
