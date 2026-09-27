# WorkSync Production Infrastructure & Deployment Guide

This document defines the production infrastructure architecture, deployment processes, database migration strategy, health monitoring, backup automation, and rollback procedures for the WorkSync platform.

---

## 1. Production Architecture Overview

```text
[ Client Browsers ]
       │  (HTTPS / TLS 1.2 & 1.3 on Port 443 with HTTP/2 & HSTS)
       ▼
[ Nginx Reverse Proxy ]
       ├── HTTP Port 80 (Permanent 301 Redirect to HTTPS + ACME Challenge)
       ├── HTTPS Port 443 (SSL Termination, Rate Limiting, Header Injection)
       │      │
       │      ├──> /api/         --> [ Express API & Socket.IO (Port 5000) ]
       │      ├──> /socket.io/   --> [ Express API & Socket.IO (Port 5000) ]
       │      ├──> /health,/ready--> [ Express API Health Probes ]
       │      └──> /             --> [ Frontend Web Application (Port 80) ]
       │
[ Managed PostgreSQL Database ] (Port 5432 with SSL & Pooling)
       │
[ Automated Backup Daemon ] (Daily scheduled snapshots & 14-day rolling retention)
       │
[ Background Worker Process ] (Consumes PostgreSQL-backed job queue)
```

### Server Configuration Highlights
- **Environment**: `NODE_ENV=production`
- **Reverse Proxy Support**: Configured with Helmet and `trust proxy` setting for accurate client IP rate limiting.
- **Port & Host**: API runs on `env.port` (default 5000) listening on all interfaces (`0.0.0.0`).
- **WebSockets**: Socket.IO attached directly to the primary HTTP server instance with sticky connection upgrade headers.
- **Storage**: Production requires `STORAGE_PROVIDER=S3` with S3-compatible endpoints (AWS S3, Cloudflare R2, MinIO).

---

## 2. Health Monitoring & Graceful Shutdown

### Health Check Endpoints
- **Liveness Probes**: `GET /health` and `GET /api/v1/health` (returns 200 with uptime if process is running).
- **Readiness Probes**: `GET /ready` and `GET /api/v1/ready` (queries database `SELECT 1`; returns 200 when database is healthy, 503 when degraded).

### Graceful Shutdown
- Handlers in [`src/server.js`](file:///c:/Users/MY%20PC/Documents/Projects/WorkSync/worksync-backend/src/server.js) intercept `SIGTERM` and `SIGINT`.
- Active HTTP connections are drained before database connections are closed via `disconnectDatabase()`.

---

## 3. Database Production & Backup Strategy

### Migrations
- **Deploy Command**: `npx prisma migrate deploy`
- **Rule**: Never run `npx prisma migrate reset` or delete migration history in production. All database migrations are sequential and idempotent.

### Automated Backups & Disaster Recovery
- **Daemon Service**: `db-backup` service in `docker-compose.production.yml` runs daily compressed snapshots (`pg_dump -Fc`).
- **Retention**: Automatic rotation purges snapshots older than `BACKUP_RETENTION_DAYS` (default: 14 days).
- **Manual Snapshot Script**: `node scripts/backup-db.js` or `scripts/backup-db.sh`.
- **Restoration Script**: `node scripts/restore-db.js <dump-file>` or `scripts/restore-db.sh <dump-file>`.

---

## 4. Rollback & Failover Strategy

1. **Application Rollback**:
   - Revert application container/code to previous tagged release.
2. **Database Migration Rollback**:
   - Apply forward-fix migrations if non-breaking schema changes were introduced.
   - For breaking schema changes, restore from pre-migration PostgreSQL snapshot.

---

## 5. Security & Secret Hygiene

- Secrets (`DATABASE_URL`, `JWT_SECRET`, `STORAGE_SECRET_ACCESS_KEY`) must be injected exclusively via system environment variables or secure secret managers (AWS Secrets Manager, HashiCorp Vault).
- Frontend environment variables exposed via Vite must exclusively use `VITE_` prefixes and never include private API keys or database connection strings.
