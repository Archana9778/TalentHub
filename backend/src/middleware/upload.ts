/**
 * Multer upload middleware configuration.
 * - uploadResume: Memory storage only. Resumes are held in req.file.buffer for validation and Azure Blob Storage streaming.
 * - uploadLogo: Disk storage for company branding logos with safe filename generation and extension filtering.
 */
import multer from 'multer';
import fs from 'fs';
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

const logoUploadDir = path.resolve(__dirname, '../../uploads');

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(logoUploadDir)) {
      fs.mkdirSync(logoUploadDir, { recursive: true });
    }
    cb(null, logoUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    cb(null, `${Date.now()}_${safeName}${ext}`);
  },
});

const imageFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (.png, .jpg, .jpeg, .webp, .svg) are allowed!'));
  }
};

export const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
});
