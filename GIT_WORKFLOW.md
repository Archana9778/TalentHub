# TalentHub Git Collaboration & Branching Workflow

This guide establishes the team engineering practices for Git branching, pull requests, and conflict prevention across the TalentHub project.

---

## 1. Branch Naming Conventions

All branches created by developers should follow structured prefix conventions reflecting the scope of work:

- `feature/<feature-name>`: New feature implementations.
  - Examples: `feature/company-management`, `feature/resume-parsing`, `feature/ats-improvements`
- `fix/<bug-name>`: Bug fixes and issue resolutions.
  - Examples: `fix/recruiter-dashboard`, `fix/api-integration`
- `chore/<task-name>`: Maintenance, package upgrades, Docker optimizations, and CI/CD adjustments.
  - Examples: `chore/docker-compose-cleanup`, `chore/dependency-updates`
- `docs/<doc-name>`: Documentation additions and updates.
  - Examples: `docs/azure-deployment-guide`

---

## 2. Core Workflow Guidelines

### A. Keep `main` Stable
The `main` branch represents deployable production code. **Never commit directly to `main`**, and **never force-push (`git push --force`)** to `main` or shared feature branches.

### B. Daily Branch Synchronization
Before starting work on any feature or fix, pull the latest changes from `origin/main` to avoid drift:
```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```
To bring existing feature branches up to date with `main`:
```bash
git checkout feature/your-feature-name
git fetch origin
git merge origin/main
```

### C. Break Work into Smaller Commits
- Commit early and often with clear, descriptive commit messages describing *what* changed and *why*.
- Avoid monolithic commits touching 30+ files across unrelated modules.

### D. Minimize Changes to Shared Files
Files like `frontend/src/services/api.ts`, `frontend/src/types/index.ts`, and `backend/src/types/index.ts` are shared touchpoints.
- Coordinate schema changes with the team.
- Append new endpoints and types to designated domain sections rather than arbitrarily reorganizing existing lines.

---

## 3. Protecting Environment Configuration & Secrets

1. **Never commit `.env` or credential files**:
   - Secrets must remain in local `.env` files or secure secret stores (e.g., Azure Key Vault).
   - `.gitignore` strictly blocks `.env`, `.env.*`, and sensitive dumps (`*.sql`).
2. **Use `.env.example` as the single source of truth**:
   - When adding new environment variables (e.g. `AZURE_DOCUMENT_INTELLIGENCE_KEY`), document their name, description, and dummy example value in `.env.example`.

---

## 4. Conflict Resolution Strategy

When Git detects a merge conflict:
1. **Never use `git checkout --` or `git restore`** to discard files during an active conflict without understanding both sides.
2. Open conflicting files and inspect all `<<<<<<< HEAD`, `=======`, and `>>>>>>>` markers.
3. Combine types, imports, and methods additively to preserve work from both branches.
4. Run compiler and test checks to verify syntax and functionality:
   ```bash
   # Verify backend
   cd backend && npm run build && npm test

   # Verify frontend
   cd frontend && npm run build
   ```
5. Stage the resolved files and conclude the merge:
   ```bash
   git add <resolved-files>
   git commit -m "chore: resolve merge conflicts between <branch-a> and <branch-b>"
   ```

---

## 5. Pull Requests & Code Reviews

1. **Push your branch**:
   ```bash
   git push -u origin feature/your-feature-name
   ```
2. **Open a GitHub Pull Request** targeting `main`.
3. Provide a clear summary:
   - What problems were solved or features added.
   - Verification steps and testing output.
   - Any required environment variables.
4. Ensure all CI/automated tests pass before requesting approval and merging.

