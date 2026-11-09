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

const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const parsedCorsOrigin = rawCorsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Reject dangerous wildcard CORS when credentials/cookies are in use
const safeCorsOrigin = parsedCorsOrigin.includes('*')
  ? (nodeEnv === 'production'
      ? ['http://localhost:5173'] // Never allow wildcard in production
      : false) // Block or restrict in dev
  : parsedCorsOrigin;

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data')),
  uploadDir: path.resolve(__dirname, '../../uploads/resumes'),
  corsOrigin: safeCorsOrigin,
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  authCookieName: 'talenthub_token',
  passwordResetExpiresMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '15', 10),
  dbMode,

  // SMTP Email Configuration for password reset and notifications
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'TalentHub Security <no-reply@talenthub.com>',
    secure: process.env.SMTP_SECURE === 'true',
  },

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
