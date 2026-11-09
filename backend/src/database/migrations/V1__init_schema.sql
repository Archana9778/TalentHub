-- ========================================================
-- TalentHub Schema V1: Initial Database Architecture
-- Target: Azure Database for MySQL Flexible Server
-- ========================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    title VARCHAR(150),
    location VARCHAR(150),
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    bio TEXT,
    company_id VARCHAR(64),
    company_name VARCHAR(150),
    resume_url VARCHAR(500),
    resume_original_name VARCHAR(255),
    skills_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    logo VARCHAR(500),
    website VARCHAR(255),
    location VARCHAR(150),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Briefcase',
    job_count INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    company_logo VARCHAR(500),
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
    salary_currency VARCHAR(10) DEFAULT 'USD',
    description TEXT NOT NULL,
    requirements_json JSON,
    skills_json JSON,
    benefits_json JSON,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    is_featured BOOLEAN DEFAULT FALSE,
    applicants_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_status (status),
    INDEX idx_job_category (category_id),
    INDEX idx_job_recruiter (recruiter_id),
    FULLTEXT INDEX ft_job_search (title, description, location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    job_title VARCHAR(200) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    candidate_id VARCHAR(64) NOT NULL,
    candidate_name VARCHAR(150) NOT NULL,
    candidate_email VARCHAR(191) NOT NULL,
    candidate_phone VARCHAR(50),
    candidate_avatar VARCHAR(500),
    candidate_title VARCHAR(150),
    resume_url VARCHAR(500) NOT NULL,
    cover_letter TEXT,
    stage VARCHAR(32) NOT NULL DEFAULT 'Applied',
    match_score INT NOT NULL DEFAULT 70,
    match_details_json JSON,
    recruiter_notes TEXT,
    interview_date TIMESTAMP NULL,
    interview_type VARCHAR(50),
    timeline_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_app_job (job_id),
    INDEX idx_app_candidate (candidate_id),
    INDEX idx_app_stage (stage),
    INDEX idx_app_match_score (match_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reported_jobs (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    job_title VARCHAR(200) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    reported_by_user_id VARCHAR(64) NOT NULL,
    reported_by_name VARCHAR(150) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_report_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_alerts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(150) NOT NULL,
    keywords VARCHAR(255),
    category VARCHAR(100),
    location VARCHAR(150),
    job_type VARCHAR(50),
    frequency VARCHAR(32) DEFAULT 'daily',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alert_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

