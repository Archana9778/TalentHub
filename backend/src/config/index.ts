import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'talenthub-super-secret-azure-enterprise-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: path.resolve(__dirname, '../../data'),
  uploadDir: path.resolve(__dirname, '../../uploads/resumes'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

