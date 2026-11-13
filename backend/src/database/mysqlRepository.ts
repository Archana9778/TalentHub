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
  PasswordResetToken,
  RevokedToken,
  ResumeDocument,
  ExtractionStatus,
  ExtractedCandidateProfile,
} from '../types';

export class MySqlRepository {
  private get pool() {
    return mysqlDb.getPool();
  }

  constructor() {
    this.mapUser = this.mapUser.bind(this);
    this.mapCompany = this.mapCompany.bind(this);
    this.mapCategory = this.mapCategory.bind(this);
    this.mapJob = this.mapJob.bind(this);
    this.mapApplication = this.mapApplication.bind(this);
    this.mapReportedJob = this.mapReportedJob.bind(this);
    this.mapJobAlert = this.mapJobAlert.bind(this);
    this.parseJson = this.parseJson.bind(this);
  }

  // --- Users & Profiles ---
  private get userSelectSql(): string {
    return `
      SELECT
        u.id, u.email, u.password_hash, u.name, u.role, u.status, u.avatar_url,
        u.parsed_resume_data_json, u.token_version, u.last_login_at, u.password_changed_at,
        u.created_at, u.updated_at,
        c.title as candidate_title, c.location as candidate_location, c.phone as candidate_phone,
        c.bio as candidate_bio, c.date_of_birth, c.gender, c.resume_url, c.resume_original_name, c.skills_json,
        c.experience_json, c.education_json,
        r.title as recruiter_title, r.location as recruiter_location, r.phone as recruiter_phone,
        r.bio as recruiter_bio, r.company_id, r.company_name
      FROM users u
      LEFT JOIN candidates c ON u.id = c.user_id
      LEFT JOIN recruiters r ON u.id = r.user_id
    `;
  }

  async getUsers(): Promise<User[]> {
    const [rows] = await this.pool.query<any[]>(`${this.userSelectSql} ORDER BY u.created_at DESC`);
    return rows.map((r) => this.mapUser(r));
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [rows] = await this.pool.query<any[]>(`${this.userSelectSql} WHERE u.id = ?`, [id]);
    return rows.length > 0 ? this.mapUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [rows] = await this.pool.query<any[]>(`${this.userSelectSql} WHERE LOWER(u.email) = LOWER(?)`, [email.trim()]);
    return rows.length > 0 ? this.mapUser(rows[0]) : undefined;
  }

