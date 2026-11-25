# ==========================================
# TalentHub Frontend - Multi-stage Production Dockerfile
# Stage 1: Build React SPA with Vite
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Optimize layer caching for dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production assets
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Serve with Lightweight Nginx
# ==========================================
FROM nginx:alpine AS runner

# Set safe production defaults for environment variables substituted by envsubst
ENV BACKEND_HOST=localhost
ENV BACKEND_PORT=5000

# Remove default static index
RUN rm -rf /usr/share/nginx/html/*

# Copy built SPA from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx template into official entrypoint template directory
# The 20-envsubst-on-templates.sh script automatically expands $BACKEND_HOST and $BACKEND_PORT
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Port 80 for production web traffic
EXPOSE 80

# Healthcheck to ensure Nginx is responding
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]


