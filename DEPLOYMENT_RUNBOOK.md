# WorkSync Production Deployment Runbook

## Architecture

- Nginx: public HTTP/TLS entry point and reverse proxy.
- Frontend: immutable Vite build served by Nginx.
- API: stateless Express/Socket.IO process.
- Worker: separate Node process consuming the PostgreSQL-backed job queue.
- PostgreSQL: persistent relational database.
- Uploads: persistent volume for the current local storage provider.

> For a multi-instance production deployment, replace the local uploads volume with an object-storage provider before scaling the API/worker across hosts.

## Preconditions

1. Provision PostgreSQL with automated backups/PITR. For cloud production, prefer managed PostgreSQL rather than the bundled Compose database.
2. Provision HTTPS/TLS at the load balancer/reverse proxy.
3. Generate a unique high-entropy `JWT_SECRET` (minimum 32 characters; default access token TTL: 15 minutes).
4. Configure production SMTP (`SMTP_HOST`, `EMAIL_FROM`) and verify the sender domain.
5. Configure production object storage (`STORAGE_PROVIDER=S3`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`).
6. Set `CLIENT_URL` and `CORS_ALLOWED_ORIGINS` to the exact HTTPS origins.
7. Store secrets outside source control (use `.env.production.example` as a template for your secrets manager or deployment platform).

## Migration procedure

Run migrations as a dedicated deployment step, before switching application traffic to a release that requires them:

```bash
cd worksync-backend
npm ci
npm run prisma:generate
npm run prisma:deploy
```

Never use `prisma migrate reset` in production and never delete migration history.

## Container deployment

Build and start the stack:

```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

Check readiness:

```bash
curl -fsS http://localhost/ready
```

Check service state:

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=200 api worker nginx
```

## Rollback

1. Stop traffic to the new release.
2. Roll back application images to the previous release.
3. Do not reverse migrations by deleting migration history. Use a forward-fix migration or restore a database backup when a breaking migration requires it.
4. Re-run `/ready` and critical smoke tests.

### Object storage
Production requires `STORAGE_PROVIDER=S3` and an S3-compatible bucket. Configure the storage endpoint, region, access key and secret in the deployment environment. Local filesystem storage remains for development only.
