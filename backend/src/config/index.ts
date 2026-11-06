import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const dbMode = (process.env.DB_MODE || 'mysql').toLowerCase();
if (!['mysql', 'json'].includes(dbMode)) {
  throw new Error(`Invalid DB_MODE "${dbMode}". Use "mysql" or "json".`);
}
if (dbMode === 'json' && !['development', 'test'].includes(nodeEnv)) {
  throw new Error('DB_MODE=json is only permitted in development or test environments.');
}
if (dbMode === 'mysql' && (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME)) {
  throw new Error('DB_USER, DB_PASSWORD, and DB_NAME must be provided through environment variables when DB_MODE=mysql.');
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data')),
  uploadDir: path.resolve(__dirname, '../../uploads/resumes'),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  dbMode,

  // MySQL 8.0 & Azure Database for MySQL Flexible Server Configuration
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  },
};
