# ========================================================
# TalentHub Backend Dockerfile (Multi-Stage Build)
# Stage 1: Build JAR with Maven & Eclipse Temurin JDK 21
# Stage 2: Minimal Production JRE 21 Container
# Target Registry: Azure Container Registry (ACR)
# ========================================================

# --- Stage 1: Build Application JAR ---
FROM maven:3.9.8-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace

# Cache maven dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build production package
COPY src ./src
RUN mvn clean package -DskipTests

# --- Stage 2: Lightweight JRE 21 Runtime ---
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app

# Non-root secure application user
RUN addgroup -S talenthub && adduser -S talenthub -G talenthub
USER talenthub

# Copy baked JAR from builder
COPY --from=builder --chown=talenthub:talenthub /workspace/target/*.jar app.jar

ENV PORT=5000
EXPOSE 5000

# Health probe check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost:5000/actuator/health || exit 1

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]

