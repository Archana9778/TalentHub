/**
 * TalentHub Secure Resume Access and Role-Based Authorization Tests
 * Run with: .\backend\node_modules\.bin\tsx backend\src\tests\resumeSecurity.test.ts
 *
 * Verifies both user stories:
 * USER STORY 1: Temporary Secure Resume Links
 * - Read-only SAS URL generation on demand.
 * - SAS expiry duration configured from application config.
 * - Private storage, no permanent public URLs.
 * - SAS tokens never stored in MySQL database.
 * - Fresh temporary link generated per request.
 * - Expired/inaccessible links handled.
 *
 * USER STORY 2: Role-Based and Application-Based Resume Authorization
 * - Candidate accesses only own resumes (403 on others).
 * - Recruiter accesses candidate resumes ONLY if candidate applied to a job managed by that recruiter.
 * - Recruiter CANNOT access another recruiter's applicants (403).
 * - Recruiter CANNOT access unrelated candidates (403).
 * - Administrator follows policy and can access candidate documents.
 * - Unauthenticated requests rejected with 401.
 * - Non-existent resources return 404.
 * - Authorization occurs strictly before SAS URL generation.
 */

import { downloadResume, getResumeHistory } from '../controllers/resumeController';
import { BlobStorageService } from '../services/blobStorageService';
import { db } from '../database/db';
import { config } from '../config';
import { User, Application, Job, ResumeDocument } from '../types';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    headers: {},
    redirectUrl: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    redirect(url: string) {
      this.redirectUrl = url;
      return this;
    },
  };
  return res;
}

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅ PASS  ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`  ❌ FAIL  ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  console.log('\n======================================================');
  console.log('TalentHub Secure Resume Access & Authorization Suite');
  console.log('======================================================\n');

  // ─── Test Entities ──────────────────────────────────────────────────────────

  const candidateA: User = {
    id: 'candidate-uuid-aaa',
    name: 'Alice Candidate',
    email: 'alice@talenthub.test',
    role: 'candidate',
    status: 'active',
    resumeUrl: 'resumes/candidate-uuid-aaa/1700000001-alice-resume.pdf',
    resumeOriginalName: 'Alice_Resume.pdf',
    createdAt: new Date().toISOString(),
  };

  const candidateB: User = {
    id: 'candidate-uuid-bbb',
    name: 'Bob Candidate',
    email: 'bob@talenthub.test',
    role: 'candidate',
    status: 'active',
    resumeUrl: 'resumes/candidate-uuid-bbb/1700000002-bob-resume.pdf',
    resumeOriginalName: 'Bob_Resume.pdf',
    createdAt: new Date().toISOString(),
  };

  const recruiter1: User = {
    id: 'recruiter-uuid-r1',
    name: 'Rachel Recruiter',
    email: 'rachel@recruiting.test',
    role: 'recruiter',
    status: 'active',
    companyId: 'company-techcorp',
    createdAt: new Date().toISOString(),
  };

  const recruiter2: User = {
    id: 'recruiter-uuid-r2',
    name: 'Robert Recruiter',
    email: 'robert@recruiting.test',
    role: 'recruiter',
    status: 'active',
    companyId: 'company-techcorp', // same company, different recruiter!
    createdAt: new Date().toISOString(),
  };

  const adminUser: User = {
    id: 'admin-uuid-root',
    name: 'Adam Admin',
    email: 'admin@talenthub.test',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  // Job managed by Recruiter 1
  const jobRecruiter1: Job = {
    id: 'job-r1-101',
    title: 'Senior Frontend Developer',
    companyId: 'company-techcorp',
    companyName: 'TechCorp',
    recruiterId: recruiter1.id,
    recruiterName: recruiter1.name,
    categoryId: 'cat-eng',
    categoryName: 'Engineering',
    location: 'Remote',
    workplaceType: 'Remote',
    jobType: 'Full-time',
    experienceLevel: 'Senior',
    salaryMin: 120000,
    salaryMax: 160000,
    salaryCurrency: 'USD',
    description: 'React/TS role',
    requirements: ['React', 'TypeScript'],
    skills: ['React', 'TypeScript'],
    benefits: ['Health', '401k'],
    status: 'active',
    isFeatured: true,
    applicantsCount: 1,
    viewsCount: 50,
    expiresAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Job managed by Recruiter 2
  const jobRecruiter2: Job = {
    id: 'job-r2-202',
    title: 'Cloud DevOps Architect',
    companyId: 'company-techcorp',
    companyName: 'TechCorp',
    recruiterId: recruiter2.id,
    recruiterName: recruiter2.name,
    categoryId: 'cat-infra',
    categoryName: 'Infrastructure',
    location: 'Hybrid',
    workplaceType: 'Hybrid',
    jobType: 'Full-time',
    experienceLevel: 'Lead / Principal',
    salaryMin: 150000,
    salaryMax: 200000,
    salaryCurrency: 'USD',
    description: 'Kubernetes role',
    requirements: ['Kubernetes', 'Terraform'],
    skills: ['Kubernetes', 'Terraform'],
    benefits: ['Health'],
    status: 'active',
    isFeatured: false,
    applicantsCount: 1,
    viewsCount: 30,
    expiresAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Candidate A applied to Job 1 (managed by Recruiter 1)
  const appCandidateAToJob1: Application = {
    id: 'app-a-1',
    jobId: jobRecruiter1.id,
    jobTitle: jobRecruiter1.title,
    companyName: jobRecruiter1.companyName,
    candidateId: candidateA.id,
    candidateName: candidateA.name,
    candidateEmail: candidateA.email,
    resumeUrl: candidateA.resumeUrl || '',
    stage: 'Applied',
    matchScore: 85,
    matchDetails: {
      score: 85,
      matchedSkills: ['React', 'TypeScript'],
      missingSkills: [],
      skillScore: 90,
      experienceScore: 80,
      analysisNotes: 'Strong frontend fit',
    },
    recruiterNotes: '',
    timeline: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Candidate B applied to Job 2 (managed by Recruiter 2)
  const appCandidateBToJob2: Application = {
    id: 'app-b-2',
    jobId: jobRecruiter2.id,
    jobTitle: jobRecruiter2.title,
    companyName: jobRecruiter2.companyName,
    candidateId: candidateB.id,
    candidateName: candidateB.name,
    candidateEmail: candidateB.email,
    resumeUrl: candidateB.resumeUrl || '',
    stage: 'Applied',
    matchScore: 92,
    matchDetails: {
      score: 92,
      matchedSkills: ['Kubernetes'],
      missingSkills: [],
      skillScore: 95,
      experienceScore: 90,
      analysisNotes: 'DevOps lead',
    },
    recruiterNotes: '',
    timeline: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Versioned document record for Candidate A
  const docCandidateA: ResumeDocument = {
    id: 'rdoc-cand-a-doc-1',
    candidateId: candidateA.id,
    originalFilename: 'Alice_Resume_v1.pdf',
    blobName: 'resumes/candidate-uuid-aaa/1700000001-alice-resume.pdf',
    containerName: 'talenthub-resumes',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 102400,
    checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadStatus: 'uploaded',
    isCurrent: true,
    uploadedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  // Versioned document record for Candidate B
  const docCandidateB: ResumeDocument = {
    id: 'rdoc-cand-b-doc-2',
    candidateId: candidateB.id,
    originalFilename: 'Bob_Resume_v1.pdf',
    blobName: 'resumes/candidate-uuid-bbb/1700000002-bob-resume.pdf',
    containerName: 'talenthub-resumes',
    fileExtension: 'pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 204800,
    checksumSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef',
    uploadStatus: 'uploaded',
    isCurrent: true,
    uploadedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  // ─── Setup Mocks ────────────────────────────────────────────────────────────

  const originalGetUserById = db.getUserById.bind(db);
  const originalGetApplicationsByCandidateId = db.getApplicationsByCandidateId.bind(db);
  const originalGetJobById = db.getJobById.bind(db);
  const originalGetResumeDocById = db.getResumeDocById.bind(db);
  const originalGetCurrentResume = db.getCurrentResume.bind(db);
  const originalGetResumeHistory = db.getResumeHistory.bind(db);
  const originalGenerateSas = BlobStorageService.generateReadSasUrl.bind(BlobStorageService);

  let sasGenerationCalls: { blobName: string; expiryMinutes: number }[] = [];

  BlobStorageService.generateReadSasUrl = async (blobName: string, expiryMinutes: number = config.storage.sasExpiryMinutes) => {
    sasGenerationCalls.push({ blobName, expiryMinutes });
    return `http://127.0.0.1:10000/devstoreaccount1/talenthub-resumes/${blobName}?sp=r&se=2026-11-11T20%3A00%3A00Z&sig=mockSignatureForTesting789`;
  };

  // Setup DB Mock State
  const allUsers = [candidateA, candidateB, recruiter1, recruiter2, adminUser];
  const allJobs = [jobRecruiter1, jobRecruiter2];
  const allApps = [appCandidateAToJob1, appCandidateBToJob2];
  const allDocs = [docCandidateA, docCandidateB];

  db.getUserById = async (id: string) => allUsers.find((u) => u.id === id);
  db.getJobById = async (id: string) => allJobs.find((j) => j.id === id);
  db.getApplicationsByCandidateId = async (cId: string) => allApps.filter((a) => a.candidateId === cId);
  db.getResumeDocById = async (id: string) => allDocs.find((d) => d.id === id);
  db.getCurrentResume = async (cId: string) => allDocs.find((d) => d.candidateId === cId && d.isCurrent);
  db.getResumeHistory = async (cId: string) => allDocs.filter((d) => d.candidateId === cId);

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // USER STORY 1: TEMPORARY SECURE RESUME LINKS
    // ══════════════════════════════════════════════════════════════════════════

    await test('[US1] Authorized recruiter receives valid temporary SAS URL with expiry info', async () => {
      sasGenerationCalls = [];
      const req: any = {
        user: recruiter1,
        params: { id: candidateA.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(typeof res.body.downloadUrl === 'string', 'Expected downloadUrl in response body');
      assert(res.body.downloadUrl.includes('sp=r'), 'Expected read-only permission in SAS token');
      assert(res.body.downloadUrl.includes('sig='), 'Expected signature in SAS token');
      assert(res.body.expiresInMinutes === config.storage.sasExpiryMinutes, 'Expected configured expiresInMinutes');
      assert(typeof res.body.expiresAt === 'string', 'Expected ISO timestamp in expiresAt');
      assert(res.body.originalName === 'Alice_Resume_v1.pdf', 'Expected candidate original filename');
    });

    await test('[US1] SAS URL generated grants read-only permission (sp=r)', async () => {
      const req: any = {
        user: candidateA,
        params: {},
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.downloadUrl.includes('sp=r'), 'SAS URL must contain sp=r for read-only access');
      assert(!res.body.downloadUrl.includes('sp=w'), 'SAS URL must NOT contain write permission');
      assert(!res.body.downloadUrl.includes('sp=d'), 'SAS URL must NOT contain delete permission');
    });

    await test('[US1] SAS expiry duration adheres to application configuration', async () => {
      sasGenerationCalls = [];
      const req: any = {
        user: adminUser,
        params: { id: candidateA.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(sasGenerationCalls.length === 1, 'Expected one SAS generation call');
      assert(
        sasGenerationCalls[0].expiryMinutes === config.storage.sasExpiryMinutes,
        `Expected expiry ${config.storage.sasExpiryMinutes}, got ${sasGenerationCalls[0].expiryMinutes}`
      );
    });

    await test('[US1] Expired link simulation: Re-requesting generates a fresh temporary SAS URL', async () => {
      sasGenerationCalls = [];
      const req1: any = { user: candidateA, params: {}, query: {} };
      const res1 = createMockResponse();
      await downloadResume(req1, res1);

      const req2: any = { user: candidateA, params: {}, query: {} };
      const res2 = createMockResponse();
      await downloadResume(req2, res2);

      assert(res1.statusCode === 200 && res2.statusCode === 200, 'Both requests should succeed');
      assert(sasGenerationCalls.length === 2, 'Two separate fresh SAS tokens generated on demand');
    });

    await test('[US1] SAS tokens are NOT permanently written to the MySQL database', async () => {
      const userBefore = await db.getUserById(candidateA.id);
      const req: any = { user: candidateA, params: {}, query: {} };
      const res = createMockResponse();
      await downloadResume(req, res);

      const userAfter = await db.getUserById(candidateA.id);
      assert(!userAfter?.resumeUrl?.includes('sig='), 'Candidate resumeUrl must not contain SAS token in DB');
      assert(!docCandidateA.blobName.includes('sig='), 'ResumeDocument blobName must not contain SAS token');
    });

    // ══════════════════════════════════════════════════════════════════════════
    // USER STORY 2: ROLE-BASED & APPLICATION-BASED AUTHORIZATION
    // ══════════════════════════════════════════════════════════════════════════

    await test('[US2] Candidate can access their own resume (default no-param)', async () => {
      const req: any = { user: candidateA, params: {}, query: {} };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.candidateId === candidateA.id, 'Expected candidate A ID returned');
    });

    await test('[US2] Candidate can access their own resume by document ID (rdoc-...)', async () => {
      const req: any = { user: candidateA, params: { id: docCandidateA.id }, query: {} };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.candidateId === candidateA.id, 'Expected candidate A ID returned');
    });

    await test('[US2] Candidate CANNOT access another candidate resume by candidate ID (403 Forbidden)', async () => {
      sasGenerationCalls = [];
      const req: any = {
        user: candidateA,
        params: { id: candidateB.id }, // Alice tries to download Bob's resume!
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
      assert(res.body.message.includes('Forbidden') || res.body.message.includes('not authorized'), 'Expected authorization error');
      assert(sasGenerationCalls.length === 0, 'CRITICAL: SAS URL generation MUST NOT be called for unauthorized request');
    });

    await test('[US2] Candidate CANNOT access another candidate document by document ID (403 Forbidden)', async () => {
      sasGenerationCalls = [];
      const req: any = {
        user: candidateA,
        params: { id: docCandidateB.id }, // Alice tries to access Bob's rdoc!
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
      assert(sasGenerationCalls.length === 0, 'CRITICAL: SAS generation skipped on 403');
    });

    await test('[US2] Candidate can view their own resume history', async () => {
      const req: any = { user: candidateA, params: {} };
      const res = createMockResponse();

      await getResumeHistory(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(Array.isArray(res.body.history), 'Expected history array');
      assert(res.body.total === 1, `Expected 1 history item, got ${res.body.total}`);
    });

    await test('[US2] Candidate CANNOT view another candidate resume history (403 Forbidden)', async () => {
      const req: any = {
        user: candidateA,
        params: { candidateId: candidateB.id }, // Alice asks for Bob's history
      };
      const res = createMockResponse();

      await getResumeHistory(req, res);

      assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
      assert(res.body.message.includes('Forbidden'), 'Expected Forbidden error');
    });

    await test('[US2] Recruiter CAN access candidate resume if candidate applied to their job (200)', async () => {
      // Candidate A applied to jobRecruiter1 (managed by Recruiter 1)
      const req: any = {
        user: recruiter1,
        params: { id: candidateA.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.downloadUrl.includes('sig='), 'Expected valid download URL');
    });

    await test('[US2] Recruiter CANNOT access candidate resume if candidate did NOT apply to their job (403 Forbidden)', async () => {
      // Candidate B applied ONLY to jobRecruiter2 (managed by Recruiter 2).
      // Recruiter 1 has NO relationship with Candidate B!
      sasGenerationCalls = [];
      const req: any = {
        user: recruiter1,
        params: { id: candidateB.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
      assert(res.body.message.includes('not authorized') || res.body.message.includes('Forbidden'), 'Expected error message');
      assert(sasGenerationCalls.length === 0, 'No SAS generated for unauthorized recruiter');
    });

    await test('[US2] Recruiter CANNOT access another recruiter applicant in the same company (403 Forbidden)', async () => {
      // Recruiter 1 and Recruiter 2 share company-techcorp.
      // Recruiter 2 tries to download Candidate A's resume (who applied ONLY to Recruiter 1's job).
      sasGenerationCalls = [];
      const req: any = {
        user: recruiter2,
        params: { id: candidateA.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
      assert(sasGenerationCalls.length === 0, 'No SAS generated for non-managing recruiter');
    });

    await test('[US2] Recruiter can view resume history of candidate who applied to their job', async () => {
      const req: any = {
        user: recruiter1,
        params: { candidateId: candidateA.id },
      };
      const res = createMockResponse();

      await getResumeHistory(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.total === 1, 'Expected 1 resume version for Candidate A');
    });

    await test('[US2] Recruiter CANNOT view resume history of unrelated candidate (403 Forbidden)', async () => {
      const req: any = {
        user: recruiter1,
        params: { candidateId: candidateB.id },
      };
      const res = createMockResponse();

      await getResumeHistory(req, res);

      assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
    });

    await test('[US2] Recruiter calling /history without candidateId returns 400 Bad Request', async () => {
      const req: any = {
        user: recruiter1,
        params: {}, // No candidateId specified
      };
      const res = createMockResponse();

      await getResumeHistory(req, res);

      assert(res.statusCode === 400, `Expected 400 Bad Request, got ${res.statusCode}`);
      assert(res.body.message.includes('Candidate ID is required'), 'Expected error requiring candidateId');
    });

    await test('[US2] Administrator can access any candidate resume download (200)', async () => {
      const req: any = {
        user: adminUser,
        params: { id: candidateB.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200 for Admin, got ${res.statusCode}`);
      assert(res.body.downloadUrl.includes('sig='), 'Expected SAS download URL');
    });

    await test('[US2] Administrator can access any candidate resume history (200)', async () => {
      const req: any = {
        user: adminUser,
        params: { candidateId: candidateB.id },
      };
      const res = createMockResponse();

      await getResumeHistory(req, res);

      assert(res.statusCode === 200, `Expected 200 for Admin, got ${res.statusCode}`);
      assert(res.body.total === 1, 'Expected history returned to admin');
    });

    await test('[US2] Unauthenticated request to download returns 401 Unauthorized', async () => {
      const req: any = {
        user: undefined, // No user session
        params: { id: candidateA.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 401, `Expected 401 Unauthorized, got ${res.statusCode}`);
    });

    await test('[US2] Unauthenticated request to history returns 401 Unauthorized', async () => {
      const req: any = {
        user: undefined,
        params: {},
      };
      const res = createMockResponse();

      await getResumeHistory(req, res);

      assert(res.statusCode === 401, `Expected 401 Unauthorized, got ${res.statusCode}`);
    });

    await test('[US2] Request for non-existent candidate or document returns 404 Not Found', async () => {
      const req: any = {
        user: adminUser,
        params: { id: 'non-existent-candidate-or-doc-999' },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 404, `Expected 404 Not Found, got ${res.statusCode}`);
    });

  } finally {
    // Restore mocks
    db.getUserById = originalGetUserById;
    db.getJobById = originalGetJobById;
    db.getApplicationsByCandidateId = originalGetApplicationsByCandidateId;
    db.getResumeDocById = originalGetResumeDocById;
    db.getCurrentResume = originalGetCurrentResume;
    db.getResumeHistory = originalGetResumeHistory;
    BlobStorageService.generateReadSasUrl = originalGenerateSas;
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed === 0) {
    console.log('🎉 All security and role authorization tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. See details above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL] Test runner crashed:', err);
  process.exit(2);
});
