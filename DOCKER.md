# TalentHub Containerization & Azure Container Registry (ACR) Guide

## Azure DevOps Work Item: ER STORY 199

This document details the Docker architecture, container build instructions, local verification procedures, and deployment workflows for the TalentHub Frontend and Backend services targeting Azure Container Registry (ACR).

---

## 1. Architecture Overview

### Frontend Architecture
- **Framework:** React 18 + TypeScript + Vite + Tailwind CSS + Bootstrap Icons.
- **Build Output:** Static production bundle generated in `/dist` via `tsc && vite build`.
- **Production Server:** High-performance, lightweight `nginx:alpine`.
- **Reverse Proxy Routing:** Nginx proxies `/api/` and `/uploads/` traffic to the backend service container (`http://backend:5000`), avoiding CORS issues and ensuring a unified single-origin frontend experience.
- **Container Port:** Nginx listens on port `80` (mapped to port `5173` on the host in development/local compose).

### Backend Architecture
- **Runtime:** Node.js 20 on lightweight Alpine Linux (`node:20-alpine`).
- **Framework:** Express + TypeScript compiled to CommonJS in `dist/`.
- **Database Engine:** MySQL 8.0 with automatic migration and schema verification.
- **Cloud Storage:** Azurite emulator (local) or Azure Blob Storage (production) for candidate resume management.
- **Network Interface:** Explicitly binds to `0.0.0.0:5000` for container networking.
- **Health Probes:** Active health endpoints at `/health` and `/actuator/health` reporting status and database health.

---

## 2. Dockerfile Design

### Frontend (`frontend/Dockerfile`)
Uses a secure multi-stage build:
1. **Builder Stage (`node:20-alpine`)**:
   - Copies `package.json` and `package-lock.json`.
   - Runs `npm install` (reproducible dependency resolution).
   - Copies frontend source code and compiles using `npm run build`.
2. **Runner Stage (`nginx:alpine`)**:
   - Copies compiled assets from `/app/dist` to `/usr/share/nginx/html`.
   - Copies optimized reverse-proxy configuration `nginx.conf` to `/etc/nginx/conf.d/default.conf`.
   - Exposes port `80`.
   - Strips dev dependencies, node runtimes, and build tooling, resulting in an image size of under 100 MB.

### Backend (`backend/Dockerfile`)
Uses a secure multi-stage build:
1. **Builder Stage (`node:20-alpine`)**:
   - Copies `package.json` and `package-lock.json`.
   - Runs `npm install` (including TypeScript devDependencies).
   - Copies backend source code.
   - Compiles TypeScript via `npm run build` (`tsc`).
   - Copies SQL migration scripts into `dist/database/migrations/`.
2. **Runner Stage (`node:20-alpine`)**:
   - Sets `NODE_ENV=production` and `PORT=5000`.
   - Installs production-only dependencies via `npm install --omit=dev`.
   - Copies compiled output from builder `/app/dist` into `./dist`.
   - Creates runtime directories for `data` and `uploads/resumes`.
   - Exposes port `5000`.
   - Runs `CMD ["node", "dist/server.js"]`.

---

## 3. Environment Variables

### Backend Configuration
| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Application environment mode | `production` |
| `PORT` | HTTP port backend binds to | `5000` |
| `DB_MODE` | Database persistence mode (`mysql` or `json`) | `mysql` |
| `DB_DRIVER` | Database driver | `mysql2` |
| `DB_HOST` | Database hostname or container DNS | `database` (Docker) / `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | MySQL database name | `talenthub` |
| `DB_USER` | MySQL database username | `talenthub_user` |
| `DB_PASSWORD` | MySQL database password | Set via secure environment/key vault |
| `JWT_SECRET` | Secret key for JWT auth (min 32 characters) | Set via secure environment/key vault |
| `JWT_EXPIRES_IN` | Lifespan for JWT tokens | `7d` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173,http://localhost` |
| `STORAGE_PROVIDER` | Resume storage provider (`azurite` or `azure`) | `azurite` / `azure` |
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string for Azurite/Azure Blob | Configured per environment |

