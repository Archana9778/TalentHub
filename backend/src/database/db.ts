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
  ApplicationStatusHistory,
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
  initialApplicationStageHistory,
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
  applicationStageHistory: ApplicationStatusHistory[];
  passwordResetTokens: PasswordResetToken[];
  revokedTokens: RevokedToken[];
  resumeDocuments: ResumeDocument[];
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
      applicationStageHistory: [],
      passwordResetTokens: [],
      revokedTokens: [],
      resumeDocuments: [],
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
        console.log(`[TalentHub DB] Loaded existing database from ${this.filePath}`);
        if (!Array.isArray(this.data.passwordResetTokens)) this.data.passwordResetTokens = [];
        if (!Array.isArray(this.data.revokedTokens)) this.data.revokedTokens = [];
        if (!Array.isArray(this.data.resumeDocuments)) this.data.resumeDocuments = [];
        if (!Array.isArray(this.data.applicationStageHistory)) {
          this.data.applicationStageHistory = [...initialApplicationStageHistory];
        }
        this.upgradeSchemaIfNeeded();
      } catch (err) {
        console.error('[TalentHub DB] Error reading existing database. Re-seeding...', err);
        this.seedJson();
      }
    } else {
      console.log('[TalentHub DB] Initializing fresh database with seed data...');
      this.seedJson();
    }
  }

  private upgradeSchemaIfNeeded() {
    let modified = false;

    if (!Array.isArray(this.data.applicationStageHistory)) {
      this.data.applicationStageHistory = [...initialApplicationStageHistory];
      modified = true;
    }

    if (!Array.isArray(this.data.resumeDocuments)) {
      this.data.resumeDocuments = [];
      modified = true;
    }

    if (!Array.isArray(this.data.passwordResetTokens)) {
      this.data.passwordResetTokens = [];
      modified = true;
    }

    if (!Array.isArray(this.data.revokedTokens)) {
      this.data.revokedTokens = [];
      modified = true;
    }

    // Ensure all seed companies exist or have missing fields
    for (const initComp of initialCompanies) {
      const existing = this.data.companies.find((c) => c.id === initComp.id);
      if (!existing) {
        this.data.companies.push(initComp);
        modified = true;
      } else {
        if (!existing.email && initComp.email) {
          existing.email = initComp.email;
          modified = true;
        }
        if (!existing.contactNumber && initComp.contactNumber) {
          existing.contactNumber = initComp.contactNumber;
          existing.phone = initComp.contactNumber;
          modified = true;
        }
        if (!existing.address && initComp.address) {
          existing.address = initComp.address;
          modified = true;
        }
      }
    }

    // Ensure seed recruiters exist
    for (const initUser of initialUsers) {
      const existing = this.data.users.find((u) => u.id === initUser.id);
      if (!existing) {
        this.data.users.push(initUser);
        modified = true;
      } else {
        if (initUser.role === 'recruiter') {
          if (!existing.companyRole) {
            existing.companyRole = initUser.companyRole || 'admin';
            modified = true;
          }
          if (!existing.contactNumber) {
            existing.contactNumber = initUser.contactNumber || existing.phone;
            modified = true;
          }
          if (!existing.designation) {
            existing.designation = initUser.designation || existing.title;
            modified = true;
          }
        }
      }
    }

    // Ensure applications have companyId and assignedRecruiter
    for (const app of this.data.applications) {
      if (!app.companyId) {
        const job = this.data.jobs.find((j) => j.id === app.jobId);
        if (job) {
          app.companyId = job.companyId;
          app.companyName = job.companyName;
          app.assignedRecruiterId = job.recruiterId;
          app.assignedRecruiterName = job.recruiterName;
          modified = true;
        }
      }
    }

    if (modified) {
      this.persistJson();
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
      applicationStageHistory: [...initialApplicationStageHistory],
      passwordResetTokens: [],
      revokedTokens: [],
      resumeDocuments: [],
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
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };
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

  async getRecruiters(companyId?: string): Promise<User[]> {
    const allUsers = await this.getUsers();
    let recruiters = allUsers.filter((u) => u.role === 'recruiter');
    if (companyId) {
      recruiters = recruiters.filter((u) => u.companyId === companyId);
    }
    return recruiters;
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
    this.data.companies[idx] = {
      ...this.data.companies[idx],
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };
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
    this.data.jobs[idx] = {
      ...this.data.jobs[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
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

  async getJobsByCompanyId(companyId: string): Promise<Job[]> {
    const allJobs = await this.getJobs();
    return allJobs.filter((j) => j.companyId === companyId);
  }

  async getJobsByRecruiterId(recruiterId: string): Promise<Job[]> {
    const allJobs = await this.getJobs();
    return allJobs.filter((j) => j.recruiterId === recruiterId);
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

  async getApplicationsByCompanyId(companyId: string): Promise<Application[]> {
    const allApps = await this.getApplications();
    return allApps.filter((a) => a.companyId === companyId);
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
    stageAudit?: any
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

  async deleteApplication(id: string): Promise<boolean> {
    if (this.isMysql) {
      return false;
    }
    const initLen = this.data.applications.length;
    this.data.applications = this.data.applications.filter((a) => a.id !== id);
    if (this.data.applications.length !== initLen) {
      this.persistJson();
      return true;
    }
    return false;
  }

  // ==========================================
  // APPLICATION AUDIT TRAIL / STATUS HISTORY
  // ==========================================
  async getApplicationStageHistory(applicationId: string): Promise<any[]> {
    if (this.isMysql) return mysqlRepository.getApplicationStageHistory(applicationId);
    const history = this.data.applicationStageHistory || [];
    const appHistory = history.filter((h) => h.applicationId === applicationId);
    if (appHistory.length > 0) return appHistory;
    const app = this.data.applications.find((a) => a.id === applicationId);
    return app?.timeline || [];
  }

  async getApplicationHistory(applicationId: string): Promise<ApplicationStatusHistory[]> {
    if (this.isMysql) {
      const rows = await mysqlRepository.getApplicationStageHistory(applicationId);
      return rows.map((r: any) => ({
        id: r.id,
        applicationId: r.applicationId || r.application_id,
        previousStatus: r.fromStage || r.from_stage || 'None',
        newStatus: r.toStage || r.to_stage,
        changedBy: r.changedByUserId || r.changed_by_user_id,
        changedByName: r.changedByName || r.changed_by_name,
        timestamp: r.createdAt || r.created_at || new Date().toISOString(),
        comments: r.comment,
        reason: r.reason || r.comment,
        isAdminOverride: Boolean(r.isAdminOverride || r.is_admin_override),
        interviewType: r.interviewType || r.interview_type,
        interviewDate: r.interviewDate || r.interview_date,
      }));
    }
    if (!Array.isArray(this.data.applicationStageHistory)) {
      this.data.applicationStageHistory = [];
    }
    return this.data.applicationStageHistory.filter((h) => h.applicationId === applicationId);
  }

  async createApplicationHistory(entry: ApplicationStatusHistory): Promise<ApplicationStatusHistory> {
    if (this.isMysql) {
      // Avoid duplicate MySQL audit inserts because the repository already records initial applications and stage transitions
      return entry;
    }
    if (!Array.isArray(this.data.applicationStageHistory)) {
      this.data.applicationStageHistory = [];
    }
    this.data.applicationStageHistory.push(entry);
    this.persistJson();
    return entry;
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
  async getCurrentResume(candidateId: string): Promise<ResumeDocument | undefined> {
    if (this.isMysql) return mysqlRepository.getCurrentResume(candidateId);
    this.data.resumeDocuments = this.data.resumeDocuments || [];
    return this.data.resumeDocuments.find(
      (r) => r.candidateId === candidateId && r.isCurrent && r.uploadStatus === 'uploaded'
    );
  }

  async getResumeHistory(candidateId: string): Promise<ResumeDocument[]> {
    if (this.isMysql) return mysqlRepository.getResumeHistory(candidateId);
    this.data.resumeDocuments = this.data.resumeDocuments || [];
    return this.data.resumeDocuments
      .filter((r) => r.candidateId === candidateId && r.uploadStatus !== 'failed')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getResumeDocById(id: string): Promise<ResumeDocument | undefined> {
    if (this.isMysql) return mysqlRepository.getResumeDocById(id);
    this.data.resumeDocuments = this.data.resumeDocuments || [];
    return this.data.resumeDocuments.find((r) => r.id === id);
  }

  async createResumeDocument(doc: ResumeDocument): Promise<ResumeDocument> {
    if (this.isMysql) return mysqlRepository.createResumeDocument(doc);
    this.data.resumeDocuments = this.data.resumeDocuments || [];
    this.data.resumeDocuments.forEach((r) => {
      if (r.candidateId === doc.candidateId && r.isCurrent) {
        r.isCurrent = false;
      }
    });
    const newDoc: ResumeDocument = { ...doc, isCurrent: true };
    this.data.resumeDocuments.push(newDoc);
    const user = this.data.users.find((u) => u.id === doc.candidateId);
    if (user) {
      user.resumeUrl = `blob://${doc.containerName || 'talenthub-resumes'}/${doc.blobName}`;
      user.resumeOriginalName = doc.originalFilename;
    }
    this.persistJson();
    return newDoc;
  }

  async markResumeDeleted(id: string, candidateId?: string): Promise<void> {
    if (this.isMysql) return mysqlRepository.markResumeDeleted(id);
    this.data.resumeDocuments = this.data.resumeDocuments || [];
    const doc = this.data.resumeDocuments.find((r) => r.id === id && (!candidateId || r.candidateId === candidateId));
    if (doc) {
      doc.uploadStatus = 'deleted';
      doc.isCurrent = false;
      this.persistJson();
    }
  }
}

export const db = new DatabaseManager();
export default db;
