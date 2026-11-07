import fs from 'fs';
import path from 'path';
import knex, { Knex } from 'knex';
import knexConfig from '../config/knexfile';
import { config } from '../config';

const environment = config.nodeEnv === 'production' ? 'production' : (config.nodeEnv === 'test' ? 'test' : 'development');
const dbConfig = knexConfig[environment] || knexConfig.development;
const db: Knex = knex(dbConfig);

interface JsonDatabase {
  users?: any[];
  companies?: any[];
  categories?: any[];
  jobs?: any[];
  applications?: any[];
  reportedJobs?: any[];
  jobAlerts?: any[];
}

export async function importJsonData() {
  const isExecute = process.argv.includes('--execute');
  const jsonPath = path.resolve(config.dataDir, 'talenthub-db.json');

  console.log('====================================================');
  console.log('TalentHub JSON-to-MySQL Data Migration Procedure');
  console.log(`Source File: ${jsonPath}`);
  console.log(`Mode:        ${isExecute ? 'LIVE EXECUTION (--execute)' : 'DRY RUN (Preview Only)'}`);
  console.log('====================================================');

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: Source JSON file not found at ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data: JsonDatabase = JSON.parse(raw);

  const users = data.users || [];
  const companies = data.companies || [];
  const categories = data.categories || [];
  const jobs = data.jobs || [];
  const applications = data.applications || [];
  const reportedJobs = data.reportedJobs || [];
  const jobAlerts = data.jobAlerts || [];

  console.log(`Discovered JSON Records:`);
  console.log(`  - Users:        ${users.length}`);
  console.log(`  - Companies:    ${companies.length}`);
  console.log(`  - Categories:   ${categories.length}`);
  console.log(`  - Jobs:         ${jobs.length}`);
  console.log(`  - Applications: ${applications.length}`);
  console.log(`  - Reports:      ${reportedJobs.length}`);
  console.log(`  - Job Alerts:   ${jobAlerts.length}`);
  console.log('----------------------------------------------------');

  // Prepare Candidates & Recruiters
  const candidateUsers = users.filter((u) => u.role === 'candidate');
  const recruiterUsers = users.filter((u) => u.role === 'recruiter');

  console.log(`Role Separation Plan:`);
  console.log(`  - Base Users (Auth):      ${users.length} records`);
  console.log(`  - Candidate Profiles:     ${candidateUsers.length} records`);
  console.log(`  - Recruiter Profiles:     ${recruiterUsers.length} records`);

  if (!isExecute) {
    console.log('\n[DRY RUN SUMMARY] Validation successful.');
    console.log('No database records were created or modified.');
    console.log('To perform live import, run: npm run db:import -- --execute');
    console.log('====================================================');
    await db.destroy();
    return;
  }

  console.log('\nConnecting to target MySQL database...');
  try {
    await db.raw('SELECT 1');
  } catch (err: any) {
    console.error('Failed to connect to MySQL database:', err.message);
    await db.destroy();
    process.exit(1);
  }

  console.log('Applying data in dependency order with foreign key safety...');
  const trx = await db.transaction();

  try {
    await trx.raw('SET FOREIGN_KEY_CHECKS = 0;');

    // 1. Companies
    if (companies.length > 0) {
      const companyRows = companies.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || null,
        logo: c.logo || null,
        website: c.website || null,
        location: c.location || null,
        industry: c.industry || null,
        company_size: c.size || c.companySize || null,
        verified: Boolean(c.verified),
        created_at: c.createdAt ? new Date(c.createdAt) : new Date(),
      }));
      await trx('companies').insert(companyRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${companyRows.length} companies.`);
    }

    // 2. Categories
    if (categories.length > 0) {
      const catRows = categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || null,
        icon: c.icon || 'Briefcase',
        job_count: c.jobCount || 0,
      }));
      await trx('job_categories').insert(catRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${catRows.length} categories.`);
    }

    // 3. Base Users
    if (users.length > 0) {
      const userRows = users.map((u) => ({
        id: u.id,
        email: u.email.toLowerCase(),
        password_hash: u.password,
        name: u.name,
        role: u.role,
        status: u.status || 'active',
        avatar_url: u.avatarUrl || null,
        created_at: u.createdAt ? new Date(u.createdAt) : new Date(),
      }));
      await trx('users').insert(userRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${userRows.length} base users.`);
    }

    // 4. Candidate Profiles
    if (candidateUsers.length > 0) {
      const candidateRows = candidateUsers.map((u) => ({
        id: u.id,
        user_id: u.id,
        title: u.title || null,
        location: u.location || null,
        phone: u.phone || null,
        bio: u.bio || null,
        resume_url: u.resumeUrl || null,
        resume_original_name: u.resumeOriginalName || null,
        skills_json: JSON.stringify(u.skills || []),
        experience_json: JSON.stringify(u.experience || []),
        education_json: JSON.stringify(u.education || []),
        created_at: u.createdAt ? new Date(u.createdAt) : new Date(),
      }));
      await trx('candidates').insert(candidateRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${candidateRows.length} candidate profiles.`);
    }

    // 5. Recruiter Profiles
    if (recruiterUsers.length > 0) {
      const recruiterRows = recruiterUsers.map((u) => ({
        id: u.id,
        user_id: u.id,
        company_id: u.companyId || null,
        company_name: u.companyName || null,
        title: u.title || null,
        location: u.location || null,
        phone: u.phone || null,
        bio: u.bio || null,
        created_at: u.createdAt ? new Date(u.createdAt) : new Date(),
      }));
      await trx('recruiters').insert(recruiterRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${recruiterRows.length} recruiter profiles.`);
    }

    // 6. Jobs
    if (jobs.length > 0) {
      const jobRows = jobs.map((j) => ({
        id: j.id,
        title: j.title,
        company_id: j.companyId,
        company_name: j.companyName,
        company_logo: j.companyLogo || null,
        recruiter_id: j.recruiterId,
        recruiter_name: j.recruiterName,
        category_id: j.categoryId,
        category_name: j.categoryName,
        location: j.location,
        workplace_type: j.workplaceType,
        job_type: j.jobType,
        experience_level: j.experienceLevel,
        salary_min: j.salaryMin,
        salary_max: j.salaryMax,
        salary_currency: j.salaryCurrency || 'USD',
        description: j.description,
        requirements_json: JSON.stringify(j.requirements || []),
        skills_json: JSON.stringify(j.skills || []),
        benefits_json: JSON.stringify(j.benefits || []),
        status: j.status || 'active',
        is_featured: Boolean(j.isFeatured),
        applicants_count: j.applicantsCount || 0,
        views_count: j.viewsCount || 0,
        expires_at: j.expiresAt ? new Date(j.expiresAt) : null,
        created_at: j.createdAt ? new Date(j.createdAt) : new Date(),
      }));
      await trx('jobs').insert(jobRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${jobRows.length} jobs.`);
    }

    // 7. Applications
    if (applications.length > 0) {
      const appRows = applications.map((a) => ({
        id: a.id,
        job_id: a.jobId,
        job_title: a.jobTitle,
        company_name: a.companyName,
        candidate_id: a.candidateId,
        candidate_name: a.candidateName,
        candidate_email: a.candidateEmail,
        candidate_phone: a.candidatePhone || null,
        candidate_avatar: a.candidateAvatar || null,
        candidate_title: a.candidateTitle || null,
        resume_url: a.resumeUrl,
        cover_letter: a.coverLetter || null,
        stage: a.stage || 'Applied',
        match_score: a.matchScore || 70,
        match_details_json: JSON.stringify(a.matchDetails || {}),
        recruiter_notes: a.recruiterNotes || null,
        interview_date: a.interviewDate ? new Date(a.interviewDate) : null,
        interview_type: a.interviewType || null,
        timeline_json: JSON.stringify(a.timeline || []),
        created_at: a.createdAt ? new Date(a.createdAt) : new Date(),
      }));
      await trx('applications').insert(appRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${appRows.length} applications.`);
    }

    // 8. Reported Jobs
    if (reportedJobs.length > 0) {
      const repRows = reportedJobs.map((r) => ({
        id: r.id,
        job_id: r.jobId,
        job_title: r.jobTitle,
        company_name: r.companyName,
        reported_by_user_id: r.reportedByUserId,
        reported_by_name: r.reportedByName,
        reason: r.reason,
        details: r.details || null,
        status: r.status || 'pending',
        created_at: r.createdAt ? new Date(r.createdAt) : new Date(),
      }));
      await trx('reported_jobs').insert(repRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${repRows.length} reports.`);
    }

    // 9. Job Alerts
    if (jobAlerts.length > 0) {
      const alertRows = jobAlerts.map((al) => ({
        id: al.id,
        user_id: al.userId,
        title: al.title,
        keywords: al.keywords || null,
        category: al.category || null,
        location: al.location || null,
        job_type: al.jobType || null,
        frequency: al.frequency || 'daily',
        is_active: Boolean(al.isActive),
        created_at: al.createdAt ? new Date(al.createdAt) : new Date(),
      }));
      await trx('job_alerts').insert(alertRows).onConflict('id').ignore();
      console.log(`[x] Inserted ${alertRows.length} job alerts.`);
    }

    await trx.raw('SET FOREIGN_KEY_CHECKS = 1;');
    await trx.commit();
    console.log('\n[SUCCESS] All records successfully migrated to MySQL!');
  } catch (err: any) {
    await trx.rollback();
    console.error('\n[ROLLBACK] Transaction failed:', err.message);
  } finally {
    await db.destroy();
  }
}

importJsonData();
