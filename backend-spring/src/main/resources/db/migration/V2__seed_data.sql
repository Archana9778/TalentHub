-- ========================================================
-- TalentHub Seed Data V2: Initial Organizations & Accounts
-- Passwords are all BCrypt-hashed: 'password123'
-- ($2a$10$w8T0M4j6fI8dG8X5r4XwYeS0H1Kq9uVqB9zN3bQ5r7s9t1v3x5z7a)
-- ========================================================

INSERT INTO companies (id, name, description, logo, website, location, industry, company_size, verified)
VALUES
('comp-1', 'CloudScale Technologies', 'Enterprise cloud management, VMSS orchestration, and immutable infrastructure solutions.', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120', 'https://cloudscale.example.com', 'San Francisco, CA & Remote', 'Cloud Infrastructure & Enterprise Software', '500-1,000 employees', TRUE),
('comp-2', 'Nexus AI Labs', 'Pioneering multimodal intelligence, generative AI models, and document cognition engines.', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120', 'https://nexusai.example.com', 'Austin, TX & Hybrid', 'Artificial Intelligence & Machine Learning', '100-250 employees', TRUE),
('comp-3', 'FinTech Velocity', 'Next-generation payment rail and automated compliance engines with bank-grade security.', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=120', 'https://fintechvelocity.example.com', 'New York, NY', 'Financial Technology', '250-500 employees', TRUE);

INSERT INTO job_categories (id, name, description, icon, job_count)
VALUES
('cat-1', 'Full Stack & Web Engineering', 'React, Spring Boot, microservices architecture', 'Code2', 14),
('cat-2', 'Cloud Architecture & DevOps', 'Azure, Kubernetes, Terraform, CI/CD pipelines', 'Cloud', 10),
('cat-3', 'AI & Data Science', 'Machine Learning, Azure AI Document Intelligence', 'BrainCircuit', 8),
('cat-4', 'Cyber Security & Compliance', 'Zero trust, CIS benchmarks, WAF rules', 'ShieldCheck', 6);

INSERT INTO users (id, email, password_hash, name, role, status, title, location, phone, avatar_url, bio, company_name, skills_json)
VALUES
('user-admin-1', 'admin@talenthub.com', '$2a$10$w8T0M4j6fI8dG8X5r4XwYeS0H1Kq9uVqB9zN3bQ5r7s9t1v3x5z7a', 'Eleanor Vance', 'admin', 'active', 'Platform Administrator', 'Seattle, WA', '+1 (555) 019-2834', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 'TalentHub System Director & Governance Lead', NULL, '[]'),
('user-recruiter-1', 'recruiter@techcorp.com', '$2a$10$w8T0M4j6fI8dG8X5r4XwYeS0H1Kq9uVqB9zN3bQ5r7s9t1v3x5z7a', 'Sarah Jenkins', 'recruiter', 'active', 'Lead Talent Acquisition Partner', 'San Francisco, CA', '+1 (555) 345-6789', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Hiring top engineering talent for cloud infrastructure.', 'CloudScale Technologies', '[]'),
('user-candidate-1', 'candidate@talenthub.com', '$2a$10$w8T0M4j6fI8dG8X5r4XwYeS0H1Kq9uVqB9zN3bQ5r7s9t1v3x5z7a', 'Alex Morgan', 'candidate', 'active', 'Senior Full-Stack Cloud Engineer', 'Seattle, WA', '+1 (555) 432-8765', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'Passionate full-stack developer with 6+ years in React, Spring Boot, MySQL, and Azure.', NULL, '["React", "TypeScript", "Java", "Spring Boot", "MySQL", "Azure", "Docker"]');

INSERT INTO jobs (id, title, company_id, company_name, company_logo, recruiter_id, recruiter_name, category_id, category_name, location, workplace_type, job_type, experience_level, salary_min, salary_max, salary_currency, description, skills_json, requirements_json, benefits_json, status, is_featured, applicants_count, views_count)
VALUES
('job-1', 'Senior Full Stack Engineer (React + Spring Boot)', 'comp-1', 'CloudScale Technologies', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120', 'user-recruiter-1', 'Sarah Jenkins', 'cat-1', 'Full Stack & Web Engineering', 'Seattle, WA', 'Hybrid', 'Full-time', 'Senior', 145000, 185000, 'USD', 'Architect responsive React UIs and implement high-performance Spring Boot 3 microservices backed by MySQL on Azure.', '["React", "TypeScript", "Java", "Spring Boot", "MySQL", "Azure", "Docker"]', '["5+ years hands-on React and Spring Boot", "Relational database tuning in MySQL", "Container deployments on Azure AKS"]', '["Competitive salary + equity", "Full healthcare", "401(k) 5% match"]', 'active', TRUE, 1, 142);

INSERT INTO applications (id, job_id, job_title, company_name, candidate_id, candidate_name, candidate_email, candidate_phone, candidate_avatar, candidate_title, resume_url, cover_letter, stage, match_score, match_details_json, recruiter_notes, timeline_json)
VALUES
('app-1', 'job-1', 'Senior Full Stack Engineer (React + Spring Boot)', 'CloudScale Technologies', 'user-candidate-1', 'Alex Morgan', 'candidate@talenthub.com', '+1 (555) 432-8765', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'Senior Full-Stack Cloud Engineer', '/uploads/resumes/sample-alex-morgan-resume.pdf', 'Excited about the role. 6 years experience in Java Spring Boot and React on Azure.', 'Interview', 94, '{"score": 94, "matchedSkills": ["React", "TypeScript", "Java", "Spring Boot", "MySQL", "Azure", "Docker"], "missingSkills": [], "analysisNotes": "Exceptional fit with core enterprise tech stack."}', 'Initial screening completed. Scheduled technical round.', '[{"stage": "Applied", "changedByName": "Alex Morgan", "changedAt": "2026-02-02T11:00:00Z"}, {"stage": "Interview", "changedByName": "Sarah Jenkins", "changedAt": "2026-02-08T14:00:00Z"}]');

