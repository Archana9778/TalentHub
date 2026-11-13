import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { getDb, testDatabaseConnection, closeDatabaseConnection } from './knex';
import {
  User,
  Company,
  JobCategory,
  Job,
  Application,
  ReportedJob,
  JobAlert,
  StageTimelineItem,
  ResumeDocument,
  MatchResult,
  ExtractionStatus,
  ExtractedCandidateProfile,
} from '../types';

function safeJsonParse<T>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export class MySqlDatabase {
  private db: Knex;
  readonly isMysql = true;

  constructor(knexInstance?: Knex) {
    this.db = knexInstance || getDb();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await testDatabaseConnection();
      return res.connected;
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    try {
      const res = await testDatabaseConnection();
      if (!res.connected) {
        console.warn(`[TalentHub MySQL] Connection test warning: ${res.error || 'Server not reachable'}`);
      }
    } catch (err: any) {
      console.warn(`[TalentHub MySQL] Connection initialization failed: ${err.message}`);
    }
  }

  async close(): Promise<void> {
    await closeDatabaseConnection();
  }

  // ==========================================
  // USERS, CANDIDATES & RECRUITERS
  // ==========================================

  private mapUserRow(row: any): User {
    const isCandidate = row.role === 'candidate';
    const isRecruiter = row.role === 'recruiter';

    return {
      id: row.id,
      email: row.email,
      password: row.password_hash,
      name: row.name,
      role: row.role,
      status: row.status,
      avatarUrl: row.avatar_url || undefined,
      title: (isCandidate ? row.candidate_title : row.recruiter_title) || row.title || undefined,
      location: (isCandidate ? row.candidate_location : row.recruiter_location) || row.location || undefined,
      phone: (isCandidate ? row.candidate_phone : row.recruiter_phone) || row.phone || undefined,
      bio: (isCandidate ? row.candidate_bio : row.recruiter_bio) || row.bio || undefined,
      dateOfBirth: row.date_of_birth ? (typeof row.date_of_birth === 'string' ? row.date_of_birth.substring(0, 10) : new Date(row.date_of_birth).toISOString().substring(0, 10)) : undefined,
      gender: row.gender || undefined,
      companyId: isRecruiter ? (row.company_id || undefined) : undefined,
      companyName: isRecruiter ? (row.company_name || undefined) : undefined,
      resumeUrl: isCandidate ? (row.resume_url || undefined) : undefined,
      resumeOriginalName: isCandidate ? (row.resume_original_name || undefined) : undefined,
      skills: isCandidate ? safeJsonParse(row.skills_json, []) : undefined,
      experience: isCandidate ? safeJsonParse(row.experience_json, []) : undefined,
      education: isCandidate ? safeJsonParse(row.education_json, []) : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private userQuery() {
    return this.db('users as u')
      .leftJoin('candidates as c', 'u.id', 'c.user_id')
      .leftJoin('recruiters as r', 'u.id', 'r.user_id')
      .select(
        'u.id',
        'u.email',
        'u.password_hash',
        'u.name',
        'u.role',
        'u.status',
        'u.avatar_url',
        'u.created_at',
        'u.updated_at',
        'c.title as candidate_title',
        'c.location as candidate_location',
        'c.phone as candidate_phone',
        'c.bio as candidate_bio',
        'c.date_of_birth',
        'c.gender',
        'c.resume_url',
        'c.resume_original_name',
        'c.skills_json',
        'c.experience_json',
        'c.education_json',
        'r.title as recruiter_title',
        'r.location as recruiter_location',
        'r.phone as recruiter_phone',
        'r.bio as recruiter_bio',
        'r.company_id',
        'r.company_name'
      );
  }

  async getUsers(): Promise<User[]> {
    const rows = await this.userQuery();
    return rows.map((r) => this.mapUserRow(r));
  }

  async getUserById(id: string): Promise<User | undefined> {
    const row = await this.userQuery().where('u.id', id).first();
    return row ? this.mapUserRow(row) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const row = await this.userQuery().where('u.email', email.trim().toLowerCase()).first();
    return row ? this.mapUserRow(row) : undefined;
  }

  async createUser(user: User): Promise<User> {
    await this.db.transaction(async (trx) => {
      await trx('users').insert({
        id: user.id,
        email: user.email.trim().toLowerCase(),
        password_hash: user.password || '',
        name: user.name,
        role: user.role,
        status: user.status || 'active',
        avatar_url: user.avatarUrl || null,
        created_at: user.createdAt ? new Date(user.createdAt) : new Date(),
      });

      if (user.role === 'candidate') {
        await trx('candidates').insert({
          id: user.id,
          user_id: user.id,
          title: user.title || null,
          location: user.location || null,
          phone: user.phone || null,
          bio: user.bio || null,
          date_of_birth: user.dateOfBirth ? user.dateOfBirth : null,
          gender: user.gender || null,
          resume_url: user.resumeUrl || null,
          resume_original_name: user.resumeOriginalName || null,
          skills_json: JSON.stringify(user.skills || []),
          experience_json: JSON.stringify(user.experience || []),
          education_json: JSON.stringify(user.education || []),
          created_at: user.createdAt ? new Date(user.createdAt) : new Date(),
        });
      } else if (user.role === 'recruiter') {
        await trx('recruiters').insert({
          id: user.id,
          user_id: user.id,
          company_id: user.companyId || null,
          company_name: user.companyName || null,
          title: user.title || null,
          location: user.location || null,
          phone: user.phone || null,
          bio: user.bio || null,
          created_at: user.createdAt ? new Date(user.createdAt) : new Date(),
        });
      }
    });

    const created = await this.getUserById(user.id);
    return created || user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existing = await this.getUserById(id);
    if (!existing) return undefined;

    await this.db.transaction(async (trx) => {
      const userUpdates: any = {};
      if (updates.name !== undefined) userUpdates.name = updates.name;
      if (updates.email !== undefined) userUpdates.email = updates.email.trim().toLowerCase();
      if (updates.password !== undefined) userUpdates.password_hash = updates.password;
      if (updates.status !== undefined) userUpdates.status = updates.status;
      if (updates.role !== undefined) userUpdates.role = updates.role;
      if (updates.avatarUrl !== undefined) userUpdates.avatar_url = updates.avatarUrl;

      if (Object.keys(userUpdates).length > 0) {
        await trx('users').where('id', id).update(userUpdates);
      }

      if (existing.role === 'candidate') {
        const candidateUpdates: any = {};
        if (updates.title !== undefined) candidateUpdates.title = updates.title;
        if (updates.location !== undefined) candidateUpdates.location = updates.location;
        if (updates.phone !== undefined) candidateUpdates.phone = updates.phone;
        if (updates.bio !== undefined) candidateUpdates.bio = updates.bio;
        if (updates.dateOfBirth !== undefined) candidateUpdates.date_of_birth = updates.dateOfBirth ? updates.dateOfBirth : null;
        if (updates.gender !== undefined) candidateUpdates.gender = updates.gender || null;
        if (updates.resumeUrl !== undefined) candidateUpdates.resume_url = updates.resumeUrl;
        if (updates.resumeOriginalName !== undefined) candidateUpdates.resume_original_name = updates.resumeOriginalName;
        if (updates.skills !== undefined) candidateUpdates.skills_json = JSON.stringify(updates.skills);
        if (updates.experience !== undefined) candidateUpdates.experience_json = JSON.stringify(updates.experience);
        if (updates.education !== undefined) candidateUpdates.education_json = JSON.stringify(updates.education);

        if (Object.keys(candidateUpdates).length > 0) {
          const existsInCandidates = await trx('candidates').where('user_id', id).first();
          if (existsInCandidates) {
            await trx('candidates').where('user_id', id).update(candidateUpdates);
          } else {
            await trx('candidates').insert({
              id,
              user_id: id,
              ...candidateUpdates,
            });
          }
        }
      } else if (existing.role === 'recruiter') {
        const recruiterUpdates: any = {};
        if (updates.title !== undefined) recruiterUpdates.title = updates.title;
        if (updates.location !== undefined) recruiterUpdates.location = updates.location;
        if (updates.phone !== undefined) recruiterUpdates.phone = updates.phone;
        if (updates.bio !== undefined) recruiterUpdates.bio = updates.bio;
        if (updates.companyId !== undefined) recruiterUpdates.company_id = updates.companyId;
        if (updates.companyName !== undefined) recruiterUpdates.company_name = updates.companyName;

        if (Object.keys(recruiterUpdates).length > 0) {
          const existsInRecruiters = await trx('recruiters').where('user_id', id).first();
          if (existsInRecruiters) {
            await trx('recruiters').where('user_id', id).update(recruiterUpdates);
          } else {
            await trx('recruiters').insert({
              id,
              user_id: id,
              ...recruiterUpdates,
            });
          }
        }
      }
    });

    return this.getUserById(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const deletedCount = await this.db('users').where('id', id).delete();
    return deletedCount > 0;
  }

  // ==========================================
  // COMPANIES
  // ==========================================

  private mapCompanyRow(r: any): Company {
    return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      logo: r.logo || '',
      website: r.website || '',
      location: r.location || '',
      industry: r.industry || '',
      size: r.company_size || '',
      verified: Boolean(r.verified),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async getCompanies(): Promise<Company[]> {
    const rows = await this.db('companies').select('*').orderBy('created_at', 'desc');
    return rows.map((r) => this.mapCompanyRow(r));
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const row = await this.db('companies').where('id', id).first();
    return row ? this.mapCompanyRow(row) : undefined;
  }

  async createCompany(company: Company): Promise<Company> {
    await this.db('companies').insert({
      id: company.id,
      name: company.name,
      description: company.description || null,
      logo: company.logo || null,
      website: company.website || null,
      location: company.location || null,
      industry: company.industry || null,
      company_size: company.size || null,
      verified: Boolean(company.verified),
      created_at: company.createdAt ? new Date(company.createdAt) : new Date(),
    });
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.logo !== undefined) dbUpdates.logo = updates.logo;
    if (updates.website !== undefined) dbUpdates.website = updates.website;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.industry !== undefined) dbUpdates.industry = updates.industry;
    if (updates.size !== undefined) dbUpdates.company_size = updates.size;
    if (updates.verified !== undefined) dbUpdates.verified = Boolean(updates.verified);

    if (Object.keys(dbUpdates).length > 0) {
      const count = await this.db('companies').where('id', id).update(dbUpdates);
      if (count === 0) return undefined;
    }
    return this.getCompanyById(id);
  }

  async deleteCompany(id: string): Promise<boolean> {
    const deletedCount = await this.db('companies').where('id', id).delete();
    return deletedCount > 0;
  }

  // ==========================================
  // JOB CATEGORIES
  // ==========================================

  private mapCategoryRow(r: any): JobCategory {
    return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      icon: r.icon || 'Briefcase',
      jobCount: r.job_count || 0,
    };
  }

  async getCategories(): Promise<JobCategory[]> {
    const rows = await this.db('job_categories').select('*').orderBy('name', 'asc');
    return rows.map((r) => this.mapCategoryRow(r));
  }

  async getCategoryById(id: string): Promise<JobCategory | undefined> {
    const row = await this.db('job_categories').where('id', id).first();
    return row ? this.mapCategoryRow(row) : undefined;
  }

  async createCategory(category: JobCategory): Promise<JobCategory> {
    await this.db('job_categories').insert({
      id: category.id,
      name: category.name,
      description: category.description || null,
      icon: category.icon || 'Briefcase',
      job_count: category.jobCount || 0,
    });
    return category;
  }

  async updateCategory(id: string, updates: Partial<JobCategory>): Promise<JobCategory | undefined> {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.jobCount !== undefined) dbUpdates.job_count = updates.jobCount;

    if (Object.keys(dbUpdates).length > 0) {
      const count = await this.db('job_categories').where('id', id).update(dbUpdates);
      if (count === 0) return undefined;
    }
    return this.getCategoryById(id);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const deletedCount = await this.db('job_categories').where('id', id).delete();
    return deletedCount > 0;
  }

  // ==========================================
  // JOBS
  // ==========================================

  private mapJobRow(r: any): Job {
    return {
      id: r.id,
      title: r.title,
      companyId: r.company_id,
      companyName: r.company_name,
      companyLogo: r.company_logo || undefined,
      recruiterId: r.recruiter_id,
      recruiterName: r.recruiter_name,
      categoryId: r.category_id,
      categoryName: r.category_name,
      location: r.location,
      workplaceType: r.workplace_type,
      jobType: r.job_type,
      experienceLevel: r.experience_level,
      salaryMin: r.salary_min,
      salaryMax: r.salary_max,
      salaryCurrency: r.salary_currency || 'USD',
      description: r.description,
      requirements: safeJsonParse(r.requirements_json, []),
      skills: safeJsonParse(r.skills_json, []),
      benefits: safeJsonParse(r.benefits_json, []),
      status: r.status,
      isFeatured: Boolean(r.is_featured),
      applicantsCount: r.applicants_count || 0,
      viewsCount: r.views_count || 0,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async getJobs(): Promise<Job[]> {
    const rows = await this.db('jobs').select('*').orderBy('created_at', 'desc');
    return rows.map((r) => this.mapJobRow(r));
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const row = await this.db('jobs').where('id', id).first();
    return row ? this.mapJobRow(row) : undefined;
  }

  async createJob(job: Job): Promise<Job> {
    await this.db.transaction(async (trx) => {
      await trx('jobs').insert({
        id: job.id,
        title: job.title,
        company_id: job.companyId,
        company_name: job.companyName,
        company_logo: job.companyLogo || null,
        recruiter_id: job.recruiterId,
        recruiter_name: job.recruiterName,
        category_id: job.categoryId,
        category_name: job.categoryName,
        location: job.location,
        workplace_type: job.workplaceType,
        job_type: job.jobType,
        experience_level: job.experienceLevel,
        salary_min: job.salaryMin,
        salary_max: job.salaryMax,
        salary_currency: job.salaryCurrency || 'USD',
        description: job.description,
        requirements_json: JSON.stringify(job.requirements || []),
        skills_json: JSON.stringify(job.skills || []),
        benefits_json: JSON.stringify(job.benefits || []),
        status: job.status || 'active',
        is_featured: Boolean(job.isFeatured),
        applicants_count: job.applicantsCount || 0,
        views_count: job.viewsCount || 0,
        expires_at: job.expiresAt ? new Date(job.expiresAt) : null,
        created_at: job.createdAt ? new Date(job.createdAt) : new Date(),
      });

      await trx('job_categories')
        .where('id', job.categoryId)
        .increment('job_count', 1);
    });

    const created = await this.getJobById(job.id);
    return created || job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.companyId !== undefined) dbUpdates.company_id = updates.companyId;
    if (updates.companyName !== undefined) dbUpdates.company_name = updates.companyName;
    if (updates.companyLogo !== undefined) dbUpdates.company_logo = updates.companyLogo;
    if (updates.recruiterId !== undefined) dbUpdates.recruiter_id = updates.recruiterId;
    if (updates.recruiterName !== undefined) dbUpdates.recruiter_name = updates.recruiterName;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    if (updates.categoryName !== undefined) dbUpdates.category_name = updates.categoryName;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.workplaceType !== undefined) dbUpdates.workplace_type = updates.workplaceType;
    if (updates.jobType !== undefined) dbUpdates.job_type = updates.jobType;
    if (updates.experienceLevel !== undefined) dbUpdates.experience_level = updates.experienceLevel;
    if (updates.salaryMin !== undefined) dbUpdates.salary_min = updates.salaryMin;
    if (updates.salaryMax !== undefined) dbUpdates.salary_max = updates.salaryMax;
    if (updates.salaryCurrency !== undefined) dbUpdates.salary_currency = updates.salaryCurrency;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.requirements !== undefined) dbUpdates.requirements_json = JSON.stringify(updates.requirements);
    if (updates.skills !== undefined) dbUpdates.skills_json = JSON.stringify(updates.skills);
    if (updates.benefits !== undefined) dbUpdates.benefits_json = JSON.stringify(updates.benefits);
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.isFeatured !== undefined) dbUpdates.is_featured = Boolean(updates.isFeatured);
    if (updates.applicantsCount !== undefined) dbUpdates.applicants_count = updates.applicantsCount;
    if (updates.viewsCount !== undefined) dbUpdates.views_count = updates.viewsCount;
    if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt ? new Date(updates.expiresAt) : null;

    if (Object.keys(dbUpdates).length > 0) {
      const count = await this.db('jobs').where('id', id).update(dbUpdates);
      if (count === 0) return undefined;
    }

    return this.getJobById(id);
  }

  async deleteJob(id: string): Promise<boolean> {
    const job = await this.getJobById(id);
    if (!job) return false;

    await this.db.transaction(async (trx) => {
      await trx('jobs').where('id', id).delete();
      await trx('job_categories')
        .where('id', job.categoryId)
        .andWhere('job_count', '>', 0)
        .decrement('job_count', 1);
    });

    return true;
  }

  async incrementJobViews(id: string): Promise<void> {
    await this.db('jobs').where('id', id).increment('views_count', 1);
  }

  // ==========================================
  // APPLICATIONS & ATS PIPELINE
  // ==========================================

  private mapApplicationRow(r: any): Application {
    return {
      id: r.id,
      jobId: r.job_id,
      jobTitle: r.job_title,
      companyName: r.company_name,
      candidateId: r.candidate_id,
      candidateName: r.candidate_name,
      candidateEmail: r.candidate_email,
      candidatePhone: r.candidate_phone || undefined,
      candidateAvatar: r.candidate_avatar || undefined,
      candidateTitle: r.candidate_title || undefined,
      resumeUrl: r.resume_url,
      coverLetter: r.cover_letter || undefined,
      stage: r.stage,
      matchScore: r.match_score,
      matchDetails: safeJsonParse(r.match_details_json, {
        score: r.match_score,
        matchedSkills: [],
        missingSkills: [],
        skillScore: 0,
        experienceScore: 0,
        analysisNotes: '',
      }),
      recruiterNotes: r.recruiter_notes || '',
      interviewDate: r.interview_date ? new Date(r.interview_date).toISOString() : undefined,
      interviewType: r.interview_type || undefined,
      timeline: safeJsonParse(r.timeline_json, []),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  async getApplications(): Promise<Application[]> {
    const rows = await this.db('applications').select('*').orderBy('created_at', 'desc');
    return rows.map((r) => this.mapApplicationRow(r));
  }

  async getApplicationById(id: string): Promise<Application | undefined> {
    const row = await this.db('applications').where('id', id).first();
    return row ? this.mapApplicationRow(row) : undefined;
  }

  async getApplicationsByCandidateId(candidateId: string): Promise<Application[]> {
    const rows = await this.db('applications')
      .where('candidate_id', candidateId)
      .orderBy('created_at', 'desc');
    return rows.map((r) => this.mapApplicationRow(r));
  }

  async getApplicationsByJobId(jobId: string): Promise<Application[]> {
    const rows = await this.db('applications')
      .where('job_id', jobId)
      .orderBy('match_score', 'desc');
    return rows.map((r) => this.mapApplicationRow(r));
  }

  async createApplication(app: Application): Promise<Application> {
    await this.db.transaction(async (trx) => {
      await trx('applications').insert({
        id: app.id,
        job_id: app.jobId,
        job_title: app.jobTitle,
        company_name: app.companyName,
        candidate_id: app.candidateId,
        candidate_name: app.candidateName,
        candidate_email: app.candidateEmail,
        candidate_phone: app.candidatePhone || null,
        candidate_avatar: app.candidateAvatar || null,
        candidate_title: app.candidateTitle || null,
        resume_url: app.resumeUrl,
        cover_letter: app.coverLetter || null,
        stage: app.stage || 'Applied',
        match_score: app.matchScore || 70,
        match_details_json: JSON.stringify(app.matchDetails || {}),
        recruiter_notes: app.recruiterNotes || null,
        interview_date: app.interviewDate ? new Date(app.interviewDate) : null,
        interview_type: app.interviewType || null,
        timeline_json: JSON.stringify(app.timeline || []),
        created_at: app.createdAt ? new Date(app.createdAt) : new Date(),
      });

      // Insert initial stage history audit record
      await trx('application_stage_history').insert({
        id: `hist-${uuidv4().substring(0, 8)}`,
        application_id: app.id,
        from_stage: null,
        to_stage: app.stage || 'Applied',
        changed_by_user_id: app.candidateId,
        changed_by_name: app.candidateName,
        comment: 'Candidate submitted online application via TalentHub portal.',
        interview_type: null,
        interview_date: null,
        created_at: new Date(),
      });

      // Increment job applicants count
      await trx('jobs').where('id', app.jobId).increment('applicants_count', 1);
    });

    const created = await this.getApplicationById(app.id);
    return created || app;
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application | undefined> {
    const existing = await this.getApplicationById(id);
    if (!existing) return undefined;

    await this.db.transaction(async (trx) => {
      const dbUpdates: any = {};
      if (updates.stage !== undefined) dbUpdates.stage = updates.stage;
      if (updates.matchScore !== undefined) dbUpdates.match_score = updates.matchScore;
      if (updates.matchDetails !== undefined) dbUpdates.match_details_json = JSON.stringify(updates.matchDetails);
      if (updates.recruiterNotes !== undefined) dbUpdates.recruiter_notes = updates.recruiterNotes;
      if (updates.interviewDate !== undefined) dbUpdates.interview_date = updates.interviewDate ? new Date(updates.interviewDate) : null;
      if (updates.interviewType !== undefined) dbUpdates.interview_type = updates.interviewType;
      if (updates.timeline !== undefined) dbUpdates.timeline_json = JSON.stringify(updates.timeline);

      if (Object.keys(dbUpdates).length > 0) {
        await trx('applications').where('id', id).update(dbUpdates);
      }

      // If stage transitioned, record in application_stage_history
      if (updates.stage && updates.stage !== existing.stage) {
        const latestTimeline = updates.timeline && updates.timeline.length > 0
          ? updates.timeline[updates.timeline.length - 1]
          : null;

        await trx('application_stage_history').insert({
          id: `hist-${uuidv4().substring(0, 8)}`,
          application_id: id,
          from_stage: existing.stage,
          to_stage: updates.stage,
          changed_by_user_id: latestTimeline?.changedBy || null,
          changed_by_name: latestTimeline?.changedByName || null,
          comment: latestTimeline?.comment || `Status moved to ${updates.stage}`,
          interview_type: updates.interviewType || existing.interviewType || null,
          interview_date: updates.interviewDate ? new Date(updates.interviewDate) : (existing.interviewDate ? new Date(existing.interviewDate) : null),
          created_at: new Date(),
        });
      }
    });

    return this.getApplicationById(id);
  }

  async getApplicationStageHistory(applicationId: string): Promise<any[]> {
    return this.db('application_stage_history')
      .where('application_id', applicationId)
      .orderBy('created_at', 'asc');
  }

  // ==========================================
  // REPORTED JOBS
  // ==========================================

  private mapReportRow(r: any): ReportedJob {
    return {
      id: r.id,
      jobId: r.job_id,
      jobTitle: r.job_title,
      companyName: r.company_name,
      reportedByUserId: r.reported_by_user_id,
      reportedByName: r.reported_by_name,
      reason: r.reason,
      details: r.details || '',
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async getReportedJobs(): Promise<ReportedJob[]> {
    const rows = await this.db('reported_jobs').select('*').orderBy('created_at', 'desc');
    return rows.map((r) => this.mapReportRow(r));
  }

  async createReportedJob(rep: ReportedJob): Promise<ReportedJob> {
    await this.db('reported_jobs').insert({
      id: rep.id,
      job_id: rep.jobId,
      job_title: rep.jobTitle,
      company_name: rep.companyName,
      reported_by_user_id: rep.reportedByUserId,
      reported_by_name: rep.reportedByName,
      reason: rep.reason,
      details: rep.details || null,
      status: rep.status || 'pending',
      created_at: rep.createdAt ? new Date(rep.createdAt) : new Date(),
    });
    return rep;
  }

  async updateReportedJob(id: string, status: 'pending' | 'resolved' | 'dismissed'): Promise<ReportedJob | undefined> {
    const count = await this.db('reported_jobs').where('id', id).update({ status });
    if (count === 0) return undefined;
    const row = await this.db('reported_jobs').where('id', id).first();
    return row ? this.mapReportRow(row) : undefined;
  }

  // ==========================================
  // JOB ALERTS
  // ==========================================

  private mapAlertRow(r: any): JobAlert {
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      keywords: r.keywords || '',
      category: r.category || 'all',
      location: r.location || '',
      jobType: r.job_type || 'all',
      frequency: r.frequency || 'daily',
      isActive: Boolean(r.is_active),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async getJobAlerts(userId?: string): Promise<JobAlert[]> {
    let query = this.db('job_alerts').select('*').orderBy('created_at', 'desc');
    if (userId) {
      query = query.where('user_id', userId);
    }
    const rows = await query;
    return rows.map((r) => this.mapAlertRow(r));
  }

  async createJobAlert(alert: JobAlert): Promise<JobAlert> {
    await this.db('job_alerts').insert({
      id: alert.id,
      user_id: alert.userId,
      title: alert.title,
      keywords: alert.keywords || null,
      category: alert.category || null,
      location: alert.location || null,
      job_type: alert.jobType || null,
      frequency: alert.frequency || 'daily',
      is_active: Boolean(alert.isActive),
      created_at: alert.createdAt ? new Date(alert.createdAt) : new Date(),
    });
    return alert;
  }

  async updateJobAlert(id: string, updates: Partial<JobAlert>): Promise<JobAlert | undefined> {
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.keywords !== undefined) dbUpdates.keywords = updates.keywords;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.jobType !== undefined) dbUpdates.job_type = updates.jobType;
    if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
    if (updates.isActive !== undefined) dbUpdates.is_active = Boolean(updates.isActive);

    if (Object.keys(dbUpdates).length > 0) {
      const count = await this.db('job_alerts').where('id', id).update(dbUpdates);
      if (count === 0) return undefined;
    }

    const row = await this.db('job_alerts').where('id', id).first();
    return row ? this.mapAlertRow(row) : undefined;
  }

  async deleteJobAlert(id: string): Promise<boolean> {
    const count = await this.db('job_alerts').where('id', id).delete();
    return count > 0;
  }

  // ==========================================
  // RESUME DOCUMENTS (Blob Storage versions)
  // ==========================================

  private mapResumeDocRow(r: any): ResumeDocument {
    return {
      id: r.id,
      candidateId: r.candidate_id,
      originalFilename: r.original_filename,
      blobName: r.blob_name,
      containerName: r.container_name,
      fileExtension: r.file_extension,
      mimeType: r.mime_type,
      fileSizeBytes: r.file_size_bytes,
      checksumSha256: r.checksum_sha256,
      uploadStatus: r.upload_status,
      isCurrent: Boolean(r.is_current),
      extractionStatus: r.extraction_status || 'completed',
      extractedData: safeJsonParse(r.extracted_data_json, undefined),
      extractionError: r.extraction_error || undefined,
      isVerified: Boolean(r.is_verified),
      verifiedById: r.verified_by_id || undefined,
      verifiedByName: r.verified_by_name || undefined,
      verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : undefined,
      uploadedAt: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : new Date().toISOString(),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async getCurrentResume(candidateId: string): Promise<ResumeDocument | undefined> {
    const row = await this.db('resume_documents')
      .where({ candidate_id: candidateId, is_current: true, upload_status: 'uploaded' })
      .orderBy('uploaded_at', 'desc')
      .first();
    return row ? this.mapResumeDocRow(row) : undefined;
  }

  async getResumeHistory(candidateId: string): Promise<ResumeDocument[]> {
    const rows = await this.db('resume_documents')
      .where({ candidate_id: candidateId })
      .whereNot({ upload_status: 'failed' })
      .orderBy('uploaded_at', 'desc');
    return rows.map((r: any) => this.mapResumeDocRow(r));
  }

  async getResumeDocById(id: string): Promise<ResumeDocument | undefined> {
    const row = await this.db('resume_documents').where('id', id).first();
    return row ? this.mapResumeDocRow(row) : undefined;
  }

  /**
   * Saves a new resume document record and marks all previous ones for this
   * candidate as is_current=false. Runs in a transaction.
   * Also back-fills candidates.resume_url and candidates.resume_original_name
   * for backward compatibility with application.resume_url references.
   */
  async createResumeDocument(doc: ResumeDocument): Promise<ResumeDocument> {
    await this.db.transaction(async (trx) => {
      // Unset current flag on all previous resumes for this candidate
      await trx('resume_documents')
        .where({ candidate_id: doc.candidateId, is_current: true })
        .update({ is_current: false });

      const insertData: any = {
        id: doc.id,
        candidate_id: doc.candidateId,
        original_filename: doc.originalFilename,
        blob_name: doc.blobName,
        container_name: doc.containerName,
        file_extension: doc.fileExtension,
        mime_type: doc.mimeType,
        file_size_bytes: doc.fileSizeBytes,
        checksum_sha256: doc.checksumSha256,
        upload_status: doc.uploadStatus || 'uploaded',
        is_current: true,
        uploaded_at: new Date(),
        created_at: new Date(),
      };

      if (doc.extractionStatus) insertData.extraction_status = doc.extractionStatus;
      if (doc.extractedData) insertData.extracted_data_json = JSON.stringify(doc.extractedData);
      if (doc.extractionError) insertData.extraction_error = doc.extractionError;
      if (doc.isVerified !== undefined) insertData.is_verified = doc.isVerified;

      await trx('resume_documents').insert(insertData);

      // Back-fill legacy columns for backward-compat
      await trx('candidates')
        .where('user_id', doc.candidateId)
        .update({
          resume_url: `blob://${doc.containerName}/${doc.blobName}`,
          resume_original_name: doc.originalFilename,
        });
    });

    const created = await this.getResumeDocById(doc.id);
    return created || doc;
  }

  async updateResumeExtraction(
    docId: string,
    status: ExtractionStatus,
    extractedData?: ExtractedCandidateProfile,
    error?: string
  ): Promise<void> {
    const updatePayload: any = {
      extraction_status: status,
      extraction_error: error || null,
    };
    if (extractedData) {
      updatePayload.extracted_data_json = JSON.stringify(extractedData);
    }
    await this.db('resume_documents').where('id', docId).update(updatePayload);
  }

  async updateResumeExtractedData(
    docId: string,
    extractedData: ExtractedCandidateProfile
  ): Promise<void> {
    await this.db('resume_documents').where('id', docId).update({
      extracted_data_json: JSON.stringify(extractedData),
    });
  }

  async verifyResumeExtraction(
    docId: string,
    candidateId: string,
    recruiterId: string,
    recruiterName: string,
    verifiedData: ExtractedCandidateProfile,
    overwriteCandidateProfile: boolean = true
  ): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (trx) => {
      // Mark resume doc as verified
      await trx('resume_documents').where('id', docId).update({
        is_verified: true,
        verified_by_id: recruiterId,
        verified_by_name: recruiterName,
        verified_at: now,
        extracted_data_json: JSON.stringify(verifiedData),
      });

      if (overwriteCandidateProfile) {
        // Map extracted details to candidate fields
        const candidateUpdates: any = {
          title: verifiedData.experience?.[0]?.title || undefined,
          location: verifiedData.location || undefined,
          phone: verifiedData.phone || undefined,
          bio: verifiedData.summary || undefined,
          skills_json: JSON.stringify(verifiedData.skills || []),
          experience_json: JSON.stringify(
            (verifiedData.experience || []).map((exp) => ({
              title: exp.title,
              company: exp.company,
              period: exp.duration,
              description: exp.description || '',
            }))
          ),
          education_json: JSON.stringify(
            (verifiedData.education || []).map((edu) => ({
              degree: edu.degree,
              school: edu.institution,
              year: edu.year,
            }))
          ),
        };
        // Clean undefined
        Object.keys(candidateUpdates).forEach(
          (k) => candidateUpdates[k] === undefined && delete candidateUpdates[k]
        );

        await trx('candidates').where('user_id', candidateId).update(candidateUpdates);
      }
    });
  }

  async markResumeDeleted(id: string): Promise<void> {
    await this.db('resume_documents').where('id', id).update({ upload_status: 'deleted', is_current: false });
  }

  // ==========================================
  // MATCH RESULTS
  // ==========================================

  /**
   * Inserts a new match_result row for the given application, atomically
   * demoting any previous is_latest=1 row to is_latest=0.
   *
   * Concurrency design (MySQL 8, InnoDB):
   *   1. `SELECT … FOR UPDATE` on the applications row acquires an exclusive
   *      row lock for the duration of the transaction.  Concurrent calls for
   *      the same application_id block until the lock is released, so they
   *      cannot both see is_latest=1 as the "current" row and produce two
   *      latest rows.
   *   2. The UPDATE demotes existing latest rows inside the same transaction
   *      (safe: we are not inside a trigger — this is plain application code).
   *   3. The INSERT adds the new row with is_latest=1.
   *   4. The DB-level UNIQUE KEY uq_mr_one_latest_per_app (latest_guard)
   *      is a final safety net that rejects any out-of-band write that would
   *      create a second is_latest=1 row for the same application.
   *
   * Never call this method from inside a trigger or stored function — MySQL
   * would raise ER_CANT_UPDATE_USED_TABLE_IN_SF_OR_TRG.  Always call it from
   * application code.
   */
  async createMatchResult(result: MatchResult): Promise<MatchResult> {
    await this.db.transaction(async (trx) => {
      // Step 1 — Acquire an exclusive row lock on the applications row.
      // This serialises concurrent recalculations for the same application.
      const appRow = await trx.raw(
        'SELECT id FROM applications WHERE id = ? FOR UPDATE',
        [result.applicationId]
      );
      const rows = appRow[0] as Array<{ id: string }>;
      if (rows.length === 0) {
        throw new Error(
          `[createMatchResult] Application not found: ${result.applicationId}`
        );
      }

      // Step 2 — Demote any existing latest row to historical.
      await trx('match_results')
        .where({ application_id: result.applicationId, is_latest: 1 })
        .update({ is_latest: 0 });

      // Step 3 — Insert the new latest result.
      await trx('match_results').insert({
        id:                result.id,
        application_id:    result.applicationId,
        candidate_id:      result.candidateId,
        job_id:            result.jobId,
        is_latest:         1,
        overall_score:     result.overallScore,
        skill_score:       result.skillScore,
        experience_score:  result.experienceScore,
        education_score:   result.educationScore,
        matched_skills:    result.matchedSkills   ? JSON.stringify(result.matchedSkills)   : null,
        missing_skills:    result.missingSkills   ? JSON.stringify(result.missingSkills)   : null,
        analysis_notes:    result.analysisNotes   ?? null,
        recruiter_override: result.recruiterOverride ?? null,
        override_by_id:    result.overrideById    ?? null,
        override_reason:   result.overrideReason  ?? null,
        computed_at:       result.computedAt ? new Date(result.computedAt) : new Date(),
        created_at:        result.createdAt  ? new Date(result.createdAt)  : new Date(),
      });
    });

    const row = await this.db('match_results').where('id', result.id).first();
    if (!row) return result;
    return {
      id:               row.id,
      applicationId:    row.application_id,
      candidateId:      row.candidate_id,
      jobId:            row.job_id,
      isLatest:         Boolean(row.is_latest),
      overallScore:     row.overall_score,
      skillScore:       row.skill_score,
      experienceScore:  row.experience_score,
      educationScore:   row.education_score,
      matchedSkills:    row.matched_skills  ? JSON.parse(row.matched_skills)  : undefined,
      missingSkills:    row.missing_skills  ? JSON.parse(row.missing_skills)  : undefined,
      analysisNotes:    row.analysis_notes  ?? undefined,
      recruiterOverride: row.recruiter_override ?? undefined,
      overrideById:     row.override_by_id  ?? undefined,
      overrideReason:   row.override_reason ?? undefined,
      computedAt:       row.computed_at  ? new Date(row.computed_at).toISOString()  : new Date().toISOString(),
      createdAt:        row.created_at   ? new Date(row.created_at).toISOString()   : new Date().toISOString(),
    };
  }

  /** Returns the latest match result for an application, or undefined. */
  async getLatestMatchResult(applicationId: string): Promise<MatchResult | undefined> {
    const row = await this.db('match_results')
      .where({ application_id: applicationId, is_latest: 1 })
      .first();
    if (!row) return undefined;
    return {
      id:               row.id,
      applicationId:    row.application_id,
      candidateId:      row.candidate_id,
      jobId:            row.job_id,
      isLatest:         Boolean(row.is_latest),
      overallScore:     row.overall_score,
      skillScore:       row.skill_score,
      experienceScore:  row.experience_score,
      educationScore:   row.education_score,
      matchedSkills:    row.matched_skills  ? JSON.parse(row.matched_skills)  : undefined,
      missingSkills:    row.missing_skills  ? JSON.parse(row.missing_skills)  : undefined,
      analysisNotes:    row.analysis_notes  ?? undefined,
      recruiterOverride: row.recruiter_override ?? undefined,
      overrideById:     row.override_by_id  ?? undefined,
      overrideReason:   row.override_reason ?? undefined,
      computedAt:       row.computed_at  ? new Date(row.computed_at).toISOString()  : new Date().toISOString(),
      createdAt:        row.created_at   ? new Date(row.created_at).toISOString()   : new Date().toISOString(),
    };
  }

  /** Returns all match results (history) for an application, newest first. */
  async getMatchResultHistory(applicationId: string): Promise<MatchResult[]> {
    const rows = await this.db('match_results')
      .where({ application_id: applicationId })
      .orderBy('created_at', 'desc');
    return rows.map((row: any) => ({
      id:               row.id,
      applicationId:    row.application_id,
      candidateId:      row.candidate_id,
      jobId:            row.job_id,
      isLatest:         Boolean(row.is_latest),
      overallScore:     row.overall_score,
      skillScore:       row.skill_score,
      experienceScore:  row.experience_score,
      educationScore:   row.education_score,
      matchedSkills:    row.matched_skills  ? JSON.parse(row.matched_skills)  : undefined,
      missingSkills:    row.missing_skills  ? JSON.parse(row.missing_skills)  : undefined,
      analysisNotes:    row.analysis_notes  ?? undefined,
      recruiterOverride: row.recruiter_override ?? undefined,
      overrideById:     row.override_by_id  ?? undefined,
      overrideReason:   row.override_reason ?? undefined,
      computedAt:       row.computed_at  ? new Date(row.computed_at).toISOString()  : new Date().toISOString(),
      createdAt:        row.created_at   ? new Date(row.created_at).toISOString()   : new Date().toISOString(),
    }));
  }
}
