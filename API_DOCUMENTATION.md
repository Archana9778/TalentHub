# TalentHub REST API Documentation

This document describes the implemented Node.js + Express.js + TypeScript API (`backend/`). The normal runtime requires MySQL 8.0. Azure Database for MySQL Flexible Server is the planned cloud target, not a completed migration.

---

## 🔐 Authentication & Headers

All protected endpoints require a valid JSON Web Token (JWT) provided in the HTTP Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Roles
- `candidate` (`ROLE_CANDIDATE`)
- `recruiter` (`ROLE_RECRUITER`)
- `admin` (`ROLE_ADMIN`)

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1 Candidate Registration
- **Endpoint**: `POST /api/auth/register`
- **Access**: Public
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!",
  "role": "candidate",
  "title": "Senior Frontend Engineer",
  "location": "Seattle, WA",
  "phone": "+1 (555) 234-5678",
  "skills": ["React", "TypeScript", "Tailwind CSS"]
}
```
- **Response** `201 Created`:
```json
{
  "user": {
    "id": "cand-001",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "candidate",
    "title": "Senior Frontend Engineer",
    "location": "Seattle, WA",
    "skills": ["React", "TypeScript", "Tailwind CSS"]
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 1.2 User Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Request Body**:
```json
{
  "email": "recruiter@techcorp.com",
  "password": "password123"
}
```
- **Response** `200 OK`:
```json
{
  "user": {
    "id": "rec-001",
    "name": "Alex Morgan",
    "email": "recruiter@techcorp.com",
    "role": "recruiter",
    "companyId": "comp-001",
    "companyName": "TechCorp Global"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 1.3 Get Current User Profile
- **Endpoint**: `GET /api/auth/me`
- **Access**: Authenticated (`Candidate`, `Recruiter`, `Admin`)
- **Response** `200 OK`:
```json
{
  "user": {
    "id": "cand-001",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "candidate",
    "skills": ["React", "TypeScript", "Spring Boot"],
    "profileCompletion": 85
  }
}
```

### 1.4 Update User Profile
- **Endpoint**: `PUT /api/auth/profile`
- **Access**: Authenticated
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "title": "Staff Full Stack Engineer",
  "location": "San Francisco, CA",
  "phone": "+1 555-0199",
  "bio": "10+ years architecting scalable cloud SaaS platforms.",
  "skills": ["React", "TypeScript", "Java", "Spring Boot", "Docker", "Kubernetes"]
}
```
- **Response** `200 OK`: Returns updated user object.

---

## 2. Job Requisition Endpoints (`/api/jobs`)

### 2.1 Search & Filter Jobs
- **Endpoint**: `GET /api/jobs`
- **Access**: Public
- **Query Parameters**:
  - `search` (string): Text query matching title, description, skills, company name
  - `category` (string): Category ID or slug
  - `workplaceType` (string): `Remote` | `Hybrid` | `On-site`
  - `jobType` (string): `Full-time` | `Part-time` | `Contract` | `Internship`
  - `experienceLevel` (string): `Entry-level` | `Mid-level` | `Senior` | `Lead / Principal`
  - `location` (string): Location substring
- **Response** `200 OK`:
```json
{
  "jobs": [
    {
      "id": "job-101",
      "title": "Lead Full-Stack Cloud Engineer",
      "companyId": "comp-001",
      "companyName": "TechCorp Global",
      "companyLogo": "https://...",
      "categoryId": "cat-001",
      "categoryName": "Software Engineering",
      "location": "Seattle, WA (Remote Eligible)",
      "workplaceType": "Remote",
      "jobType": "Full-time",
      "experienceLevel": "Lead / Principal",
      "salaryMin": 150000,
      "salaryMax": 200000,
      "skills": ["React", "TypeScript", "Java", "Spring Boot", "Azure", "Docker"],
      "status": "active",
      "applicantsCount": 12,
      "createdAt": "2026-10-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

### 2.2 Get Job Details
- **Endpoint**: `GET /api/jobs/:id`
- **Access**: Public
- **Response** `200 OK`: Returns full job object including `requirements` and `benefits` arrays, plus associated company profile.

### 2.3 Create Job
- **Endpoint**: `POST /api/jobs`
- **Access**: Protected (`recruiter`, `admin`)
- **Request Body**:
```json
{
  "title": "Senior Backend Java Engineer",
  "categoryId": "cat-001",
  "location": "Austin, TX (Hybrid)",
  "workplaceType": "Hybrid",
  "jobType": "Full-time",
  "experienceLevel": "Senior",
  "salaryMin": 130000,
  "salaryMax": 165000,
  "description": "Building microservices on Spring Boot 3 & Kubernetes...",
  "skills": ["Java", "Spring Boot", "MySQL", "Docker", "Kafka"],
  "requirements": ["5+ years Java experience", "Deep knowledge of Spring Data JPA"],
  "benefits": ["Health, Dental, Vision", "401(k) match", "Flexible PTO"]
}
```
- **Response** `201 Created`: Returns newly created Job entity.

### 2.4 Update Job
- **Endpoint**: `PUT /api/jobs/:id`
- **Access**: Protected (`recruiter` owner or `admin`)
- **Request Body**: Partial or full job fields (`title`, `location`, `salaryMin`, `salaryMax`, `status`, etc.)
- **Response** `200 OK`: Returns updated Job entity.

### 2.5 Delete / Archive Job
- **Endpoint**: `DELETE /api/jobs/:id`
- **Access**: Protected (`recruiter` owner or `admin`)
- **Response** `200 OK`:
```json
{ "message": "Job posting deleted successfully." }
```

### 2.6 Get Recruiter's Active Postings
- **Endpoint**: `GET /api/jobs/recruiter/my-jobs`
- **Access**: Protected (`recruiter`)
- **Response** `200 OK`: Array of job requisitions owned by the authenticated recruiter.

---

## 3. Application & ATS Endpoints (`/api/applications`)

### 3.1 Apply for a Job
- **Endpoint**: `POST /api/applications/apply` (or `POST /api/applications`)
- **Access**: Candidate
- **Request Body** (`multipart/form-data` from the React client; JSON is also accepted):
```json
{
  "jobId": "job-101",
  "coverLetter": "Excited to apply for the Lead Cloud Engineer role...",
}
```
- **Validation**: Enforces single application per candidate per job (duplicate prevention).
- **Match Scoring**: Calculates a local skill/experience match estimate from the signed-in candidate and job requirements.
- **Audit Log**: Automatically writes initial stage audit record (`Applied`).
- **Response** `201 Created`:
```json
{
  "application": {
    "id": "app-501",
    "jobId": "job-101",
    "jobTitle": "Lead Full-Stack Cloud Engineer",
    "candidateId": "cand-001",
    "candidateName": "Jane Doe",
    "stage": "Applied",
    "matchScore": 85,
    "createdAt": "2026-11-03T18:00:00Z"
  }
}
```

### 3.2 Candidate Application Pipeline
- **Endpoint**: `GET /api/applications/my-applications`
- **Access**: Protected (`candidate`)
- **Response** `200 OK`:
```json
{
  "applications": [
    {
      "id": "app-501",
      "jobId": "job-101",
      "jobTitle": "Lead Full-Stack Cloud Engineer",
      "companyName": "TechCorp Global",
      "stage": "Interview",
      "matchScore": 85,
      "interviewDate": "2026-11-10T14:00:00Z",
      "interviewType": "Technical Round",
      "timeline": [
        { "stage": "Applied", "changedAt": "2026-11-03T18:00:00Z", "changedByName": "Jane Doe" },
        { "stage": "Screening", "changedAt": "2026-11-04T10:00:00Z", "changedByName": "Alex Morgan" },
        { "stage": "Interview", "changedAt": "2026-11-05T09:30:00Z", "changedByName": "Alex Morgan", "comment": "Scheduled technical architecture round." }
      ]
    }
  ]
}
```

### 3.3 Recruiter Applicant Tracking (ATS View)
- **Endpoint**: `GET /api/applications/applicants` (or `GET /api/applications/job/:jobId`)
- **Access**: Protected (`recruiter`, `admin`)
- **Query Parameters**:
  - `jobId` (optional): Filter to candidates for a specific requisition
  - `stage` (optional): Filter to candidates in `Applied`, `Screening`, `Interview`, `Offer`, `Hired`, or `Rejected`
- **Response** `200 OK`: Array of applicant objects ranked by match score.

### 3.4 Advance / Transition Application Stage
- **Endpoint**: `PUT /api/applications/:id/stage` (or `PATCH`)
- **Access**: Protected (`recruiter`, `admin`)
- **Request Body**:
```json
{
  "stage": "Interview",
  "comment": "Passed screening with flying colors. Advancing to technical interview.",
  "interviewDate": "2026-11-10T14:00:00Z",
  "interviewType": "Technical Round"
}
```
- **Permitted Stages**: `Applied` → `Screening` → `Interview` → `Offer` → `Hired` (or `Rejected`).
- **Audit Persistence**: Appends immutable entry to `application_stage_history`.
- **Response** `200 OK`: Returns updated application object with latest timeline.

### 3.5 Application Stage Audit Timeline
- **Endpoint**: `GET /api/applications/:id/audit`
- **Access**: Candidate for their own application; recruiter for applications to their own jobs; admin.
- **Response** `200 OK`:
```json
{
  "total": 1,
  "timeline": [
    {
      "id": "hist-12345678",
      "applicationId": "app-501",
      "fromStage": "Applied",
      "toStage": "Interview",
      "changedByUserId": "rec-001",
      "changedByName": "Alex Morgan",
      "comment": "Scheduled technical interview",
      "interviewType": "Technical Round",
      "interviewDate": "2026-11-10T14:00:00Z",
      "createdAt": "2026-11-05T09:30:00Z"
    }
  ]
}
```

---

## 4. Resume Upload and Parsing (`/api/resume`)

### 4.1 Upload & Parse Resume
- **Endpoint**: `POST /api/resume/upload`
- **Access**: Protected (`candidate`)
- **Content-Type**: `multipart/form-data`
- **Form Field**: `resume` (PDF, DOC, DOCX up to 10MB)
- **Response** `200 OK`:
```json
{
  "message": "Resume uploaded and processed with the local heuristic parser.",
  "parsedData": {
    "extractedSkills": ["React", "TypeScript", "Node.js", "Java", "Docker"],
    "experienceYears": 6,
    "educationLevel": "Bachelor of Science in Computer Science",
    "summary": "Full stack engineer experienced in cloud microservices and React web applications."
  },
  "user": {
    "id": "cand-001",
    "resumeOriginalName": "Jane_Doe_Resume_2026.pdf",
    "skills": ["React", "TypeScript", "Node.js", "Java", "Docker"]
  }
}
```

### 4.2 On-Demand Resume Parsing
- **Endpoint**: `POST /api/resume/parse`
- **Access**: Authenticated
- **Content-Type**: `multipart/form-data` with an optional `resume` field, or JSON with an optional `filename`.
- **Response** `200 OK`: Extracted entity structure without automatically updating candidate profile.

---

## 5. Analytics & Dashboard Metrics (`/api/analytics`)

### 5.1 Role-Scoped Analytics
- **Endpoint**: `GET /api/analytics/dashboard`
- **Access**: Authenticated

#### Candidate View:
```json
{
  "analytics": {
    "totalApplications": 5,
    "activeApplications": 4,
    "interviewsScheduled": 2,
    "offersReceived": 1,
    "rejectedApplications": 0,
    "profileCompletion": 90,
    "recentApplications": [...]
  }
}
```

#### Recruiter View:
```json
{
  "analytics": {
    "activeJobs": 6,
    "totalApplicants": 48,
    "underReview": 14,
    "interviews": 8,
    "offers": 3,
    "hires": 2,
    "stageDistribution": {
      "Applied": 21,
      "Screening": 14,
      "Interview": 8,
      "Offer": 3,
      "Hired": 2,
      "Rejected": 0
    },
    "topCandidates": [...]
  }
}
```

#### Admin View:
```json
{
  "analytics": {
    "totalUsers": 128,
    "totalCandidates": 95,
    "totalRecruiters": 30,
    "totalCompanies": 18,
    "totalJobs": 42,
    "activeJobs": 36,
    "totalApplications": 210,
    "pendingReports": 2
  }
}
```

---

## 6. Companies, Categories, and Job Alerts

- `GET /api/companies` and `GET /api/companies/:id`: Public company directory and company details with jobs.
- `POST /api/companies`: Recruiter or admin creates a company.
- `PUT /api/companies/:id` and `DELETE /api/companies/:id`: Admin only.
- `GET /api/categories`: Public category list. `POST`, `PUT /:id`, and `DELETE /:id` require admin.
- `GET /api/job-alerts`, `POST /api/job-alerts`, `PATCH /api/job-alerts/:id/toggle`, and `DELETE /api/job-alerts/:id`: Candidate-only operations, scoped to the signed-in candidate.

## 7. Administration & Governance Endpoints (`/api/admin`)

All endpoints require an admin JWT:

- `GET /api/admin/statistics`: Platform counts and application-stage totals.
- `GET /api/admin/users`: List users; accepts `role`, `status`, and `search` filters.
- `PATCH /api/admin/users/:id`: Change a user's `status` and/or `role`.
- `DELETE /api/admin/users/:id`: Delete a user account (admins cannot delete themselves).
- `GET /api/admin/reported-jobs`: List job reports.
- `PATCH /api/admin/reported-jobs/:id`: Set `pending`, `resolved`, or `dismissed`; optional `removeJob` deletes the reported job.

## Database and runtime notes

- Set `DB_MODE=mysql` (the default), `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. The API refuses to start if MySQL is unavailable or migrations fail.
- `DB_MODE=json` explicitly opts into local JSON storage in `development` or `test` only; it is not available in production and does not synchronize data with MySQL.
- Migrations V1–V4 create the initial schema, seed demo data on a fresh schema, add the application-stage audit table, and add JSON-backed profile fields. Existing rows are retained.
- Application stage changes support interview scheduling through `interviewDate` and `interviewType`; audit history is available from `GET /api/applications/:id/audit`.

