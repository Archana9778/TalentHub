import fs from 'fs';
import path from 'path';
import {
  User,
  Company,
  JobCategory,
  Job,
  Application,
  ReportedJob,
  JobAlert,
  PasswordResetToken,
  RevokedToken,
  ResumeDocument,
} from '../types';
import {
  initialUsers,
  initialCompanies,
  initialCategories,
  initialJobs,
  initialApplications,
  initialReportedJobs,
  initialJobAlerts,
} from './seedData';
import { config } from '../config';
import { mysqlDb } from './mysql';
import { mysqlRepository } from './mysqlRepository';

interface DatabaseSchema {
  users: User[];
  companies: Company[];
  categories: JobCategory[];
  jobs: Job[];
  applications: Application[];
  reportedJobs: ReportedJob[];
  jobAlerts: JobAlert[];
  passwordResetTokens: PasswordResetToken[];
  revokedTokens: RevokedToken[];
}

class DatabaseManager {
  private data: DatabaseSchema;
  private filePath: string;

  constructor() {
    this.filePath = path.join(config.dataDir, 'talenthub-db.json');
    this.data = {
      users: [],
      companies: [],
      categories: [],
      jobs: [],
      applications: [],
      reportedJobs: [],
      jobAlerts: [],
      passwordResetTokens: [],
      revokedTokens: [],
    };
    if (config.dbMode === 'json') this.initJson();
  }

  async initialize(): Promise<void> {
    if (config.dbMode === 'json') {
      console.log('[TalentHub DB] Operating with Embedded Local Persistence Engine.');
      return;
    }

    await mysqlDb.initialize();
    console.log('[TalentHub DB] Connected to the required MySQL database.');
  }

  get isMysql(): boolean {
    return config.dbMode === 'mysql' && mysqlDb.connected;
  }

  async checkHealth(): Promise<boolean> {
    if (config.dbMode === 'json') return true;
    return mysqlDb.checkHealth();
  }

