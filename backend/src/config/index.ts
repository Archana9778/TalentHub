import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'talenthub-super-secret-azure-enterprise-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: path.resolve(__dirname, '../../data'),
  uploadDir: path.resolve(__dirname, '../../uploads/resumes'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  database: {
    driver: process.env.DB_DRIVER || 'mysql2',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'talenthub',
    user: process.env.DB_USER || 'talenthub_user',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
  },
};
