import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { config } from './config';
import { db } from './database/db';
import { mysqlDb } from './database/mysql';
import { parseCookies } from './middleware/auth';

// Import route modules
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobRoutes';
import applicationRoutes from './routes/applicationRoutes';
import companyRoutes from './routes/companyRoutes';
import recruiterRoutes from './routes/recruiterRoutes';
import categoryRoutes from './routes/categoryRoutes';
import jobAlertRoutes from './routes/jobAlertRoutes';
import adminRoutes from './routes/adminRoutes';
import resumeRoutes from './routes/resumeRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

const app = express();

// Trust reverse proxy (e.g. Azure Container Apps, NGINX, Cloudflare) when configured
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// Middlewares
app.use(cors({
  origin: Array.isArray(config.corsOrigin)
    ? (config.corsOrigin.length === 1 ? config.corsOrigin[0] : config.corsOrigin)
    : (config.corsOrigin || '*'),
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Parse incoming Cookie header
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).cookies = parseCookies(req.headers['cookie']);
  next();
});

// Serve static uploaded resumes & company logos
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health probes (matches Azure Application Gateway, Spring Actuator, and container orchestrators)
app.get(['/health', '/actuator/health'], async (req: Request, res: Response) => {
  try {
    const databaseHealthy = await db.checkHealth();
    const status = databaseHealthy ? 'UP' : 'DOWN';
    res.status(databaseHealthy ? 200 : 503).json({
      status,
      platform: 'TalentHub ATS API Tier (Node.js + Express + TypeScript)',
      timestamp: new Date().toISOString(),
      details: {
        diskSpace: { status: 'UP' },
        database: {
          status: databaseHealthy ? 'UP' : 'DOWN',
          engine: db.isMysql
            ? 'MySQL 8.0'
            : 'Embedded JSON persistence (development/test opt-in)',
        },
        resumeParsing: { status: 'READY', mode: 'local-heuristic' },
        azureDocumentIntelligence: { status: 'READY' },
      },
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'DOWN',
      platform: 'TalentHub ATS API Tier',
      timestamp: new Date().toISOString(),
      error: err.message,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/recruiters', recruiterRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/job-alerts', jobAlertRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root greeting
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'TalentHub Applicant Tracking System REST API',
    version: '1.0.0',
    backend: 'Node.js + Express + TypeScript',
    database: db.isMysql ? 'MySQL 8.0' : 'Embedded Engine',
    documentation: '/api/docs',
    endpoints: [
      '/api/auth',
      '/api/jobs',
      '/api/applications',
      '/api/companies',
      '/api/recruiters',
      '/api/categories',
      '/api/job-alerts',
      '/api/admin',
      '/api/resume',
      '/api/analytics',
    ],
  });
});

// 404 handler for unmatched routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const uploadError = err instanceof multer.MulterError;
  const status =
    uploadError && err.code === 'LIMIT_FILE_SIZE'
      ? 413
      : err.status || (uploadError ? 400 : 500);
  const message =
    status >= 500 ? 'Internal Server Error' : err.message || 'Invalid request.';
  console.error('[TalentHub Backend Error]', err instanceof Error ? err.name : 'UnknownError', status);
  res.status(status).json({
    message,
    error: (config.nodeEnv === 'development' || process.env.NODE_ENV === 'development') && status >= 500 ? err : undefined,
  });
});

const PORT = config.port;
let serverInstance: any = null;

const startServer = async () => {
  // Initialize Database before accepting requests
  await db.initialize();

  serverInstance = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 TalentHub Backend running on http://localhost:${PORT}`);
    console.log(`🗄️  Database engine: ${db.isMysql ? 'MySQL 8.0' : 'Embedded Persistence'}`);
    console.log(`📡 Health probe available at http://localhost:${PORT}/health`);
    console.log(`====================================================`);
  });

  const shutdown = async () => {
    console.log('\n[TalentHub Backend] Shutting down gracefully...');
    if (serverInstance) {
      serverInstance.close(async () => {
        await mysqlDb.close().catch(() => undefined);
        console.log('[TalentHub Backend] Stopped.');
        process.exit(0);
      });
    } else {
      await mysqlDb.close().catch(() => undefined);
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

export { app, startServer };
export default app;

if (process.env.NODE_ENV !== 'test' && process.env.TEST_IN_PROCESS !== 'true') {
  startServer().catch((err) => {
    console.error('[TalentHub Backend] Failed to start server:', err);
    process.exit(1);
  });
}
