-- ========================================================
-- TalentHub Schema V7: Candidate Education and Work Experience Management
-- Target: MySQL 8.0 / Azure Database for MySQL Flexible Server
-- Tables: candidate_education, candidate_experience
-- ========================================================

CREATE TABLE IF NOT EXISTS candidate_education (
    id VARCHAR(64) NOT NULL,
    candidate_id VARCHAR(64) NOT NULL,
    institution VARCHAR(200) NOT NULL,
    degree VARCHAR(150) NOT NULL,
    field_of_study VARCHAR(150) NULL,
    start_date VARCHAR(50) NULL,
    end_date VARCHAR(50) NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    grade VARCHAR(50) NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_education_candidate (candidate_id),
    CONSTRAINT fk_education_candidate FOREIGN KEY (candidate_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_experience (
    id VARCHAR(64) NOT NULL,
    candidate_id VARCHAR(64) NOT NULL,
    company VARCHAR(200) NOT NULL,
    title VARCHAR(150) NOT NULL,
    employment_type VARCHAR(50) NULL,
    location VARCHAR(150) NULL,
    start_date VARCHAR(50) NULL,
    end_date VARCHAR(50) NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_experience_candidate (candidate_id),
    CONSTRAINT fk_experience_candidate FOREIGN KEY (candidate_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

