# WorkSync Production Infrastructure & Deployment Guide

This document defines the production infrastructure architecture, deployment processes, database migration strategy, health monitoring, and rollback procedures for the WorkSync platform.

---

## 1. Production Architecture Overview

```text
[ Client Browsers ]
       │  (HTTPS / TLS 1.3)
       ▼
[ Reverse Proxy / Load Balancer ]  (Nginx / Cloudflare / AWS ALB)
       │  (Terminates SSL, sets X-Forwarded-For)
       ▼
[ WorkSync Express API & Socket.IO ]  (Node.js process / cluster behind systemd or Docker)
       │  (Prisma Client v5.x singleton)
       ▼
[ Managed PostgreSQL Database ]  (AWS RDS / Supabase / Neon with SSL & Pooling)
```

### Server Configuration Highlights
- **Environment**: `NODE_ENV=production`
- **Reverse Proxy Support**: Configured with Helmet and `trust proxy` setting for accurate client IP rate limiting.
- **Port & Host**: Runs on `env.port` (default 5000) listening on all interfaces (`0.0.0.0`).
- **WebSockets**: Socket.IO attached directly to the primary HTTP server instance.

---

## 2. Health Monitoring & Graceful Shutdown

### Health Check Endpoint
- **URL**: `GET /health` and `GET /api/v1/health`
- **Response**:
  ```json
  {
    "success": true,
    "message": "WorkSync API is healthy",
    "data": {
      "uptime": 3642.12
    }
  }
  ```
- **Security**: Operational metrics only; never exposes database credentials, tokens, or environment secrets.

### Graceful Shutdown
- Handlers in [`src/server.js`](file:///c:/Users/MY%20PC/Documents/Projects/WorkSync/worksync-backend/src/server.js) intercept `SIGTERM` and `SIGINT`.
- Active HTTP connections are drained before database connections are closed via `disconnectDatabase()`.

---

## 3. Database Production Strategy

### Migrations
- **Deploy Command**: `npx prisma migrate deploy`
- **Rule**: Never run `npx prisma migrate reset` or delete migration history. All database migrations are sequential and idempotent.

### Connection Management
- Uses a single global `PrismaClient` instance via [`src/config/database.js`](file:///c:/Users/MY%20PC/Documents/Projects/WorkSync/worksync-backend/src/config/database.js) to avoid database connection exhaustion.
- SSL connections required for production Postgres instances via `DATABASE_URL` query parameter (`?sslmode=require`).

### Backup & Retention Policy
- **Automated Daily Snapshots**: Point-in-time recovery (PITR) enabled for 30 days.
- **Pre-Migration Backups**: Trigger manual database snapshot prior to deploying schema migrations.

---

## 4. Rollback Strategy

1. **Application Rollback**:
   - Revert application container/code to previous tagged release.
2. **Database Migration Rollback**:
   - Apply forward-fix migrations if non-breaking schema changes were introduced.
   - For breaking schema changes, restore from pre-migration PostgreSQL snapshot.

---

## 5. Security & Secret Hygiene

- Secrets (`DATABASE_URL`, `JWT_SECRET`) must be injected exclusively via system environment variables or secure secret managers (AWS Secrets Manager, HashiCorp Vault).
- Frontend environment variables exposed via Vite must exclusively use `VITE_` prefixes and never include private API keys or database connection strings.

## 6. Repository deployment assets

The repository now includes:
- `Dockerfile` for the API image.
- `../worksync-frontend/Dockerfile` for the frontend image.
- `../docker-compose.production.yml` for a single-host production/staging topology.
- `../deploy/nginx/default.conf` for HTTP/API/Socket.IO routing.
- `src/worker.js` for a separately deployable background worker.
- `/ready` and `/api/v1/ready` readiness endpoints returning HTTP 503 when PostgreSQL is unavailable.

The bundled PostgreSQL and local uploads volumes are intended for single-host/self-managed deployments. Managed PostgreSQL and object storage are preferred for resilient production.


### A3 production object storage
WorkSync now supports an S3-compatible object-storage provider using AWS Signature V4. Production must use `STORAGE_PROVIDER=S3`; local filesystem storage remains available for development. AWS S3, Cloudflare R2, and other S3-compatible services can be configured through the storage endpoint, bucket, region, and credentials.
