# TalentHub — Enterprise Job Portal & Applicant Tracking System (ATS)

An enterprise 3-tier recruitment platform and Applicant Tracking System built with React, Node.js, Express, TypeScript, and MySQL.

TalentHub features a high-density, professional UI inspired by **Linear**, **Stripe**, and **Notion** (deep navy `#0F172A`, indigo `#4F46E5`, and subtle teal `#0D9488`), complete candidate and recruiter portals, AI match scoring, an interactive ATS pipeline, and an immutable stage audit trail.

> **Architecture Decision**: React + TypeScript → Node.js + Express.js + TypeScript → MySQL 8.0. Azure Database for MySQL Flexible Server is the planned cloud database target; the repository has not been migrated to Azure.

---

## 📑 Project Documentation Deliverables

Detailed engineering documentation is available directly in the repository:

- 📊 **[MVP Implementation Audit](MVP_IMPLEMENTATION_AUDIT.md)**: Full component-by-component audit matrix against product requirements.
- 🔌 **[REST API Documentation](API_DOCUMENTATION.md)**: Endpoint contract for auth, jobs, ATS applications, resume upload/parsing, and analytics.
- ✅ **[Completed Features Matrix](COMPLETED_FEATURES.md)**: Verification checklist of all delivered candidate, recruiter, and admin capabilities.
- ⚠️ **[Technical Constraints & Limitations](REMAINING_LIMITATIONS.md)**: Cloud service credentials, local database configuration, and production deployment notes.

---

## 🏗️ Architecture Blueprint

```
                     ┌─────────────────────────────────────────────────────────┐
                     │          Tier 1: Presentation (React 18 + TypeScript)   │
                     │          • Professional Linear/Stripe-Quality UI        │
                     │          • Candidate, Recruiter & Admin Portals         │
                     │          • Vite + Tailwind CSS + Bootstrap Icons        │
                     │          • Multi-Stage Docker NGINX (Port 5173 / 80)    │
                     └──────────────────────────┬──────────────────────────────┘
                                                │ REST API / JWT
                                                ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          Tier 2: Application Tier (Node.js REST API)    │
                     │          • Node.js 20+ / Express.js / TypeScript        │
                     │          • JWT Authentication & Role-Based Guarding     │
                     │          • Resume Parsing & Match Scoring               │
                     │          • Health Probes (/health, /actuator/health)    │
                     │          • Connection Pooling & Database Migrations     │
                     └──────────────────────────┬──────────────────────────────┘
                                                │ MySQL Protocol / SSL
                                                ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          Tier 3: Data Tier (MySQL 8.0 Flexible Server)  │
                     │          • Relational Schema (V1–V4 migrations)          │
                     │          • Stage Audit Trail (application_stage_history)│
                     │          • MySQL local/container; Azure target planned   │
                     │          • Port 3306 (Docker Container or Local Server) │
                     └─────────────────────────────────────────────────────────┘
```

---

## 👥 Three-Tier User Roles & Capabilities

### 1. 💼 Job Seeker / Candidate Portal
- **Public Landing Page**: Modern overview highlighting ATS capabilities, job search, and AI scoring.
- **Register & Login**: Clean split-screen authentication with role pre-selection and demo sign-in shortcuts.
- **Candidate Dashboard**: Dynamic metrics retrieved via `/api/analytics/dashboard` (active applications, scheduled interviews, pending offers, profile completion meter).
- **Search & Filter Jobs**: Full-text search with multi-select filters by category, workplace (`Remote` / `Hybrid` / `On-site`), employment type, and experience level.
- **Job Details & AI Match**: Real-time match score breakdown comparing candidate skills with job requirements.
- **Job Application**: Apply with cover letter, profile resume, or new document upload with duplicate application prevention.
- **Resume Parsing**: Upload PDF/DOC/DOCX resumes; the current parser uses local heuristics and is not connected to Azure Document Intelligence.
- **Application Pipeline Tracker**: Interactive progress stepper:
  $$\text{Applied} \longrightarrow \text{Screening} \longrightarrow \text{Interview} \longrightarrow \text{Offer} \longrightarrow \text{Hired / Rejected}$$
- **Profile Management**: Maintain professional headline, bio, contact information, and technical skill chips.

### 2. 🏢 Recruiter Workspace (ATS)
- **Recruiter Dashboard**: Real-time KPI cards (active requisitions, candidates under review, scheduled interviews, offers, hires) and visual recruitment funnel bar charts.
- **Job Requisition Management**: Complete CRUD for job postings (skills, salary range, workplace type, experience level, requirements, benefits, archive/close).
- **ATS Applicant Tracking Board**:
  - Toggle between **Kanban Board** and **Table View**.
  - Candidates automatically ranked by **AI Match Score** (0–100%).
  - Stage progression modal with required audit comment, interview type selection (`Technical Round`, `Video Call`, `On-site`, `HR Discussion`), and interview date/time picker.
