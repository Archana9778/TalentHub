-- ========================================================
-- TalentHub Enterprise Database Schema (MySQL 8.0)
-- Target: Local MySQL 8.0 / Azure Database for MySQL Flexible Server
-- Charset: utf8mb4 | Collation: utf8mb4_unicode_ci | Engine: InnoDB
-- ========================================================

-- Disable foreign key checks during initialization
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- 1. Table: users (Shared Authentication Entity)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    avatar_url VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role),
    KEY idx_users_status (status),
    CONSTRAINT chk_users_role CHECK (role IN ('candidate', 'recruiter', 'admin')),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Table: companies (Hiring Organizations)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    logo VARCHAR(500) NULL,
    website VARCHAR(255) NULL,
    location VARCHAR(150) NULL,
    industry VARCHAR(100) NULL,
    company_size VARCHAR(50) NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_companies_name (name),
    KEY idx_companies_verified (verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Table: job_categories (Job Taxonomy Classifications)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_categories (
    id VARCHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'Briefcase',
    job_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_job_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. Table: candidates (Dedicated Candidate Profiles)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(150) NULL,
    location VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    bio TEXT NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(32) NULL,
    resume_url VARCHAR(500) NULL,
    resume_original_name VARCHAR(255) NULL,
    skills_json JSON NULL,
    experience_json JSON NULL,
    education_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_candidates_user_id (user_id),
    KEY idx_candidates_title (title),
    CONSTRAINT fk_candidates_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Table: recruiters (Dedicated Recruiter Profiles)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS recruiters (
    id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    company_id VARCHAR(64) NULL,
    company_name VARCHAR(150) NULL,
    title VARCHAR(150) NULL,
    location VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,
    bio TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_recruiters_user_id (user_id),
    KEY idx_recruiters_company_id (company_id),
    CONSTRAINT fk_recruiters_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_recruiters_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Table: jobs (Job Requisition Postings)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    company_logo VARCHAR(500) NULL,
    recruiter_id VARCHAR(64) NOT NULL,
    recruiter_name VARCHAR(150) NOT NULL,
    category_id VARCHAR(64) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    workplace_type VARCHAR(32) NOT NULL,
    job_type VARCHAR(32) NOT NULL,
    experience_level VARCHAR(32) NOT NULL,
    salary_min INT NOT NULL,
    salary_max INT NOT NULL,
    salary_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    description TEXT NOT NULL,
    requirements_json JSON NULL,
    skills_json JSON NULL,
    benefits_json JSON NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    applicants_count INT NOT NULL DEFAULT 0,
    views_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_jobs_status (status),
    KEY idx_jobs_company_id (company_id),
    KEY idx_jobs_recruiter_id (recruiter_id),
    KEY idx_jobs_category_id (category_id),
    KEY idx_jobs_feed (status, created_at DESC),
    FULLTEXT KEY ft_jobs_search (title, description, location),
    CONSTRAINT chk_jobs_salary CHECK (salary_min >= 0 AND salary_max >= salary_min),
    CONSTRAINT chk_jobs_workplace CHECK (workplace_type IN ('Remote', 'On-site', 'Hybrid')),
    CONSTRAINT chk_jobs_type CHECK (job_type IN ('Full-time', 'Part-time', 'Contract', 'Internship')),
    CONSTRAINT chk_jobs_experience CHECK (experience_level IN ('Entry-level', 'Mid-level', 'Senior', 'Lead / Principal')),
    CONSTRAINT chk_jobs_status CHECK (status IN ('active', 'closed', 'draft')),
    CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT,
    CONSTRAINT fk_jobs_recruiter FOREIGN KEY (recruiter_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_jobs_category FOREIGN KEY (category_id) REFERENCES job_categories (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. Table: applications (Job Applications)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(64) NOT NULL,
    job_id VARCHAR(64) NOT NULL,
    job_title VARCHAR(200) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    candidate_id VARCHAR(64) NOT NULL,
    candidate_name VARCHAR(150) NOT NULL,
    candidate_email VARCHAR(191) NOT NULL,
    candidate_phone VARCHAR(50) NULL,
    candidate_avatar VARCHAR(500) NULL,
    candidate_title VARCHAR(150) NULL,
    resume_url VARCHAR(500) NOT NULL,
    cover_letter TEXT NULL,
    stage VARCHAR(32) NOT NULL DEFAULT 'Applied',
    match_score INT NOT NULL DEFAULT 70,
    match_details_json JSON NULL,
    recruiter_notes TEXT NULL,
    interview_date TIMESTAMP NULL,
    interview_type VARCHAR(50) NULL,
    timeline_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_candidate_job (candidate_id, job_id),
    KEY idx_app_job_id (job_id),
    KEY idx_app_candidate_id (candidate_id),
    KEY idx_app_stage (stage),
    KEY idx_app_match_score (match_score DESC),
    KEY idx_app_pipeline (job_id, stage),
    KEY idx_app_candidate_timeline (candidate_id, created_at DESC),
    CONSTRAINT chk_app_stage CHECK (stage IN ('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected')),
    CONSTRAINT chk_app_score CHECK (match_score BETWEEN 0 AND 100),
    CONSTRAINT fk_app_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT,
    CONSTRAINT fk_app_candidate FOREIGN KEY (candidate_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. Table: application_stage_history (ATS Stage Audit Trail)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_stage_history (
    id VARCHAR(64) NOT NULL,
    application_id VARCHAR(64) NOT NULL,
    from_stage VARCHAR(32) NULL,
    to_stage VARCHAR(32) NOT NULL,
    changed_by_user_id VARCHAR(64) NULL,
    changed_by_name VARCHAR(150) NULL,
    comment TEXT NULL,
    interview_type VARCHAR(64) NULL,
    interview_date TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_stage_hist_app (application_id),
    KEY idx_stage_hist_app_created (application_id, created_at ASC),
    CONSTRAINT fk_stage_hist_app FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE,
    CONSTRAINT fk_stage_hist_user FOREIGN KEY (changed_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 9. Table: reported_jobs (Job Moderation Queue)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS reported_jobs (
    id VARCHAR(64) NOT NULL,
    job_id VARCHAR(64) NOT NULL,
    job_title VARCHAR(200) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    reported_by_user_id VARCHAR(64) NOT NULL,
    reported_by_name VARCHAR(150) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reported_jobs_status (status),
    KEY idx_reported_jobs_job_id (job_id),
    CONSTRAINT chk_reported_status CHECK (status IN ('pending', 'resolved', 'dismissed')),
    CONSTRAINT fk_reported_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
    CONSTRAINT fk_reported_user FOREIGN KEY (reported_by_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 10. Table: job_alerts (Candidate Subscriptions)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_alerts (
    id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(150) NOT NULL,
    keywords VARCHAR(255) NULL,
    category VARCHAR(100) NULL,
    location VARCHAR(150) NULL,
    job_type VARCHAR(50) NULL,
    frequency VARCHAR(32) NOT NULL DEFAULT 'daily',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_job_alerts_user_id (user_id),
    CONSTRAINT chk_job_alerts_freq CHECK (frequency IN ('daily', 'weekly')),
    CONSTRAINT fk_job_alerts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 11. Relational Views (Candidate & Recruiter Views)
-- --------------------------------------------------------
CREATE OR REPLACE VIEW candidate_view AS
SELECT
    u.id AS user_id,
    c.id AS candidate_id,
    u.email,
    u.name,
    u.role,
    u.status,
    u.avatar_url,
    c.title,
    c.location,
    c.phone,
    c.bio,
    c.resume_url,
    c.resume_original_name,
    c.skills_json,
    c.experience_json,
    c.education_json,
    u.created_at,
    u.updated_at
FROM users u
LEFT JOIN candidates c ON u.id = c.user_id
WHERE u.role = 'candidate';

CREATE OR REPLACE VIEW recruiter_view AS
SELECT
    u.id AS user_id,
    r.id AS recruiter_id,
    u.email,
    u.name,
    u.role,
    u.status,
    u.avatar_url,
    r.company_id,
    r.company_name,
    r.title,
    r.location,
    r.phone,
    r.bio,
    u.created_at,
    u.updated_at
FROM users u
LEFT JOIN recruiters r ON u.id = r.user_id
WHERE u.role = 'recruiter';

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
