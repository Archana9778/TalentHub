-- TalentHub Schema V4: Persist candidate and recruiter profile details.
-- Additive migration: existing rows remain valid and existing profile values are preserved.

ALTER TABLE users
    ADD COLUMN experience_json JSON NULL,
    ADD COLUMN education_json JSON NULL,
    ADD COLUMN parsed_resume_data_json JSON NULL;
