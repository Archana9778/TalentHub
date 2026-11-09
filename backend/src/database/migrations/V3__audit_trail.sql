-- ========================================================
-- TalentHub Schema V3: Application Stage Audit Trail
-- ========================================================

CREATE TABLE IF NOT EXISTS application_stage_history (
    id VARCHAR(64) PRIMARY KEY,
    application_id VARCHAR(64) NOT NULL,
    from_stage VARCHAR(32),
    to_stage VARCHAR(32) NOT NULL,
    changed_by_user_id VARCHAR(64),
    changed_by_name VARCHAR(150),
    comment TEXT,
    interview_type VARCHAR(64),
    interview_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_stage_hist_app (application_id),
    CONSTRAINT fk_stage_hist_app FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

