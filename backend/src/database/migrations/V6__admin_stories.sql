-- ========================================================
-- TalentHub Schema V6: Admin Stories 184-186
-- ========================================================

-- 184: Add is_active to job_categories
ALTER TABLE job_categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 185: Add status to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';

-- 186: Add admin audit columns to reported_jobs
ALTER TABLE reported_jobs
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_name VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS admin_action VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS admin_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL;

