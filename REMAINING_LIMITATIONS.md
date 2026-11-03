# TalentHub MVP — Technical Constraints & Remaining Limitations

This document outlines architectural nuances, external dependencies, and recommended production hardening steps for the TalentHub MVP.

---

## 1. External Cloud Services & Credentials

### Azure AI Document Intelligence
- **Current Behavior**: The system includes a full `AzureDocumentIntelligenceService` client configured to read credentials from environment variables (`AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and `AZURE_DOCUMENT_INTELLIGENCE_KEY`). When valid cloud credentials are provided, it calls the Azure Document Intelligence REST endpoint (`prebuilt-read` or `prebuilt-document`).
- **Graceful Fallback**: If Azure credentials are not configured or the network is offline, the service automatically falls back to an intelligent heuristic regex parser that extracts email, phone, candidate summary, and matches against an enterprise technical skills vocabulary (React, TypeScript, Java, Spring Boot, Docker, Kubernetes, Azure, etc.).
- **Production Recommendation**: Set up an Azure Cognitive Services account, generate an Azure Document Intelligence key and endpoint, and inject them into container environment variables or Kubernetes secrets.

---

## 2. Spring Boot Local Execution Prerequisites

### Java 21 & Maven Local Installation
- **Current Setup**: The developer workstation has Node.js v24.19.0 installed, which allows instant zero-dependency execution of the Node.js backend (`backend/`) and React frontend (`frontend/`).
- **Spring Boot Compilation**: Building the Spring Boot application locally outside of Docker requires a JDK 21 (or Eclipse Temurin 21) and Apache Maven installation on the host machine.
- **Docker Compose**: For environments without local Java 21, the repository includes a multi-stage `Dockerfile` (`backend-spring/Dockerfile`) that compiles Spring Boot inside a Maven builder container and runs on a lightweight Eclipse Temurin 21 JRE image.
- **H2 Profile**: For testing the Spring Boot service without running a MySQL server, the newly added `application-h2.yml` profile enables an in-memory database with automatic schema generation:
  ```bash
  mvn spring-boot:run -Dspring-boot.run.profiles=h2
  ```

---

## 3. Resume File Storage

- **Local Development**: Uploaded resume files are currently buffered and stored locally in the temporary uploads directory.
- **Production Recommendation**: In a scaled Azure Kubernetes Service (AKS) deployment, configure Azure Blob Storage (`@azure/storage-blob` or Spring Cloud Azure Storage) to store resume PDF/DOCX files persistently with SAS (Shared Access Signature) tokens for secure candidate and recruiter access.

---

## 4. Real-Time WebSockets

- **Current Implementation**: Application stage updates, recruiter comments, and interview dates are immediately persisted in the database and retrieved via polling and on-demand refresh.
- **Production Recommendation**: Integrate Spring WebSocket / STOMP or Socket.io to push stage progression notifications to candidates in real-time when a recruiter advances their application.

---

## 5. Security & Secret Management

- **Current Behavior**: Default JWT secrets and demo account credentials are provided for local development convenience in `application.yml` and `.env.example`.
- **Production Recommendation**: Store production secrets in **Azure Key Vault** and synchronize them via Azure Key Vault Secrets Store CSI Driver for Kubernetes.

