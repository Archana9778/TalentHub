import mysql, { Pool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

class MySqlDatabase {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  get connected(): boolean {
    return this.isConnected;
  }

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('MySQL pool is not initialized.');
    }
    return this.pool;
  }

  async checkHealth(): Promise<boolean> {
    if (!this.pool || !this.isConnected) return false;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  async initialize(): Promise<void> {
    const pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      multipleStatements: true,
      ssl: config.db.ssl,
    });
    console.log(`[TalentHub MySQL] Connecting to MySQL at ${config.db.host}:${config.db.port} (database: ${config.db.database})...`);
    try {
      const connection = await pool.getConnection();
      connection.release();
    } catch (err: any) {
      this.isConnected = false;
      await pool.end().catch(() => undefined);
      const code = typeof err?.code === 'string' ? ` (${err.code})` : '';
      throw new Error(`Required MySQL database at ${config.db.host}:${config.db.port}/${config.db.database} is unavailable${code}. Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, and that MySQL is running.`);
    }

    this.pool = pool;
    this.isConnected = true;
    console.log(`[TalentHub MySQL] Connected successfully at ${config.db.host}:${config.db.port}.`);
    try {
      await this.runMigrations();
    } catch (err: any) {
      this.isConnected = false;
      this.pool = null;
      await pool.end().catch(() => undefined);
      throw new Error(err instanceof Error ? err.message : 'MySQL connected, but schema migration failed. Existing data was not intentionally deleted.');
    }
  }

  private findMigrationFile(filename: string): string | null {
    const candidates = [
      path.join(__dirname, 'migrations', filename),
      path.join(__dirname, '../../src/database/migrations', filename),
      path.join(process.cwd(), 'src/database/migrations', filename),
      path.join(process.cwd(), 'backend/src/database/migrations', filename),
      path.join(process.cwd(), 'dist/database/migrations', filename),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  async runMigrations(): Promise<void> {
    if (!this.pool) return;

    let migrationStep = 'schema inspection';
    try {
      // Check if users table exists
      const [rows] = await this.pool.query<any[]>(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
        [config.db.database]
      );

      const tableExists = rows && rows[0] && rows[0].count > 0;

      if (!tableExists) {
        console.log('[TalentHub MySQL] Fresh database detected. Executing migrations V1, V2, V3...');
        const v1Path = this.findMigrationFile('V1__init_schema.sql');
        const v2Path = this.findMigrationFile('V2__seed_data.sql');
        const v3Path = this.findMigrationFile('V3__audit_trail.sql');

        if (v1Path) {
          migrationStep = 'V1__init_schema.sql';
          console.log('[TalentHub MySQL] Applying V1__init_schema.sql...');
          const v1Sql = fs.readFileSync(v1Path, 'utf-8');
          await this.pool.query(v1Sql);
        } else throw new Error('Required migration V1__init_schema.sql was not found.');

        if (v2Path) {
          migrationStep = 'V2__seed_data.sql';
          console.log('[TalentHub MySQL] Applying V2__seed_data.sql...');
          const v2Sql = fs.readFileSync(v2Path, 'utf-8');
          await this.pool.query(v2Sql);
        } else throw new Error('Required migration V2__seed_data.sql was not found.');

        if (v3Path) {
          migrationStep = 'V3__audit_trail.sql';
          console.log('[TalentHub MySQL] Applying V3__audit_trail.sql...');
          const v3Sql = fs.readFileSync(v3Path, 'utf-8');
          await this.pool.query(v3Sql);
        } else throw new Error('Required migration V3__audit_trail.sql was not found.');

        console.log('[TalentHub MySQL] ✅ Migrations completed successfully.');
      } else {
        // Ensure V3 audit trail table exists even if V1/V2 already exist
        const [v3Rows] = await this.pool.query<any[]>(
          "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'application_stage_history'",
          [config.db.database]
        );
        if (!v3Rows || v3Rows[0].count === 0) {
          const v3Path = this.findMigrationFile('V3__audit_trail.sql');
          if (v3Path) {
            migrationStep = 'V3__audit_trail.sql';
            console.log('[TalentHub MySQL] Applying V3__audit_trail.sql...');
            const v3Sql = fs.readFileSync(v3Path, 'utf-8');
            await this.pool.query(v3Sql);
          }
        }
      }
      migrationStep = 'profile_tables';
      await this.ensureProfileTables();
      migrationStep = 'V4__user_profile_fields.sql';
      await this.ensureProfileColumns();
      migrationStep = 'V5__auth_hardening.sql';
      await this.ensureAuthHardening();
      migrationStep = 'V6__admin_stories.sql';
      await this.ensureAdminStories();
      migrationStep = 'V6__candidate_personal_info.sql';
      await this.ensureCandidatePersonalInfoColumns();
      migrationStep = 'V7__candidate_education_experience.sql';
      await this.ensureEducationExperienceTables();
      migrationStep = 'ensureCompanyProfileColumns';
      await this.ensureCompanyProfileColumns();
      migrationStep = 'syncRecruiterCompanyAssociations';
      await this.syncRecruiterCompanyAssociations();
    } catch (migrationErr: any) {
      const code = typeof migrationErr?.code === 'string' ? ` (${migrationErr.code})` : '';
      throw new Error(`MySQL migration step ${migrationStep} failed${code}. Check database permissions, existing schema compatibility, and migration files; existing data was not intentionally deleted.`);
    }
  }

  private async ensureProfileColumns(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');
    const additions: Array<[string, string]> = [
      ['experience_json', 'JSON NULL'],
      ['education_json', 'JSON NULL'],
      ['parsed_resume_data_json', 'JSON NULL'],
    ];
    const missing: Array<[string, string]> = [];
    for (const [column, definition] of additions) {
      const [rows] = await this.pool.query<any[]>(
        'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
        [config.db.database, 'users', column]
      );
      if (Number(rows?.[0]?.count || 0) === 0) {
        missing.push([column, definition]);
      }
    }
    if (!missing.length) return;
    if (missing.length === additions.length) {
      const migrationPath = this.findMigrationFile('V4__user_profile_fields.sql');
      if (!migrationPath) throw new Error('Required migration V4__user_profile_fields.sql was not found.');
      await this.pool.query(fs.readFileSync(migrationPath, 'utf-8'));
      return;
    }
    // Recover safely from an interrupted additive migration without touching existing values.
    for (const [column, definition] of missing) {
      await this.pool.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }

  private async ensureAuthHardening(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');

    // 1. Ensure user columns
    const userColumns: Array<[string, string]> = [
      ['token_version', 'INT NOT NULL DEFAULT 1'],
      ['last_login_at', 'TIMESTAMP NULL'],
      ['password_changed_at', 'TIMESTAMP NULL'],
    ];

    for (const [column, definition] of userColumns) {
      const [rows] = await this.pool.query<any[]>(
        'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
        [config.db.database, 'users', column]
      );
      if (Number(rows?.[0]?.count || 0) === 0) {
        await this.pool.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
      }
    }

    // 2. Ensure password_reset_tokens table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        token_hash VARCHAR(128) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reset_token_hash (token_hash),
        INDEX idx_reset_user (user_id),
        CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Ensure revoked_tokens table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        id VARCHAR(64) PRIMARY KEY,
        token_jti VARCHAR(128) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_revoked_jti (token_jti),
        INDEX idx_revoked_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  private async ensureProfileTables(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');

    // 1. Ensure candidates table exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        title VARCHAR(150) NULL,
        location VARCHAR(150) NULL,
        phone VARCHAR(50) NULL,
        bio TEXT NULL,
        date_of_birth DATE NULL,
        gender VARCHAR(32) NULL,
        resume_url VARCHAR(500) NULL,
        resume_original_name VARCHAR(255) NULL,
        skills_json JSON NULL,
        experience_json JSON NULL,
        education_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_candidates_user_id (user_id),
        KEY idx_candidates_title (title),
        CONSTRAINT fk_candidates_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Ensure recruiters table exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS recruiters (
        id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NULL,
        company_name VARCHAR(150) NULL,
        title VARCHAR(150) NULL,
        location VARCHAR(150) NULL,
        phone VARCHAR(50) NULL,
        bio TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_recruiters_user_id (user_id),
        KEY idx_recruiters_company_id (company_id),
        CONSTRAINT fk_recruiters_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_recruiters_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Backfill existing users into candidates and recruiters
    const [userCols] = await this.pool.query<any[]>(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
      [config.db.database, 'users']
    );
    const existingColNames = new Set((userCols || []).map((r: any) => (r.column_name || r.COLUMN_NAME || '').toLowerCase()));

    const candCols = ['id', 'user_id', 'created_at', 'updated_at'];
    const candSelects = ['id', 'id', 'created_at', 'updated_at'];
    for (const c of ['title', 'location', 'phone', 'bio', 'resume_url', 'resume_original_name', 'skills_json', 'experience_json', 'education_json', 'date_of_birth', 'gender']) {
      if (existingColNames.has(c.toLowerCase())) {
        candCols.push(c);
        candSelects.push(c);
      }
    }

    await this.pool.query(`
      INSERT IGNORE INTO candidates (${candCols.join(', ')})
      SELECT ${candSelects.join(', ')}
      FROM users WHERE role = 'candidate'
    `);

    const recCols = ['id', 'user_id', 'created_at', 'updated_at'];
    const recSelects = ['id', 'id', 'created_at', 'updated_at'];
    for (const c of ['company_id', 'company_name', 'title', 'location', 'phone', 'bio']) {
      if (existingColNames.has(c.toLowerCase())) {
        recCols.push(c);
        recSelects.push(c);
      }
    }

    await this.pool.query(`
      INSERT IGNORE INTO recruiters (${recCols.join(', ')})
      SELECT ${recSelects.join(', ')}
      FROM users WHERE role = 'recruiter'
    `);

    // 4. Ensure resume_documents table exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS resume_documents (
        id VARCHAR(64) NOT NULL,
        candidate_id VARCHAR(64) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        blob_name VARCHAR(500) NOT NULL,
        container_name VARCHAR(100) NOT NULL DEFAULT 'talenthub-resumes',
        file_extension VARCHAR(10) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size_bytes BIGINT UNSIGNED NOT NULL,
        checksum_sha256 CHAR(64) NOT NULL,
        upload_status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
        is_current TINYINT(1) NOT NULL DEFAULT 1,
        current_guard VARCHAR(64) GENERATED ALWAYS AS (
          CASE WHEN is_current = 1 THEN candidate_id ELSE NULL END
        ) VIRTUAL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_rd_one_current_per_candidate (current_guard),
        KEY idx_rd_candidate_uploaded (candidate_id, uploaded_at DESC),
        KEY idx_rd_status (upload_status),
        KEY idx_rd_checksum (checksum_sha256),
        CONSTRAINT fk_rd_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Ensure relational views exist
    await this.pool.query(`
      CREATE OR REPLACE VIEW candidate_view AS
      SELECT
        u.id AS user_id,
        c.id AS candidate_id,
        u.email,
        u.name,
        u.role,
        u.status,
        u.avatar_url,
        c.title,
        c.location,
        c.phone,
        c.bio,
        c.resume_url,
        c.resume_original_name,
        c.skills_json,
        c.experience_json,
        c.education_json,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN candidates c ON u.id = c.user_id
      WHERE u.role = 'candidate';
    `);

    await this.pool.query(`
      CREATE OR REPLACE VIEW recruiter_view AS
      SELECT
        u.id AS user_id,
        r.id AS recruiter_id,
        u.email,
        u.name,
        u.role,
        u.status,
        u.avatar_url,
        r.company_id,
        r.company_name,
        r.title,
        r.location,
        r.phone,
        r.bio,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN recruiters r ON u.id = r.user_id
      WHERE u.role = 'recruiter';
    `);
  }

  private async ensureAdminStories(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');

    // Check and add is_active to job_categories
    const [catCols] = await this.pool.query<any[]>(
      'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
      [config.db.database, 'job_categories', 'is_active']
    );
    if (Number(catCols?.[0]?.count || 0) === 0) {
      await this.pool.query('ALTER TABLE job_categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE');
      console.log('[TalentHub MySQL] V6: Added is_active to job_categories.');
    }

    // Check and add status to companies
    const [compCols] = await this.pool.query<any[]>(
      'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
      [config.db.database, 'companies', 'status']
    );
    if (Number(compCols?.[0]?.count || 0) === 0) {
      await this.pool.query("ALTER TABLE companies ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'");
      console.log('[TalentHub MySQL] V6: Added status to companies.');
    }

    // Check and add reviewed_at to reported_jobs
    const [repCols] = await this.pool.query<any[]>(
      'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
      [config.db.database, 'reported_jobs', 'reviewed_at']
    );
    if (Number(repCols?.[0]?.count || 0) === 0) {
      await this.pool.query(`
        ALTER TABLE reported_jobs
          ADD COLUMN reviewed_by_user_id VARCHAR(64) NULL,
          ADD COLUMN reviewed_by_name VARCHAR(150) NULL,
          ADD COLUMN admin_action VARCHAR(50) NULL,
          ADD COLUMN admin_reason TEXT NULL,
          ADD COLUMN reviewed_at TIMESTAMP NULL
      `);
      console.log('[TalentHub MySQL] V6: Added admin audit columns to reported_jobs.');
    }
  }

  private async ensureCandidatePersonalInfoColumns(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');

    // Ensure columns on candidates table
    const candColumns: Array<[string, string]> = [
      ['date_of_birth', 'DATE NULL'],
      ['gender', 'VARCHAR(32) NULL'],
    ];

    const [candTableRows] = await this.pool.query<any[]>(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'candidates'",
      [config.db.database]
    );

    if (Number(candTableRows?.[0]?.count || 0) > 0) {
      for (const [column, definition] of candColumns) {
        const [rows] = await this.pool.query<any[]>(
          'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
          [config.db.database, 'candidates', column]
        );
        if (Number(rows?.[0]?.count || 0) === 0) {
          await this.pool.query(`ALTER TABLE candidates ADD COLUMN ${column} ${definition}`);
        }
      }
    }

    // Ensure columns on users table
    const userColumns: Array<[string, string]> = [
      ['date_of_birth', 'DATE NULL'],
      ['gender', 'VARCHAR(32) NULL'],
    ];

    const [userTableRows] = await this.pool.query<any[]>(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
      [config.db.database]
    );

    if (Number(userTableRows?.[0]?.count || 0) > 0) {
      for (const [column, definition] of userColumns) {
        const [rows] = await this.pool.query<any[]>(
          'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
          [config.db.database, 'users', column]
        );
        if (Number(rows?.[0]?.count || 0) === 0) {
          await this.pool.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
        }
      }
    }
  }

  private async ensureEducationExperienceTables(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS candidate_education (
        id VARCHAR(64) PRIMARY KEY,
        candidate_id VARCHAR(64) NOT NULL,
        institution VARCHAR(200) NOT NULL,
        degree VARCHAR(150) NOT NULL,
        field_of_study VARCHAR(150) NULL,
        start_date VARCHAR(50) NULL,
        end_date VARCHAR(50) NULL,
        is_current BOOLEAN NOT NULL DEFAULT FALSE,
        grade VARCHAR(50) NULL,
        description TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_education_candidate (candidate_id),
        CONSTRAINT fk_education_candidate FOREIGN KEY (candidate_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS candidate_experience (
        id VARCHAR(64) PRIMARY KEY,
        candidate_id VARCHAR(64) NOT NULL,
        company VARCHAR(200) NOT NULL,
        title VARCHAR(150) NOT NULL,
        employment_type VARCHAR(50) NULL,
        location VARCHAR(150) NULL,
        start_date VARCHAR(50) NULL,
        end_date VARCHAR(50) NULL,
        is_current BOOLEAN NOT NULL DEFAULT FALSE,
        description TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_experience_candidate (candidate_id),
        CONSTRAINT fk_experience_candidate FOREIGN KEY (candidate_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  private async ensureCompanyProfileColumns(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');

    const compColumns: Array<[string, string]> = [
      ['email', 'VARCHAR(150) NULL'],
      ['contact_number', 'VARCHAR(50) NULL'],
      ['address', 'TEXT NULL'],
      ['updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
    ];

    const [tableRows] = await this.pool.query<any[]>(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'companies'",
      [config.db.database]
    );

    if (Number(tableRows?.[0]?.count || 0) > 0) {
      for (const [column, definition] of compColumns) {
        const [rows] = await this.pool.query<any[]>(
          'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
          [config.db.database, 'companies', column]
        );
        if (Number(rows?.[0]?.count || 0) === 0) {
          await this.pool.query(`ALTER TABLE companies ADD COLUMN ${column} ${definition}`);
          console.log(`[TalentHub MySQL] Added column ${column} to companies.`);
        }
      }
    }
  }

  private async syncRecruiterCompanyAssociations(): Promise<void> {
    if (!this.pool) throw new Error('MySQL pool is not initialized.');

    try {
      // 1. Link recruiters with missing company_id based on matching company_name
      await this.pool.query(`
        UPDATE recruiters r
        JOIN companies c ON LOWER(TRIM(c.name)) = LOWER(TRIM(r.company_name))
        SET r.company_id = c.id
        WHERE r.company_id IS NULL AND r.company_name IS NOT NULL AND TRIM(r.company_name) != '';
      `);

      // 2. Sync company_name if missing in recruiters
      await this.pool.query(`
        UPDATE recruiters r
        JOIN companies c ON r.company_id = c.id
        SET r.company_name = c.name
        WHERE (r.company_name IS NULL OR TRIM(r.company_name) = '') AND r.company_id IS NOT NULL;
      `);

      // 3. Ensure primary recruiter for seeded/existing company is company admin if not set
      await this.pool.query(`
        UPDATE recruiters
        SET company_role = 'admin'
        WHERE company_role IS NULL OR TRIM(company_role) = '';
      `);
    } catch (syncErr) {
      console.warn('[TalentHub MySQL] Non-fatal warning syncing recruiter company associations:', syncErr);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }
}

export const mysqlDb = new MySqlDatabase();
