import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';

export const uploadResume = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: 'No resume file uploaded.' });
    return;
  }

  const resumeUrl = `/uploads/resumes/${req.file.filename}`;
  const parsedData = AzureDocumentIntelligenceService.parseResumeFile(
    req.file.originalname,
    req.user.skills,
    req.user.experience?.length ? req.user.experience.length * 2 : 4
  );

  // Update user profile skills & resume if candidate
  const existingSkills = req.user.skills || [];
  const updatedUser = db.updateUser(req.user.id, {
    resumeUrl,
    resumeOriginalName: req.file.originalname,
    skills: Array.from(new Set([...existingSkills, ...parsedData.extractedSkills])),
  });

  res.json({
    message: 'Resume uploaded and analyzed with Azure AI Document Intelligence.',
    resumeUrl,
    parsedData,
    user: updatedUser,
  });
};

export const parseResume = (req: AuthRequest, res: Response): void => {
  const filename = req.file?.originalname || req.body?.filename || 'Candidate_Resume.pdf';

  const parsed = AzureDocumentIntelligenceService.parseResumeFile(filename);
  res.json({
    parserEngine: 'Azure AI Document Intelligence (Simulated Production Service)',
    status: 'PARSED',
    extracted: parsed,
  });
};
