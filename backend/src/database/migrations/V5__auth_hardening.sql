-- ========================================================
-- TalentHub Schema V5: Advanced Authentication & Security Hardening
-- ========================================================

-- 1. Add session version and audit columns to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL;

-- 2. Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reset_token_hash (token_hash),
    INDEX idx_reset_user (user_id),
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create revoked tokens table for explicit server-side token invalidation
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id VARCHAR(64) PRIMARY KEY,
    token_jti VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_revoked_jti (token_jti),
    INDEX idx_revoked_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

