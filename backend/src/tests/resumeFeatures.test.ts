/**
 * TalentHub Resume Feature Integration Tests
 * Run with: ./backend/node_modules/.bin/tsx.cmd backend/src/tests/resumeFeatures.test.ts
 *
 * Verifies all 3 user stories:
 * 1. Candidate uploads resume in PDF or DOCX format.
 * 2. System validates file type, actual content, corruption, and maximum file size.
 * 3. System stores valid resumes in private Azure Blob Storage and generates secure SAS URLs.
 * 4. Authorized recruiter & candidate access control.
 * 5. Rollback and orphaned blob cleanup on database write failure.
 */

import crypto from 'crypto';
import { uploadResume, downloadResume, getMyResume, getResumeHistory } from '../controllers/resumeController';
import { BlobStorageService } from '../services/blobStorageService';
import { db } from '../database/db';
import { User, Application, Job } from '../types';

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const VALID_PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');

function buildMinimalDocx(): Buffer {
  const entryName = 'word/document.xml';
  const entryContent = Buffer.from('<root/>');
  const fnBuf = Buffer.from(entryName);

  const crc = computeCrc32(entryContent);

  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(20, 4);
  lfh.writeUInt16LE(0, 6);
  lfh.writeUInt16LE(0, 8);
  lfh.writeUInt16LE(0, 10);
  lfh.writeUInt16LE(0, 12);
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(entryContent.length, 18);
  lfh.writeUInt32LE(entryContent.length, 22);
  lfh.writeUInt16LE(fnBuf.length, 26);
  lfh.writeUInt16LE(0, 28);

  const lfhBlock = Buffer.concat([lfh, fnBuf, entryContent]);

  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(20, 4);
  cdh.writeUInt16LE(20, 6);
  cdh.writeUInt16LE(0, 8);
  cdh.writeUInt16LE(0, 10);
  cdh.writeUInt16LE(0, 12);
  cdh.writeUInt16LE(0, 14);
  cdh.writeUInt32LE(crc, 16);
  cdh.writeUInt32LE(entryContent.length, 20);
  cdh.writeUInt32LE(entryContent.length, 24);
  cdh.writeUInt16LE(fnBuf.length, 28);
  cdh.writeUInt16LE(0, 30);
  cdh.writeUInt16LE(0, 32);
  cdh.writeUInt16LE(0, 34);
  cdh.writeUInt16LE(0, 36);
  cdh.writeUInt32LE(0, 38);
  cdh.writeUInt32LE(0, 42);

  const cdhBlock = Buffer.concat([cdh, fnBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdhBlock.length, 12);
  eocd.writeUInt32LE(lfhBlock.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([lfhBlock, cdhBlock, eocd]);
}

function computeCrc32(buf: Buffer): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const VALID_DOCX = buildMinimalDocx();

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

// ─── Test Harness ─────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  \u2705 PASS  ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.log(`  \u274c FAIL  ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ─── Main Test Suite ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n======================================================');
  console.log('TalentHub Resume End-to-End Features & User Stories');
  console.log('======================================================\n');

  const testCandidate: User = {
    id: 'candidate-uuid-101',
    name: 'Alice Johnson',
    email: 'alice@talenthub.test',
    role: 'candidate',
    status: 'active',
    skills: ['TypeScript', 'Node.js'],
    createdAt: new Date().toISOString(),
  };

  const testRecruiter: User = {
    id: 'recruiter-uuid-202',
    name: 'Bob Recruiter',
    email: 'bob@talenthub.test',
    role: 'recruiter',
    status: 'active',
    companyId: 'company-acme',
    createdAt: new Date().toISOString(),
  };

  // Mock DB methods for isolation
  const originalGetUserById = db.getUserById.bind(db);
  const originalUpdateUser = db.updateUser.bind(db);
  const originalGetApplicationsByCandidateId = db.getApplicationsByCandidateId.bind(db);
  const originalGetJobById = db.getJobById.bind(db);
  const originalCreateResumeDocument = db.createResumeDocument.bind(db);
  const originalGetCurrentResume = db.getCurrentResume.bind(db);
  const originalGetResumeHistory = db.getResumeHistory.bind(db);
  const originalGetResumeDocById = db.getResumeDocById.bind(db);

  // Mock Blob Storage upload & delete to verify interactions without external services
  let uploadedBlobs: string[] = [];
  let deletedBlobs: string[] = [];
  const originalUpload = BlobStorageService.uploadResumeBuffer.bind(BlobStorageService);
  const originalDelete = BlobStorageService.deleteBlob.bind(BlobStorageService);

  BlobStorageService.uploadResumeBuffer = async (blobName: string, buffer: Buffer, mime: string, meta?: any) => {
    uploadedBlobs.push(blobName);
    return {
      blobName,
      blobUrl: `http://127.0.0.1:10000/devstoreaccount1/talenthub-resumes/${blobName}`,
      containerName: 'talenthub-resumes',
      contentType: mime,
      sizeBytes: buffer.length,
    };
  };

  BlobStorageService.deleteBlob = async (blobName: string) => {
    deletedBlobs.push(blobName);
    return true;
  };

  try {
    // ── 1. RESUME UPLOAD USER STORY ──────────────────────────────────────────

    await test('Candidate uploads valid PDF: receives 200, SAS URL, and user record is updated', async () => {
      let savedUserUpdates: any = null;
      db.updateUser = async (id: string, updates: Partial<User>) => {
        savedUserUpdates = updates;
        return { ...testCandidate, ...updates };
      };

      const req: any = {
        user: { ...testCandidate },
        file: {
          originalname: 'Alice_Resume.pdf',
          buffer: VALID_PDF,
          size: VALID_PDF.length,
          mimetype: 'application/pdf',
        },
      };
      const res = createMockResponse();

      await uploadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.message.includes('successfully'), 'Expected success message');
      assert(res.body.blobName.startsWith(`resumes/${testCandidate.id}/`), 'Expected blobName prefix');
      assert(res.body.resumeUrl.includes('sig='), 'Expected SAS URL with signature');
      assert(res.body.resumeUrl.includes('sp=r'), 'Expected SAS URL with read permission');
      assert(savedUserUpdates !== null, 'Expected db.updateUser to have been called');
      assert(savedUserUpdates.resumeOriginalName === 'Alice_Resume.pdf', 'Expected original filename preserved');
      assert(savedUserUpdates.resumeUrl === res.body.blobName, 'Expected resume blob identifier saved in DB');
    });

    await test('Candidate uploads valid DOCX: receives 200 and processes successfully', async () => {
      db.updateUser = async (id: string, updates: Partial<User>) => ({ ...testCandidate, ...updates });

      const req: any = {
        user: { ...testCandidate },
        file: {
          originalname: 'Alice_Profile.docx',
          buffer: VALID_DOCX,
          size: VALID_DOCX.length,
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      };
      const res = createMockResponse();

      await uploadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.blobName.endsWith('.docx'), 'Expected .docx extension on blob name');
    });

    // ── 2. VALIDATION USER STORY ─────────────────────────────────────────────

    await test('Rejects unauthenticated upload request with 401', async () => {
      const req: any = {
        user: undefined,
        file: { originalname: 'resume.pdf', buffer: VALID_PDF },
      };
      const res = createMockResponse();

      await uploadResume(req, res);
      assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    });

    await test('Rejects non-candidate role upload attempt with 403', async () => {
      const req: any = {
        user: { ...testRecruiter },
        file: { originalname: 'resume.pdf', buffer: VALID_PDF },
      };
      const res = createMockResponse();

      await uploadResume(req, res);
      assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    });

    await test('Rejects legacy .doc resume with 415', async () => {
      const req: any = {
        user: { ...testCandidate },
        file: { originalname: 'old_resume.doc', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) },
      };
      const res = createMockResponse();

      await uploadResume(req, res);
      assert(res.statusCode === 415, `Expected 415, got ${res.statusCode}`);
      assert(res.body.message.includes('.doc'), 'Expected rejection message mentioning .doc');
    });

    await test('Rejects executable and unsupported file formats with 415', async () => {
      const req: any = {
        user: { ...testCandidate },
        file: { originalname: 'payload.exe', buffer: Buffer.from('MZ\x90\x00') },
      };
      const res = createMockResponse();

      await uploadResume(req, res);
      assert(res.statusCode === 415, `Expected 415, got ${res.statusCode}`);
    });

    await test('Rejects corrupted PDF (missing %%EOF marker) with 400', async () => {
      const corruptPdf = Buffer.from('%PDF-1.4\ncorrupted file without eof trailer');
      const req: any = {
        user: { ...testCandidate },
        file: { originalname: 'corrupted.pdf', buffer: corruptPdf },
      };
      const res = createMockResponse();

      await uploadResume(req, res);
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      assert(res.body.message.includes('corrupted') || res.body.message.includes('incomplete'), 'Expected corruption error');
    });

    await test('Rejects corrupted DOCX (missing word/document.xml) with 400', async () => {
      // Empty ZIP archive with no word/document.xml entry
      const emptyZip = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x05, 0x06]),
        Buffer.alloc(18, 0),
      ]);
      const req: any = {
        user: { ...testCandidate },
        file: { originalname: 'fake.docx', buffer: emptyZip },
      };
      const res = createMockResponse();

      await uploadResume(req, res);
      assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
      assert(
        res.body.message.includes('word/document.xml') || res.body.message.includes('DOCX structure'),
        `Expected DOCX validation error, got: ${res.body.message}`
      );
    });

    await test('Rejects oversized file (> 10MB) with 413', async () => {
      const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 0x20); // 11 MB
      const req: any = {
        user: { ...testCandidate },
        file: { originalname: 'huge.pdf', buffer: bigBuffer },
      };
      const res = createMockResponse();

      await uploadResume(req, res);
      assert(res.statusCode === 413, `Expected 413, got ${res.statusCode}`);
    });

    // ── 3. AZURE BLOB STORAGE & CLEANUP USER STORY ───────────────────────────

    await test('Orphan blob cleanup: deletes uploaded blob if database update fails', async () => {
      deletedBlobs = [];
      db.updateUser = async () => {
        throw new Error('Simulated MySQL Connection Timeout');
      };

      const req: any = {
        user: { ...testCandidate },
        file: { originalname: 'Alice_Resume.pdf', buffer: VALID_PDF },
      };
      const res = createMockResponse();

      await uploadResume(req, res);

      assert(res.statusCode === 500, `Expected 500 on db error, got ${res.statusCode}`);
      assert(deletedBlobs.length > 0, 'Expected uploaded blob to be deleted upon DB failure');
      assert(deletedBlobs[0].startsWith(`resumes/${testCandidate.id}/`), 'Deleted blob name matches candidate upload');
    });

    // ── 4. AUTHORIZED RESUME DOWNLOAD ────────────────────────────────────────

    await test('Candidate can download their own stored resume', async () => {
      const candidateWithResume: User = {
        ...testCandidate,
        resumeUrl: 'resumes/candidate-uuid-101/1700000000-resume.pdf',
        resumeOriginalName: 'Alice_Resume.pdf',
      };
      db.getUserById = async (id: string) => (id === candidateWithResume.id ? candidateWithResume : undefined);

      const req: any = {
        user: { ...candidateWithResume },
        params: {},
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
      assert(res.body.downloadUrl.includes('sig='), 'Expected SAS signature in download URL');
      assert(res.body.originalName === 'Alice_Resume.pdf', 'Expected original filename returned');
    });

    await test('Recruiter can download resume of a candidate who applied to recruiter’s job', async () => {
      const candidateWithResume: User = {
        ...testCandidate,
        resumeUrl: 'resumes/candidate-uuid-101/1700000000-resume.pdf',
        resumeOriginalName: 'Alice_Resume.pdf',
      };
      const testJob: Job = {
        id: 'job-101',
        title: 'Full Stack Engineer',
        companyId: 'company-acme',
        companyName: 'Acme Corp',
        recruiterId: testRecruiter.id,
        recruiterName: testRecruiter.name,
        categoryId: 'cat-1',
        categoryName: 'Engineering',
        location: 'Remote',
        workplaceType: 'Remote',
        jobType: 'Full-time',
        experienceLevel: 'Senior',
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: 'USD',
        description: 'Great job',
        requirements: [],
        skills: [],
        benefits: [],
        status: 'active',
        isFeatured: false,
        applicantsCount: 1,
        viewsCount: 10,
        expiresAt: '',
        createdAt: '',
        updatedAt: '',
      };
      const testApp: Application = {
        id: 'app-501',
        jobId: testJob.id,
        jobTitle: testJob.title,
        companyName: testJob.companyName,
        candidateId: candidateWithResume.id,
        candidateName: candidateWithResume.name,
        candidateEmail: candidateWithResume.email,
        resumeUrl: candidateWithResume.resumeUrl || '',
        stage: 'Applied',
        matchScore: 90,
        matchDetails: { score: 90, matchedSkills: [], missingSkills: [], skillScore: 90, experienceScore: 90, analysisNotes: '' },
        recruiterNotes: '',
        timeline: [],
        createdAt: '',
        updatedAt: '',
      };

      db.getUserById = async (id: string) => (id === candidateWithResume.id ? candidateWithResume : testRecruiter);
      db.getApplicationsByCandidateId = async (cId: string) => (cId === candidateWithResume.id ? [testApp] : []);
      db.getJobById = async (jId: string) => (jId === testJob.id ? testJob : undefined);

      const req: any = {
        user: { ...testRecruiter },
        params: { candidateId: candidateWithResume.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 200, `Expected 200 for authorized recruiter, got ${res.statusCode}`);
      assert(res.body.downloadUrl.includes('sig='), 'Expected SAS download URL');
    });

    await test('Recruiter CANNOT download resume of candidate who did NOT apply to their jobs (403)', async () => {
      const candidateWithResume: User = {
        ...testCandidate,
        id: 'candidate-unrelated-999',
        resumeUrl: 'resumes/candidate-unrelated-999/1700000000-resume.pdf',
        resumeOriginalName: 'Unrelated_Resume.pdf',
      };

      // Candidate has zero applications to this recruiter's jobs
      db.getUserById = async (id: string) => (id === candidateWithResume.id ? candidateWithResume : testRecruiter);
      db.getApplicationsByCandidateId = async () => [];

      const req: any = {
        user: { ...testRecruiter },
        params: { candidateId: candidateWithResume.id },
        query: {},
      };
      const res = createMockResponse();

      await downloadResume(req, res);

      assert(res.statusCode === 403, `Expected 403 Forbidden, got ${res.statusCode}`);
      assert(res.body.message.includes('not authorized'), 'Expected authorization error message');
    });

    // ── 5. RESUME DOCUMENT VERSIONING & METADATA ─────────────────────────────

    await test('Versioned resume storage: second upload demotes first upload to isCurrent=false, keeping both in history', async () => {
      const storedDocs: any[] = [];
      db.createResumeDocument = async (doc: any) => {
        storedDocs.forEach((d) => {
          if (d.candidateId === doc.candidateId) d.isCurrent = false;
        });
        const saved = { ...doc, isCurrent: true };
        storedDocs.push(saved);
        return saved;
      };
      db.getCurrentResume = async (candId: string) => storedDocs.find((d) => d.candidateId === candId && d.isCurrent);
      db.getResumeHistory = async (candId: string) => storedDocs.filter((d) => d.candidateId === candId);
      db.getResumeDocById = async (id: string) => storedDocs.find((d) => d.id === id);
      db.updateUser = async (id: string, updates: Partial<User>) => ({ ...testCandidate, ...updates });

      // First upload: PDF
      const req1: any = {
        user: { ...testCandidate },
        file: { originalname: 'Version_1.pdf', buffer: VALID_PDF },
      };
      const res1 = createMockResponse();
      await uploadResume(req1, res1);
      assert(res1.statusCode === 200, `Expected 200 for upload 1, got ${res1.statusCode}`);
      const doc1Id = res1.body.resume.id;

      // Second upload: DOCX
      const req2: any = {
        user: { ...testCandidate },
        file: { originalname: 'Version_2.docx', buffer: VALID_DOCX },
      };
      const res2 = createMockResponse();
      await uploadResume(req2, res2);
      assert(res2.statusCode === 200, `Expected 200 for upload 2, got ${res2.statusCode}`);
      const doc2Id = res2.body.resume.id;

      // Verify versioning in storage
      assert(storedDocs.length === 2, `Expected 2 stored documents, found ${storedDocs.length}`);
      const doc1 = storedDocs.find((d) => d.id === doc1Id);
      const doc2 = storedDocs.find((d) => d.id === doc2Id);
      assert(doc1 && doc1.isCurrent === false, 'Expected first upload to be demoted to isCurrent=false');
      assert(doc2 && doc2.isCurrent === true, 'Expected second upload to be isCurrent=true');

      // Verify getMyResume endpoint returns latest current resume
      const reqMy: any = { user: { ...testCandidate } };
      const resMy = createMockResponse();
      await getMyResume(reqMy, resMy);
      assert(resMy.statusCode === 200, 'Expected 200 from getMyResume');
      assert(resMy.body.resume.id === doc2Id, 'Expected getMyResume to return version 2');

      // Verify getResumeHistory returns both versions
      const reqHist: any = { user: { ...testCandidate } };
      const resHist = createMockResponse();
      await getResumeHistory(reqHist, resHist);
      assert(resHist.statusCode === 200, 'Expected 200 from getResumeHistory');
      assert(resHist.body.total === 2, `Expected 2 resumes in history, got ${resHist.body.total}`);

      // Verify download by document ID (rdoc-...)
      const reqDownDoc: any = {
        user: { ...testCandidate },
        params: { id: doc1Id },
        query: {},
      };
      const resDownDoc = createMockResponse();
      await downloadResume(reqDownDoc, resDownDoc);
      assert(resDownDoc.statusCode === 200, `Expected 200 when downloading by document ID, got ${resDownDoc.statusCode}`);
      assert(resDownDoc.body.originalName === 'Version_1.pdf', 'Expected Version 1 original filename in download');
    });

    await test('Orphan blob cleanup: deletes uploaded blob if createResumeDocument fails', async () => {
      deletedBlobs = [];
      db.createResumeDocument = async () => {
        throw new Error('Database disk full');
      };

      const req: any = {
        user: { ...testCandidate },
        file: { originalname: 'Fail_Doc.pdf', buffer: VALID_PDF },
      };
      const res = createMockResponse();
      await uploadResume(req, res);

      assert(res.statusCode === 500, `Expected 500 on createResumeDocument error, got ${res.statusCode}`);
      assert(deletedBlobs.length > 0, 'Expected uploaded blob to be deleted upon createResumeDocument failure');
      assert(deletedBlobs[0].startsWith(`resumes/${testCandidate.id}/`), 'Deleted blob name matches candidate upload');
    });

  } finally {
    // Restore mocks
    db.getUserById = originalGetUserById;
    db.updateUser = originalUpdateUser;
    db.getApplicationsByCandidateId = originalGetApplicationsByCandidateId;
    db.getJobById = originalGetJobById;
    db.createResumeDocument = originalCreateResumeDocument;
    db.getCurrentResume = originalGetCurrentResume;
    db.getResumeHistory = originalGetResumeHistory;
    db.getResumeDocById = originalGetResumeDocById;
    BlobStorageService.uploadResumeBuffer = originalUpload;
    BlobStorageService.deleteBlob = originalDelete;
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  if (failed === 0) {
    console.log('🎉 All resume feature tests passed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. See above for details.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL] Test runner crashed:', err);
  process.exit(2);
});
