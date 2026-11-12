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
  ResumeDocument,
  ExtractionStatus,
  ExtractedCandidateProfile,
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

interface DatabaseSchema {
  users: User[];
  companies: Company[];
  categories: JobCategory[];
  jobs: Job[];
  applications: Application[];
  reportedJobs: ReportedJob[];
  jobAlerts: JobAlert[];
  resumeDocuments?: ResumeDocument[];
}

export class JsonDatabase {
  private data: DatabaseSchema;
  private filePath: string;
  readonly isMysql = false;

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
    };
    this.init();
  }

  async checkHealth(): Promise<boolean> {
    try {
      return fs.existsSync(this.filePath);
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    // JsonDatabase is initialized synchronously in constructor
  }

  async close(): Promise<void> {
    // no-op for JSON persistence
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
        console.log(`[TalentHub DB - JSON] Loaded existing database from ${this.filePath}`);
      } catch (err) {
        console.error('[TalentHub DB - JSON] Error reading existing database. Re-seeding...', err);
        this.seed();
      }
    } else {
      console.log('[TalentHub DB - JSON] Initializing fresh database with seed data...');
      this.seed();
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
    };
    this.persist();
  }

  private persist() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[TalentHub DB - JSON] Failed to persist data to disk:', err);
    }
  }

  // --- Users ---
  async getUsers(): Promise<User[]> {
    return this.data.users;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.data.users.find((u) => u.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  async createUser(user: User): Promise<User> {
    this.data.users.push(user);
    this.persist();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.persist();
    return this.data.users[idx];
  }

  async deleteUser(id: string): Promise<boolean> {
    const initLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Companies ---
  async getCompanies(): Promise<Company[]> {
    return this.data.companies;
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    return this.data.companies.find((c) => c.id === id);
  }

  async createCompany(company: Company): Promise<Company> {
    this.data.companies.push(company);
    this.persist();
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const idx = this.data.companies.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.companies[idx] = { ...this.data.companies[idx], ...updates };
    this.persist();
    return this.data.companies[idx];
  }

  async deleteCompany(id: string): Promise<boolean> {
    const initLen = this.data.companies.length;
    this.data.companies = this.data.companies.filter((c) => c.id !== id);
    if (this.data.companies.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Categories ---
  async getCategories(): Promise<JobCategory[]> {
    return this.data.categories;
  }

  async getCategoryById(id: string): Promise<JobCategory | undefined> {
    return this.data.categories.find((c) => c.id === id);
  }

  async createCategory(category: JobCategory): Promise<JobCategory> {
    this.data.categories.push(category);
    this.persist();
    return category;
  }

  async updateCategory(id: string, updates: Partial<JobCategory>): Promise<JobCategory | undefined> {
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    this.data.categories[idx] = { ...this.data.categories[idx], ...updates };
    this.persist();
    return this.data.categories[idx];
  }

  async deleteCategory(id: string): Promise<boolean> {
    const initLen = this.data.categories.length;
    this.data.categories = this.data.categories.filter((c) => c.id !== id);
    if (this.data.categories.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Jobs ---
  async getJobs(): Promise<Job[]> {
    return this.data.jobs;
  }

  async getJobById(id: string): Promise<Job | undefined> {
    return this.data.jobs.find((j) => j.id === id);
  }

  async createJob(job: Job): Promise<Job> {
    this.data.jobs.unshift(job);
    const cat = this.data.categories.find((c) => c.id === job.categoryId);
    if (cat) cat.jobCount = (cat.jobCount || 0) + 1;
    this.persist();
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const idx = this.data.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return undefined;
    this.data.jobs[idx] = { ...this.data.jobs[idx], ...updates, updatedAt: new Date().toISOString() };
    this.persist();
    return this.data.jobs[idx];
  }

  async deleteJob(id: string): Promise<boolean> {
    const job = await this.getJobById(id);
    if (!job) return false;
    const cat = this.data.categories.find((c) => c.id === job.categoryId);
    if (cat && cat.jobCount > 0) cat.jobCount -= 1;
    this.data.jobs = this.data.jobs.filter((j) => j.id !== id);
    this.persist();
    return true;
  }

  async incrementJobViews(id: string): Promise<void> {
    const job = await this.getJobById(id);
    if (job) {
      job.viewsCount = (job.viewsCount || 0) + 1;
      this.persist();
    }
  }

  // --- Applications ---
  async getApplications(): Promise<Application[]> {
    return this.data.applications;
  }

  async getApplicationById(id: string): Promise<Application | undefined> {
    return this.data.applications.find((a) => a.id === id);
  }

  async getApplicationsByCandidateId(candidateId: string): Promise<Application[]> {
    return this.data.applications.filter((a) => a.candidateId === candidateId);
  }

  async getApplicationsByJobId(jobId: string): Promise<Application[]> {
    return this.data.applications.filter((a) => a.jobId === jobId);
  }

  async createApplication(app: Application): Promise<Application> {
    this.data.applications.unshift(app);
    const job = await this.getJobById(app.jobId);
    if (job) {
      job.applicantsCount = (job.applicantsCount || 0) + 1;
    }
    this.persist();
    return app;
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application | undefined> {
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

  async getApplicationStageHistory(applicationId: string): Promise<any[]> {
    const app = await this.getApplicationById(applicationId);
    return app?.timeline || [];
  }

  // --- Reported Jobs ---
  async getReportedJobs(): Promise<ReportedJob[]> {
    return this.data.reportedJobs;
  }

  async createReportedJob(rep: ReportedJob): Promise<ReportedJob> {
    this.data.reportedJobs.unshift(rep);
    this.persist();
    return rep;
  }

  async updateReportedJob(id: string, status: 'pending' | 'resolved' | 'dismissed'): Promise<ReportedJob | undefined> {
    const idx = this.data.reportedJobs.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    this.data.reportedJobs[idx].status = status;
    this.persist();
    return this.data.reportedJobs[idx];
  }

  // --- Job Alerts ---
  async getJobAlerts(userId?: string): Promise<JobAlert[]> {
    if (userId) {
      return this.data.jobAlerts.filter((a) => a.userId === userId);
    }
    return this.data.jobAlerts;
  }

  async createJobAlert(alert: JobAlert): Promise<JobAlert> {
    this.data.jobAlerts.unshift(alert);
    this.persist();
    return alert;
  }

  async updateJobAlert(id: string, updates: Partial<JobAlert>): Promise<JobAlert | undefined> {
    const idx = this.data.jobAlerts.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    this.data.jobAlerts[idx] = { ...this.data.jobAlerts[idx], ...updates };
    this.persist();
    return this.data.jobAlerts[idx];
  }

  async deleteJobAlert(id: string): Promise<boolean> {
    const initLen = this.data.jobAlerts.length;
    this.data.jobAlerts = this.data.jobAlerts.filter((a) => a.id !== id);
    if (this.data.jobAlerts.length !== initLen) {
      this.persist();
      return true;
    }
    return false;
  }

  resetToSeed(): void {
    this.seed();
  }

  // ==========================================
  // RESUME DOCUMENTS & AZURE EXTRACTIONS
  // ==========================================

  private ensureResumeDocumentsArray(): ResumeDocument[] {
    if (!this.data.resumeDocuments) {
      this.data.resumeDocuments = [];
    }
    return this.data.resumeDocuments;
  }

  async getCurrentResume(candidateId: string): Promise<ResumeDocument | undefined> {
    const docs = this.ensureResumeDocumentsArray();
    return docs
      .filter((d) => d.candidateId === candidateId && d.isCurrent && d.uploadStatus === 'uploaded')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
  }

  async getResumeHistory(candidateId: string): Promise<ResumeDocument[]> {
    const docs = this.ensureResumeDocumentsArray();
    return docs
      .filter((d) => d.candidateId === candidateId && d.uploadStatus !== 'failed')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getResumeDocById(id: string): Promise<ResumeDocument | undefined> {
    const docs = this.ensureResumeDocumentsArray();
    return docs.find((d) => d.id === id);
  }

  async createResumeDocument(doc: ResumeDocument): Promise<ResumeDocument> {
    const docs = this.ensureResumeDocumentsArray();
    // Demote existing current resumes for this candidate
    docs.forEach((d) => {
      if (d.candidateId === doc.candidateId) {
        d.isCurrent = false;
      }
    });

    const newDoc: ResumeDocument = {
      ...doc,
      isCurrent: true,
      uploadedAt: doc.uploadedAt || new Date().toISOString(),
      createdAt: doc.createdAt || new Date().toISOString(),
    };
    docs.push(newDoc);

    // Update candidate's resume reference
    const uIdx = this.data.users.findIndex((u) => u.id === doc.candidateId);
    if (uIdx !== -1) {
      this.data.users[uIdx].resumeUrl = `blob://${doc.containerName}/${doc.blobName}`;
      this.data.users[uIdx].resumeOriginalName = doc.originalFilename;
    }

    this.persist();
    return newDoc;
  }

  async markResumeDeleted(id: string): Promise<void> {
    const docs = this.ensureResumeDocumentsArray();
    const doc = docs.find((d) => d.id === id);
    if (doc) {
      doc.uploadStatus = 'deleted';
      doc.isCurrent = false;
      this.persist();
    }
  }

  async updateResumeExtraction(
    docId: string,
    status: ExtractionStatus,
    extractedData?: ExtractedCandidateProfile,
    error?: string
  ): Promise<void> {
    const docs = this.ensureResumeDocumentsArray();
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      doc.extractionStatus = status;
      if (extractedData) doc.extractedData = extractedData;
      if (error !== undefined) doc.extractionError = error;
      this.persist();
    }
  }

  async updateResumeExtractedData(
    docId: string,
    extractedData: ExtractedCandidateProfile
  ): Promise<void> {
    const docs = this.ensureResumeDocumentsArray();
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      doc.extractedData = extractedData;
      this.persist();
    }
  }

  async verifyResumeExtraction(
    docId: string,
    candidateId: string,
    recruiterId: string,
    recruiterName: string,
    verifiedData: ExtractedCandidateProfile,
    overwriteCandidateProfile: boolean = true
  ): Promise<void> {
    const now = new Date().toISOString();
    const docs = this.ensureResumeDocumentsArray();
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      doc.isVerified = true;
      doc.verifiedById = recruiterId;
      doc.verifiedByName = recruiterName;
      doc.verifiedAt = now;
      doc.extractedData = verifiedData;
    }

    const uIdx = this.data.users.findIndex((u) => u.id === candidateId);
    if (uIdx !== -1) {
      this.data.users[uIdx].isProfileVerified = true;
      this.data.users[uIdx].verifiedById = recruiterId;
      this.data.users[uIdx].verifiedByName = recruiterName;
      this.data.users[uIdx].verifiedAt = now;
      this.data.users[uIdx].extractedProfile = verifiedData;

      if (overwriteCandidateProfile) {
        if (verifiedData.skills && verifiedData.skills.length > 0) {
          this.data.users[uIdx].skills = verifiedData.skills;
        }
        if (verifiedData.summary) {
          this.data.users[uIdx].bio = verifiedData.summary;
        }
        if (verifiedData.phone) {
          this.data.users[uIdx].phone = verifiedData.phone;
        }
        if (verifiedData.location) {
          this.data.users[uIdx].location = verifiedData.location;
        }
        if (verifiedData.experience && verifiedData.experience.length > 0) {
          this.data.users[uIdx].experience = verifiedData.experience.map((e) => ({
            title: e.title,
            company: e.company,
            period: e.duration,
            description: e.description || '',
          }));
          this.data.users[uIdx].title = verifiedData.experience[0].title;
        }
        if (verifiedData.education && verifiedData.education.length > 0) {
          this.data.users[uIdx].education = verifiedData.education.map((e) => ({
            degree: e.degree,
            school: e.institution,
            year: e.year,
          }));
        }
        if (verifiedData.certifications) {
          this.data.users[uIdx].certifications = verifiedData.certifications;
        }
      }
    }

    this.persist();
  }
}
