import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    cb(null, `${Date.now()}_${safeName}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Only .pdf, .doc, and .docx resume files are allowed.') as Error & { status?: number };
    error.status = 400;
    cb(error);
  }
};

export const uploadResume = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

