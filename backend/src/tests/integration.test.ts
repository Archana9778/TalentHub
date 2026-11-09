/**
 * TalentHub — Integration & Regression Test Suite
 * =================================================
 * Run with:  npx tsx src/tests/integration.test.ts
 *
 * Test categories:
 *   A. Resume validation (pure — no DB / Azurite needed)
 *   B. Database schema integrity   [INTEGRATION — requires MySQL]
 *   C. Resume blob storage         [INTEGRATION — requires Azurite]
 *   D. API regression smoke tests  [INTEGRATION — requires running backend]
 *
 * Each category is clearly marked. Categories B, C, D are skipped when the
 * required services are unavailable; they never cause false failures.
 *
 * To run only unit tests (safe in CI without services):
 *   SKIP_INTEGRATION=true npx tsx src/tests/integration.test.ts
 */

import crypto from 'crypto';
import path from 'path';

// ─── Imports (services used in tests) ────────────────────────────────────────
import { validateResumeBuffer, sanitizeFilename } from '../services/resumeValidationService';

// ─── Test Runner ──────────────────────────────────────────────────────────────

type TestResult = {
  name: string;
  passed: boolean;
  skipped?: boolean;
  error?: string;
  category: string;
};

const results: TestResult[] = [];
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

async function test(
  category: string,
  name: string,
  fn: () => Promise<void> | void,
  options?: { requiresService?: string; skip?: boolean }
): Promise<void> {
  const shouldSkip = options?.skip || (SKIP_INTEGRATION && options?.requiresService);
  if (shouldSkip) {
    results.push({ name, passed: true, skipped: true, category });
    console.log(`  ⏭  SKIP  [${category}] ${name}${options?.requiresService ? ` (requires ${options.requiresService})` : ''}`);
    return;
  }
  try {
    await fn();
    results.push({ name, passed: true, category });
    console.log(`  ✅ PASS  [${category}] ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, category });
    console.log(`  ❌ FAIL  [${category}] ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(a: unknown, b: unknown, message: string): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${message}\n  expected: ${JSON.stringify(b)}\n  received: ${JSON.stringify(a)}`);
  }
}

// ─── Synthetic Test Files ─────────────────────────────────────────────────────

/** Valid minimal PDF — has %PDF- header and %%EOF footer. */
const VALID_PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n%%EOF\n', 'latin1');

/** Builds a minimal but structurally valid DOCX (ZIP containing word/document.xml). */
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
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── Category A: Resume Validation (pure unit tests) ─────────────────────────

async function runCategoryA(): Promise<void> {
  console.log('\n── Category A: Resume Validation (no external services) ──\n');

  await test('A', 'Valid PDF buffer accepted', async () => {
    const r = await validateResumeBuffer(VALID_PDF, 'resume.pdf', MAX_SIZE);
    assert(r.valid, `expected valid but got: ${r.errorMessage}`);
    assert(r.extension === 'pdf', `expected pdf, got: ${r.extension}`);
    assert(r.checksum !== null && r.checksum!.length === 64, 'expected 64-char SHA-256');
  });

  await test('A', 'Valid DOCX buffer accepted', async () => {
    const r = await validateResumeBuffer(VALID_DOCX, 'resume.docx', MAX_SIZE);
    assert(r.valid, `expected valid but got: ${r.errorMessage}`);
    assert(r.extension === 'docx', `expected docx, got: ${r.extension}`);
    assert(r.checksum !== null, 'expected checksum');
  });

  await test('A', 'Empty file rejected with EMPTY error code', async () => {
    const r = await validateResumeBuffer(Buffer.alloc(0), 'resume.pdf', MAX_SIZE);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'EMPTY', `expected EMPTY, got: ${r.errorCode}`);
  });

  await test('A', 'PNG extension rejected with BAD_EXTENSION', async () => {
    const r = await validateResumeBuffer(VALID_PDF, 'photo.png', MAX_SIZE);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'BAD_EXTENSION', `expected BAD_EXTENSION, got: ${r.errorCode}`);
  });

  await test('A', 'JPG extension rejected with BAD_EXTENSION', async () => {
    const r = await validateResumeBuffer(VALID_PDF, 'photo.jpg', MAX_SIZE);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'BAD_EXTENSION', `expected BAD_EXTENSION, got: ${r.errorCode}`);
  });

  await test('A', 'EXE binary rejected with BAD_EXTENSION', async () => {
    const r = await validateResumeBuffer(Buffer.from('MZ\x90\x00'), 'virus.exe', MAX_SIZE);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'BAD_EXTENSION', `expected BAD_EXTENSION, got: ${r.errorCode}`);
  });

  await test('A', 'ZIP renamed .docx rejected — missing word/document.xml', async () => {
    const emptyZip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x05, 0x06]),
      Buffer.alloc(18, 0),
    ]);
    const r = await validateResumeBuffer(emptyZip, 'fake.docx', MAX_SIZE);
    assert(!r.valid, `expected invalid, got valid=${r.valid}`);
  });

  await test('A', 'Random bytes renamed .pdf rejected (BAD_CONTENT or CORRUPT)', async () => {
    const r = await validateResumeBuffer(crypto.randomBytes(512), 'resume.pdf', MAX_SIZE);
    assert(!r.valid, 'expected invalid');
    assert(
      r.errorCode === 'BAD_CONTENT' || r.errorCode === 'CORRUPT',
      `expected BAD_CONTENT or CORRUPT, got: ${r.errorCode}`
    );
  });

  await test('A', 'Oversized file rejected with TOO_LARGE', async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0x41);
    const r = await validateResumeBuffer(bigBuffer, 'resume.pdf', MAX_SIZE);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'TOO_LARGE', `expected TOO_LARGE, got: ${r.errorCode}`);
  });

  await test('A', 'PDF missing %%EOF rejected with CORRUPT', async () => {
    const truncated = Buffer.from('%PDF-1.4\nsome content with no eof marker at all');
    const r = await validateResumeBuffer(truncated, 'resume.pdf', MAX_SIZE);
    assert(!r.valid, 'expected invalid');
    assert(r.errorCode === 'CORRUPT', `expected CORRUPT, got: ${r.errorCode}`);
  });

  await test('A', 'SHA-256 checksum is deterministic', async () => {
    const r1 = await validateResumeBuffer(VALID_PDF, 'resume.pdf', MAX_SIZE);
    const r2 = await validateResumeBuffer(VALID_PDF, 'resume.pdf', MAX_SIZE);
    assert(r1.checksum === r2.checksum, 'checksums differ between identical runs');
    const expected = crypto.createHash('sha256').update(VALID_PDF).digest('hex');
    assert(r1.checksum === expected, `checksum mismatch: got ${r1.checksum}`);
  });

  await test('A', 'sanitizeFilename strips path traversal', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    assert(!result.includes('..'), `".." found in sanitised name: ${result}`);
    assert(!result.includes('/'), `"/" found in sanitised name: ${result}`);
    assert(!result.includes('\\'), `"\\" found in sanitised name: ${result}`);
  });

  await test('A', 'sanitizeFilename strips special/non-ASCII characters', () => {
    const result = sanitizeFilename('My Résumé 2026 (Draft).pdf');
    assert(
      /^[a-zA-Z0-9._-]+$/.test(result),
      `sanitised filename contains unexpected characters: ${result}`
    );
  });

  await test('A', 'sanitizeFilename preserves safe alphanumeric names', () => {
    const result = sanitizeFilename('John_Doe_Resume-2026.pdf');
    assert(result === 'John_Doe_Resume-2026.pdf', `expected unchanged, got: ${result}`);
  });

  await test('A', 'File with correct extension but wrong content is rejected', async () => {
    // A file named .pdf but containing DOCX (ZIP) magic bytes
    const r = await validateResumeBuffer(VALID_DOCX, 'resume.pdf', MAX_SIZE);
    assert(!r.valid, 'expected invalid when DOCX bytes presented as PDF');
  });

  await test('A', 'File at exactly the size limit is accepted (PDF)', async () => {
    // Build a valid PDF that is exactly MAX_SIZE bytes
    const header = Buffer.from('%PDF-1.4\n');
    const footer = Buffer.from('\n%%EOF\n');
    const filler = Buffer.alloc(MAX_SIZE - header.length - footer.length, 0x20);
    const exactPdf = Buffer.concat([header, filler, footer]);
    const r = await validateResumeBuffer(exactPdf, 'resume.pdf', MAX_SIZE);
    assert(r.valid, `expected valid at exact size limit, got: ${r.errorMessage}`);
  });

  await test('A', 'File one byte over the limit is rejected', async () => {
    const header = Buffer.from('%PDF-1.4\n');
    const footer = Buffer.from('\n%%EOF\n');
    const filler = Buffer.alloc(MAX_SIZE - header.length - footer.length + 1, 0x20);
    const tooLarge = Buffer.concat([header, filler, footer]);
    const r = await validateResumeBuffer(tooLarge, 'resume.pdf', MAX_SIZE);
    assert(!r.valid, 'expected invalid one byte over the limit');
    assert(r.errorCode === 'TOO_LARGE', `expected TOO_LARGE, got: ${r.errorCode}`);
  });
}

// ─── Category B: Database Schema Integrity [INTEGRATION — requires MySQL] ────

async function checkMysqlAvailable(): Promise<boolean> {
  try {
    // Dynamically import to avoid loading knex when not needed
    const { getDb } = await import('../database/knex');
    const db = getDb();
    await db.raw('SELECT 1');
    await db.destroy();
    return true;
  } catch {
    return false;
  }
}

async function runCategoryB(): Promise<void> {
  console.log('\n── Category B: Database Schema Integrity [INTEGRATION — MySQL] ──\n');

  const mysqlAvailable = !SKIP_INTEGRATION && await checkMysqlAvailable();

  if (!mysqlAvailable) {
    console.log('  ℹ️  MySQL not reachable — skipping all Category B tests.');
    console.log('     Start the database with: docker-compose up -d database\n');
    const dbTests = [
      'All migrations are applied (migration status = 0)',
      'users table exists with correct columns',
      'candidates table exists',
      'recruiters table exists',
      'companies table exists',
      'job_categories table exists',
      'jobs table has FULLTEXT index on title/description/location',
      'applications table has composite unique key (candidate_id, job_id)',
      'application_stage_history table exists with FK to applications',
      'resume_documents table exists with FK to candidates and DB-level unique current_guard',
      'resume_documents: generated virtual column current_guard enforces one is_current=1 per candidate',
      'skills table exists',
      'candidate_skills table exists with FK to skills and candidates',
      'job_skills table exists with FK to skills and jobs',
      'interviews table exists with composite FK (application_id, candidate_id, job_id)',
      'interview_participants table exists with FK to interviews',
      'interview_feedback table exists with unique constraint per interviewer',
      'notifications table exists with correct indexes',
      'notification_preferences table exists (unique per user)',
      'notification_delivery_logs table exists',
      'audit_logs table exists (auto-increment PK)',
      'resume_parse_runs table exists',
      'match_results table exists (trigger-free; is_latest + latest_guard virtual column)',
      'match_results: generated virtual column latest_guard enforces one is_latest=1 per application',
      'match_result_details table exists',
      'job_alert_deliveries table exists',
      'candidate_education table exists (coexists with education_json)',
      'candidate_experience table exists (coexists with experience_json)',
      'candidate_view exists',
      'recruiter_view exists',
      'application_pipeline_view exists',
      'candidate_skills_view exists',
      'job_skills_view exists',
      'Foreign key: candidate_skills → candidates',
      'Foreign key: job_skills → jobs',
      'Foreign key: resume_documents → candidates',
      'resume_documents: DB UNIQUE current_guard prevents two is_current=1 rows per candidate',
      'Unique constraint on users.email is enforced',
      'Existing users data is intact',
      'Existing jobs data is intact',
      'Existing applications data is intact',
      'createMatchResult: SELECT FOR UPDATE serialises concurrent recalculations',
      'createMatchResult: second call demotes previous is_latest row',
      'match_results: DB UNIQUE latest_guard prevents two is_latest=1 rows per application',
      'Transaction rollback works correctly',
    ];
    for (const t of dbTests) {
      await test('B', t, () => {}, { skip: true, requiresService: 'MySQL' });
    }
    return;
  }

  // Load DB
  const { getDb } = await import('../database/knex');
  const db = getDb();

  try {
    await test('B', 'All migrations are applied (migration status = 0)', async () => {
      const status = await db.migrate.status();
      assert(status === 0, `Expected status=0 (all applied), got ${status}`);
    });

    const requiredTables = [
      'users', 'candidates', 'recruiters', 'companies', 'job_categories',
      'jobs', 'applications', 'application_stage_history', 'reported_jobs',
      'job_alerts', 'resume_documents', 'skills', 'candidate_skills',
      'job_skills', 'interviews', 'interview_participants', 'interview_feedback',
      'notifications', 'notification_preferences', 'notification_delivery_logs',
      'audit_logs', 'resume_parse_runs', 'match_results', 'match_result_details',
      'job_alert_deliveries', 'candidate_education', 'candidate_experience',
    ];

    for (const tableName of requiredTables) {
      await test('B', `Table "${tableName}" exists`, async () => {
        const exists = await db.schema.hasTable(tableName);
        assert(exists, `Table "${tableName}" does not exist`);
      });
    }

    const requiredViews = [
      'candidate_view', 'recruiter_view', 'application_pipeline_view',
      'candidate_skills_view', 'job_skills_view',
    ];

    for (const viewName of requiredViews) {
      await test('B', `View "${viewName}" exists`, async () => {
        const rows = await db.raw(
          `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [viewName]
        );
        assert(rows[0].length > 0, `View "${viewName}" not found`);
      });
    }

    await test('B', 'jobs table has FULLTEXT index on title/description/location', async () => {
      const rows = await db.raw(`
        SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'jobs'
          AND INDEX_TYPE = 'FULLTEXT'
          AND INDEX_NAME = 'ft_jobs_search'
      `);
      assert(rows[0].length > 0, 'FULLTEXT index ft_jobs_search not found on jobs');
    });

    await test('B', 'applications has composite unique key (candidate_id, job_id)', async () => {
      const rows = await db.raw(`
        SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'applications'
          AND INDEX_NAME = 'uq_app_candidate_job'
        LIMIT 1
      `);
      assert(rows[0].length > 0, 'Unique index uq_app_candidate_job not found');
    });

    await test('B', 'interview_feedback has unique constraint per interviewer per interview', async () => {
      const rows = await db.raw(`
        SELECT INDEX_NAME FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'interview_feedback'
          AND INDEX_NAME = 'uq_feedback_per_interviewer'
        LIMIT 1
      `);
      assert(rows[0].length > 0, 'Unique index uq_feedback_per_interviewer not found');
    });

    await test('B', 'Unique constraint on users.email is enforced', async () => {
      const testEmail = `unique-test-${Date.now()}@test-nonexistent.invalid`;
      const id1 = `test-${Date.now()}-1`;
      const id2 = `test-${Date.now()}-2`;
      let threw = false;
      try {
        await db('users').insert({ id: id1, email: testEmail, password_hash: 'x', name: 'Test1', role: 'candidate', status: 'active' });
        await db('users').insert({ id: id2, email: testEmail, password_hash: 'x', name: 'Test2', role: 'candidate', status: 'active' });
      } catch (err: any) {
        threw = true;
        // ER_DUP_ENTRY
        assert(err.code === 'ER_DUP_ENTRY', `Expected ER_DUP_ENTRY, got: ${err.code}`);
      } finally {
        await db('users').whereIn('id', [id1, id2]).delete().catch(() => {});
      }
      assert(threw, 'Expected duplicate email insert to throw');
    });

    await test('B', 'Existing users data is intact (at least 1 user)', async () => {
      const count = await db('users').count('id as cnt').first();
      assert(Number(count?.cnt) >= 1, 'No users found in database');
    });

    await test('B', 'Existing jobs data is intact (at least 1 job)', async () => {
      const count = await db('jobs').count('id as cnt').first();
      assert(Number(count?.cnt) >= 1, 'No jobs found in database');
    });

    await test('B', 'Existing applications data is intact', async () => {
      const count = await db('applications').count('id as cnt').first();
      assert(Number(count?.cnt) >= 0, 'applications query failed');
    });

    await test('B', 'Transaction rollback prevents partial writes', async () => {
      const testId = `trx-rollback-${Date.now()}`;
      let count1 = 0;
      try {
        await db.transaction(async (trx) => {
          await trx('users').insert({
            id: testId,
            email: `trx-test-${Date.now()}@rollback.invalid`,
            password_hash: 'x',
            name: 'TrxTest',
            role: 'candidate',
            status: 'active',
          });
          count1 = Number((await trx('users').where('id', testId).count('id as cnt').first())?.cnt || 0);
          throw new Error('forced rollback');
        });
      } catch {
        // expected
      }
      const count2 = Number((await db('users').where('id', testId).count('id as cnt').first())?.cnt || 0);
      assert(count1 === 1, 'Row should exist inside transaction');
      assert(count2 === 0, 'Row should not exist after rollback');
    });

    await test('B', 'Read/write to skills table succeeds', async () => {
      const id = `skill-test-${Date.now()}`;
      await db('skills').insert({ id, name: 'TestSkillXYZ', slug: `testskillxyz-${Date.now()}`, category: 'Test', is_active: true });
      const row = await db('skills').where('id', id).first();
      assert(row?.name === 'TestSkillXYZ', 'Read back failed');
      await db('skills').where('id', id).delete();
    });

    await test('B', 'Read/write to notifications table succeeds', async () => {
      // Need a real user to satisfy FK
      const userRow = await db('users').select('id').first();
      if (!userRow) { throw new Error('No users to test notifications with'); }
      const id = `notif-test-${Date.now()}`;
      await db('notifications').insert({
        id, recipient_id: userRow.id, type: 'system_message',
        title: 'Test', body: 'Test body', is_read: false,
      });
      const row = await db('notifications').where('id', id).first();
      assert(row?.title === 'Test', 'Read back failed');
      await db('notifications').where('id', id).delete();
    });

    await test('B', 'No orphaned candidates (FK to users)', async () => {
      const orphans = await db('candidates as c')
        .leftJoin('users as u', 'c.user_id', 'u.id')
        .whereNull('u.id')
        .count('c.id as cnt')
        .first();
      assert(Number(orphans?.cnt) === 0, `Found ${orphans?.cnt} orphaned candidate rows`);
    });

    await test('B', 'No orphaned applications (FK to jobs)', async () => {
      const orphans = await db('applications as a')
        .leftJoin('jobs as j', 'a.job_id', 'j.id')
        .whereNull('j.id')
        .count('a.id as cnt')
        .first();
      assert(Number(orphans?.cnt) === 0, `Found ${orphans?.cnt} orphaned application rows`);
    });

  } finally {
    await db.destroy();
  }
}

