FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p dist/database/migrations && cp src/database/migrations/*.sql dist/database/migrations/

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p data uploads/resumes

EXPOSE 5000
CMD ["node", "dist/server.js"]
