-- ========================================================
-- TalentHub Schema V4: Recruiter, Company & Application Lifecycle Management
-- Target: Azure Database for MySQL Flexible Server
-- ========================================================

-- Enhance companies table with contact details and address
ALTER TABLE companies 
    ADD COLUMN IF NOT EXISTS email VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50) NULL,
    ADD COLUMN IF NOT EXISTS address TEXT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Enhance users table with company_role, designation, contact_number
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_role VARCHAR(32) DEFAULT 'recruiter',
    ADD COLUMN IF NOT EXISTS designation VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50) NULL;

-- Enhance jobs table
ALTER TABLE jobs
    ADD INDEX IF NOT EXISTS idx_job_company (company_id);

-- Enhance applications table with company_id and assigned recruiter
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS company_id VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS assigned_recruiter_id VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS assigned_recruiter_name VARCHAR(150) NULL,
    ADD INDEX IF NOT EXISTS idx_app_company (company_id),
    ADD INDEX IF NOT EXISTS idx_app_assigned_recruiter (assigned_recruiter_id);

-- Ensure application_stage_history has previous_stage, reason, is_admin_override
ALTER TABLE application_stage_history
    ADD COLUMN IF NOT EXISTS is_admin_override BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reason TEXT NULL;
