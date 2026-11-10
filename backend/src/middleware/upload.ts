import multer from 'multer';
import path from 'path';
import { config } from '../config';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === '.doc') {
    const error = new Error('Legacy .doc format is not supported. Please upload your resume in .pdf or modern .docx format.') as Error & { status?: number };
    error.status = 415;
    return cb(error);
  }

  if (ext === '.pdf' || ext === '.docx') {
    return cb(null, true);
  }

  const error = new Error(`Unsupported file type "${ext}". Only .pdf and .docx resumes are accepted.`) as Error & { status?: number };
  error.status = 415;
  cb(error);
};

export const uploadResume = multer({
  storage,
  limits: {
    fileSize: config.storage.maxResumeSizeBytes,
  },
  fileFilter,
});


