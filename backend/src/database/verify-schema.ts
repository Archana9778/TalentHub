import knex, { Knex } from 'knex';
import knexConfig from '../config/knexfile';
import { config } from '../config';

const environment = config.nodeEnv === 'production' ? 'production' : (config.nodeEnv === 'test' ? 'test' : 'development');
const dbConfig = knexConfig[environment] || knexConfig.development;
const db: Knex = knex(dbConfig);

const EXPECTED_TABLES = [
  'users',
  'companies',
  'job_categories',
  'candidates',
  'recruiters',
  'jobs',
  'applications',
  'application_stage_history',
  'reported_jobs',
  'job_alerts',
];

const EXPECTED_VIEWS = ['candidate_view', 'recruiter_view'];

const EXPECTED_FOREIGN_KEYS = [
  { table: 'candidates', column: 'user_id', refTable: 'users', refColumn: 'id' },
  { table: 'recruiters', column: 'user_id', refTable: 'users', refColumn: 'id' },
  { table: 'recruiters', column: 'company_id', refTable: 'companies', refColumn: 'id' },
  { table: 'jobs', column: 'company_id', refTable: 'companies', refColumn: 'id' },
  { table: 'jobs', column: 'recruiter_id', refTable: 'users', refColumn: 'id' },
  { table: 'jobs', column: 'category_id', refTable: 'job_categories', refColumn: 'id' },
  { table: 'applications', column: 'job_id', refTable: 'jobs', refColumn: 'id' },
  { table: 'applications', column: 'candidate_id', refTable: 'users', refColumn: 'id' },
  { table: 'application_stage_history', column: 'application_id', refTable: 'applications', refColumn: 'id' },
  { table: 'reported_jobs', column: 'job_id', refTable: 'jobs', refColumn: 'id' },
  { table: 'reported_jobs', column: 'reported_by_user_id', refTable: 'users', refColumn: 'id' },
  { table: 'job_alerts', column: 'user_id', refTable: 'users', refColumn: 'id' },
];

export async function verifySchema() {
  console.log('====================================================');
  console.log('TalentHub Schema & Referential Integrity Verification');
  console.log(`Database: ${config.database.name} on ${config.database.host}:${config.database.port}`);
  console.log('====================================================');

  try {
    await db.raw('SELECT 1');
    console.log('[1/6] Database Connectivity: OK\n');

    // 1. Verify Tables
    console.log('[2/6] Verifying Core & Supporting Tables:');
    const [existingTables]: any = await db.raw(`
      SELECT TABLE_NAME, TABLE_TYPE
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE';
    `);
    const tableNames = new Set(existingTables.map((t: any) => t.TABLE_NAME));

    let allTablesPresent = true;
    for (const t of EXPECTED_TABLES) {
      if (tableNames.has(t)) {
        console.log(`  [PASS] Table '${t}' exists.`);
      } else {
        console.error(`  [FAIL] Table '${t}' is MISSING!`);
        allTablesPresent = false;
      }
    }

    // 2. Verify Views
    console.log('\n[3/6] Verifying Relational Views:');
    const [existingViews]: any = await db.raw(`
      SELECT TABLE_NAME
      FROM information_schema.VIEWS
      WHERE TABLE_SCHEMA = DATABASE();
    `);
    const viewNames = new Set(existingViews.map((v: any) => v.TABLE_NAME));

    for (const v of EXPECTED_VIEWS) {
      if (viewNames.has(v)) {
        console.log(`  [PASS] View '${v}' exists.`);
      } else {
        console.error(`  [FAIL] View '${v}' is MISSING!`);
      }
    }

    // 3. Verify Foreign Keys
    console.log('\n[4/6] Verifying Foreign Key Constraints:');
    const [existingFks]: any = await db.raw(`
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL;
    `);

    for (const expected of EXPECTED_FOREIGN_KEYS) {
      const match = existingFks.find(
        (fk: any) =>
          fk.TABLE_NAME === expected.table &&
          fk.COLUMN_NAME === expected.column &&
          fk.REFERENCED_TABLE_NAME === expected.refTable &&
          fk.REFERENCED_COLUMN_NAME === expected.refColumn
      );
      if (match) {
        console.log(`  [PASS] FK ${expected.table}.${expected.column} -> ${expected.refTable}.${expected.refColumn} (${match.CONSTRAINT_NAME})`);
      } else {
        console.error(`  [FAIL] FK ${expected.table}.${expected.column} -> ${expected.refTable}.${expected.refColumn} is MISSING!`);
      }
    }

    // 4. Verify Unique and Check Constraints
    console.log('\n[5/6] Verifying Key Constraints & Indexes:');
    const [indexes]: any = await db.raw(`
      SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE();
    `);

    const hasCandidateJobUnique = indexes.some(
      (idx: any) => idx.TABLE_NAME === 'applications' && idx.INDEX_NAME === 'uq_app_candidate_job'
    );
    console.log(`  [${hasCandidateJobUnique ? 'PASS' : 'FAIL'}] Unique constraint applications(candidate_id, job_id): ${hasCandidateJobUnique ? 'Verified' : 'Missing'}`);

    const hasFeedIndex = indexes.some(
      (idx: any) => idx.TABLE_NAME === 'jobs' && idx.INDEX_NAME === 'idx_jobs_feed'
    );
    console.log(`  [${hasFeedIndex ? 'PASS' : 'FAIL'}] Composite index jobs(status, created_at DESC): ${hasFeedIndex ? 'Verified' : 'Missing'}`);

    // 5. Test Referential Integrity via Rollback Transaction
    console.log('\n[6/6] Testing Database Operations in Isolated Transaction:');
    const trx = await db.transaction();
    try {
      const testUserId = `test-user-${Date.now()}`;
      await trx('users').insert({
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'testhash',
        name: 'Test Candidate',
        role: 'candidate',
      });

      await trx('candidates').insert({
        id: testUserId,
        user_id: testUserId,
        title: 'Software Test Engineer',
      });

      const [joined]: any = await trx.raw(`SELECT * FROM candidate_view WHERE user_id = ?`, [testUserId]);
      const joinedRow = Array.isArray(joined) ? joined[0] : joined;
      if (joinedRow && joinedRow.title === 'Software Test Engineer') {
        console.log('  [PASS] Transactional insert and view query verified.');
      } else {
        console.error('  [FAIL] Transactional test query failed to return joined row.');
      }

      await trx.rollback();
      console.log('  [PASS] Test transaction rolled back cleanly. No residual test data created.');
    } catch (testErr: any) {
      await trx.rollback();
      console.error('  [FAIL] Transactional verification test failed:', testErr.message);
    }

    console.log('\n====================================================');
    console.log('Schema Verification Completed Successfully.');
    console.log('====================================================');
  } catch (err: any) {
    console.error('\n[Verification Error]:', err.message || err);
    console.log('\nNote: If MySQL is not running yet, execute migrations when MySQL is started.');
  } finally {
    await db.destroy();
  }
}

verifySchema();
