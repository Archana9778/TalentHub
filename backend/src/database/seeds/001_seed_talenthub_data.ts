import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

const defaultPasswordHash = bcrypt.hashSync('password123', 10);

export async function seed(knex: Knex): Promise<void> {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0;');

  // 1. Companies
  await knex('companies').insert([
    {
      id: 'comp-1',
      name: 'CloudScale Technologies',
      description: 'Enterprise cloud management, VMSS orchestration, and immutable infrastructure solutions.',
      logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      website: 'https://cloudscale.example.com',
      location: 'San Francisco, CA & Remote',
      industry: 'Cloud Infrastructure & Enterprise Software',
      company_size: '500-1,000 employees',
      verified: true,
    },
    {
      id: 'comp-2',
      name: 'Nexus AI Labs',
      description: 'Pioneering multimodal intelligence, generative AI models, and document cognition engines.',
      logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      website: 'https://nexusai.example.com',
      location: 'Austin, TX & Hybrid',
      industry: 'Artificial Intelligence & Machine Learning',
      company_size: '100-250 employees',
      verified: true,
    },
    {
      id: 'comp-3',
      name: 'FinTech Velocity',
      description: 'Next-generation payment rail and automated compliance engines with bank-grade security.',
      logo: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=120',
      website: 'https://fintechvelocity.example.com',
      location: 'New York, NY',
      industry: 'Financial Technology',
      company_size: '250-500 employees',
      verified: true,
    },
  ]).onConflict('id').ignore();

  // 2. Job Categories
  await knex('job_categories').insert([
    { id: 'cat-1', name: 'Full Stack & Web Engineering', description: 'React, Node.js, Spring Boot, microservices architecture', icon: 'Code2', job_count: 14 },
    { id: 'cat-2', name: 'Cloud Architecture & DevOps', description: 'Azure, Kubernetes, Terraform, CI/CD pipelines', icon: 'Cloud', job_count: 10 },
    { id: 'cat-3', name: 'AI & Data Science', description: 'Machine Learning, Azure AI Document Intelligence', icon: 'BrainCircuit', job_count: 8 },
    { id: 'cat-4', name: 'Cyber Security & Compliance', description: 'Zero trust, CIS benchmarks, WAF rules', icon: 'ShieldCheck', job_count: 6 },
  ]).onConflict('id').ignore();

  // 3. Users (Shared Auth)
  await knex('users').insert([
    {
      id: 'user-admin-1',
      email: 'admin@talenthub.com',
      password_hash: defaultPasswordHash,
      name: 'Eleanor Vance',
      role: 'admin',
      status: 'active',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    {
      id: 'user-recruiter-1',
      email: 'recruiter@techcorp.com',
      password_hash: defaultPasswordHash,
      name: 'Sarah Jenkins',
      role: 'recruiter',
      status: 'active',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    },
    {
      id: 'user-candidate-1',
      email: 'candidate@talenthub.com',
      password_hash: defaultPasswordHash,
      name: 'Alex Morgan',
      role: 'candidate',
      status: 'active',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  ]).onConflict('id').ignore();

  // 4. Candidates Profile
  await knex('candidates').insert([
    {
      id: 'user-candidate-1',
      user_id: 'user-candidate-1',
      title: 'Senior Full-Stack Cloud Engineer',
      location: 'Seattle, WA',
      phone: '+1 (555) 432-8765',
      bio: 'Passionate full-stack developer with 6+ years in React, TypeScript, Node.js, and Azure.',
      resume_url: '/uploads/resumes/sample-alex-morgan-resume.pdf',
      resume_original_name: 'Alex-Morgan-Senior-Dev-2026.pdf',
      skills_json: JSON.stringify(['React', 'TypeScript', 'Node.js', 'MySQL', 'Azure', 'Docker']),
      experience_json: JSON.stringify([
        { title: 'Senior Software Engineer', company: 'Contoso Cloud', period: '2022 - Present', description: 'Led frontend redesign.' },
      ]),
      education_json: JSON.stringify([
        { degree: 'B.S. in Computer Science', school: 'University of Washington', year: '2019' },
      ]),
    },
  ]).onConflict('id').ignore();

  // 5. Recruiters Profile
  await knex('recruiters').insert([
    {
      id: 'user-recruiter-1',
      user_id: 'user-recruiter-1',
      company_id: 'comp-1',
      company_name: 'CloudScale Technologies',
      title: 'Lead Talent Acquisition Partner',
      location: 'San Francisco, CA',
      phone: '+1 (555) 345-6789',
      bio: 'Hiring top engineering talent for cloud infrastructure.',
    },
  ]).onConflict('id').ignore();

  // 6. Jobs
  await knex('jobs').insert([
    {
      id: 'job-1',
      title: 'Senior Full Stack Engineer (React + Node.js)',
      company_id: 'comp-1',
      company_name: 'CloudScale Technologies',
      company_logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120',
      recruiter_id: 'user-recruiter-1',
      recruiter_name: 'Sarah Jenkins',
      category_id: 'cat-1',
      category_name: 'Full Stack & Web Engineering',
      location: 'Seattle, WA',
      workplace_type: 'Hybrid',
      job_type: 'Full-time',
      experience_level: 'Senior',
      salary_min: 145000,
      salary_max: 185000,
      salary_currency: 'USD',
      description: 'Architect responsive React UIs and implement high-performance Node.js / Express microservices backed by MySQL on Azure.',
      requirements_json: JSON.stringify(['5+ years hands-on React and Node.js', 'Relational database tuning in MySQL', 'Container deployments on Azure AKS']),
      skills_json: JSON.stringify(['React', 'TypeScript', 'Node.js', 'MySQL', 'Azure', 'Docker']),
      benefits_json: JSON.stringify(['Competitive salary + equity', 'Full healthcare', '401(k) 5% match']),
      status: 'active',
      is_featured: true,
      applicants_count: 1,
      views_count: 142,
    },
  ]).onConflict('id').ignore();

  // 7. Applications
  await knex('applications').insert([
    {
      id: 'app-1',
      job_id: 'job-1',
      job_title: 'Senior Full Stack Engineer (React + Node.js)',
      company_name: 'CloudScale Technologies',
      candidate_id: 'user-candidate-1',
      candidate_name: 'Alex Morgan',
      candidate_email: 'candidate@talenthub.com',
      candidate_phone: '+1 (555) 432-8765',
      candidate_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      candidate_title: 'Senior Full-Stack Cloud Engineer',
      resume_url: '/uploads/resumes/sample-alex-morgan-resume.pdf',
      cover_letter: 'Excited about the role. 6 years experience in Node.js and React on Azure.',
      stage: 'Interview',
      match_score: 94,
      match_details_json: JSON.stringify({ score: 94, matchedSkills: ['React', 'TypeScript', 'Node.js', 'MySQL', 'Azure', 'Docker'], missingSkills: [], analysisNotes: 'Exceptional fit with core stack.' }),
      recruiter_notes: 'Initial screening completed. Scheduled technical round.',
      interview_date: new Date('2026-03-15T15:00:00Z'),
      interview_type: 'Technical Round',
      timeline_json: JSON.stringify([
        { stage: 'Applied', changedByName: 'Alex Morgan', changedAt: '2026-02-02T11:00:00Z' },
        { stage: 'Interview', changedByName: 'Sarah Jenkins', changedAt: '2026-02-08T14:00:00Z' },
      ]),
    },
  ]).onConflict('id').ignore();

  // 8. Application Stage History
  await knex('application_stage_history').insert([
    {
      id: 'stage-hist-1',
      application_id: 'app-1',
      from_stage: 'Applied',
      to_stage: 'Interview',
      changed_by_user_id: 'user-recruiter-1',
      changed_by_name: 'Sarah Jenkins',
      comment: 'Scheduled technical round with hiring team.',
      interview_type: 'Technical Round',
      interview_date: new Date('2026-03-15T15:00:00Z'),
    },
  ]).onConflict('id').ignore();

  await knex.raw('SET FOREIGN_KEY_CHECKS = 1;');
}
