/**
 * Multer middleware — memory storage only.
 * Files are held as Buffer in req.file.buffer and are never written to disk.
 * Content validation and Blob upload happen in the controller after this middleware.
 */
import multer from 'multer';
import path from 'path';
import { config } from '../config';

const memoryStorage = multer.memoryStorage();

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

  const error = new Error(`Unsupported file type "${ext || 'unknown'}". Only .pdf and .docx resumes are accepted.`) as Error & { status?: number };
  error.status = 415;
  cb(error);
};

/**
 * Resume upload middleware.
 * - Uses memory storage (no disk writes).
 * - Hard size limit: config.storage.maxResumeSizeBytes (enforced by multer before controller).
 * - Extension pre-filter: provides an early 415 for clearly wrong file types.
 *   The controller performs authoritative content-based validation.
 */
export const uploadResume = multer({
  storage: memoryStorage,
  limits: {
    fileSize: config.storage.maxResumeSizeBytes,
  },
  fileFilter,
});