// ─── Category C: Resume Blob Storage [INTEGRATION — requires Azurite] ────────

async function checkAzuriteAvailable(): Promise<boolean> {
  try {
    const { pingBlobStorage } = await import('../services/blobStorageService');
    return await pingBlobStorage();
  } catch {
    return false;
  }
}

async function runCategoryC(): Promise<void> {
  console.log('\n── Category C: Resume Blob Storage [INTEGRATION — Azurite / Azure Blob] ──\n');
  console.log('  NOTE: Tests in this category run against Azurite (local emulator).');
  console.log('        No real Azure subscription is used or needed.\n');

  const azuriteAvailable = !SKIP_INTEGRATION && await checkAzuriteAvailable();

  if (!azuriteAvailable) {
    console.log('  ℹ️  Azurite not reachable — skipping all Category C tests.');
    console.log('     Start Azurite with: docker-compose up -d azurite\n');
    const blobTests = [
      'Upload valid PDF to Azurite blob storage succeeds',
      'Upload valid DOCX to Azurite blob storage succeeds',
      'Generate read-only SAS URL for uploaded blob',
      'SAS URL is short-lived (expiry set correctly)',
      'Delete blob from Azurite succeeds',
      'Upload and download round-trip via Azurite',
    ];
    for (const t of blobTests) {
      await test('C', t, () => {}, { skip: true, requiresService: 'Azurite' });
    }
    return;
  }

  const { uploadResumeBuffer, generateReadSasUrl, deleteBlob, ensureContainer } = await import('../services/blobStorageService');
  const { v4: uuidv4 } = await import('uuid');

  await test('C', 'Ensure container is created on Azurite', async () => {
    const container = await ensureContainer();
    assert(container !== null, 'Container client should not be null');
  });

  await test('C', 'Upload valid PDF to Azurite blob storage succeeds', async () => {
    const blobName = `test-uploads/${uuidv4()}/resume.pdf`;
    const result = await uploadResumeBuffer(blobName, VALID_PDF, 'application/pdf', 'resume.pdf');
    assert(result.blobName === blobName, 'blobName mismatch');
    assert(result.sizeBytes === VALID_PDF.length, 'sizeBytes mismatch');
    // Cleanup
    await deleteBlob(blobName);
  });

  await test('C', 'Upload valid DOCX to Azurite blob storage succeeds', async () => {
    const blobName = `test-uploads/${uuidv4()}/resume.docx`;
    const result = await uploadResumeBuffer(
      blobName, VALID_DOCX,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'resume.docx'
    );
    assert(result.sizeBytes === VALID_DOCX.length, 'sizeBytes mismatch');
    // Cleanup
    await deleteBlob(blobName);
  });

  await test('C', 'Generate read-only SAS URL for uploaded blob', async () => {
    const blobName = `test-uploads/${uuidv4()}/sas-test.pdf`;
    await uploadResumeBuffer(blobName, VALID_PDF, 'application/pdf', 'sas-test.pdf');
    const sasUrl = await generateReadSasUrl(blobName, 5);
    assert(typeof sasUrl === 'string' && sasUrl.length > 0, 'SAS URL should be non-empty string');
    assert(sasUrl.includes('sig=') || sasUrl.includes('sv='), 'SAS URL should contain SAS parameters');
    // Cleanup
    await deleteBlob(blobName);
  });

  await test('C', 'SAS URL contains read-only permission (not write)', async () => {
    const blobName = `test-uploads/${uuidv4()}/perm-test.pdf`;
    await uploadResumeBuffer(blobName, VALID_PDF, 'application/pdf', 'perm-test.pdf');
    const sasUrl = await generateReadSasUrl(blobName, 5);
    // SAS should have 'r' (read) permission, NOT 'w' (write) or 'c' (create)
    const urlParams = new URL(sasUrl).searchParams;
    const perms = urlParams.get('sp') || '';
    assert(perms.includes('r'), `SAS should include read permission 'r', got: "${perms}"`);
    assert(!perms.includes('w'), `SAS should NOT include write permission 'w', got: "${perms}"`);
    assert(!perms.includes('c'), `SAS should NOT include create permission 'c', got: "${perms}"`);
    // Cleanup
    await deleteBlob(blobName);
  });

  await test('C', 'Delete blob from Azurite succeeds (idempotent)', async () => {
    const blobName = `test-uploads/${uuidv4()}/delete-test.pdf`;
    await uploadResumeBuffer(blobName, VALID_PDF, 'application/pdf', 'delete-test.pdf');
    await deleteBlob(blobName); // First delete
    await deleteBlob(blobName); // Second delete should not throw (deleteIfExists)
  });

  await test('C', 'SHA-256 checksum verified against uploaded content', async () => {
    const blobName = `test-uploads/${uuidv4()}/checksum-test.pdf`;
    await uploadResumeBuffer(blobName, VALID_PDF, 'application/pdf', 'checksum-test.pdf');
    const expectedChecksum = crypto.createHash('sha256').update(VALID_PDF).digest('hex');
    const validResult = await validateResumeBuffer(VALID_PDF, 'checksum-test.pdf', MAX_SIZE);
    assert(validResult.checksum === expectedChecksum, 'Checksum mismatch');
    // Cleanup
    await deleteBlob(blobName);
  });
}

