# TalentHub MVP — Technical Constraints & Remaining Limitations

This document outlines architectural nuances, external dependencies, and recommended production hardening steps for the TalentHub MVP.

---

## 1. Official Backend Standardization

- **Active Backend**: Node.js 20+ with Express.js and TypeScript (`backend/`) is the sole active backend service.
- **Retired Components**: Legacy Java 21 / Spring Boot 3 and H2 source/configuration are removed. The active SQL migrations are retained under `backend/src/database/migrations/`.

---

## 2. Database Integration & Cloud Readiness

### MySQL 8.0 & Azure Database for MySQL Flexible Server
- **Current Behavior**: MySQL 8.0 is mandatory by default. Docker Compose connects to the `database` service hostname and waits for its health check. The Node backend applies additive migrations before listening and exits with a sanitized configuration or migration error if MySQL is unavailable.
- **Development Opt-in**: `DB_MODE=json` enables legacy JSON persistence only in `development` or `test`. It is rejected in production and is isolated from MySQL data. Set `DATA_DIR` when an isolated JSON store is needed.
- **Schema Relationships**: The schema stores entity IDs and has a foreign key for application stage history. Several business relationships (user/job/application/company/category/report/alert) are not enforced by foreign-key constraints. Audit existing records before adding constraints.
- **Azure Cloud Readiness**: `DB_SSL=true` is supported. Azure Database for MySQL Flexible Server is the planned cloud target; deployment and data migration have not been completed.
- **Production Recommendation**: Provision Azure Database for MySQL Flexible Server with high availability, enforce TLS/SSL, configure Azure Private Endpoint / Virtual Network integration, and set database connection parameters via Azure Key Vault.

---

## 3. External Cloud Services & Credentials

### Resume Parsing
- **Current Behavior**: The service uses deterministic local heuristics and filename/profile-derived skills. It does not call Azure Document Intelligence; output should not be treated as verified extracted resume content.
- **Production Recommendation**: If Azure Document Intelligence is adopted later, implement and test a real client, secret management, timeouts, and user-consent/data-retention rules before describing it as active.

---

## 4. Resume File Storage

- **Local Development**: Uploaded resume files are currently buffered and stored locally in `backend/uploads/resumes/`.
- **Production Recommendation**: In a scaled Azure Kubernetes Service (AKS) or Azure Container Apps deployment, configure **Azure Blob Storage** (`@azure/storage-blob`) to store resume PDF/DOCX files persistently with SAS (Shared Access Signature) tokens for secure candidate and recruiter access.

---

## 5. Real-Time WebSockets

- **Current Implementation**: Application stage updates, recruiter comments, and interview dates are immediately persisted in the database and retrieved via REST queries and on-demand UI refresh.
- **Production Recommendation**: Integrate Socket.io or Azure Web PubSub to push stage progression notifications to candidates in real-time when a recruiter advances their application.

---

## 6. Security & Secret Management

- **Current Behavior**: The API requires a `JWT_SECRET` of at least 32 characters and configurable MySQL credentials. Environment example files contain placeholders; replace them before use and do not use them in production. Demo account credentials are seeded only on a fresh schema.
- **Production Recommendation**: Store production secrets in **Azure Key Vault** and synchronize them via Azure Key Vault Secrets Store CSI Driver or Azure Managed Identities.

## 7. Verification Coverage and Remaining Security Work

- There is no dedicated unit-test suite. Current integration scripts cover primary candidate, recruiter, admin-auth, application, interview, and audit workflows; company/category/admin CRUD paths have not all been exercised over HTTP.
- Resume uploads are limited by extension and size and are stored on the local filesystem. File-content inspection, malware scanning, and object storage are not implemented.
- The schema has a foreign key for application stage history but does not enforce every business relationship. Review existing records before adding constraints.
- Login rate limiting, refresh-token rotation, and cookie-based token storage are not implemented. JWTs remain in browser `localStorage`.
- The container smoke test created separate `talenthub-clean-review` and `talenthub-codex-review` test volumes. They remain stopped and intact; remove them manually only when you decide their test data is no longer needed.
