import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';

// Import route modules
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobRoutes';
import applicationRoutes from './routes/applicationRoutes';
import companyRoutes from './routes/companyRoutes';
import categoryRoutes from './routes/categoryRoutes';
import jobAlertRoutes from './routes/jobAlertRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow development frontend requests
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static uploaded resumes
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health probes (matches Azure Application Gateway & Spring Actuator health specifications)
app.get(['/health', '/actuator/health'], (req: Request, res: Response) => {
  res.json({
    status: 'UP',
    platform: 'TalentHub ATS API Tier',
    timestamp: new Date().toISOString(),
    details: {
      diskSpace: { status: 'UP' },
      database: { status: 'UP' },
      azureDocumentIntelligence: { status: 'READY' },
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

// Root greeting
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'TalentHub Applicant Tracking System REST API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: [
      '/api/auth',
      '/api/jobs',
      '/api/applications',
      '/api/companies',
      '/api/categories',
      '/api/job-alerts',
      '/api/admin',
    ],
  });
});

// 404 handler for unmatched routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[TalentHub Backend Error]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : undefined,
  });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 TalentHub Backend running on http://localhost:${PORT}`);
  console.log(`📡 Health probe available at http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});