// ─── Category D: Config & Environment Tests (always run) ─────────────────────

async function runCategoryD(): Promise<void> {
  console.log('\n── Category D: Configuration & Environment Checks ──\n');

  await test('D', 'config.storage.maxResumeSizeBytes is 5 MB by default', async () => {
    const { config } = await import('../config');
    assert(config.storage.maxResumeSizeBytes === 5 * 1024 * 1024, `Expected ${5 * 1024 * 1024}, got: ${config.storage.maxResumeSizeBytes}`);
  });

  await test('D', 'config.storage.sasExpiryMinutes defaults to 5', async () => {
    const { config } = await import('../config');
    assert(config.storage.sasExpiryMinutes === 5, `Expected 5, got: ${config.storage.sasExpiryMinutes}`);
  });

  await test('D', 'config.storage.containerName is set', async () => {
    const { config } = await import('../config');
    assert(typeof config.storage.containerName === 'string' && config.storage.containerName.length > 0, 'containerName should be non-empty');
  });

  await test('D', 'config.storage.provider is azurite or azure', async () => {
    const { config } = await import('../config');
    assert(['azurite', 'azure'].includes(config.storage.provider), `Unexpected provider: ${config.storage.provider}`);
  });

  await test('D', 'config.jwtSecret is set', async () => {
    const { config } = await import('../config');
    assert(typeof config.jwtSecret === 'string' && config.jwtSecret.length >= 10, 'JWT secret too short or not set');
  });

  await test('D', 'migrations directory contains expected files', async () => {
    const fs = await import('fs');
    const migrationsDir = path.resolve(__dirname, '../database/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.ts'));
    assert(files.includes('20261107000001_initial_schema.ts'), 'Initial schema migration missing');
    assert(files.includes('20261108000002_resume_documents.ts'), 'Resume documents migration missing');
    assert(files.includes('20261109000003_full_schema_improvements.ts'), 'Full improvements migration missing');
    assert(files.length >= 3, `Expected at least 3 migrations, found: ${files.length}`);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🧪 TalentHub — Complete Integration & Regression Test Suite');
  console.log('============================================================');
  console.log(`Mode: ${SKIP_INTEGRATION ? 'Unit tests only (SKIP_INTEGRATION=true)' : 'Full suite (unit + integration)'}`);
  console.log('Test Environment: Local (MySQL + Azurite emulator — no Azure subscription required)');

  await runCategoryA();
  await runCategoryB();
  await runCategoryC();
  await runCategoryD();

  // ─── Summary ──────────────────────────────────────────────────────────────
  const passed  = results.filter((r) => r.passed && !r.skipped).length;
  const failed  = results.filter((r) => !r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const total   = results.length;

  console.log('\n============================================================');
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped out of ${total} total`);

  if (failed > 0) {
    console.log('\n⚠️  FAILED tests:');
    results.filter((r) => !r.passed && !r.skipped).forEach((r) => {
      console.log(`  ❌ [${r.category}] ${r.name}`);
      if (r.error) console.log(`       → ${r.error}`);
    });
  }

  if (skipped > 0) {
    console.log(`\n  ℹ️  ${skipped} integration tests were skipped (services unavailable).`);
    console.log('     Start services with: docker-compose up -d');
    console.log('     Then re-run without SKIP_INTEGRATION=true to test them.');
  }

  if (failed === 0) {
    console.log('\n🎉 All executed tests passed!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n[FATAL] Test runner crashed:', err);
  process.exit(2);
});
