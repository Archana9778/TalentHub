-- ========================================================
-- TalentHub Schema V6: Candidate Personal Information Management
-- Target: MySQL 8.0 / Azure Database for MySQL Flexible Server
-- Additive migration: adds date_of_birth and gender to candidates and users
-- ========================================================

ALTER TABLE candidates
    ADD COLUMN date_of_birth DATE NULL,
    ADD COLUMN gender VARCHAR(32) NULL;

ALTER TABLE users
    ADD COLUMN date_of_birth DATE NULL,
    ADD COLUMN gender VARCHAR(32) NULL;