  private initJson() {
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.passwordResetTokens) this.data.passwordResetTokens = [];
        if (!this.data.revokedTokens) this.data.revokedTokens = [];
      } catch (err) {
        console.error('[TalentHub DB] Error reading local database. Re-seeding...', err);
        this.seedJson();
      }
    } else {
      this.seedJson();
    }
  }

  private seedJson() {
    this.data = {
      users: [...initialUsers],
      companies: [...initialCompanies],
      categories: [...initialCategories],
      jobs: [...initialJobs],
      applications: [...initialApplications],
      reportedJobs: [...initialReportedJobs],
      jobAlerts: [...initialJobAlerts],
      passwordResetTokens: [],
      revokedTokens: [],
    };
    this.persistJson();
  }

  private persistJson() {
    try {
      const payload = JSON.stringify(this.data, null, 2);
      const tempPath = `${this.filePath}.tmp`;
      try {
        fs.writeFileSync(tempPath, payload, 'utf-8');
        fs.copyFileSync(tempPath, this.filePath);
        try { fs.unlinkSync(tempPath); } catch {}
      } catch {
        fs.writeFileSync(this.filePath, payload, 'utf-8');
      }
    } catch (err) {
      console.error('[TalentHub DB] Failed to persist data to disk:', err);
    }
  }

  // ==========================================
  // USERS
  // ==========================================
  async getUsers(): Promise<User[]> {
    if (this.isMysql) return mysqlRepository.getUsers();
    return this.data.users;
  }

  async getUserById(id: string): Promise<User | undefined> {
    if (this.isMysql) return mysqlRepository.getUserById(id);
    return this.data.users.find((u) => u.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (this.isMysql) return mysqlRepository.getUserByEmail(email);
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async createUser(user: User): Promise<User> {
    if (this.isMysql) return mysqlRepository.createUser(user);
    this.data.users.push(user);
    this.persistJson();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    if (this.isMysql) return mysqlRepository.updateUser(id, updates);
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.persistJson();
    return this.data.users[idx];
  }

  async deleteUser(id: string): Promise<boolean> {
    if (this.isMysql) return mysqlRepository.deleteUser(id);
    const initLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length !== initLen) {
      this.persistJson();
      return true;
    }
    return false;
  }

  // ==========================================
  // COMPANIES
  // ==========================================
  async getCompanies(): Promise<Company[]> {
    if (this.isMysql) return mysqlRepository.getCompanies();
    return this.data.companies;
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    if (this.isMysql) return mysqlRepository.getCompanyById(id);
    return this.data.companies.find((c) => c.id === id);
  }

  async createCompany(company: Company): Promise<Company> {
    if (this.isMysql) return mysqlRepository.createCompany(company);
    this.data.companies.push(company);
    this.persistJson();
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    if (this.isMysql) return mysqlRepository.updateCompany(id, updates);
    const idx = this.data.companies.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.companies[idx] = { ...this.data.companies[idx], ...updates };
    this.persistJson();
    return this.data.companies[idx];
  }

  async deleteCompany(id: string): Promise<boolean> {
    if (this.isMysql) return mysqlRepository.deleteCompany(id);
    const initLen = this.data.companies.length;
    this.data.companies = this.data.companies.filter((c) => c.id !== id);
    if (this.data.companies.length !== initLen) {
      this.persistJson();
      return true;
    }
    return false;
  }

  // ==========================================
  // CATEGORIES
  // ==========================================
  async getCategories(): Promise<JobCategory[]> {
    if (this.isMysql) return mysqlRepository.getCategories();
    return this.data.categories;
  }

  async getCategoryById(id: string): Promise<JobCategory | undefined> {
    if (this.isMysql) return mysqlRepository.getCategoryById(id);
    return this.data.categories.find((c) => c.id === id);
  }

  async createCategory(category: JobCategory): Promise<JobCategory> {
    if (this.isMysql) return mysqlRepository.createCategory(category);
    this.data.categories.push(category);
    this.persistJson();
    return category;
  }

  async updateCategory(id: string, updates: Partial<JobCategory>): Promise<JobCategory | undefined> {
    if (this.isMysql) return mysqlRepository.updateCategory(id, updates);
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.categories[idx] = { ...this.data.categories[idx], ...updates };
    this.persistJson();
    return this.data.categories[idx];
  }

  async deleteCategory(id: string): Promise<boolean> {
    if (this.isMysql) return mysqlRepository.deleteCategory(id);
    const initLen = this.data.categories.length;
    this.data.categories = this.data.categories.filter((c) => c.id !== id);
    if (this.data.categories.length !== initLen) {
      this.persistJson();
      return true;
    }
    return false;
  }

  // ==========================================
  // JOBS
  // ==========================================
  async getJobs(): Promise<Job[]> {
    if (this.isMysql) return mysqlRepository.getJobs();
    return this.data.jobs;
  }

  async getJobById(id: string): Promise<Job | undefined> {
    if (this.isMysql) return mysqlRepository.getJobById(id);
    return this.data.jobs.find((j) => j.id === id);
  }

  async createJob(job: Job): Promise<Job> {
    if (this.isMysql) return mysqlRepository.createJob(job);
    this.data.jobs.unshift(job);
    const cat = this.data.categories.find((c) => c.id === job.categoryId);
    if (cat) cat.jobCount = (cat.jobCount || 0) + 1;
    this.persistJson();
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    if (this.isMysql) return mysqlRepository.updateJob(id, updates);
    const idx = this.data.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return undefined;
    this.data.jobs[idx] = { ...this.data.jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    this.persistJson();
    return this.data.jobs[idx];
  }

  async deleteJob(id: string): Promise<boolean> {
    if (this.isMysql) return mysqlRepository.deleteJob(id);
    const job = this.data.jobs.find((j) => j.id === id);
    if (!job) return false;
    const cat = this.data.categories.find((c) => c.id === job.categoryId);
    if (cat && cat.jobCount > 0) cat.jobCount -= 1;
    this.data.jobs = this.data.jobs.filter((j) => j.id !== id);
    this.persistJson();
    return true;
  }

  async incrementJobViews(id: string): Promise<void> {
    if (this.isMysql) {
      await mysqlRepository.incrementJobViews(id);
      return;
    }
    const job = this.data.jobs.find((j) => j.id === id);
    if (job) {
      job.viewsCount = (job.viewsCount || 0) + 1;
      this.persistJson();
    }
  }

  // ==========================================
  // APPLICATIONS
  // ==========================================
  async getApplications(): Promise<Application[]> {
    if (this.isMysql) return mysqlRepository.getApplications();
    return this.data.applications;
  }

  async getApplicationById(id: string): Promise<Application | undefined> {
    if (this.isMysql) return mysqlRepository.getApplicationById(id);
    return this.data.applications.find((a) => a.id === id);
  }

  async getApplicationsByCandidateId(candidateId: string): Promise<Application[]> {
    if (this.isMysql) return mysqlRepository.getApplicationsByCandidateId(candidateId);
    return this.data.applications.filter((a) => a.candidateId === candidateId);
  }

  async getApplicationsByJobId(jobId: string): Promise<Application[]> {
    if (this.isMysql) return mysqlRepository.getApplicationsByJobId(jobId);
    return this.data.applications.filter((a) => a.jobId === jobId);
  }

  async createApplication(app: Application): Promise<Application> {
    if (this.isMysql) return mysqlRepository.createApplication(app);
    this.data.applications.unshift(app);
    const job = this.data.jobs.find((j) => j.id === app.jobId);
    if (job) {
      job.applicantsCount = (job.applicantsCount || 0) + 1;
    }
    this.persistJson();
    return app;
  }

  async updateApplication(
    id: string,
    updates: Partial<Application>,
    stageAudit?: {
      fromStage?: string;
      toStage?: string;
      changedByUserId?: string;
      changedByName?: string;
      comment?: string;
      interviewType?: string;
      interviewDate?: string;
    }
  ): Promise<Application | undefined> {
    if (this.isMysql) return mysqlRepository.updateApplication(id, updates, stageAudit);
    const idx = this.data.applications.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    this.data.applications[idx] = {
      ...this.data.applications[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persistJson();
    return this.data.applications[idx];
  }

  async getApplicationStageHistory(applicationId: string): Promise<any[]> {
    if (this.isMysql) return mysqlRepository.getApplicationStageHistory(applicationId);
    const app = this.data.applications.find((a) => a.id === applicationId);
    return app?.timeline || [];
  }

  // ==========================================
  // REPORTED JOBS
  // ==========================================
  async getReportedJobs(): Promise<ReportedJob[]> {
    if (this.isMysql) return mysqlRepository.getReportedJobs();
    return this.data.reportedJobs;
  }

  async createReportedJob(rep: ReportedJob): Promise<ReportedJob> {
    if (this.isMysql) return mysqlRepository.createReportedJob(rep);
    this.data.reportedJobs.unshift(rep);
    this.persistJson();
    return rep;
  }

  async updateReportedJob(id: string, status: 'pending' | 'resolved' | 'dismissed'): Promise<ReportedJob | undefined> {
    if (this.isMysql) return mysqlRepository.updateReportedJob(id, status);
    const idx = this.data.reportedJobs.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    this.data.reportedJobs[idx].status = status;
    this.persistJson();
    return this.data.reportedJobs[idx];
  }

  // ==========================================
  // JOB ALERTS
  // ==========================================
  async getJobAlerts(userId?: string): Promise<JobAlert[]> {
    if (this.isMysql) return mysqlRepository.getJobAlerts(userId);
    if (userId) {
      return this.data.jobAlerts.filter((a) => a.userId === userId);
    }
    return this.data.jobAlerts;
  }

  async createJobAlert(alert: JobAlert): Promise<JobAlert> {
    if (this.isMysql) return mysqlRepository.createJobAlert(alert);
    this.data.jobAlerts.unshift(alert);
    this.persistJson();
    return alert;
  }

  async updateJobAlert(id: string, updatesOrUserId: string | Partial<JobAlert>, maybeUpdates?: Partial<JobAlert>): Promise<JobAlert | undefined> {
    const userId = typeof updatesOrUserId === 'string' ? updatesOrUserId : undefined;
    const updates = typeof updatesOrUserId === 'string' ? maybeUpdates || {} : updatesOrUserId;

    if (this.isMysql) {
      if (userId) return mysqlRepository.updateJobAlert(id, userId, updates);
      return mysqlRepository.updateJobAlert(id, updates as any, updates);
    }
    const idx = this.data.jobAlerts.findIndex((a) => a.id === id && (!userId || a.userId === userId));
    if (idx === -1) return undefined;
    this.data.jobAlerts[idx] = { ...this.data.jobAlerts[idx], ...updates };
    this.persistJson();
    return this.data.jobAlerts[idx];
  }

  async deleteJobAlert(id: string, userId?: string): Promise<boolean> {
    if (this.isMysql) return mysqlRepository.deleteJobAlert(id, userId || '');
    const initLen = this.data.jobAlerts.length;
    this.data.jobAlerts = this.data.jobAlerts.filter((a) => !(a.id === id && (!userId || a.userId === userId)));
    if (this.data.jobAlerts.length !== initLen) {
      this.persistJson();
      return true;
    }
    return false;
  }

  // ==========================================
  // PASSWORD RESET TOKENS
  // ==========================================
  async createPasswordResetToken(token: PasswordResetToken): Promise<PasswordResetToken> {
    if (this.isMysql) return mysqlRepository.createPasswordResetToken(token);
    this.data.passwordResetTokens = this.data.passwordResetTokens || [];
    this.data.passwordResetTokens.push(token);
    this.persistJson();
    return token;
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    if (this.isMysql) return mysqlRepository.getPasswordResetTokenByHash(tokenHash);
    this.data.passwordResetTokens = this.data.passwordResetTokens || [];
    return this.data.passwordResetTokens
      .filter((t) => t.tokenHash === tokenHash)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    if (this.isMysql) return mysqlRepository.markPasswordResetTokenUsed(id);
    this.data.passwordResetTokens = this.data.passwordResetTokens || [];
    const target = this.data.passwordResetTokens.find((t) => t.id === id);
    if (target) {
      target.usedAt = new Date().toISOString();
      this.persistJson();
    }
  }

  async invalidateUserResetTokens(userId: string): Promise<void> {
    if (this.isMysql) return mysqlRepository.invalidateUserResetTokens(userId);
    this.data.passwordResetTokens = this.data.passwordResetTokens || [];
    let changed = false;
    this.data.passwordResetTokens.forEach((t) => {
      if (t.userId === userId && !t.usedAt) {
        t.usedAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) this.persistJson();
  }

  // ==========================================
  // REVOKED TOKENS (LOGOUT INVALIDATION)
  // ==========================================
  async revokeToken(token: RevokedToken): Promise<RevokedToken> {
    if (this.isMysql) return mysqlRepository.revokeToken(token);
    this.data.revokedTokens = this.data.revokedTokens || [];
    this.data.revokedTokens.push(token);
    this.persistJson();
    return token;
  }

  async isTokenRevoked(tokenJti: string): Promise<boolean> {
    if (this.isMysql) return mysqlRepository.isTokenRevoked(tokenJti);
    this.data.revokedTokens = this.data.revokedTokens || [];
    const now = Date.now();
    return this.data.revokedTokens.some(
      (t) => t.tokenJti === tokenJti && new Date(t.expiresAt).getTime() > now
    );
  }

  resetToSeed(): void {
    this.seedJson();
  }

  // ==========================================
  // RESUME DOCUMENTS (Blob Storage support)
  // ==========================================
  async getCurrentResume(_candidateId: string): Promise<ResumeDocument | undefined> {
    return undefined;
  }

  async getResumeHistory(_candidateId: string): Promise<ResumeDocument[]> {
    return [];
  }

  async getResumeDocById(_id: string): Promise<ResumeDocument | undefined> {
    return undefined;
  }

  async createResumeDocument(doc: ResumeDocument): Promise<ResumeDocument> {
    return doc;
  }

  async markResumeDeleted(_id: string): Promise<void> {
    // no-op
  }
}

export const db = new DatabaseManager();
export default db;
