/**
 * Multer middleware — memory storage only.
 * Files are held as Buffer in req.file.buffer and are never written to disk.
 * Content validation and Blob upload happen in the controller after this middleware.
 */
import multer from 'multer';
import { config } from '../config';

const memoryStorage = multer.memoryStorage();

/**
 * Resume upload middleware.
 * - Uses memory storage (no disk writes).
 * - Hard size limit: config.storage.maxResumeSizeBytes (enforced by multer before controller).
 * - Extension pre-filter: provides an early 415 for clearly wrong file types.
 *   The controller performs authoritative content-based validation.
 */
export const uploadResume = multer({
  storage: memoryStorage,
  limits: { fileSize: config.storage.maxResumeSizeBytes },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || ext === 'docx') {
      cb(null, true);
    } else {
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      (err as any).message = `Unsupported file type ".${ext ?? '?'}". Only PDF and DOCX resumes are accepted.`;
      cb(err);
    }
  },
});
