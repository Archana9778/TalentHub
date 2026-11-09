import { v4 as uuidv4 } from 'uuid';
import { mysqlDb } from './mysql';
import {
  User,
  Company,
  JobCategory,
  Job,
  Application,
  ReportedJob,
  JobAlert,
} from '../types';

export class MySqlRepository {
  private get pool() {
    return mysqlDb.getPool();
  }

  // --- Users ---
  async getUsers(): Promise<User[]> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(this.mapUser);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM users WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    return rows.length > 0 ? this.mapUser(rows[0]) : undefined;
  }

  async createUser(user: User): Promise<User> {
    await this.pool.query(
      `INSERT INTO users (
        id, email, password_hash, name, role, status, title, location, phone,
        avatar_url, bio, company_id, company_name, resume_url, resume_original_name, skills_json,
        experience_json, education_json, parsed_resume_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email,
        user.password || '',
        user.name,
        user.role,
        user.status,
        user.title || null,
        user.location || null,
        user.phone || null,
        user.avatarUrl || null,
        user.bio || null,
        user.companyId || null,
        user.companyName || null,
        user.resumeUrl || null,
        user.resumeOriginalName || null,
        user.skills ? JSON.stringify(user.skills) : JSON.stringify([]),
        JSON.stringify(user.experience || []),
        JSON.stringify(user.education || []),
        user.parsedResumeData ? JSON.stringify(user.parsedResumeData) : null,
      ]
    );
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const current = await this.getUserById(id);
    if (!current) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.password !== undefined) { fields.push('password_hash = ?'); values.push(updates.password); }
    if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.location !== undefined) { fields.push('location = ?'); values.push(updates.location); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.avatarUrl !== undefined) { fields.push('avatar_url = ?'); values.push(updates.avatarUrl); }
    if (updates.bio !== undefined) { fields.push('bio = ?'); values.push(updates.bio); }
    if (updates.companyId !== undefined) { fields.push('company_id = ?'); values.push(updates.companyId); }
    if (updates.companyName !== undefined) { fields.push('company_name = ?'); values.push(updates.companyName); }
    if (updates.resumeUrl !== undefined) { fields.push('resume_url = ?'); values.push(updates.resumeUrl); }
    if (updates.resumeOriginalName !== undefined) { fields.push('resume_original_name = ?'); values.push(updates.resumeOriginalName); }
    if (updates.skills !== undefined) { fields.push('skills_json = ?'); values.push(JSON.stringify(updates.skills)); }
    if (updates.experience !== undefined) { fields.push('experience_json = ?'); values.push(JSON.stringify(updates.experience)); }
    if (updates.education !== undefined) { fields.push('education_json = ?'); values.push(JSON.stringify(updates.education)); }
    if (updates.parsedResumeData !== undefined) { fields.push('parsed_resume_data_json = ?'); values.push(JSON.stringify(updates.parsedResumeData)); }

    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    return this.getUserById(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const [result] = await this.pool.query<any>('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // --- Companies ---
  async getCompanies(): Promise<Company[]> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM companies ORDER BY created_at DESC');
    return rows.map(this.mapCompany);
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM companies WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapCompany(rows[0]) : undefined;
  }

  async createCompany(company: Company): Promise<Company> {
    await this.pool.query(
      `INSERT INTO companies (id, name, description, logo, website, location, industry, company_size, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company.id,
        company.name,
        company.description || null,
        company.logo || null,
        company.website || null,
        company.location || null,
        company.industry || null,
        company.size || null,
        company.verified ? 1 : 0,
      ]
    );
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const current = await this.getCompanyById(id);
    if (!current) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.logo !== undefined) { fields.push('logo = ?'); values.push(updates.logo); }
    if (updates.website !== undefined) { fields.push('website = ?'); values.push(updates.website); }
    if (updates.location !== undefined) { fields.push('location = ?'); values.push(updates.location); }
    if (updates.industry !== undefined) { fields.push('industry = ?'); values.push(updates.industry); }
    if (updates.size !== undefined) { fields.push('company_size = ?'); values.push(updates.size); }
    if (updates.verified !== undefined) { fields.push('verified = ?'); values.push(updates.verified ? 1 : 0); }

    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    return this.getCompanyById(id);
  }

  async deleteCompany(id: string): Promise<boolean> {
    const [result] = await this.pool.query<any>('DELETE FROM companies WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // --- Categories ---
  async getCategories(): Promise<JobCategory[]> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM job_categories ORDER BY name ASC');
    return rows.map(this.mapCategory);
  }

  async getCategoryById(id: string): Promise<JobCategory | undefined> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM job_categories WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapCategory(rows[0]) : undefined;
  }

  async createCategory(category: JobCategory): Promise<JobCategory> {
    await this.pool.query(
      `INSERT INTO job_categories (id, name, description, icon, job_count) VALUES (?, ?, ?, ?, ?)`,
      [category.id, category.name, category.description || null, category.icon || 'Briefcase', category.jobCount || 0]
    );
    return category;
  }

  async updateCategory(id: string, updates: Partial<JobCategory>): Promise<JobCategory | undefined> {
    const current = await this.getCategoryById(id);
    if (!current) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
    if (updates.jobCount !== undefined) { fields.push('job_count = ?'); values.push(updates.jobCount); }

    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE job_categories SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    return this.getCategoryById(id);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const [result] = await this.pool.query<any>('DELETE FROM job_categories WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // --- Jobs ---
  async getJobs(): Promise<Job[]> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM jobs ORDER BY created_at DESC');
    return rows.map(this.mapJob);
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM jobs WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapJob(rows[0]) : undefined;
  }

  async createJob(job: Job): Promise<Job> {
    await this.pool.query(
      `INSERT INTO jobs (
        id, title, company_id, company_name, company_logo, recruiter_id, recruiter_name,
        category_id, category_name, location, workplace_type, job_type, experience_level,
        salary_min, salary_max, salary_currency, description, requirements_json, skills_json,
        benefits_json, status, is_featured, applicants_count, views_count, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.title,
        job.companyId,
        job.companyName,
        job.companyLogo || null,
        job.recruiterId,
        job.recruiterName,
        job.categoryId,
        job.categoryName,
        job.location,
        job.workplaceType,
        job.jobType,
        job.experienceLevel,
        job.salaryMin,
        job.salaryMax,
        job.salaryCurrency || 'USD',
        job.description,
        job.requirements ? JSON.stringify(job.requirements) : JSON.stringify([]),
        job.skills ? JSON.stringify(job.skills) : JSON.stringify([]),
        job.benefits ? JSON.stringify(job.benefits) : JSON.stringify([]),
        job.status,
        job.isFeatured ? 1 : 0,
        job.applicantsCount || 0,
        job.viewsCount || 0,
        job.expiresAt ? new Date(job.expiresAt) : null,
      ]
    );

    // Increment category job count
    await this.pool.query('UPDATE job_categories SET job_count = job_count + 1 WHERE id = ?', [job.categoryId]);
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const current = await this.getJobById(id);
    if (!current) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.companyId !== undefined) { fields.push('company_id = ?'); values.push(updates.companyId); }
    if (updates.companyName !== undefined) { fields.push('company_name = ?'); values.push(updates.companyName); }
    if (updates.companyLogo !== undefined) { fields.push('company_logo = ?'); values.push(updates.companyLogo); }
    if (updates.categoryId !== undefined) { fields.push('category_id = ?'); values.push(updates.categoryId); }
    if (updates.categoryName !== undefined) { fields.push('category_name = ?'); values.push(updates.categoryName); }
    if (updates.location !== undefined) { fields.push('location = ?'); values.push(updates.location); }
    if (updates.workplaceType !== undefined) { fields.push('workplace_type = ?'); values.push(updates.workplaceType); }
    if (updates.jobType !== undefined) { fields.push('job_type = ?'); values.push(updates.jobType); }
    if (updates.experienceLevel !== undefined) { fields.push('experience_level = ?'); values.push(updates.experienceLevel); }
    if (updates.salaryMin !== undefined) { fields.push('salary_min = ?'); values.push(updates.salaryMin); }
    if (updates.salaryMax !== undefined) { fields.push('salary_max = ?'); values.push(updates.salaryMax); }
    if (updates.salaryCurrency !== undefined) { fields.push('salary_currency = ?'); values.push(updates.salaryCurrency); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.requirements !== undefined) { fields.push('requirements_json = ?'); values.push(JSON.stringify(updates.requirements)); }
    if (updates.skills !== undefined) { fields.push('skills_json = ?'); values.push(JSON.stringify(updates.skills)); }
    if (updates.benefits !== undefined) { fields.push('benefits_json = ?'); values.push(JSON.stringify(updates.benefits)); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.isFeatured !== undefined) { fields.push('is_featured = ?'); values.push(updates.isFeatured ? 1 : 0); }
    if (updates.applicantsCount !== undefined) { fields.push('applicants_count = ?'); values.push(updates.applicantsCount); }
    if (updates.viewsCount !== undefined) { fields.push('views_count = ?'); values.push(updates.viewsCount); }

    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    return this.getJobById(id);
  }

  async deleteJob(id: string): Promise<boolean> {
    const job = await this.getJobById(id);
    if (!job) return false;

    const [result] = await this.pool.query<any>('DELETE FROM jobs WHERE id = ?', [id]);
    if (result.affectedRows > 0) {
      await this.pool.query('UPDATE job_categories SET job_count = GREATEST(0, job_count - 1) WHERE id = ?', [job.categoryId]);
      return true;
    }
    return false;
  }

  async incrementJobViews(id: string): Promise<void> {
    await this.pool.query('UPDATE jobs SET views_count = views_count + 1 WHERE id = ?', [id]);
  }

  // --- Applications ---
  async getApplications(): Promise<Application[]> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM applications ORDER BY created_at DESC');
    return rows.map(this.mapApplication);
  }

  async getApplicationById(id: string): Promise<Application | undefined> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM applications WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapApplication(rows[0]) : undefined;
  }

  async getApplicationsByCandidateId(candidateId: string): Promise<Application[]> {
    const [rows] = await this.pool.query<any[]>(
      'SELECT * FROM applications WHERE candidate_id = ? ORDER BY created_at DESC',
      [candidateId]
    );
    return rows.map(this.mapApplication);
  }

  async getApplicationsByJobId(jobId: string): Promise<Application[]> {
    const [rows] = await this.pool.query<any[]>(
      'SELECT * FROM applications WHERE job_id = ? ORDER BY created_at DESC',
      [jobId]
    );
    return rows.map(this.mapApplication);
  }

  async createApplication(app: Application): Promise<Application> {
    await this.pool.query(
      `INSERT INTO applications (
        id, job_id, job_title, company_name, candidate_id, candidate_name, candidate_email,
        candidate_phone, candidate_avatar, candidate_title, resume_url, cover_letter, stage,
        match_score, match_details_json, recruiter_notes, interview_date, interview_type, timeline_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        app.id,
        app.jobId,
        app.jobTitle,
        app.companyName,
        app.candidateId,
        app.candidateName,
        app.candidateEmail,
        app.candidatePhone || null,
        app.candidateAvatar || null,
        app.candidateTitle || null,
        app.resumeUrl,
        app.coverLetter || '',
        app.stage,
        app.matchScore,
        JSON.stringify(app.matchDetails),
        app.recruiterNotes || '',
        app.interviewDate ? new Date(app.interviewDate) : null,
        app.interviewType || null,
        JSON.stringify(app.timeline || []),
      ]
    );

    // Increment applicants_count on job
    await this.pool.query('UPDATE jobs SET applicants_count = applicants_count + 1 WHERE id = ?', [app.jobId]);

    // Record initial audit entry into application_stage_history
    try {
      await this.pool.query(
        `INSERT INTO application_stage_history (
          id, application_id, from_stage, to_stage, changed_by_user_id, changed_by_name, comment
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `hist-${uuidv4().substring(0, 8)}`,
          app.id,
          null,
          app.stage,
          app.candidateId,
          app.candidateName,
          'Candidate submitted initial application.',
        ]
      );
    } catch (histErr) {
      console.warn('[TalentHub MySQL] Non-critical warning recording initial stage history:', histErr);
    }

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
    const current = await this.getApplicationById(id);
    if (!current) return undefined;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.stage !== undefined) { fields.push('stage = ?'); values.push(updates.stage); }
    if (updates.recruiterNotes !== undefined) { fields.push('recruiter_notes = ?'); values.push(updates.recruiterNotes); }
    if (updates.interviewDate !== undefined) { fields.push('interview_date = ?'); values.push(updates.interviewDate ? new Date(updates.interviewDate) : null); }
    if (updates.interviewType !== undefined) { fields.push('interview_type = ?'); values.push(updates.interviewType); }
    if (updates.timeline !== undefined) { fields.push('timeline_json = ?'); values.push(JSON.stringify(updates.timeline)); }

    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE applications SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Insert into application_stage_history if stage transition provided
    if (stageAudit && stageAudit.toStage) {
      try {
        await this.pool.query(
          `INSERT INTO application_stage_history (
            id, application_id, from_stage, to_stage, changed_by_user_id, changed_by_name, comment, interview_type, interview_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `hist-${uuidv4().substring(0, 8)}`,
            id,
            stageAudit.fromStage || current.stage,
            stageAudit.toStage,
            stageAudit.changedByUserId || null,
            stageAudit.changedByName || null,
            stageAudit.comment || null,
            stageAudit.interviewType || null,
            stageAudit.interviewDate ? new Date(stageAudit.interviewDate) : null,
          ]
        );
      } catch (histErr) {
        console.warn('[TalentHub MySQL] Warning inserting audit stage history:', histErr);
      }
    }

    return this.getApplicationById(id);
  }

  async getApplicationStageHistory(applicationId: string): Promise<any[]> {
    try {
      const [rows] = await this.pool.query<any[]>(
        'SELECT * FROM application_stage_history WHERE application_id = ? ORDER BY created_at ASC',
        [applicationId]
      );
      return rows.map((r: any) => ({
        id: r.id,
        applicationId: r.application_id,
        fromStage: r.from_stage,
        toStage: r.to_stage,
        changedByUserId: r.changed_by_user_id,
        changedByName: r.changed_by_name,
        comment: r.comment,
        interviewType: r.interview_type,
        interviewDate: r.interview_date ? new Date(r.interview_date).toISOString() : null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));
    } catch {
      return [];
    }
  }

  // --- Reported Jobs ---
  async getReportedJobs(): Promise<ReportedJob[]> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM reported_jobs ORDER BY created_at DESC');
    return rows.map(this.mapReportedJob);
  }

  async createReportedJob(rep: ReportedJob): Promise<ReportedJob> {
    await this.pool.query(
      `INSERT INTO reported_jobs (id, job_id, job_title, company_name, reported_by_user_id, reported_by_name, reason, details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rep.id,
        rep.jobId,
        rep.jobTitle,
        rep.companyName,
        rep.reportedByUserId,
        rep.reportedByName,
        rep.reason,
        rep.details || null,
        rep.status || 'pending',
      ]
    );
    return rep;
  }

  async updateReportedJob(id: string, status: 'pending' | 'resolved' | 'dismissed'): Promise<ReportedJob | undefined> {
    await this.pool.query('UPDATE reported_jobs SET status = ? WHERE id = ?', [status, id]);
    const [rows] = await this.pool.query<any[]>('SELECT * FROM reported_jobs WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapReportedJob(rows[0]) : undefined;
  }

  // --- Job Alerts ---
  async getJobAlerts(userId?: string): Promise<JobAlert[]> {
    let sql = 'SELECT * FROM job_alerts';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await this.pool.query<any[]>(sql, params);
    return rows.map(this.mapJobAlert);
  }

  async createJobAlert(alert: JobAlert): Promise<JobAlert> {
    await this.pool.query(
      `INSERT INTO job_alerts (id, user_id, title, keywords, category, location, job_type, frequency, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.userId,
        alert.title,
        alert.keywords || null,
        alert.category || 'all',
        alert.location || null,
        alert.jobType || 'all',
        alert.frequency || 'daily',
        alert.isActive ? 1 : 0,
      ]
    );
    return alert;
  }

  async updateJobAlert(id: string, userId: string, updates: Partial<JobAlert>): Promise<JobAlert | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.keywords !== undefined) { fields.push('keywords = ?'); values.push(updates.keywords); }
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
    if (updates.location !== undefined) { fields.push('location = ?'); values.push(updates.location); }
    if (updates.jobType !== undefined) { fields.push('job_type = ?'); values.push(updates.jobType); }
    if (updates.frequency !== undefined) { fields.push('frequency = ?'); values.push(updates.frequency); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

    if (fields.length > 0) {
      values.push(id, userId);
      await this.pool.query(`UPDATE job_alerts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
    }

    const [rows] = await this.pool.query<any[]>('SELECT * FROM job_alerts WHERE id = ? AND user_id = ?', [id, userId]);
    return rows.length > 0 ? this.mapJobAlert(rows[0]) : undefined;
  }

  async deleteJobAlert(id: string, userId: string): Promise<boolean> {
    const [result] = await this.pool.query<any>('DELETE FROM job_alerts WHERE id = ? AND user_id = ?', [id, userId]);
    return result.affectedRows > 0;
  }

  // --- Mappers ---
  private parseJson<T>(value: any, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
      try { return JSON.parse(value) as T; } catch { return fallback; }
    }
    return fallback;
  }

  private mapUser(row: any): User {
    let skills: string[] = [];
    if (Array.isArray(row.skills_json)) {
      skills = row.skills_json;
    } else if (typeof row.skills_json === 'string') {
      try { skills = JSON.parse(row.skills_json); } catch { skills = []; }
    }

    return {
      id: row.id,
      email: row.email,
      password: row.password_hash,
      name: row.name,
      role: row.role,
      status: row.status,
      title: row.title || undefined,
      location: row.location || undefined,
      phone: row.phone || undefined,
      avatarUrl: row.avatar_url || undefined,
      bio: row.bio || undefined,
      companyId: row.company_id || undefined,
      companyName: row.company_name || undefined,
      resumeUrl: row.resume_url || undefined,
      resumeOriginalName: row.resume_original_name || undefined,
      skills,
      experience: this.parseJson(row.experience_json, []),
      education: this.parseJson(row.education_json, []),
      parsedResumeData: this.parseJson(row.parsed_resume_data_json, undefined),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapCompany(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      logo: row.logo || '',
      website: row.website || '',
      location: row.location || '',
      industry: row.industry || '',
      size: row.company_size || '',
      verified: Boolean(row.verified),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapCategory(row: any): JobCategory {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      icon: row.icon || 'Briefcase',
      jobCount: Number(row.job_count || 0),
    };
  }

  private mapJob(row: any): Job {
    const parseJson = (val: any) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return []; }
      }
      return [];
    };

    return {
      id: row.id,
      title: row.title,
      companyId: row.company_id,
      companyName: row.company_name,
      companyLogo: row.company_logo || undefined,
      recruiterId: row.recruiter_id,
      recruiterName: row.recruiter_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      location: row.location,
      workplaceType: row.workplace_type,
      jobType: row.job_type,
      experienceLevel: row.experience_level,
      salaryMin: Number(row.salary_min),
      salaryMax: Number(row.salary_max),
      salaryCurrency: row.salary_currency || 'USD',
      description: row.description,
      requirements: parseJson(row.requirements_json),
      skills: parseJson(row.skills_json),
      benefits: parseJson(row.benefits_json),
      status: row.status,
      isFeatured: Boolean(row.is_featured),
      applicantsCount: Number(row.applicants_count || 0),
      viewsCount: Number(row.views_count || 0),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapApplication(row: any): Application {
    const parseJson = (val: any, fallback: any) => {
      if (typeof val === 'object' && val !== null) return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return fallback; }
      }
      return fallback;
    };

    return {
      id: row.id,
      jobId: row.job_id,
      jobTitle: row.job_title,
      companyName: row.company_name,
      candidateId: row.candidate_id,
      candidateName: row.candidate_name,
      candidateEmail: row.candidate_email,
      candidatePhone: row.candidate_phone || undefined,
      candidateAvatar: row.candidate_avatar || undefined,
      candidateTitle: row.candidate_title || undefined,
      resumeUrl: row.resume_url,
      coverLetter: row.cover_letter || '',
      stage: row.stage,
      matchScore: Number(row.match_score || 70),
      matchDetails: parseJson(row.match_details_json, {
        score: row.match_score || 70,
        matchedSkills: [],
        missingSkills: [],
        skillScore: 70,
        experienceScore: 70,
        analysisNotes: 'Candidate profile processed',
      }),
      recruiterNotes: row.recruiter_notes || '',
      interviewDate: row.interview_date ? new Date(row.interview_date).toISOString() : undefined,
      interviewType: row.interview_type || undefined,
      timeline: parseJson(row.timeline_json, []),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapReportedJob(row: any): ReportedJob {
    return {
      id: row.id,
      jobId: row.job_id,
      jobTitle: row.job_title,
      companyName: row.company_name,
      reportedByUserId: row.reported_by_user_id,
      reportedByName: row.reported_by_name,
      reason: row.reason,
      details: row.details || '',
      status: row.status,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapJobAlert(row: any): JobAlert {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      keywords: row.keywords || '',
      category: row.category || 'all',
      location: row.location || '',
      jobType: row.job_type || 'all',
      frequency: row.frequency || 'daily',
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const mysqlRepository = new MySqlRepository();

