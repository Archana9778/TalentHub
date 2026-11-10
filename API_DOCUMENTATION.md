# TalentHub REST API Documentation

This document describes the implemented Node.js + Express.js + TypeScript API (`backend/`). The normal runtime requires MySQL 8.0. Azure Database for MySQL Flexible Server is the planned cloud target, not a completed migration.

---

## 🔐 Authentication & Headers

Protected endpoints accept authentication via either:
1. **HttpOnly Cookie** (`talenthub_token`) automatically transmitted by browsers with `credentials: include` / `withCredentials: true`.
2. **Authorization Header**:
```http
Authorization: Bearer <jwt_token>
```

### Roles
- `candidate`
- `recruiter`
- `admin` (or `administrator`)

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1 User Registration
- **Endpoint**: `POST /api/auth/register`
- **Access**: Public (Candidate & Recruiter)
- **Rate Limit**: 15 requests / 60 minutes
- **Password Policy**:
  - Minimum 12 characters, maximum 128 characters.
  - Requires uppercase letter, lowercase letter, number, and special character.
  - Commonly compromised passwords and dictionary patterns are rejected.
- **Role Rules**:
  - `candidate`: requires `name`, `email`, `password`.
  - `recruiter`: requires `name`, `email`, `password`, and `companyName`.
  - Public registration as `admin` is strictly forbidden (HTTP 403).
- **Request Body**:
```json
{
  "name": "Alex Morgan",
  "email": "alex.morgan@example.com",
  "password": "SecurePass2026!#",
  "confirmPassword": "SecurePass2026!#",
  "role": "candidate",
  "title": "Senior Frontend Engineer",
  "location": "Seattle, WA"
}
```
- **Response** `201 Created`:
```json
{
  "message": "Account registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-8a9b1c2d",
    "name": "Alex Morgan",
    "email": "alex.morgan@example.com",
    "role": "candidate",
    "status": "active"
  }
}
```

### 1.2 User Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Rate Limit**: 10 requests / 15 minutes
- **Security**: Timing-attack protected with constant-time password comparison and identical error responses preventing account enumeration. Sets secure, HttpOnly, SameSite session cookie.
- **Request Body**:
```json
{
  "email": "candidate@talenthub.com",
  "password": "password123"
}
```
- **Response** `200 OK`:
```json
{
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-candidate-1",
    "name": "Alex Morgan",
    "email": "candidate@talenthub.com",
    "role": "candidate",
    "status": "active"
  }
}
```

### 1.3 User Logout
- **Endpoint**: `POST /api/auth/logout`
- **Access**: Authenticated
- **Security**: Invalidates session token server-side (stored in revoked tokens blacklist) and clears the HttpOnly auth cookie.
- **Response** `200 OK`:
```json
{
  "message": "Logged out successfully."
}
```

### 1.4 Forgot Password (Password Recovery Request)
- **Endpoint**: `POST /api/auth/forgot-password`
- **Access**: Public
- **Rate Limit**: 5 requests / 15 minutes
- **Security**: Generates a cryptographically secure 32-byte hex token, stores its SHA-256 hash with a 15-minute expiration, and dispatches an email via configured SMTP provider. Returns a generic success response regardless of whether the email exists to prevent user enumeration.
- **Request Body**:
```json
{
  "email": "candidate@talenthub.com"
}
```
- **Response** `200 OK`:
```json
{
  "message": "If an account with that email address exists, password reset instructions have been sent."
}
```

### 1.5 Reset Password (Password Recovery Confirmation)
- **Endpoint**: `POST /api/auth/reset-password`
- **Access**: Public (requires valid single-use reset token)
- **Rate Limit**: 5 requests / 15 minutes
- **Security**: Verifies SHA-256 token hash and expiration, marks token as used, enforces the 12+ character password complexity policy, updates password with bcrypt salt, and terminates all active sessions by incrementing the user's `tokenVersion`.
- **Request Body**:
```json
{
  "token": "4a7f8e1c2b3d...",
  "newPassword": "BrandNewPassword2026!#",
  "confirmPassword": "BrandNewPassword2026!#"
}
```
- **Response** `200 OK`:
```json
{
  "message": "Password has been reset successfully. Please sign in with your new password."
}
```

### 1.6 Get Current User Profile
- **Endpoint**: `GET /api/auth/me`
- **Access**: Authenticated (`candidate`, `recruiter`, `admin`)
- **Response** `200 OK`: Returns sanitized user object.

### 1.7 Update User Profile
- **Endpoint**: `PUT /api/auth/profile`
- **Access**: Authenticated
- **Security**: Role, status, password, and tokenVersion are protected and cannot be changed through this endpoint.
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "title": "Staff Full Stack Engineer",
  "location": "San Francisco, CA",
  "phone": "+1 555-0199",
  "bio": "10+ years architecting scalable cloud SaaS platforms.",
  "skills": ["React", "TypeScript", "Node.js", "Docker", "Kubernetes"]
}
```
- **Response** `200 OK`: Returns updated user object.

### 1.8 Upload Candidate Resume
- **Endpoint**: `POST /api/auth/resume`
- **Access**: Authenticated (`candidate`, `admin`)
- **Content-Type**: `multipart/form-data` (field: `resume`)
- **Response** `200 OK`: Returns resume URL, parsed data, and updated candidate profile.

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

