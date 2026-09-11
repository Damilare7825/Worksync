# WorkSync Environment Management & Secret Hygiene

This document defines the environment architecture, variable validation rules, secret management policies, and CI/CD environment isolation for WorkSync.

---

## 1. Environment Classification

| Environment | Purpose | DB Target | Logging | JWT Validation | Storage Provider | Email Provider |
|---|---|---|---|---|---|---|
| `development` | Local development | Local PostgreSQL / `.env` | Verbose (`dev`) | Warning allowed for default secret | `LOCAL` (`./uploads`) | `MockEmailProvider` |
| `test` | Automated unit & contract testing | In-memory `fakePrisma` / Test DB | Silent / Minimal | Standard validation | Mocked / In-memory | Mocked / In-memory |
| `production` | Production deployment | Managed PostgreSQL (SSL required) | Structured (`combined`) | Strict fail-fast on weak/placeholder secrets | `S3` (Cloudflare R2 / AWS S3) | `SmtpEmailProvider` (Strict fail-fast) |

---

## 2. Backend Environment Variables (`worksync-backend`)

### Core & Security
| Variable | Required in Prod | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (SSL required in prod; placeholders rejected) |
| `JWT_SECRET` | **Yes** | — | HMAC-SHA256 signing secret for access JWTs (minimum 32 characters; placeholders rejected in prod) |
| `JWT_EXPIRES_IN` | No | `15m` | Short-lived access JWT token expiration duration (default: 15 minutes) |
| `PORT` | No | `5000` | HTTP server listening port |
| `NODE_ENV` | No | `development` | Node runtime environment (`development` / `test` / `production`) |
| `CLIENT_URL` | No | `http://localhost:5173` | Primary CORS allowed client origin |
| `CORS_ALLOWED_ORIGINS` | No | `CLIENT_URL` | Comma-separated list of allowed CORS origins |
| `RUN_WORKER` | No | `true` | Set to `"false"` to disable in-process background worker (e.g. when running dedicated worker container) |

> [!NOTE]
> WorkSync uses a dual-token authentication model:
> - **Access Token (JWT)**: Short-lived access credential with a **15-minute default lifetime** (`JWT_EXPIRES_IN=15m`).
> - **Refresh Token / Session**: Long-lived credential with a **7-day lifetime**, stored securely in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie and hashed in PostgreSQL (`Session.refreshTokenHash`).

### Object Storage (S3 / Cloudflare R2)
| Variable | Required in Prod | Default | Purpose |
|---|---|---|---|
| `STORAGE_PROVIDER` | **Yes** (`S3`) | `LOCAL` | Storage backend: `LOCAL` (development only) or `S3` (mandatory in production) |
| `STORAGE_BUCKET` | **Yes** (when S3) | — | Bucket name for durable attachment storage |
| `STORAGE_REGION` | No | `auto` | Storage region (`auto` for Cloudflare R2; AWS region for AWS S3) |
| `STORAGE_ENDPOINT` | Conditional | — | S3-compatible endpoint (e.g. `https://<account-id>.r2.cloudflarestorage.com` for R2) |
| `STORAGE_ACCESS_KEY_ID` | **Yes** (when S3) | — | S3/R2 API Access Key ID |
| `STORAGE_SECRET_ACCESS_KEY` | **Yes** (when S3) | — | S3/R2 API Secret Access Key |
| `UPLOAD_DIR` | No | `./uploads` | Local directory for attachments (used only when `STORAGE_PROVIDER=LOCAL`) |
| `MAX_FILE_SIZE` | No | `10485760` (10MB) | Max attachment upload size limit in bytes |

### Email Delivery (SMTP)
| Variable | Required in Prod | Default | Purpose |
|---|---|---|---|
| `SMTP_HOST` | **Yes** | — | Outbound SMTP relay hostname (e.g. `smtp.sendgrid.net`) |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Whether to use TLS on connect (true for port 465, false for 587/STARTTLS) |
| `SMTP_USER` | Conditional | — | SMTP username / API key identity (required if `SMTP_PASS` is set) |
| `SMTP_PASS` | Conditional | — | SMTP password / API key secret (required if `SMTP_USER` is set) |
| `EMAIL_FROM` | **Yes** | — | Verified sender address (e.g. `WorkSync <no-reply@worksync.app>`) |

---

## 3. Frontend Environment Variables (`worksync-frontend`)

> [!CAUTION]
> All Vite environment variables embedded in client bundles **MUST** use the `VITE_` prefix and are strictly public. Never place `JWT_SECRET`, database credentials, R2 secret keys, or private API keys in frontend environment files or build arguments.

| Variable | Purpose | Example |
|---|---|---|
| `VITE_API_URL` | Base URL of the REST API (with `/api/v1` prefix) | `/api/v1` (prod) or `http://localhost:5000/api/v1` (dev) |
| `VITE_SOCKET_URL` | Base URL of the Socket.IO server (no `/api` prefix) | `https://app.example.com` (prod) or `http://localhost:5000` (dev) |

---

## 4. Environment Startup Validation (Fail-Closed Architecture)

WorkSync enforces strict fail-closed validation on startup via [`src/config/env.js`](file:///c:/Users/MY%20PC/Documents/Projects/WorkSync/worksync-backend/src/config/env.js):

1. **Database Validation**:
   - `DATABASE_URL` must be non-empty and non-whitespace across all environments.
   - In `production`, `DATABASE_URL` must not contain unconfigured template placeholders (e.g., `GENERATE_A_LONG_RANDOM_DATABASE_PASSWORD`).
2. **JWT Secret Validation**:
   - `JWT_SECRET` must be non-empty and non-whitespace across all environments.
   - In `production`, `JWT_SECRET` must be at least 32 characters long and must not match common weak secrets or example patterns (`change_me`, `replace_with`, etc.).
   - In `development`, weak secrets are permitted with a visible console warning to preserve developer ergonomics.
3. **Storage Provider Validation**:
   - `STORAGE_PROVIDER` must be either `LOCAL` or `S3`.
   - In `production`, `STORAGE_PROVIDER` **must** be `S3`. Local filesystem fallback is strictly rejected.
   - When `STORAGE_PROVIDER=S3`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY` must be configured and cannot be placeholder values.
4. **Email Delivery Validation**:
   - In `production`, `SMTP_HOST` and `EMAIL_FROM` are required.
   - Silent downgrade to `MockEmailProvider` is strictly blocked in production.
   - If SMTP authentication is used, both `SMTP_USER` and `SMTP_PASS` must be provided together. Unauthenticated SMTP relay is supported when both are omitted.

Any fatal validation error causes the application to terminate immediately with `process.exit(1)` and an explicit error log.

---

## 5. Environment Separation & Secret Hygiene

- **Development (`.env`)**:
  - Developers copy `.env.example` to `.env`.
  - Local credentials are untracked by Git via `.gitignore`.
- **Testing**:
  - Test runner sets `NODE_ENV=test`.
  - Isolated from production secrets and external services.
- **Production Container / Cloud Orchestration**:
  - Production secrets are injected at runtime via container orchestrator (e.g. Docker Compose, Kubernetes secrets, or cloud secret managers).
  - Production container images **never** have `.env` files baked in.
  - `.dockerignore` blocks `.env*` files from entering the Docker build context.
- **Example Templates**:
  - Safe templates (`.env.example`, `.env.production.example`) contain placeholders only and are safe to commit.
