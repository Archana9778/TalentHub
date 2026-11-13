/**
 * TalentHub MySQL Candidate Personal Information Architecture & Persistence Test
 * Tests MySQL repository query construction, schema compatibility, migration logic,
 * and data mapping for date_of_birth, gender, and personal information.
 */

import fs from 'fs';
import path from 'path';
import { MySqlRepository } from '../database/mysqlRepository';
import { formatCandidateProfile } from '../controllers/candidateController';
import { User } from '../types';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(suite: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    testResults.push({ suite, name, passed: true });
    console.log(`  ✓ PASS: [${suite}] ${name}`);
  } catch (err: any) {
    testResults.push({ suite, name, passed: false, error: err.message });
    console.error(`  ✗ FAIL: [${suite}] ${name} -> ${err.message}`);
  }
}

async function main() {
  console.log('======================================================');
  console.log(' TalentHub MySQL Candidate Profile Persistence Tests');
  console.log('======================================================\n');

  // ── TEST SUITE 1: Migration and Schema Verification ──────────────────────────
  console.log('--- TEST SUITE 1: Migration and Schema Verification ---');

  await runTest('Schema', 'V6__candidate_personal_info.sql exists and contains valid DDL', () => {
    const v6Path = path.resolve(__dirname, '../database/migrations/V6__candidate_personal_info.sql');
    assert(fs.existsSync(v6Path), 'V6 migration file must exist');
    const sql = fs.readFileSync(v6Path, 'utf-8');
    assert(/ALTER TABLE candidates\s+ADD COLUMN date_of_birth/i.test(sql), 'Must add date_of_birth to candidates');
    assert(/ADD COLUMN gender/i.test(sql), 'Must add gender to candidates');
    assert(/ALTER TABLE users\s+ADD COLUMN date_of_birth/i.test(sql), 'Must add date_of_birth to users');
  });

  await runTest('Schema', '20261111000003_candidate_personal_info.ts knex migration exists with up and down', () => {
    const knexMigPath = path.resolve(__dirname, '../database/migrations/20261111000003_candidate_personal_info.ts');
    assert(fs.existsSync(knexMigPath), 'Knex migration must exist');
    const content = fs.readFileSync(knexMigPath, 'utf-8');
    assert(/export async function up/i.test(content), 'Must export up function');
    assert(/export async function down/i.test(content), 'Must export down function');
    assert(/date_of_birth/i.test(content), 'Must reference date_of_birth column');
    assert(/gender/i.test(content), 'Must reference gender column');
  });

  await runTest('Schema', 'schema.sql defines date_of_birth and gender in candidates table', () => {
    const schemaPath = path.resolve(__dirname, '../database/schema.sql');
    assert(fs.existsSync(schemaPath), 'schema.sql must exist');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    assert(/date_of_birth DATE NULL/i.test(schemaSql), 'schema.sql must define date_of_birth in candidates');
    assert(/gender VARCHAR\(32\) NULL/i.test(schemaSql), 'schema.sql must define gender in candidates');
  });

  // ── TEST SUITE 2: Repository SQL Generation & Data Mapping ───────────────────
  console.log('\n--- TEST SUITE 2: Repository SQL Generation & Data Mapping ---');

  await runTest('Repository', 'MySqlRepository userSelectSql selects date_of_birth and gender', () => {
    const repo = new MySqlRepository();
    const selectSql = (repo as any).userSelectSql;
    assert(/c\.date_of_birth/i.test(selectSql), 'userSelectSql must select c.date_of_birth');
    assert(/c\.gender/i.test(selectSql), 'userSelectSql must select c.gender');
    assert(/LEFT JOIN candidates c ON u\.id = c\.user_id/i.test(selectSql), 'Must join candidates table');
  });

  await runTest('Repository', 'MySqlRepository mapUser correctly maps candidate dateOfBirth and gender', () => {
    const repo = new MySqlRepository();
    const mockRow = {
      id: 'usr-cand-123',
      email: 'candidate@talenthub.com',
      password_hash: '$2a$10$xyz',
      name: 'Alice Candidate',
      role: 'candidate',
      status: 'active',
      candidate_title: 'Staff Platform Engineer',
      candidate_location: 'Austin, TX',
      candidate_phone: '+1 555 456 7890',
      candidate_bio: 'Staff engineer specialized in Kubernetes.',
      date_of_birth: '1990-11-20',
      gender: 'Female',
      skills_json: '["Go", "Kubernetes", "AWS"]',
      created_at: new Date('2026-01-01'),
    };

    const mappedUser = (repo as any).mapUser(mockRow);
    assert(mappedUser.id === 'usr-cand-123', 'ID mapped correctly');
    assert(mappedUser.name === 'Alice Candidate', 'Name mapped correctly');
    assert(mappedUser.dateOfBirth === '1990-11-20', 'dateOfBirth mapped correctly');
    assert(mappedUser.gender === 'Female', 'gender mapped correctly');
    assert(mappedUser.title === 'Staff Platform Engineer', 'title mapped correctly');
    assert(mappedUser.location === 'Austin, TX', 'location mapped correctly');
    assert(mappedUser.phone === '+1 555 456 7890', 'phone mapped correctly');
  });

  // ── TEST SUITE 3: Candidate Profile Formatting & Security ────────────────────
  console.log('\n--- TEST SUITE 3: Candidate Profile Formatting & Security ---');

  await runTest('Security', 'formatCandidateProfile strips passwords and formats fields securely', () => {
    const testUser: User = {
      id: 'cand-sec-1',
      name: 'Bob Secure',
      email: 'bob@example.com',
      password: 'super-secret-password-hash',
      role: 'candidate',
      status: 'active',
      phone: '+1 555 999 8888',
      dateOfBirth: '1995-03-25T00:00:00.000Z',
      gender: 'Male',
      title: 'Security Engineer',
      location: 'New York, NY',
      bio: 'Application security engineer.',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const profile = formatCandidateProfile(testUser);
    assert(profile.id === 'cand-sec-1', 'ID preserved');
    assert(profile.name === 'Bob Secure', 'Name preserved');
    assert(profile.dateOfBirth === '1995-03-25', 'DOB formatted to YYYY-MM-DD');
    assert(profile.gender === 'Male', 'Gender preserved');
    assert((profile as any).password === undefined, 'Password must not exist in CandidateProfile');
    assert((profile as any).password_hash === undefined, 'Password hash must not exist in CandidateProfile');
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n======================================================');
  console.log(' Test Execution Summary');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(` Total Scenarios: ${total}`);
  console.log(` Passed:          ${passed}`);
  console.log(` Failed:          ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

