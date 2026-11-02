# TalentHub — Enterprise Job Portal & Applicant Tracking System (ATS)

An enterprise 3-tier recruitment platform and Applicant Tracking System designed according to the **Azure IaaS / AKS Architecture Blueprint** and the **Project Scope & Boundary Matrix**:

| Category | In-Scope Requirements (Satisfied 100%) |
|---|---|
| **Frontend** | React + TypeScript SPA, responsive Tailwind & Bootstrap UI, role-based routing (Candidate, Recruiter, Admin), full REST API integration. |
| **Backend API** | Java 21, Spring Boot 3, RESTful endpoints, OAuth2/JWT authentication, Spring Data JPA, Flyway database migrations (plus instant-run Node/TS backend). |
| **Containerization** | Multi-stage Dockerfile for UI (NGINX) and API (JRE 21), Azure Container Registry (ACR) push/pull compatibility. |

---

## 🏗️ Architecture Blueprint

```
                     ┌─────────────────────────────────────────────────────────┐
                     │          Tier 1: Presentation (React + TypeScript)       │
                     │          • Candidate, Recruiter & Admin Portals         │
                     │          • Docker Multi-Stage + NGINX (Port 5173 / 80)  │
                     └──────────────────────────┬──────────────────────────────┘
                                                │ REST API / JWT
                                                ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          Tier 2: Application (Spring Boot 3 + Java 21)   │
                     │          • Spring Security + OAuth2 / JWT Auth          │
                     │          • AI Match Score & Stage Transitions           │
                     │          • Actuator Health Probes (/actuator/health)    │
                     │          • Multi-Stage JRE 21 Container (Port 5000)     │
                     └──────────────────────────┬──────────────────────────────┘
                                                │ JPA / Hibernate / Flyway
                                                ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          Tier 3: Data Tier (Azure MySQL Flexible)       │
                     │          • Flyway V1 Schema & V2 Seed Migrations        │
                     │          • Port 3306                                    │
                     └─────────────────────────────────────────────────────────┘
```

---

## 👥 Three-Tier User Roles & Capabilities

### 1. 💼 Job Seeker / Candidate
- **Register & Authentication**: Sign up / login with JWT authentication.
- **Candidate Dashboard**: Active applications, scheduled interviews, pending offers, and profile completion meter.
- **Search & Filter Jobs**: Full-text search with filters by category, workplace (`Remote` / `Hybrid` / `On-site`), employment type (`Full-time` / `Contract`), experience level, and salary.
- **Job Details & AI Match**: View job postings with instant AI Candidate Match Score breakdown (matched skills vs. missing skills).
- **Apply for Jobs**: Submit applications with resume upload or using profile resume with cover notes.
- **Upload Resume**: Triggers Azure AI Document Intelligence parsing, auto-extracting skills into candidate profile.
- **Track Applications**: Visual interactive progress stepper:
  $$\text{Applied} \longrightarrow \text{Screening} \longrightarrow \text{Interview} \longrightarrow \text{Offer} \longrightarrow \text{Hired / Rejected}$$
- **Profile Management**: Manage headline, bio, location, phone, and technical skill chips.
- **Job Alerts**: Configure automated email alert criteria with frequency (daily / weekly).

### 2. 🏢 Recruiter
- **Recruiter Dashboard**: Requisitions count, applicant pipeline, recruitment funnel stage distribution.
- **Create & Manage Jobs**: Post new jobs with required skills, salary ranges, benefits, experience levels, and workplace flexibility; edit/archive postings.
- **Applicant Tracking Board (ATS)**:
  - Toggle between **Kanban Board** and **Table View**.
  - Candidates ranked automatically by **AI Match Score** (0–100%).
  - Single-click stage progression:
    $$\text{Applied} \longrightarrow \text{Screening} \longrightarrow \text{Interview} \longrightarrow \text{Offer} \longrightarrow \text{Hired / Rejected}$$
  - Schedule interview rounds (`Technical Round`, `Video Call`, `On-site`, `HR Discussion`) with date and time picker.
- **Applicant Details**: Deep-dive profile view with parsed resume data, recruiter notes, and full audit trail of stage changes.

### 3. 🛡️ Admin
- **Admin Dashboard**: System-wide platform metrics, total users, active jobs, verified companies, reported jobs, top in-demand skills, and average time-to-hire.
- **User Management**: Filter users by role (`candidate`, `recruiter`, `admin`), toggle account status (`active` vs. `suspended`), update roles, or delete users.
- **Manage Companies**: Register partner organizations and toggle verification badges.
- **Job Categories**: Add and configure job classifications and taxonomies with real-time job counts.
- **Reported Jobs Queue**: Moderate candidate reports on fraudulent or misleading job postings (Dismiss report, Resolve report, or Remove job immediately).

