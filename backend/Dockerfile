# ==========================================
# TalentHub Backend - Multi-stage Production Dockerfile
# Stage 1: Build TypeScript into JavaScript
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Optimize layer caching for dependencies
COPY package*.json ./
RUN npm ci

# Copy TypeScript source and configuration
COPY . .
RUN npm run build

# Ensure SQL migration files are bundled into production dist directory
RUN mkdir -p dist/database/migrations && cp src/database/migrations/*.sql dist/database/migrations/

# ==========================================
# Stage 2: Minimal Production Runtime
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript and SQL migration assets from builder
COPY --from=builder /app/dist ./dist

# Create necessary persistent and upload directories
RUN mkdir -p data uploads/resumes

# Expose backend REST API port
EXPOSE 5000

# Health check to ensure Express API server is healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

# Start production server
CMD ["node", "dist/server.js"]

