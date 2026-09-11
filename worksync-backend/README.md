# WorkSync — Backend

WorkSync is a collaborative task management and productivity platform. This repository contains **only the backend API** (the frontend is a separate, future effort).

> Note: this project was originally scaffolded under the working name "TaskForge" and has been renamed to **WorkSync**.

---

## 1. Overview

WorkSync's backend is a REST API that lets teams:

- Register/authenticate users
- Create projects and invite teammates with role-based permissions (Owner / Admin / Member)
- Create, assign, filter, search, and track tasks
- Comment on tasks
- View an activity log of what happened and when
- See dashboard statistics (task counts by status/priority, overdue, due today, upcoming, recently completed)

---

## 2. Features (MVP)

- JWT authentication (register, login, current user, logout)
- User profile management
- Project CRUD with ownership
- Project membership with roles (OWNER / ADMIN / MEMBER) and permission checks
- Task CRUD with status/priority, due dates, assignment
- Filtering, full-text search, sorting, and pagination on tasks
- Comments on tasks (own-comment editing, owner/admin moderation)
- Activity log for key events (created, updated, assigned, completed, member added, etc.)
- Dashboard statistics computed live from PostgreSQL
- Centralized error handling with consistent JSON responses
- Input validation via Zod on every mutating endpoint
- Security hardening: Helmet, CORS, rate limiting, bcrypt hashing, IDOR/privilege-escalation protections

---

## 3. Technology Stack

| Layer            | Choice                          |
|-------------------|----------------------------------|
| Runtime            | Node.js (ES Modules)            |
| Framework          | Express.js                       |
| Database           | PostgreSQL                       |
| ORM                | Prisma                           |
| Auth                | JWT (jsonwebtoken)               |
| Password hashing    | bcryptjs                         |
| Validation          | Zod                              |
| Security headers    | Helmet                           |
| CORS                | cors                             |
| Rate limiting        | express-rate-limit               |
| Logging              | morgan                           |
| Testing              | Jest + Supertest                 |

---

## 4. Architecture

Layered architecture, one direction of dependency only:

```
routes  →  validators/middleware  →  controllers  →  services  →  Prisma (database)
```