- **Applicant Details & Audit Log**: In-depth candidate review showing match breakdown, resume details, recruiter notes, and full historical timeline of stage changes from `application_stage_history`.

### 3. 🛡️ Admin Platform Governance
- **Control Center**: System-wide platform metrics, total candidates, total recruiters, registered companies, active jobs, top in-demand technical skills, and average time-to-hire.
- **User Directory**: Search and filter platform users, toggle account status (`active` vs. `suspended`), update roles, or delete users.
- **Company Management**: Directory of hiring organizations with partner verification badges.
- **Job Categories Taxonomy**: Manage categorization classifications with live job counts.
- **Reported Jobs Queue**: Triage candidate reports regarding fraudulent or expired postings (dismiss report, resolve report, or remove posting immediately).

---

## 🚀 Running the Project Locally

### Demo User Accounts

| Role | Email | Password |
|---|---|---|
| **Candidate** | `candidate@talenthub.com` | `password123` |
| **Recruiter** | `recruiter@techcorp.com` | `password123` |
| **Admin** | `admin@talenthub.com` | `password123` |

*(Quick-login buttons are also provided directly on the Login page).*

---

### Option A: Local Development (MySQL required by default)

Start a local MySQL 8.0 server and create `backend/.env` from the example before launching the batch file. Set a private JWT secret and your MySQL credentials.

```powershell
Copy-Item backend/.env.example backend/.env
```

Both backend and frontend can be started with a single double-click:

```cmd
start-talenthub.bat
```

Or start them individually from command line:

```powershell
# Start MySQL 8.0 locally, then start the Node.js/TypeScript REST API on port 5000.
cd backend
npm install
npm run dev

# Start Frontend (React 18 + Vite on port 5173)
cd frontend
npm install
npm run dev
```

- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Probe**: [http://localhost:5000/health](http://localhost:5000/health)

---

### Option B: Docker Compose (Node.js REST API + MySQL 8.0 + Azurite + React NGINX)

To launch the fully containerized 3-tier production stack with Azure Blob Storage emulator:

```powershell
Copy-Item .env.example .env
# Edit .env before starting. Set secure passwords, JWT_SECRET, and port configurations.
docker compose up --build -d
```

This starts:
1. `database`: MySQL 8.0 on host port 3308 (internal port 3306) with a persistent volume (`mysql_data`) and health check.
2. `azurite`: Azure Blob Storage emulator on port 10000 with persistent volume (`azurite_data`) for enterprise resume storage.
3. `backend`: Node.js + Express + TypeScript on port 5000, waiting for healthy MySQL and Azurite, running migrations on startup before serving requests.
4. `frontend`: React 18 production build behind NGINX on host port 5173, internally proxying `/api/` and `/uploads/` to `http://backend:5000`.

Check service health:
```powershell
docker compose ps
curl http://localhost:5000/health
curl http://localhost:5173
```

---

For isolated development or tests only, set `DB_MODE=json` to opt into the legacy JSON store. This is rejected in production and does not synchronize with MySQL.

## ⚙️ Environment Variables

The backend uses environment variables for all external dependencies:

See [`backend/.env.example`](backend/.env.example) for local development and [`.env.example`](.env.example) for Docker Compose. The backend defaults to `DB_MODE=mysql` and requires `JWT_SECRET` with at least 32 characters. Compose sets `DB_HOST=database` so the API connects over the Docker network.

---

## 🛠️ Verification & Test Scripts

TalentHub includes comprehensive automated integration test suites:

```powershell
# Run basic integration test
powershell -ExecutionPolicy Bypass -File .\scripts\test-e2e.ps1

# Run comprehensive 10-step full workflow verification (Auth, Profile, Application, Recruiter Kanban, Audit History)
powershell -ExecutionPolicy Bypass -File .\scripts\test-comprehensive.ps1
```

Build status is not inferred from earlier documentation; run the commands below to verify the current checkout:

```bash
# Build Node.js backend and React frontend from the repository root
npm run build
```

### Verification run (November 4, 2026)

- `npm run build`: passed for the Node backend and React frontend.
- `npm test`: passed all 8 integration checks using an isolated JSON test directory.
- `npm run test:comprehensive`: passed registration, profile, application, candidate role denial, suspended-account denial, recruiter review, interview scheduling, and audit-history checks in an isolated JSON test directory.
- Docker Compose: backend and frontend images built; MySQL 8.0, the Node API, and NGINX reached healthy/running states on isolated test ports. MySQL-backed HTTP smoke checks passed through the NGINX proxy for profile persistence, alerts, multipart applications, resume upload/parse, and password omission.
- No standalone unit-test suite is configured. The automated API scripts use JSON mode; a separate isolated Docker/MySQL smoke run covered database integration.
