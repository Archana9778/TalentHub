import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { db } from '../database/db';
import { AzureDocumentIntelligenceService } from '../services/aiResumeParser';

export const uploadResume = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
    const updatedUser = await db.updateUser(req.user.id, {
      resumeUrl,
      resumeOriginalName: req.file.originalname,
      parsedResumeData: parsedData,
      skills: Array.from(new Set([...existingSkills, ...parsedData.extractedSkills])),
    });

    const { password: _password, ...safeUser } = updatedUser || {};
    res.json({
      message: 'Resume uploaded and processed with the local heuristic parser.',
      resumeUrl,
      parsedData,
      user: safeUser,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error uploading resume', error: err.message });
  }
};

export const parseResume = (req: AuthRequest, res: Response): void => {
  const filename = req.file?.originalname || req.body?.filename || 'Candidate_Resume.pdf';

  const parsed = AzureDocumentIntelligenceService.parseResumeFile(filename);
  res.json({
    parserEngine: 'Local heuristic parser',
    status: 'PARSED',
    extracted: parsed,
  });
};
