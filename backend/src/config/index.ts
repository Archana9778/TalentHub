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
  storage: {
    /** 'azurite' (local emulator) or 'azure' (production DefaultAzureCredential) */
    provider: (process.env.STORAGE_PROVIDER || 'azurite') as 'azurite' | 'azure',
    /** Azurite / local dev connection string */
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    /** Azure production account name (used with DefaultAzureCredential) */
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || 'devstoreaccount1',
    /** Private container name */
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'talenthub-resumes',
    /** Maximum resume file size in bytes (default 5 MB) */
    maxResumeSizeBytes: parseInt(process.env.MAX_RESUME_SIZE_MB || '5', 10) * 1024 * 1024,
    /** Short-lived SAS URL expiry in minutes (default 5 min) */
    sasExpiryMinutes: parseInt(process.env.RESUME_SAS_EXPIRY_MINUTES || '5', 10),
  },
};