- **Routes**: wire URLs to middleware + controllers. No logic.
- **Validators**: Zod schemas — reject bad input before it reaches a controller.
- **Middleware**: auth, validation, rate limiting, centralized error handling.
- **Controllers**: thin — parse `req`, call a service, shape the response. No business logic.
- **Services**: all business logic and authorization rules live here. This is the only layer that talks to Prisma directly (aside from the auth middleware's user lookup).
- **Utils**: JWT signing/verification, password hashing, pagination helpers, standard response shape, custom error classes.

This separation means Socket.io, Cloudinary uploads, email notifications, and analytics can be added later as new services/routes without restructuring existing code.

---

## 5. Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js        # Prisma client singleton, connect/disconnect
│   │   └── env.js             # Loads & validates environment variables
│   ├── controllers/           # Thin request handlers
│   ├── routes/                # Express routers, one per resource
│   ├── middleware/
│   │   ├── auth.middleware.js       # JWT verification, attaches req.user
│   │   ├── error.middleware.js      # Centralized error + 404 handling
│   │   ├── validation.middleware.js # Zod-based request validation
│   │   └── rateLimit.middleware.js  # General + auth-specific limiters
│   ├── validators/            # Zod schemas per resource
│   ├── services/              # Business logic + authorization rules
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── password.js
│   │   ├── pagination.js
│   │   ├── response.js
│   │   ├── errors.js
│   │   └── asyncHandler.js
│   ├── app.js                 # Express app assembly
│   └── server.js              # Entrypoint: connects DB, starts HTTP server
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 6. Data Model

### Entities

- **User** — id, name, email (unique), passwordHash, avatar, timestamps
- **Project** — id, name, description, ownerId, timestamps
- **ProjectMember** — join table: projectId + userId (unique pair) + role, joinedAt
- **Task** — id, title, description, status, priority, dueDate, projectId, creatorId, assigneeId, timestamps
- **Comment** — id, content, taskId, userId, timestamps
- **ActivityLog** — id, action, taskId?, projectId?, userId, metadata (JSON), createdAt

### Enums

- `TaskStatus`: `TODO`, `IN_PROGRESS`, `COMPLETED`
- `TaskPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `ProjectMemberRole`: `OWNER`, `ADMIN`, `MEMBER`

### Relationships

- A `User` owns many `Project`s, and belongs to many `Project`s via `ProjectMember`.
- A `Project` has many `Task`s and many `ProjectMember`s.
- A `Task` belongs to a `Project`, has one creator and an optional assignee (both `User`).
- A `Comment` belongs to a `Task` and a `User`.
- An `ActivityLog` entry optionally references a `Task` and/or `Project`, and always references the acting `User`.

### Indexes

`User.email` (unique + indexed), `Task.status`, `Task.priority`, `Task.dueDate`, `Task.projectId`, `Task.assigneeId`, plus indexes on all foreign keys used in lookups (`ProjectMember.userId/projectId`, `Comment.taskId/userId`, `ActivityLog.taskId/projectId/userId`).

Cascading deletes: deleting a `Project` removes its members and tasks; deleting a `Task` removes its comments and activity logs; deleting a `User` removes owned projects, memberships, created tasks, comments, and logs (assignee references are set to `NULL` instead, so deleting a user doesn't delete tasks assigned to them).

---

## 7. Environment Setup

```bash
cp .env.example .env
```

Fill in real values, especially `DATABASE_URL` and `JWT_SECRET` (use a long random string — e.g. `openssl rand -base64 48`).

---

## 8. PostgreSQL Setup

Any local or hosted PostgreSQL 13+ instance works. Example with Docker:

```bash
docker run --name worksync-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=worksync -p 5432:5432 -d postgres:16
```

Then set:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/worksync?schema=public"
```

---

## 9. Install & Migrate

```bash
npm install
npm run prisma:migrate      # creates tables from prisma/schema.prisma (dev)
npm run prisma:generate     # regenerate the Prisma client if needed
```

For production deploys, use:

```bash
npm run prisma:deploy
```

---

## 10. Seed the Database

```bash
npm run seed
```

Creates 5 users, 2 projects, memberships across various roles, 17 tasks with varied status/priority/due dates, several comments, and activity logs. **This data is for local development only** — the script deletes existing rows and all seeded users share the password `Password123`.

---

## 11. Running Locally

```bash
npm run dev     # auto-restarts on file changes (node --watch)
npm start        # plain start
```

Server starts on `http://localhost:5000` (or `PORT` from `.env`). Health check: `GET /health`.

---

## 12. API Endpoints

All routes are versioned under `/api/v1`. Endpoints marked 🔒 require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint              | Description               |
|--------|------------------------|----------------------------|
| POST   | /api/v1/auth/register  | Create an account          |
| POST   | /api/v1/auth/login     | Log in, receive a JWT      |
| GET    | /api/v1/auth/me     🔒 | Current authenticated user |
| POST   | /api/v1/auth/logout 🔒 | Logout (client discards token) |

### Users

| Method | Endpoint            | Description                     |
|--------|-----------------------|----------------------------------|
| GET    | /api/v1/users/me   🔒 | Full profile of current user     |
| PUT    | /api/v1/users/me   🔒 | Update own profile (name, avatar)|
| DELETE | /api/v1/users/me   🔒 | Delete own account                |
| GET    | /api/v1/users/:id  🔒 | Public profile of another user    |

### Projects

| Method | Endpoint                                         | Description                    |
|--------|----------------------------------------------------|----------------------------------|
| POST   | /api/v1/projects                              🔒   | Create a project (creator becomes OWNER) |
| GET    | /api/v1/projects                              🔒   | List projects you're a member of, with pagination + search |
| GET    | /api/v1/projects/:id                          🔒   | Get a project (members only)     |
| PUT    | /api/v1/projects/:id                          🔒   | Update a project (Admin/Owner)   |
| DELETE | /api/v1/projects/:id                          🔒   | Delete a project (Owner only)    |
| GET    | /api/v1/projects/:projectId/members           🔒   | List members                      |
| POST   | /api/v1/projects/:projectId/members           🔒   | Add a member (Admin/Owner)        |
| PATCH  | /api/v1/projects/:projectId/members/:userId   🔒   | Change a member's role (Admin/Owner, ownership transfer requires Owner) |
| DELETE | /api/v1/projects/:projectId/members/:userId   🔒   | Remove a member (self, or Admin/Owner) |

### Tasks

| Method | Endpoint                       | Description                                |
|--------|----------------------------------|----------------------------------------------|
| POST   | /api/v1/tasks                🔒 | Create a task in a project you belong to     |
| GET    | /api/v1/tasks                🔒 | List tasks (filter/search/sort/paginate)     |
| GET    | /api/v1/tasks/:id             🔒 | Get a single task                              |
| PUT    | /api/v1/tasks/:id             🔒 | Update a task                                   |
| PATCH  | /api/v1/tasks/:id/status      🔒 | Update only the status                         |
| DELETE | /api/v1/tasks/:id             🔒 | Delete a task (creator, or project Admin/Owner)|

Query params on `GET /api/v1/tasks`: `status`, `priority`, `projectId`, `assigneeId`, `search`, `sortBy` (`dueDate`\|`createdAt`\|`priority`\|`status`\|`title`), `order` (`asc`\|`desc`), `page`, `limit`.

### Comments

| Method | Endpoint                          | Description                       |
|--------|--------------------------------------|--------------------------------------|
| POST   | /api/v1/tasks/:taskId/comments   🔒 | Add a comment to a task              |
| GET    | /api/v1/tasks/:taskId/comments   🔒 | List a task's comments               |
| PUT    | /api/v1/comments/:id             🔒 | Edit your own comment                 |
| DELETE | /api/v1/comments/:id             🔒 | Delete your own comment (or Admin/Owner moderation) |

### Dashboard

| Method | Endpoint                  | Description                          |
|--------|------------------------------|-----------------------------------------|
| GET    | /api/v1/dashboard/stats  🔒 | Task counts, overdue, due today, upcoming, recently completed, by-priority breakdown — for tasks assigned to the current user |

---

## 13. Authentication

- `POST /auth/register` and `POST /auth/login` return `{ user, token }`.
- Send the token on every subsequent request: `Authorization: Bearer <token>`.
- The JWT payload contains only `userId` and `email` — never the password hash.
- `authenticate` middleware verifies the token, loads the user, and rejects requests with missing/invalid/expired tokens (401) or a token for a deleted user.
- Logout is a client-side action (discard the token); the endpoint exists for API symmetry and as a future extension point (e.g. a token blacklist).

---

## 14. Security Considerations

- Passwords hashed with bcrypt (12 salt rounds); `passwordHash` is never selected into an API response.
- All mutating endpoints validate input with Zod **before** touching business logic; unknown/extra fields are dropped by explicit schema whitelisting (no mass assignment).
- Every project/task/comment operation re-verifies the caller's project membership and role server-side — a caller can never access or modify data in a project they don't belong to (IDOR protection), and cannot pass a `projectId`/`userId` to escalate their own or someone else's role.
- Role changes explicitly block self-promotion and require existing Owner/Admin privileges; ownership transfer requires the current Owner.
- Helmet sets standard security headers; CORS is restricted to `CLIENT_URL`.
- Rate limiting: 300 req/15min globally, 20 req/15min on auth endpoints (register/login) to slow brute-force attempts.
- Centralized error handler never leaks stack traces in production and maps Prisma errors (unique constraint, not found, FK violation) to safe, consistent responses.

---

## 15. Response Format

Success:

```json
{ "success": true, "message": "Task created successfully", "data": { "task": { } } }
```

Error:

```json
{ "success": false, "message": "Task not found", "error": { "code": "TASK_NOT_FOUND" } }
```

Paginated endpoints add a `meta.pagination` object: `{ page, limit, total, totalPages }`.

---

## 16. Testing

```bash
npm test
```

Included:

- Unit tests for pagination utilities and Zod validators (no database required).
- Supertest smoke tests for health check, 404 handling, unauthenticated access (401), and validation errors (422).

> **Environment note for this sandbox:** the automated build environment used to generate this project has network access restricted to package registries only, so it could not download the Prisma query-engine binary from `binaries.prisma.sh`. As a result the DB-touching smoke tests could not be executed here. On a normal machine, `npm install` (which runs `prisma generate` via postinstall) will fetch the engine automatically and every test — including ones that hit Prisma — will run. The pagination and validator unit tests, which do not require Prisma, were run successfully in this environment (10/10 passing) as a sanity check on the surrounding logic.

To extend coverage for the full checklist (auth flows, task/project/comment CRUD with a live test database, permission checks), point `DATABASE_URL` at a disposable Postgres instance/test schema and add integration tests under `tests/` using the same Supertest pattern as `tests/app.smoke.test.js`.

---

## 17. Future Features (Not Implemented Yet)

**V2** — Kanban board APIs, calendar APIs, advanced search
**V3** — Socket.io real-time collaboration, notifications, team activity feed
**V4** — Cloudinary file uploads, advanced analytics/reports, email notifications

The service-layer architecture (especially `activity.service.js`, which already records every meaningful event) is designed so these can be layered in without restructuring existing routes/controllers/services.

---

## 18. Remaining TODOs

- Run `prisma migrate dev` against a real Postgres instance and confirm the migration applies cleanly (could not be executed in this sandboxed environment — see §16).
- Add integration tests that exercise the full auth → project → task → comment → dashboard flow against a live test database.
- Consider a refresh-token / token-blacklist strategy if true server-side logout is required later.