---

## 🚀 Running the Project

### Option A: Local Run (Node.js & Vite Live Development)
Both servers can be started simultaneously:
```cmd
start-talenthub.bat
```
*(Or run `npm run dev:backend` and `npm run dev:frontend`)*

* **Frontend UI**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:5000](http://localhost:5000)
* **Health Probe**: [http://localhost:5000/health](http://localhost:5000/health)

### Option B: Docker Compose (Java 21 Spring Boot 3 + MySQL + React NGINX)
To launch the complete Java 21 + Spring Boot 3 containerized stack:
```bash
docker compose up --build
```
This builds:
1. `talenthub-mysql`: MySQL 8.0 on port 3306 with Flyway migrations.
2. `talenthub-spring-api`: Java 21 Spring Boot 3 multi-stage JRE 21 container on port 5000.
3. `talenthub-frontend-ui`: React + TypeScript multi-stage NGINX container on port 5173 / 80.

---

## 🔑 Pre-Seeded Demo Credentials

| Role | Email | Password | Pre-loaded Data |
|---|---|---|---|
| **Candidate** | `candidate@talenthub.com` | `password123` | Alex Morgan (Sr. Full-Stack Engineer, 6 yrs exp) |
| **Recruiter** | `recruiter@techcorp.com` | `password123` | Sarah Jenkins (CloudScale Technologies) |
| **Admin** | `admin@talenthub.com` | `password123` | Eleanor Vance (Platform Administrator) |

---

## 📁 Project Directory Structure

```
Talenthub/
├── backend-spring/                     # Java 21 + Spring Boot 3 Backend
│   ├── src/
│   │   ├── main/java/com/talenthub/
│   │   │   ├── TalentHubApplication.java
│   │   │   ├── config/                 # SecurityConfig, JwtAuthFilter, JwtTokenProvider
│   │   │   ├── controller/             # Auth, Jobs, ATS Applications, Companies, Admin
│   │   │   ├── dto/                    # AuthDto, ApplicationDto, SystemStatsDto
│   │   │   ├── model/                  # User, Job, Application, Company, JobCategory
│   │   │   ├── repository/             # Spring Data JPA Repositories
│   │   │   └── service/                # ApplicationService (AI Match Engine), AuthService
│   │   └── main/resources/
│   │       ├── application.yml         # MySQL & Actuator Configuration
│   │       └── db/migration/           # Flyway Migrations (V1__init_schema.sql, V2__seed_data.sql)
│   ├── Dockerfile                      # Multi-stage: Maven Temurin 21 -> JRE 21 Alpine
│   └── pom.xml                         # Spring Boot 3.3.2, Java 21, JPA, Security, Flyway
│
├── frontend/                           # React + TypeScript Frontend
│   ├── src/
│   │   ├── components/                 # Navbar, Sidebar, ProtectedRoute, JobCard, Loading
│   │   ├── layouts/                    # CandidateLayout, RecruiterLayout, AdminLayout
│   │   ├── pages/
│   │   │   ├── auth/                   # Login, Register
│   │   │   ├── candidate/              # Dashboard, Jobs, JobDetails, Applications, Profile, JobAlerts
│   │   │   ├── recruiter/              # Dashboard, ManageJobs, CreateJob, Applicants, ApplicantDetails
│   │   │   └── admin/                  # Dashboard, Users, Companies, Categories, ReportedJobs
│   │   ├── services/api.ts             # Typed REST API Client
│   │   ├── context/AuthContext.tsx     # Session management & Role Switcher
│   │   ├── types/index.ts              # TypeScript Domain Definitions
│   │   ├── App.tsx                     # Route Switcher
│   │   ├── main.tsx                    # Entry Point
│   │   └── index.css                   # Tailwind CSS
│   ├── Dockerfile                      # Multi-stage: Node 20 -> NGINX Alpine
│   ├── nginx.conf                      # Production Reverse Proxy
│   └── package.json
│
├── backend/                            # TypeScript Express Backend (Immediate Host Execution)
├── docker-compose.yml                  # Full 3-Tier Multi-Container Orchestrator
├── start-talenthub.bat                 # One-Click Windows Launcher
└── README.md
```
