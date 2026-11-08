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

interface DatabaseSchema {
  users: User[];
  companies: Company[];
  categories: JobCategory[];
  jobs: Job[];
  applications: Application[];
  reportedJobs: ReportedJob[];
  jobAlerts: JobAlert[];
  applicationStageHistory: ApplicationStatusHistory[];
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
    };
    this.init();
  }

  private init() {
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
        this.upgradeSchemaIfNeeded();
      } catch (err) {
        console.error('[TalentHub DB] Error reading existing database. Re-seeding...', err);
        this.seed();
      }
    } else {
      console.log('[TalentHub DB] Initializing fresh database with seed data...');
      this.seed();
    }
  }

  private upgradeSchemaIfNeeded() {
    let modified = false;

    if (!Array.isArray(this.data.applicationStageHistory) || this.data.applicationStageHistory.length === 0) {
      this.data.applicationStageHistory = [...initialApplicationStageHistory];
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
      this.persist();
    }
  }

  private seed() {
    this.data = {
      users: [...initialUsers],
      companies: [...initialCompanies],
      categories: [...initialCategories],
      jobs: [...initialJobs],
      applications: [...initialApplications],
      reportedJobs: [...initialReportedJobs],
      jobAlerts: [...initialJobAlerts],
      applicationStageHistory: [...initialApplicationStageHistory],
    };
    this.persist();
  }

  private persist() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[TalentHub DB] Failed to persist data to disk:', err);
    }
  }

  // --- Users ---
  getUsers(): User[] {
    return this.data.users;
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.persist();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = {
      ...this.data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.data.users[idx];
  }

  deleteUser(id: string): boolean {
    const initLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  getRecruiters(companyId?: string): User[] {
    let recruiters = this.data.users.filter((u) => u.role === 'recruiter');
    if (companyId) {
      recruiters = recruiters.filter((u) => u.companyId === companyId);
    }
    return recruiters;
  }

  // --- Companies ---
  getCompanies(): Company[] {
    return this.data.companies;
  }

  getCompanyById(id: string): Company | undefined {
    return this.data.companies.find((c) => c.id === id);
  }

  createCompany(company: Company): Company {
    this.data.companies.push(company);
    this.persist();
    return company;
  }

  updateCompany(id: string, updates: Partial<Company>): Company | undefined {
    const idx = this.data.companies.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.companies[idx] = {
      ...this.data.companies[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.data.companies[idx];
  }

  deleteCompany(id: string): boolean {
    const initLen = this.data.companies.length;
    this.data.companies = this.data.companies.filter((c) => c.id !== id);
    if (this.data.companies.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Categories ---
  getCategories(): JobCategory[] {
    return this.data.categories;
  }

  getCategoryById(id: string): JobCategory | undefined {
    return this.data.categories.find((c) => c.id === id);
  }

  createCategory(category: JobCategory): JobCategory {
    this.data.categories.push(category);
    this.persist();
    return category;
  }

  updateCategory(id: string, updates: Partial<JobCategory>): JobCategory | undefined {
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.categories[idx] = { ...this.data.categories[idx], ...updates };
    this.persist();
    return this.data.categories[idx];
  }

  deleteCategory(id: string): boolean {
    const initLen = this.data.categories.length;
    this.data.categories = this.data.categories.filter((c) => c.id !== id);
    if (this.data.categories.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Jobs ---
  getJobs(): Job[] {
    return this.data.jobs;
  }

  getJobById(id: string): Job | undefined {
    return this.data.jobs.find((j) => j.id === id);
  }

  getJobsByCompanyId(companyId: string): Job[] {
    return this.data.jobs.filter((j) => j.companyId === companyId);
  }

  getJobsByRecruiterId(recruiterId: string): Job[] {
    return this.data.jobs.filter((j) => j.recruiterId === recruiterId);
  }

  createJob(job: Job): Job {
    this.data.jobs.unshift(job);
    const cat = this.data.categories.find((c) => c.id === job.categoryId);
    if (cat) cat.jobCount = (cat.jobCount || 0) + 1;
    this.persist();
    return job;
  }

  updateJob(id: string, updates: Partial<Job>): Job | undefined {
    const idx = this.data.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return undefined;
    this.data.jobs[idx] = { ...this.data.jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    this.persist();
    return this.data.jobs[idx];
  }

  deleteJob(id: string): boolean {
    const job = this.getJobById(id);
    if (!job) return false;
    const cat = this.data.categories.find((c) => c.id === job.categoryId);
    if (cat && cat.jobCount > 0) cat.jobCount -= 1;
    this.data.jobs = this.data.jobs.filter((j) => j.id !== id);
    this.persist();
    return true;
  }

  incrementJobViews(id: string): void {
    const job = this.getJobById(id);
    if (job) {
      job.viewsCount = (job.viewsCount || 0) + 1;
      this.persist();
    }
  }

  // --- Applications ---
  getApplications(): Application[] {
    return this.data.applications;
  }

  getApplicationById(id: string): Application | undefined {
    return this.data.applications.find((a) => a.id === id);
  }

  getApplicationsByCandidateId(candidateId: string): Application[] {
    return this.data.applications.filter((a) => a.candidateId === candidateId);
  }

  getApplicationsByJobId(jobId: string): Application[] {
    return this.data.applications.filter((a) => a.jobId === jobId);
  }

  getApplicationsByCompanyId(companyId: string): Application[] {
    return this.data.applications.filter((a) => a.companyId === companyId);
  }

  createApplication(app: Application): Application {
    this.data.applications.unshift(app);
    const job = this.getJobById(app.jobId);
    if (job) {
      job.applicantsCount = (job.applicantsCount || 0) + 1;
    }
    this.persist();
    return app;
  }

  updateApplication(id: string, updates: Partial<Application>): Application | undefined {
    const idx = this.data.applications.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    this.data.applications[idx] = {
      ...this.data.applications[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return this.data.applications[idx];
  }

  // --- Application Status History / Audit Trail ---
  getApplicationHistory(applicationId: string): ApplicationStatusHistory[] {
    if (!this.data.applicationStageHistory) {
      this.data.applicationStageHistory = [];
    }
    return this.data.applicationStageHistory.filter((h) => h.applicationId === applicationId);
  }

  createApplicationHistory(entry: ApplicationStatusHistory): ApplicationStatusHistory {
    if (!this.data.applicationStageHistory) {
      this.data.applicationStageHistory = [];
    }
    this.data.applicationStageHistory.push(entry);
    this.persist();
    return entry;
  }

  // --- Reported Jobs ---
  getReportedJobs(): ReportedJob[] {
    return this.data.reportedJobs;
  }

  createReportedJob(rep: ReportedJob): ReportedJob {
    this.data.reportedJobs.unshift(rep);
    this.persist();
    return rep;
  }

  updateReportedJob(id: string, status: 'pending' | 'resolved' | 'dismissed'): ReportedJob | undefined {
    const idx = this.data.reportedJobs.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    this.data.reportedJobs[idx].status = status;
    this.persist();
    return this.data.reportedJobs[idx];
  }

  // --- Job Alerts ---
  getJobAlerts(userId?: string): JobAlert[] {
    if (userId) {
      return this.data.jobAlerts.filter((a) => a.userId === userId);
    }
    return this.data.jobAlerts;
  }

  createJobAlert(alert: JobAlert): JobAlert {
    this.data.jobAlerts.unshift(alert);
    this.persist();
    return alert;
  }

  updateJobAlert(id: string, updates: Partial<JobAlert>): JobAlert | undefined {
    const idx = this.data.jobAlerts.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    this.data.jobAlerts[idx] = { ...this.data.jobAlerts[idx], ...updates };
    this.persist();
    return this.data.jobAlerts[idx];
  }

  deleteJobAlert(id: string): boolean {
    const initLen = this.data.jobAlerts.length;
    this.data.jobAlerts = this.data.jobAlerts.filter((a) => a.id !== id);
    if (this.data.jobAlerts.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // Reset database back to default seed
  resetToSeed(): void {
    this.seed();
  }
}

export const db = new DatabaseManager();
