import { Knex } from 'knex';

/**
 * TalentHub Migration: resume_documents table
 * Version: 20261108000002
 *
 * Creates the versioned resume-document store that records every file uploaded
 * by a candidate.  File bytes live in Azure Blob Storage / Azurite; this table
 * stores only metadata (blob reference, checksum, status, …).
 *
 * Design notes
 * ────────────
 * • candidate_id → candidates.user_id (VARCHAR(64) utf8mb4_unicode_ci).
 *   The referenced column is the PRIMARY KEY of `candidates` (enforced by
 *   UNIQUE KEY uq_candidates_user_id), which guarantees uniqueness and the
 *   correct collation match.
 *
 * • "Only one current resume" rule
 *   MySQL 8.0 does NOT support partial / filtered unique indexes.
 *   A plain UNIQUE index on (candidate_id) would prevent historical rows.
 *
 *   DATABASE-LEVEL ENFORCEMENT — Generated Virtual Column + Partial Unique:
 *   We add a nullable generated virtual column `current_guard` whose value is
 *   candidate_id when is_current = 1, and NULL when is_current = 0.
 *   A UNIQUE constraint on (current_guard) then ensures at most one non-NULL
 *   value per candidate, i.e. at most one is_current=1 row.  NULL values are
 *   excluded from MySQL unique index enforcement, so historical rows (is_current
 *   = 0, current_guard = NULL) are unconstrained.
 *
 *   APPLICATION-LEVEL ENFORCEMENT (belt-and-suspenders):
 *   createResumeDocument() in MySqlDatabase runs inside a transaction:
 *     1. SELECT … FOR UPDATE on the candidate's latest is_current row (locks it)
 *     2. UPDATE … SET is_current = 0 WHERE candidate_id = ? AND is_current = 1
 *     3. INSERT new row with is_current = 1
 *   This prevents duplicate current rows under concurrent upload requests.
 *
 *   NOTE: MySQL 8.0 BEFORE INSERT / BEFORE UPDATE triggers CANNOT safely
 *   modify the same table they are defined on when that table is involved in the
 *   triggering statement — doing so causes ER_CANT_UPDATE_USED_TABLE_IN_SF_OR_TRG.
 *   Triggers are therefore NOT used for this constraint.
 *
 * • FK checks are NOT disabled.  The referenced table (candidates) already
 *   exists and the type/collation match has been verified.
 *
 * • Replacement safety
 *   The application layer (resumeController → createResumeDocument) follows
 *   this sequence to ensure the previous resume is never prematurely deleted:
 *     1. Validate file (pure in-memory).
 *     2. Upload buffer to Blob Storage.
 *     3. If Blob upload fails → 503, old resume untouched.
 *     4. If Blob upload succeeds → open DB transaction (SELECT FOR UPDATE,
 *        demote old, insert new).
 *     5. If DB transaction fails → delete the new orphaned blob, return 500,
 *        old resume untouched (is_current still 1 on old row).
 *   At no point is the previous resume's DB record or Blob deleted.
 *   Soft-delete (upload_status = 'deleted') is the only removal mechanism
 *   exposed by the application, and only an admin/candidate can trigger it.
 *
 * • The down() function does not need FOREIGN_KEY_CHECKS=0 because
 *   resume_parse_runs (created in migration 3) is dropped by that migration's
 *   down() before this migration's down() is ever called during a rollback.
 *   If migration 3 has not been applied, no child rows exist and DROP TABLE
 *   succeeds without disabling FK checks.
 */