---

## 4. Build Commands

Run the following commands from the project root:

```bash
# Build Frontend Image
docker build -t talenthub-frontend:v1.0 -t talenthub-frontend:latest ./frontend

# Build Backend Image
docker build -t talenthub-backend:v1.0 -t talenthub-backend:latest ./backend
```

---

## 5. Running Containers Locally

### Using Docker Compose (Recommended)
```bash
# Start all services (Database, Azurite, Backend, Frontend) in background
docker compose up -d

# Check service logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down
```

### Running Containers Standalone
```bash
# Create shared bridge network
docker network create talenthub-network

# Run Backend Container
docker run -d \
  --name talenthub-backend-1 \
  --network talenthub-network \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e DB_MODE=mysql \
  -e DB_HOST=talenthub-database-1 \
  -e DB_PORT=3306 \
  -e DB_NAME=talenthub \
  -e DB_USER=talenthub_user \
  -e DB_PASSWORD=root123 \
  -e JWT_SECRET=talenthub-super-secret-azure-enterprise-key-2026-very-secure-hmac-sha256 \
  talenthub-backend:v1.0

# Run Frontend Container
docker run -d \
  --name talenthub-frontend-1 \
  --network talenthub-network \
  -p 5173:80 \
  talenthub-frontend:v1.0
```

---

## 6. Testing and Verification Commands

```bash
# 1. Verify container status and health
docker ps --filter "name=talenthub"

# 2. Test Backend Health Probe
curl -i http://localhost:5000/health
# Expected: HTTP 200 with JSON payload {"status": "UP", "details": {"database": {"status": "UP"}}}

# 3. Test Backend Root API
curl -i http://localhost:5000/api
# Expected: HTTP 200 with list of API endpoints

# 4. Test Frontend HTML accessibility
curl -i http://localhost:5173/
# Expected: HTTP 200 containing <!doctype html> and React root

# 5. Test Frontend to Backend Reverse Proxy
curl -i http://localhost:5173/api/
# Expected: HTTP 200 proxied response from backend
```

---

## 7. Azure Container Registry (ACR) Preparation & Push Commands

> **Note:** Do not execute push commands without explicit authorization and active Azure login.

Replace `<ACR_NAME>` with your Azure Container Registry name (e.g. `talenthubacr`).

### Step 1: Login to Azure & ACR
```bash
# Authenticate with Azure CLI
az login

# Authenticate with Azure Container Registry
az acr login --name <ACR_NAME>
```

### Step 2: Tag Images for ACR
```bash
# Tag Frontend Image
docker tag talenthub-frontend:v1.0 <ACR_NAME>.azurecr.io/talenthub-frontend:v1.0
docker tag talenthub-frontend:latest <ACR_NAME>.azurecr.io/talenthub-frontend:latest

# Tag Backend Image
docker tag talenthub-backend:v1.0 <ACR_NAME>.azurecr.io/talenthub-backend:v1.0
docker tag talenthub-backend:latest <ACR_NAME>.azurecr.io/talenthub-backend:latest
```

### Step 3: Push Images to ACR
```bash
# Push Frontend Image
docker push <ACR_NAME>.azurecr.io/talenthub-frontend:v1.0
docker push <ACR_NAME>.azurecr.io/talenthub-frontend:latest

# Push Backend Image
docker push <ACR_NAME>.azurecr.io/talenthub-backend:v1.0
docker push <ACR_NAME>.azurecr.io/talenthub-backend:latest
```

### Step 4: Verify Images in ACR
```bash
# List repository tags in ACR
az acr repository show-tags --name <ACR_NAME> --repository talenthub-frontend --output table
az acr repository show-tags --name <ACR_NAME> --repository talenthub-backend --output table
```

