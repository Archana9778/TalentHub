import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { config } from './config';
import { db } from './database/db';
import { mysqlDb } from './database/mysql';

// Import route modules
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobRoutes';
import applicationRoutes from './routes/applicationRoutes';
import companyRoutes from './routes/companyRoutes';
import categoryRoutes from './routes/categoryRoutes';
import jobAlertRoutes from './routes/jobAlertRoutes';
import adminRoutes from './routes/adminRoutes';
import resumeRoutes from './routes/resumeRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

const app = express();

// Middlewares
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static uploaded resumes
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health probes for local and container orchestrator readiness checks.
app.get(['/health', '/actuator/health'], async (req: Request, res: Response) => {
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
        engine: config.dbMode === 'mysql' ? 'MySQL 8.0' : 'Embedded JSON persistence (development/test opt-in)',
      },
      resumeParsing: { status: 'READY', mode: 'local-heuristic' },
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/companies', companyRoutes);
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
    endpoints: [
      '/api/auth',
      '/api/jobs',
      '/api/applications',
      '/api/companies',
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
  const status = uploadError && err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status || (uploadError ? 400 : 500));
  const message = status >= 500 ? 'Internal Server Error' : (err.message || 'Invalid request.');
  console.error('[TalentHub Backend Error]', err instanceof Error ? err.name : 'UnknownError', status);
  res.status(status).json({
    message,
    error: config.nodeEnv === 'development' && status >= 500 ? err : undefined,
  });
});

const PORT = config.port;

const startServer = async () => {
  // Initialize Database (attempts MySQL 8.0 connection & migrations, falls back gracefully if offline)
  await db.initialize();

  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 TalentHub Backend running on http://localhost:${PORT}`);
    console.log(`🗄️  Database engine: ${db.isMysql ? 'MySQL 8.0' : 'Embedded Persistence'}`);
    console.log(`📡 Health probe available at http://localhost:${PORT}/health`);
    console.log(`====================================================`);
  });

  const shutdown = async () => {
    console.log('\n[TalentHub Backend] Shutting down gracefully...');
    server.close(async () => {
      await mysqlDb.close();
      console.log('[TalentHub Backend] Stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startServer().catch((err) => {
  console.error('[TalentHub Backend] Failed to start server:', err);
  process.exit(1);
});
