# TalentHub — Developer Database Handover Guide

**Target Database:** MySQL 8.0 / Azure Database for MySQL Flexible Server
**Backend Framework:** Node.js + Express + TypeScript
**Migration Framework:** Knex.js Migration Engine
**Branch:** `feature/dbs`
**Status:** Completed & Ready for Developer Use

---

## 1. Quickstart: 3-Step Setup for Developers

### Step 1: Start the Local MySQL 8.0 Database
If you do not have MySQL 8.0 installed locally as a Windows service, start the simulated cloud database container using Docker Compose:

```bash
docker compose up -d database
```

This starts a clean MySQL 8.0 instance on `localhost:3306` with:
- **Database:** `talenthub`
- **Username:** `talenthub_user`
- **Password:** `talenthub_pass`
- **Root Password:** `root_secure_password_2026`

### Step 2: Configure Environment Variables
Copy the template configuration in `backend/.env.example` to `backend/.env`:

```bash
cd backend
cp .env.example .env
```

Ensure the database settings match your local MySQL credentials:

```env
DB_DRIVER=mysql2
DB_HOST=localhost
DB_PORT=3306
DB_NAME=talenthub
DB_USER=talenthub_user
DB_PASSWORD=talenthub_pass
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### Step 3: Test Connection & Run Migrations
From the `backend/` directory:

```bash
# 1. Run diagnostic connection test
npm run db:test

# 2. Check migration status
npm run migrate:status

# 3. Apply the initial schema migration
npm run migrate

# 4. Verify tables, foreign keys, and indexes
npm run db:verify
```

---

## 2. CLI Database Command Reference

All database commands are configured in [`backend/package.json`](file:///c:/Users/sajik/TalentHub/backend/package.json):

| Command | Action | Description |
|---|---|---|
| `npm run db:test` | Connection Diagnostic | Tests MySQL connectivity, displays server version, active database, latency, and lists existing tables. |
| `npm run migrate:status` | Migration Status | Displays applied vs. pending migrations tracked in `knex_migrations`. |
| `npm run migrate` | Apply Migrations | Applies all pending migrations up to the latest version. |
| `npm run migrate:rollback` | Rollback Migration | Rolls back the last batch of migrations (drops views and tables in reverse dependency order). |
| `npm run migrate:unlock` | Release Lock | Frees `knex_migrations_lock` if a migration run was interrupted. |
| `npm run db:verify` | Schema Verification | Inspects MySQL `information_schema` to verify all 10 tables, 2 views, foreign keys, unique constraints, and indexes. |
| `npm run db:import` | Import Preview | Dry-run validation of `talenthub-db.json` records, verifying mappings to MySQL schema. |
| `npm run db:import -- --execute` | Live Data Import | Migrates all existing JSON records to MySQL using non-destructive conflict-free inserts. |

---

## 3. Database Architecture & Table Structure

The schema defines **10 tables** and **2 relational views**:

```
users (Shared Authentication & Base Identity)
├── candidates (1:1 physical profile for job seekers, FK user_id -> users.id)
└── recruiters (1:1 physical profile for talent acquisition, FK user_id -> users.id)
     └── companies (N:1 employing organization, FK company_id -> companies.id)
          └── jobs (N:1 posted requisition, FK recruiter_id -> users.id, company_id -> companies.id)
               ├── applications (N:1 job submissions, FK job_id -> jobs.id, candidate_id -> users.id)
               │    └── application_stage_history (1:N immutable ATS audit trail)
               └── reported_jobs (1:N moderation flags)

job_categories (N:1 taxonomy classification for jobs)
job_alerts (1:N candidate subscription alerts)
```

### 3.1 Relational Views for Easy Querying
- **`candidate_view`:** Automatically joins `users` with `candidates` on `user_id` where `role = 'candidate'`. Returns candidate title, skills, resume, experience, and contact details alongside core user credentials.
- **`recruiter_view`:** Automatically joins `users` with `recruiters` on `user_id` where `role = 'recruiter'`. Returns recruiter title, company name, company ID, and contact details.

### 3.2 Key Constraints & Deletion Policies
1. **Single Application Guarantee:** `applications` enforces `UNIQUE KEY uq_app_candidate_job (candidate_id, job_id)`. Candidates cannot submit duplicate applications to the same job posting.
2. **Audit & Compliance Safety:**
   - Jobs with candidate applications cannot be deleted (`ON DELETE RESTRICT`).
   - Companies with active jobs cannot be deleted (`ON DELETE RESTRICT`).
   - Recruiters with active job postings cannot be deleted (`ON DELETE RESTRICT`).
3. **Data Integrity Checks (MySQL 8.0 `CHECK`):**
   - `users.role IN ('candidate', 'recruiter', 'admin')`
   - `users.status IN ('active', 'suspended')`
   - `jobs.salary_min >= 0 AND salary_max >= salary_min`
   - `applications.match_score BETWEEN 0 AND 100`
   - `applications.stage IN ('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected')`

---

## 4. Existing Data Migration (`talenthub-db.json` -> MySQL)

The file [`backend/data/talenthub-db.json`](file:///c:/Users/sajik/TalentHub/backend/data/talenthub-db.json) contains working local development data.

A safe, repeatable import utility is provided in [`backend/src/database/import-json-data.ts`](file:///c:/Users/sajik/TalentHub/backend/src/database/import-json-data.ts).

### Dry-Run Verification (Safe / Read-Only):
```bash
npm run db:import
```
*Output: Validates JSON structure and reports entity counts without modifying MySQL.*

### Live Data Import:
```bash
npm run db:import -- --execute
```
*Features:*
- Wraps all inserts inside an atomic database transaction.
- Uses `INSERT ... ON DUPLICATE KEY UPDATE` / `.onConflict('id').ignore()` so existing records are never duplicated or overwritten.
- Automatically separates candidate profiles and recruiter profiles from `users`.

---

## 5. Production: Azure Database for MySQL Flexible Server

When deploying to Azure:
1. In the Azure Portal, create an **Azure Database for MySQL Flexible Server**.
2. Under **Networking**, add your application gateway / VM / AKS subnet to allowed firewall rules.
3. Set environment variables in your deployment pipeline or Kubernetes Secrets:
   ```env
   DB_DRIVER=mysql2
   DB_HOST=talenthub-mysql-prod.mysql.database.azure.com
   DB_PORT=3306
   DB_NAME=talenthub
   DB_USER=azure_admin_user
   DB_PASSWORD=your_azure_secure_password
   DB_SSL=true
   DB_POOL_MIN=5
   DB_POOL_MAX=25
   ```
4. Run migrations during your CI/CD deployment step:
   ```bash
   npm run migrate
   ```
