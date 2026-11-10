import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
// DB_MODE defaults to 'mysql'. Can be overridden with 'json' for development or testing.
const dbMode = (process.env.DB_MODE || (process.env.DB_DRIVER === 'json' ? 'json' : 'mysql')).toLowerCase();
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

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbName = process.env.DB_NAME || 'talenthub';
const dbUser = process.env.DB_USER || 'talenthub_user';
const dbPassword = process.env.DB_PASSWORD || '';
const dbSsl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined;
const dbPoolMin = parseInt(process.env.DB_POOL_MIN || '2', 10);
const dbPoolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);

export const config = {
<<<<<<< HEAD
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

  // MySQL configuration block (Knex / migrations compatible)
=======
  dbMode,
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'talenthub-super-secret-azure-enterprise-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data')),
  uploadDir: path.resolve(__dirname, '../../uploads/resumes'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'talenthub',
    user: process.env.DB_USER || 'talenthub_user',
    password: process.env.DB_PASSWORD || '',
    connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  },
>>>>>>> origin/main
  database: {
    driver: process.env.DB_DRIVER || (dbMode === 'json' ? 'json' : 'mysql2'),
    host: dbHost,
    port: dbPort,
    name: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: dbSsl,
    pool: {
      min: dbPoolMin,
      max: dbPoolMax,
    },
  },

  // MySQL 8.0 connection pool configuration
  db: {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    connectionLimit: dbPoolMax,
    ssl: dbSsl,
  },

  // Azure Blob Storage / Azurite configuration
  storage: {
    /** 'azurite' (local emulator) or 'azure' (production DefaultAzureCredential) */
    provider: (process.env.STORAGE_PROVIDER || 'azurite') as 'azurite' | 'azure',
    /** Azurite / local dev connection string */
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    /** Azure production account name (used with DefaultAzureCredential) */
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || 'devstoreaccount1',
    /** Private container name */
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'talenthub-resumes',
    /** Maximum resume file size in bytes (default 10 MB) */
    maxResumeSizeBytes: parseInt(process.env.RESUME_MAX_FILE_SIZE_MB || process.env.MAX_RESUME_SIZE_MB || '10', 10) * 1024 * 1024,
    /** Short-lived SAS URL expiry in minutes (default 15 min) */
    sasExpiryMinutes: parseInt(process.env.RESUME_SAS_EXPIRY_MINUTES || process.env.AZURE_STORAGE_SAS_EXPIRY_MINUTES || '15', 10),
  },
};
