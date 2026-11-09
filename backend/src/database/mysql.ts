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
      migrationStep = 'V4__user_profile_fields.sql';
      await this.ensureProfileColumns();
      migrationStep = 'V5__auth_hardening.sql';
      await this.ensureAuthHardening();
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

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }
}

export const mysqlDb = new MySqlDatabase();
