# TalentHub — Enterprise Job Portal & Applicant Tracking System (ATS)

An enterprise 3-tier recruitment platform and Applicant Tracking System designed according to modern cloud SaaS patterns and the **Azure IaaS / AKS Architecture Blueprint**.

TalentHub features a high-density, professional UI inspired by **Linear**, **Stripe**, and **Notion** (deep navy `#0F172A`, indigo `#4F46E5`, and subtle teal `#0D9488`), complete candidate and recruiter portals, AI match scoring, an interactive ATS pipeline, and an immutable stage audit trail.

---

## 📑 MVP Documentation Deliverables

Detailed engineering documentation is available directly in the repository:

- 📊 **[MVP Implementation Audit](MVP_IMPLEMENTATION_AUDIT.md)**: Full component-by-component audit matrix against product requirements.
- 🔌 **[REST API Documentation](API_DOCUMENTATION.md)**: Exhaustive endpoint contract for Auth, Jobs, ATS Applications, Azure AI Resume Extraction, and Analytics.
- ✅ **[Completed Features Matrix](COMPLETED_FEATURES.md)**: Verification checklist of all delivered candidate, recruiter, and admin capabilities.
- ⚠️ **[Technical Constraints & Limitations](REMAINING_LIMITATIONS.md)**: Cloud service credentials, local JDK requirements, and production deployment notes.

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
                     │          Tier 2: Application Tier (Dual Implementation)  │
                     │          • Option A: Node.js/TypeScript (Port 5000)     │
                     │          • Option B: Java 21 / Spring Boot 3 (Port 5000)│
                     │          • Spring Security + OAuth2 / JWT Auth          │
                     │          • Azure AI Resume Parsing & Match Scoring      │
                     │          • Actuator Health Probes (/health)             │
                     └──────────────────────────┬──────────────────────────────┘
                                                │ JPA / Hibernate / Flyway
                                                ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          Tier 3: Data Tier (MySQL Flexible / H2)        │
                     │          • Flyway V1 Schema, V2 Seed, V3 Audit Migrations│
                     │          • Port 3306 (or In-Memory H2 for Local Dev)    │
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
- **Azure AI Resume Extraction**: Upload PDF/DOCX resumes to extract skills, experience years, and career summary via Azure Document Intelligence.
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

### Option A: Local Dev Execution (Zero Dependencies Required)

Both backend and frontend can be started with a single double-click:

```cmd
start-talenthub.bat
```

Or start them individually from command line:

```bash
# 1. Start Backend (Node.js/TypeScript REST API on port 5000)
cd backend
npm install
npm run dev

# 2. Start Frontend (React 18 + Vite on port 5173)
cd frontend
npm install
npm run dev
```

- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Probe**: [http://localhost:5000/health](http://localhost:5000/health)

---

### Option B: Docker Compose (Java 21 Spring Boot 3 + MySQL + React NGINX)

To launch the containerized Java 21 / Spring Boot 3 enterprise stack:

```bash
docker compose up --build
```

This spins up:
1. `talenthub-mysql`: MySQL 8.0 on port 3306 with Flyway schema migrations (`V1`, `V2`, `V3`).
2. `talenthub-spring-api`: Java 21 Spring Boot 3 multi-stage JRE 21 container on port 5000.
3. `talenthub-frontend-ui`: React 18 multi-stage NGINX container on port 5173 / 80.

---

### Option C: Spring Boot with In-Memory H2 Database

If you have Java 21 and Maven installed locally and want to test Spring Boot without a running MySQL container:

```bash
cd backend-spring
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

This launches the Spring Boot service on port 5000 with the H2 in-memory profile and automatic entity schema generation.

---

## 🛠️ Verification & Build Commands

Both sub-projects build with zero compilation errors:

```bash
# Build Node.js backend
npm run build --prefix backend
# Exit code: 0

# Build React frontend
npm run build --prefix frontend
# Exit code: 0
```
