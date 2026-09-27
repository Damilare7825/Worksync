# WorkSync Production Deployment Runbook

## Architecture

- **Nginx**: Public HTTP/HTTPS reverse proxy terminating TLS 1.2/1.3, handling HTTP/2, enforcing HSTS, and redirecting HTTP (port 80) to HTTPS (port 443).
- **Frontend**: Immutable production Vite build served by Nginx.
- **API**: Stateless Express/Socket.IO process with graceful shutdown and `/ready` probes.
- **Worker**: Dedicated Node.js process consuming the PostgreSQL-backed durable job queue.
- **PostgreSQL**: Persistent relational database (v16).
- **Automated Backup**: Periodic snapshot daemon (`db-backup`) with configurable rolling retention.
- **Uploads & Storage**: S3-compatible object storage provider in production; persistent volume for local development.

---

## Preconditions & Environment Setup

1. **Database & Backups**: Provision PostgreSQL with automated snapshots / PITR.
2. **HTTPS / TLS Certificates**:
   - For public domain with Let's Encrypt / Certbot:
     ```bash
     docker compose -f docker-compose.production.yml run --rm certbot certonly \
       --webroot -w /var/www/certbot \
       -d yourdomain.com -d api.yourdomain.com
     ```
   - For local staging / self-signed certificate:
     ```bash
     node scripts/generate-ssl.js
     ```
     Certificates will be placed into `./deploy/nginx/ssl/live/fullchain.pem` and `./deploy/nginx/ssl/live/privkey.pem`.
3. **Secrets**:
   - Generate a high-entropy `JWT_SECRET` (minimum 32 characters; default access token TTL: 15 minutes).
   - Set `CLIENT_URL` and `CORS_ALLOWED_ORIGINS` to the exact HTTPS domain (no wildcards).
   - Configure production SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
   - Configure S3-compatible storage (`STORAGE_PROVIDER=S3`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`).

---

## Migration Procedure

Run migrations as a dedicated deployment step before routing application traffic to a new release:

```bash
cd worksync-backend
npm ci
npm run prisma:generate
npm run prisma:deploy
```

> [!CAUTION]
> Never use `prisma migrate reset` in production and never delete migration history. All migrations are sequential and idempotent.

---

## Container Deployment

Build and start the complete production stack:

```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

### Health & Readiness Probes

```bash
# Check HTTPS readiness endpoint
curl -fsS https://yourdomain.com/ready

# Check service status
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=200 api worker nginx
```

---

## Database Backup & Restore Procedures

### 1. Manual Backup Snapshot
Before deploying any major schema change or application release:

```bash
# Using Node utility
node scripts/backup-db.js

# Or via Docker compose
docker compose -f docker-compose.production.yml exec db-backup /usr/local/bin/backup-db.sh
```
Backups are timestamped and stored in `./backups/worksync_backup_YYYY-MM-DD_HHMMSS.dump`.

### 2. Database Restoration
To restore a snapshot in disaster recovery:

```bash
# Using Node utility
node scripts/restore-db.js ./backups/worksync_backup_2026-09-13_220000.dump

# Or via Docker compose
docker compose -f docker-compose.production.yml exec db-backup /usr/local/bin/restore-db.sh /backups/worksync_backup_2026-09-13_220000.dump
```

---

## Rollback & Disaster Recovery Strategy

1. **Application Rollback**:
   - Stop traffic to current release.
   - Point Compose or orchestrator back to the previous release image tags:
     ```bash
     docker compose -f docker-compose.production.yml up -d --no-deps api worker frontend
     ```
2. **Database Rollback**:
   - Non-breaking changes: deploy forward-fix migrations.
   - Breaking changes: restore database from pre-migration backup using `scripts/restore-db.js`.
3. **Verification**:
   - Run `/ready` and smoke test suite:
     ```bash
     npm run test:e2e
     ```
