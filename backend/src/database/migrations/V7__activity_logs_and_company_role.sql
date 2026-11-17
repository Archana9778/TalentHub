-- ========================================================
-- TalentHub Schema V7: Activity Log Audit Trail & Company Role Persistence
-- ========================================================

-- 1. Add company_role to recruiters table if missing
ALTER TABLE recruiters
    ADD COLUMN IF NOT EXISTS company_role VARCHAR(32) NOT NULL DEFAULT 'recruiter';

-- Backfill known company admins from seed data
UPDATE recruiters SET company_role = 'admin' WHERE user_id IN ('user-recruiter-1', 'user-recruiter-2');

-- 2. Add soft-delete columns to jobs table
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(64) NULL DEFAULT NULL,
    ADD INDEX IF NOT EXISTS idx_jobs_deleted_at (deleted_at);

-- 3. Create activity_logs audit table
CREATE TABLE IF NOT EXISTS activity_logs (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    actor_user_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(150) NOT NULL,
    action VARCHAR(32) NOT NULL,
    module VARCHAR(64) NOT NULL,
    record_id VARCHAR(64) NOT NULL,
    record_name VARCHAR(255) NOT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_activity_company (company_id),
    INDEX idx_activity_actor (actor_user_id),
    INDEX idx_activity_action (action),
    INDEX idx_activity_module (module),
    INDEX idx_activity_created (created_at),
    INDEX idx_activity_company_created (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