export async function up(knex: Knex): Promise<void> {
  // ── Pre-condition: verify candidates table and the referenced column ────────
  const candidatesExists = await knex.schema.hasTable('candidates');
  if (!candidatesExists) {
    throw new Error(
      '[Migration 20261108000002] Pre-condition failed: table `candidates` does not exist. ' +
      'Apply the initial schema migration (20261107000001) first.'
    );
  }

  const userIdColExists = await knex.schema.hasColumn('candidates', 'user_id');
  if (!userIdColExists) {
    throw new Error(
      '[Migration 20261108000002] Pre-condition failed: `candidates.user_id` column is missing.'
    );
  }

  // ── Verify type/collation match via information_schema ─────────────────────
  // candidates.user_id must be VARCHAR(64) utf8mb4_unicode_ci to match our FK.
  const [colRows] = await knex.raw(`
    SELECT CHARACTER_MAXIMUM_LENGTH, CHARACTER_SET_NAME, COLLATION_NAME, DATA_TYPE
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'candidates'
       AND COLUMN_NAME  = 'user_id'
  `);
  const col = (colRows as Array<{
    DATA_TYPE: string;
    CHARACTER_MAXIMUM_LENGTH: number;
    CHARACTER_SET_NAME: string;
    COLLATION_NAME: string;
  }>)[0];

  if (!col) {
    throw new Error('[Migration 20261108000002] Pre-condition failed: could not read candidates.user_id column metadata.');
  }
  if (col.DATA_TYPE !== 'varchar' || col.CHARACTER_MAXIMUM_LENGTH < 64) {
    throw new Error(
      `[Migration 20261108000002] Pre-condition failed: candidates.user_id is ${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH}), expected VARCHAR(64).`
    );
  }
  if (col.COLLATION_NAME !== 'utf8mb4_unicode_ci') {
    throw new Error(
      `[Migration 20261108000002] Pre-condition failed: candidates.user_id collation is ${col.COLLATION_NAME}, expected utf8mb4_unicode_ci. The FK would fail.`
    );
  }

  // ── Create resume_documents ───────────────────────────────────────────────
  // current_guard is a virtual generated column used by the UNIQUE constraint
  // that enforces one is_current=1 row per candidate at the database level.
  // Its value:
  //   • candidate_id  when is_current = 1  → participates in the UNIQUE index
  //   • NULL          when is_current = 0  → excluded from UNIQUE index (MySQL
  //                                          allows multiple NULLs in a UNIQUE key)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS resume_documents (
      id                VARCHAR(64)   NOT NULL
                        COMMENT 'Application-generated UUID',
      candidate_id      VARCHAR(64)   NOT NULL
                        COMMENT 'FK → candidates.user_id (VARCHAR(64) utf8mb4_unicode_ci)',
      original_filename VARCHAR(255)  NOT NULL
                        COMMENT 'Sanitised original filename as supplied by the candidate',
      blob_name         VARCHAR(500)  NOT NULL
                        COMMENT 'UUID-prefixed blob path in the Azure Blob Storage container; never contains PII',
      container_name    VARCHAR(100)  NOT NULL DEFAULT 'talenthub-resumes'
                        COMMENT 'Azure / Azurite container name',
      file_extension    VARCHAR(10)   NOT NULL
                        COMMENT 'Lower-case extension: pdf or docx',
      mime_type         VARCHAR(100)  NOT NULL
                        COMMENT 'Content-verified MIME type (not taken from the HTTP header)',
      file_size_bytes   BIGINT UNSIGNED NOT NULL
                        COMMENT 'Exact byte length of the uploaded buffer',
      checksum_sha256   CHAR(64)      NOT NULL
                        COMMENT 'Lowercase hex SHA-256 digest of the uploaded buffer',
      upload_status     VARCHAR(32)   NOT NULL DEFAULT 'uploaded'
                        COMMENT 'uploaded | failed | deleted',
      is_current        TINYINT(1)    NOT NULL DEFAULT 1
                        COMMENT '1 = this is the active resume version for the candidate; 0 = historical',

      -- Generated virtual column for the single-current-resume DB constraint.
      -- NULL when is_current=0 so historical rows are exempt from the UNIQUE index.
      current_guard     VARCHAR(64)   GENERATED ALWAYS AS (
                          CASE WHEN is_current = 1 THEN candidate_id ELSE NULL END
                        ) VIRTUAL,

      uploaded_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                        COMMENT 'Wall-clock time the upload was accepted by the application',
      created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),

      -- DB-level: at most one is_current=1 row per candidate.
      -- NULL values are excluded from MySQL UNIQUE indexes, so is_current=0 rows
      -- (which yield current_guard=NULL) are unconstrained.
      UNIQUE KEY uq_rd_one_current_per_candidate (current_guard),

      -- Fast lookup of the current resume for a candidate
      KEY idx_rd_candidate_current  (candidate_id, is_current),
      -- General candidate history queries
      KEY idx_rd_candidate_uploaded (candidate_id, uploaded_at DESC),
      -- Status filtering (e.g. exclude 'deleted' rows)
      KEY idx_rd_upload_status      (upload_status),
      -- Blob-name lookup (prefix index because VARCHAR(500) > 767 bytes in some row formats)
      KEY idx_rd_blob_name          (blob_name(255)),
      -- Duplicate-upload detection via checksum
      KEY idx_rd_checksum           (checksum_sha256),

      CONSTRAINT chk_rd_extension CHECK (file_extension IN ('pdf', 'docx')),
      CONSTRAINT chk_rd_status    CHECK (upload_status  IN ('uploaded', 'failed', 'deleted')),

      -- FK to candidates.user_id (VARCHAR(64) NOT NULL, utf8mb4_unicode_ci)
      CONSTRAINT fk_rd_candidate FOREIGN KEY (candidate_id)
        REFERENCES candidates (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE

    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
      COMMENT='One row per uploaded resume version; bytes live in Blob Storage, metadata lives here.';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS resume_documents');
}