  async createUser(user: User): Promise<User> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO users (
          id, email, password_hash, name, role, status, avatar_url,
          parsed_resume_data_json, token_version, last_login_at, password_changed_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          user.id,
          user.email.trim().toLowerCase(),
          user.password || '',
          user.name,
          user.role,
          user.status || 'active',
          user.avatarUrl || null,
          user.parsedResumeData ? JSON.stringify(user.parsedResumeData) : null,
          user.tokenVersion || 1,
          user.lastLoginAt ? new Date(user.lastLoginAt) : null,
          user.passwordChangedAt ? new Date(user.passwordChangedAt) : null,
        ]
      );

      if (user.role === 'candidate') {
        await conn.query(
          `INSERT INTO candidates (
            id, user_id, title, location, phone, bio, date_of_birth, gender, resume_url, resume_original_name,
            skills_json, experience_json, education_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            user.id,
            user.id,
            user.title || null,
            user.location || null,
            user.phone || null,
            user.bio || null,
            user.dateOfBirth ? user.dateOfBirth : null,
            user.gender || null,
            user.resumeUrl || null,
            user.resumeOriginalName || null,
            user.skills ? JSON.stringify(user.skills) : JSON.stringify([]),
            JSON.stringify(user.experience || []),
            JSON.stringify(user.education || []),
          ]
        );
      } else if (user.role === 'recruiter') {
        await conn.query(
          `INSERT INTO recruiters (
            id, user_id, company_id, company_name, title, location, phone, bio,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            user.id,
            user.id,
            user.companyId || null,
            user.companyName || null,
            user.title || null,
            user.location || null,
            user.phone || null,
            user.bio || null,
          ]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const created = await this.getUserById(user.id);
    return created || user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const current = await this.getUserById(id);
    if (!current) return undefined;

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Account updates on `users` table
      const userFields: string[] = [];
      const userValues: any[] = [];

      if (updates.name !== undefined) { userFields.push('name = ?'); userValues.push(updates.name); }
      if (updates.email !== undefined) { userFields.push('email = ?'); userValues.push(updates.email.trim().toLowerCase()); }
      if (updates.password !== undefined) { userFields.push('password_hash = ?'); userValues.push(updates.password); }
      if (updates.role !== undefined) { userFields.push('role = ?'); userValues.push(updates.role); }
      if (updates.status !== undefined) { userFields.push('status = ?'); userValues.push(updates.status); }
      if (updates.avatarUrl !== undefined) { userFields.push('avatar_url = ?'); userValues.push(updates.avatarUrl); }
      if (updates.parsedResumeData !== undefined) { userFields.push('parsed_resume_data_json = ?'); userValues.push(JSON.stringify(updates.parsedResumeData)); }
      if (updates.tokenVersion !== undefined) { userFields.push('token_version = ?'); userValues.push(updates.tokenVersion); }
      if (updates.lastLoginAt !== undefined) { userFields.push('last_login_at = ?'); userValues.push(updates.lastLoginAt ? new Date(updates.lastLoginAt) : null); }
      if (updates.passwordChangedAt !== undefined) { userFields.push('password_changed_at = ?'); userValues.push(updates.passwordChangedAt ? new Date(updates.passwordChangedAt) : null); }

      if (userFields.length > 0) {
        userValues.push(id);
        await conn.query(`UPDATE users SET ${userFields.join(', ')} WHERE id = ?`, userValues);
      }

      // 2. Candidate profile updates on `candidates` table
      if (current.role === 'candidate') {
        const hasCandidateFields =
          updates.title !== undefined ||
          updates.location !== undefined ||
          updates.phone !== undefined ||
          updates.bio !== undefined ||
          updates.dateOfBirth !== undefined ||
          updates.gender !== undefined ||
          updates.resumeUrl !== undefined ||
          updates.resumeOriginalName !== undefined ||
          updates.skills !== undefined ||
          updates.experience !== undefined ||
          updates.education !== undefined;

        if (hasCandidateFields) {
          const [candRows] = await conn.query<any[]>('SELECT id FROM candidates WHERE user_id = ?', [id]);
          if (candRows.length === 0) {
            await conn.query(
              `INSERT INTO candidates (
                id, user_id, title, location, phone, bio, date_of_birth, gender, resume_url, resume_original_name,
                skills_json, experience_json, education_json, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                id,
                id,
                updates.title || current.title || null,
                updates.location || current.location || null,
                updates.phone || current.phone || null,
                updates.bio || current.bio || null,
                updates.dateOfBirth !== undefined ? updates.dateOfBirth : (current.dateOfBirth || null),
                updates.gender !== undefined ? updates.gender : (current.gender || null),
                updates.resumeUrl || current.resumeUrl || null,
                updates.resumeOriginalName || current.resumeOriginalName || null,
                updates.skills !== undefined ? JSON.stringify(updates.skills) : JSON.stringify(current.skills || []),
                updates.experience !== undefined ? JSON.stringify(updates.experience) : JSON.stringify(current.experience || []),
                updates.education !== undefined ? JSON.stringify(updates.education) : JSON.stringify(current.education || []),
              ]
            );
          } else {
            const candFields: string[] = [];
            const candValues: any[] = [];
            if (updates.title !== undefined) { candFields.push('title = ?'); candValues.push(updates.title); }
            if (updates.location !== undefined) { candFields.push('location = ?'); candValues.push(updates.location); }
            if (updates.phone !== undefined) { candFields.push('phone = ?'); candValues.push(updates.phone); }
            if (updates.bio !== undefined) { candFields.push('bio = ?'); candValues.push(updates.bio); }
            if (updates.dateOfBirth !== undefined) { candFields.push('date_of_birth = ?'); candValues.push(updates.dateOfBirth ? updates.dateOfBirth : null); }
            if (updates.gender !== undefined) { candFields.push('gender = ?'); candValues.push(updates.gender || null); }
            if (updates.resumeUrl !== undefined) { candFields.push('resume_url = ?'); candValues.push(updates.resumeUrl); }
            if (updates.resumeOriginalName !== undefined) { candFields.push('resume_original_name = ?'); candValues.push(updates.resumeOriginalName); }
            if (updates.skills !== undefined) { candFields.push('skills_json = ?'); candValues.push(JSON.stringify(updates.skills)); }
            if (updates.experience !== undefined) { candFields.push('experience_json = ?'); candValues.push(JSON.stringify(updates.experience)); }
            if (updates.education !== undefined) { candFields.push('education_json = ?'); candValues.push(JSON.stringify(updates.education)); }

            if (candFields.length > 0) {
              candValues.push(id);
              await conn.query(`UPDATE candidates SET ${candFields.join(', ')} WHERE user_id = ?`, candValues);
            }
          }
        }
      }

      // 3. Recruiter profile updates on `recruiters` table
      if (current.role === 'recruiter') {
        const hasRecruiterFields =
          updates.title !== undefined ||
          updates.location !== undefined ||
          updates.phone !== undefined ||
          updates.bio !== undefined ||
          updates.companyId !== undefined ||
          updates.companyName !== undefined;

        if (hasRecruiterFields) {
          const [recRows] = await conn.query<any[]>('SELECT id FROM recruiters WHERE user_id = ?', [id]);
          if (recRows.length === 0) {
            await conn.query(
              `INSERT INTO recruiters (
                id, user_id, company_id, company_name, title, location, phone, bio,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                id,
                id,
                updates.companyId || current.companyId || null,
                updates.companyName || current.companyName || null,
                updates.title || current.title || null,
                updates.location || current.location || null,
                updates.phone || current.phone || null,
                updates.bio || current.bio || null,
              ]
            );
          } else {
            const recFields: string[] = [];
            const recValues: any[] = [];
            if (updates.title !== undefined) { recFields.push('title = ?'); recValues.push(updates.title); }
            if (updates.location !== undefined) { recFields.push('location = ?'); recValues.push(updates.location); }
            if (updates.phone !== undefined) { recFields.push('phone = ?'); recValues.push(updates.phone); }
            if (updates.bio !== undefined) { recFields.push('bio = ?'); recValues.push(updates.bio); }
            if (updates.companyId !== undefined) { recFields.push('company_id = ?'); recValues.push(updates.companyId); }
            if (updates.companyName !== undefined) { recFields.push('company_name = ?'); recValues.push(updates.companyName); }

            if (recFields.length > 0) {
              recValues.push(id);
              await conn.query(`UPDATE recruiters SET ${recFields.join(', ')} WHERE user_id = ?`, recValues);
            }
          }
        }
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return this.getUserById(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const [result] = await this.pool.query<any>('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // --- Companies ---
  async getCompanies(params?: { search?: string; status?: string }): Promise<Company[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    if (params?.search) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(industry) LIKE ? OR LOWER(location) LIKE ?)');
      const q = `%${params.search.toLowerCase()}%`;
      values.push(q, q, q);
    }
    if (params?.status && params.status !== 'all') {
      conditions.push('status = ?');
      values.push(params.status);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.pool.query<any[]>(`SELECT * FROM companies ${where} ORDER BY created_at DESC`, values);
    return rows.map(this.mapCompany);
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [rows] = await this.pool.query<any[]>('SELECT * FROM companies WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapCompany(rows[0]) : undefined;
  }

  async createCompany(company: Company): Promise<Company> {
    await this.pool.query(
      `INSERT INTO companies (id, name, description, logo, website, location, industry, company_size, verified, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        company.status || 'active',
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
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

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
  async getCategories(includeInactive = false): Promise<JobCategory[]> {
    let sql = `
      SELECT jc.*,
        COUNT(j.id) AS live_job_count
      FROM job_categories jc
      LEFT JOIN jobs j ON j.category_id = jc.id AND j.status = 'active'
      ${includeInactive ? '' : 'WHERE (jc.is_active IS NULL OR jc.is_active = 1)'}
      GROUP BY jc.id
      ORDER BY jc.name ASC
    `;
    const [rows] = await this.pool.query<any[]>(sql);
    return rows.map(this.mapCategory);
  }

  async getCategoryById(id: string): Promise<JobCategory | undefined> {
    const [rows] = await this.pool.query<any[]>(`
      SELECT jc.*, COUNT(j.id) AS live_job_count
      FROM job_categories jc
      LEFT JOIN jobs j ON j.category_id = jc.id AND j.status = 'active'
      WHERE jc.id = ?
      GROUP BY jc.id
    `, [id]);
    return rows.length > 0 ? this.mapCategory(rows[0]) : undefined;
  }

  async getCategoryByName(name: string, excludeId?: string): Promise<JobCategory | undefined> {
    let sql = 'SELECT * FROM job_categories WHERE LOWER(name) = LOWER(?)';
    const params: any[] = [name];
    if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
    const [rows] = await this.pool.query<any[]>(sql, params);
    return rows.length > 0 ? this.mapCategory(rows[0]) : undefined;
  }

  async createCategory(category: JobCategory): Promise<JobCategory> {
    await this.pool.query(
      `INSERT INTO job_categories (id, name, description, icon, job_count, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [category.id, category.name, category.description || null, category.icon || 'Briefcase', category.jobCount || 0, category.isActive !== false ? 1 : 0]
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
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

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

  async getCategoryJobCount(id: string): Promise<number> {
    const [rows] = await this.pool.query<any[]>(
      "SELECT COUNT(*) AS cnt FROM jobs WHERE category_id = ?",
      [id]
    );
    return Number(rows?.[0]?.cnt || 0);
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

  async updateReportedJobWithAction(
    id: string,
    payload: {
      status: 'resolved' | 'dismissed';
      adminAction: string;
      adminReason: string;
      reviewedByUserId: string;
      reviewedByName: string;
    }
  ): Promise<ReportedJob | undefined> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE reported_jobs SET
          status = ?,
          admin_action = ?,
          admin_reason = ?,
          reviewed_by_user_id = ?,
          reviewed_by_name = ?,
          reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [payload.status, payload.adminAction, payload.adminReason,
         payload.reviewedByUserId, payload.reviewedByName, id]
      );

      // Modify the referenced job based on the admin action
      const [repRows] = await conn.query<any[]>('SELECT job_id FROM reported_jobs WHERE id = ?', [id]);
      if (repRows.length > 0) {
        const jobId = repRows[0].job_id;
        if (payload.adminAction === 'deactivate_job') {
          await conn.query("UPDATE jobs SET status = 'closed' WHERE id = ?", [jobId]);
        } else if (payload.adminAction === 'restore_job') {
          await conn.query("UPDATE jobs SET status = 'active' WHERE id = ?", [jobId]);
        }
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await this.pool.query<any[]>('SELECT * FROM reported_jobs WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapReportedJob(rows[0]) : undefined;
  }

  async getReportedJobsFiltered(params?: { status?: string; search?: string }): Promise<ReportedJob[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    if (params?.status && params.status !== 'all') {
      conditions.push('rj.status = ?');
      values.push(params.status);
    }
    if (params?.search) {
      conditions.push('(LOWER(rj.job_title) LIKE ? OR LOWER(rj.company_name) LIKE ? OR LOWER(rj.reported_by_name) LIKE ?)');
      const q = `%${params.search.toLowerCase()}%`;
      values.push(q, q, q);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.pool.query<any[]>(
      `SELECT rj.*, j.status AS current_job_status
       FROM reported_jobs rj
       LEFT JOIN jobs j ON j.id = rj.job_id
       ${where}
       ORDER BY rj.created_at DESC`,
      values
    );
    return rows.map((row) => ({
      ...this.mapReportedJob(row),
    }));
  }

  async getRecruiters(params?: { search?: string; companyId?: string }): Promise<User[]> {
    const conditions: string[] = ["role = 'recruiter'"];
    const values: any[] = [];
    if (params?.search) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(company_name) LIKE ?)');
      const q = `%${params.search.toLowerCase()}%`;
      values.push(q, q, q);
    }
    if (params?.companyId) {
      conditions.push('company_id = ?');
      values.push(params.companyId);
    }
    const [rows] = await this.pool.query<any[]>(
      `SELECT * FROM users WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      values
    );
    return rows.map((r) => this.mapUser(r));
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

  // --- Password Reset Tokens ---
  async createPasswordResetToken(token: PasswordResetToken): Promise<PasswordResetToken> {
    await this.pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at) VALUES (?, ?, ?, ?, ?)`,
      [
        token.id,
        token.userId,
        token.tokenHash,
        new Date(token.expiresAt),
        token.usedAt ? new Date(token.usedAt) : null,
      ]
    );
    return token;
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const [rows] = await this.pool.query<any[]>(
      'SELECT * FROM password_reset_tokens WHERE token_hash = ? ORDER BY created_at DESC LIMIT 1',
      [tokenHash]
    );
    if (!rows || rows.length === 0) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      tokenHash: r.token_hash,
      expiresAt: new Date(r.expires_at).toISOString(),
      usedAt: r.used_at ? new Date(r.used_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  async invalidateUserResetTokens(userId: string): Promise<void> {
    await this.pool.query(
      'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL',
      [userId]
    );
  }

  // --- Token Revocation / Blacklist ---
  async revokeToken(token: RevokedToken): Promise<RevokedToken> {
    await this.pool.query(
      'INSERT INTO revoked_tokens (id, token_jti, expires_at) VALUES (?, ?, ?)',
      [token.id, token.tokenJti, new Date(token.expiresAt)]
    );
    return token;
  }

  async isTokenRevoked(tokenJti: string): Promise<boolean> {
    const [rows] = await this.pool.query<any[]>(
      'SELECT COUNT(*) as count FROM revoked_tokens WHERE token_jti = ? AND expires_at > CURRENT_TIMESTAMP',
      [tokenJti]
    );
    return rows && rows[0] && Number(rows[0].count) > 0;
  }

  // --- Resume Documents (Blob Storage support) ---
  async getCurrentResume(candidateId: string): Promise<ResumeDocument | undefined> {
    const [rows] = await this.pool.query<any[]>(
      `SELECT * FROM resume_documents
       WHERE candidate_id = ? AND is_current = 1 AND upload_status = 'uploaded'
       ORDER BY uploaded_at DESC LIMIT 1`,
      [candidateId]
    );
    return rows.length > 0 ? this.mapResumeDoc(rows[0]) : undefined;
  }

  async getResumeHistory(candidateId: string): Promise<ResumeDocument[]> {
    const [rows] = await this.pool.query<any[]>(
      `SELECT * FROM resume_documents
       WHERE candidate_id = ? AND upload_status != 'failed'
       ORDER BY uploaded_at DESC`,
      [candidateId]
    );
    return rows.map((r) => this.mapResumeDoc(r));
  }

  async getResumeDocById(id: string): Promise<ResumeDocument | undefined> {
    const [rows] = await this.pool.query<any[]>(
      'SELECT * FROM resume_documents WHERE id = ? LIMIT 1',
      [id]
    );
    return rows.length > 0 ? this.mapResumeDoc(rows[0]) : undefined;
  }

  async createResumeDocument(doc: ResumeDocument): Promise<ResumeDocument> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Demote previous current resume for this candidate
      await conn.query(
        'UPDATE resume_documents SET is_current = 0 WHERE candidate_id = ? AND is_current = 1',
        [doc.candidateId]
      );

      // 2. Insert new resume document
      await conn.query(
        `INSERT INTO resume_documents (
          id, candidate_id, original_filename, blob_name, container_name,
          file_extension, mime_type, file_size_bytes, checksum_sha256,
          upload_status, is_current, uploaded_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
        [
          doc.id,
          doc.candidateId,
          doc.originalFilename,
          doc.blobName,
          doc.containerName || 'talenthub-resumes',
          doc.fileExtension,
          doc.mimeType,
          doc.fileSizeBytes,
          doc.checksumSha256,
          doc.uploadStatus || 'uploaded',
        ]
      );

      // 3. Back-fill candidates profile with resume details
      const [candRows] = await conn.query<any[]>(
        'SELECT id FROM candidates WHERE user_id = ?',
        [doc.candidateId]
      );
      if (candRows.length > 0) {
        await conn.query(
          'UPDATE candidates SET resume_url = ?, resume_original_name = ? WHERE user_id = ?',
          [`blob://${doc.containerName || 'talenthub-resumes'}/${doc.blobName}`, doc.originalFilename, doc.candidateId]
        );
      } else {
        await conn.query(
          `INSERT INTO candidates (id, user_id, resume_url, resume_original_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [doc.candidateId, doc.candidateId, `blob://${doc.containerName || 'talenthub-resumes'}/${doc.blobName}`, doc.originalFilename]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const created = await this.getResumeDocById(doc.id);
    return created || doc;
  }

  async markResumeDeleted(id: string): Promise<void> {
    await this.pool.query(
      "UPDATE resume_documents SET upload_status = 'deleted', is_current = 0 WHERE id = ?",
      [id]
    );
  }

  async updateResumeExtraction(
    docId: string,
    status: ExtractionStatus,
    extractedData?: ExtractedCandidateProfile,
    error?: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE resume_documents
         SET extraction_status = ?, extracted_data_json = ?, extraction_error = ?, updated_at = NOW()
         WHERE id = ?`,
        [status, extractedData ? JSON.stringify(extractedData) : null, error || null, docId]
      );
    } catch (err) {
      console.warn('[TalentHub MySQL] Warning updating extraction status:', err);
    }
  }

  async updateResumeExtractedData(
    docId: string,
    extractedData: ExtractedCandidateProfile
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE resume_documents SET extracted_data_json = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(extractedData), docId]
      );
    } catch (err) {
      console.warn('[TalentHub MySQL] Warning updating extracted data:', err);
    }
  }

  async verifyResumeExtraction(
    docId: string,
    candidateId: string,
    recruiterId: string,
    recruiterName: string,
    verifiedData: ExtractedCandidateProfile,
    overwriteProfile: boolean = true
  ): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE resume_documents
         SET is_verified = 1, verified_by_id = ?, verified_by_name = ?, verified_at = NOW(),
             extracted_data_json = ?, updated_at = NOW()
         WHERE id = ?`,
        [recruiterId, recruiterName, JSON.stringify(verifiedData), docId]
      );

      if (overwriteProfile) {
        const fields: string[] = [];
        const values: any[] = [];
        if (verifiedData.skills) {
          fields.push('skills_json = ?');
          values.push(JSON.stringify(verifiedData.skills));
        }
        if (verifiedData.summary) {
          fields.push('bio = ?');
          values.push(verifiedData.summary);
        }
        if (verifiedData.phone) {
          fields.push('phone = ?');
          values.push(verifiedData.phone);
        }
        if (verifiedData.location) {
          fields.push('location = ?');
          values.push(verifiedData.location);
        }
        if (verifiedData.experience?.length) {
          fields.push('experience_json = ?');
          values.push(
            JSON.stringify(
              verifiedData.experience.map((e) => ({
                title: e.title,
                company: e.company,
                period: e.duration,
                description: e.description || '',
              }))
            )
          );
          fields.push('title = ?');
          values.push(verifiedData.experience[0].title);
        }
        if (verifiedData.education?.length) {
          fields.push('education_json = ?');
          values.push(
            JSON.stringify(
              verifiedData.education.map((e) => ({
                degree: e.degree,
                school: e.institution,
                year: e.year,
              }))
            )
          );
        }
        if (fields.length > 0) {
          values.push(candidateId);
          await conn.query(`UPDATE candidates SET ${fields.join(', ')} WHERE user_id = ?`, values);
        }
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
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

  private mapResumeDoc(r: any): ResumeDocument {
    return {
      id: r.id,
      candidateId: r.candidate_id,
      originalFilename: r.original_filename,
      blobName: r.blob_name,
      containerName: r.container_name,
      fileExtension: r.file_extension,
      mimeType: r.mime_type,
      fileSizeBytes: Number(r.file_size_bytes),
      checksumSha256: r.checksum_sha256,
      uploadStatus: r.upload_status,
      isCurrent: Boolean(r.is_current),
      extractionStatus: r.extraction_status || 'completed',
      extractedData: this.parseJson(r.extracted_data_json, undefined),
      extractionError: r.extraction_error || undefined,
      isVerified: Boolean(r.is_verified),
      verifiedById: r.verified_by_id || undefined,
      verifiedByName: r.verified_by_name || undefined,
      verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : undefined,
      uploadedAt: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : new Date().toISOString(),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapUser(row: any): User {
    const isCandidate = row.role === 'candidate';
    const isRecruiter = row.role === 'recruiter';

    let skills: string[] = [];
    const rawSkills = isCandidate ? (row.skills_json !== undefined ? row.skills_json : row.skills) : row.skills_json;
    if (Array.isArray(rawSkills)) {
      skills = rawSkills;
    } else if (typeof rawSkills === 'string') {
      try { skills = JSON.parse(rawSkills); } catch { skills = []; }
    }

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
      skills: isCandidate ? skills : undefined,
      experience: isCandidate ? this.parseJson(row.experience_json, []) : undefined,
      education: isCandidate ? this.parseJson(row.education_json, []) : undefined,
      parsedResumeData: this.parseJson(row.parsed_resume_data_json, undefined),
      tokenVersion: row.token_version !== undefined && row.token_version !== null ? Number(row.token_version) : 1,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
      passwordChangedAt: row.password_changed_at ? new Date(row.password_changed_at).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
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
      status: (row.status as 'active' | 'suspended') || 'active',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapCategory(row: any): JobCategory {
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      icon: row.icon || 'Briefcase',
      jobCount: Number(row.live_job_count ?? row.job_count ?? 0),
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
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
      reviewedByUserId: row.reviewed_by_user_id || undefined,
      reviewedByName: row.reviewed_by_name || undefined,
      adminAction: row.admin_action || undefined,
      adminReason: row.admin_reason || undefined,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
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

