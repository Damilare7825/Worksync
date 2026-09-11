# WorkSync API Documentation

Base URL: `/api/v1` (health check is at `/health`, unprefixed)

All authenticated routes expect `Authorization: Bearer <token>`.

## Response shape

```json
// success
{ "success": true, "message": "...", "data": { ... }, "meta": { ... } }

// error
{ "success": false, "message": "...", "error": { "code": "...", "details": [...] } }
```

## Role model

- **Workspace roles** (`WorkspaceMember.role`): `OWNER`, `ADMIN`, `MEMBER`
- **Project roles** (`ProjectMember.role`): `MANAGER`, `MEMBER`
- These are independent. A workspace `MEMBER` can be a project `MANAGER` on one project and have no role at all on another.
- There is no `role` field on `User`. Every permission check re-derives the caller's role from `WorkspaceMember`/`ProjectMember` on every request.

## Permission summary

| Action | Who |
|---|---|
| Update workspace settings, delete workspace, transfer ownership, change member roles | Workspace `OWNER` only |
| Invite/remove members, create/manage projects, manage teams | Workspace `OWNER` or `ADMIN` |
| Delete a project | Workspace `OWNER` only |
| Manage a project (settings, members, full task edit) | Workspace `OWNER`/`ADMIN`, or that project's `MANAGER` |
| Create tasks, assign tasks, edit any task field | Same as "manage a project" |
| Update a task's `status` only | The task's assignee, even as a plain project `MEMBER` |
| View a project | Workspace `OWNER`/`ADMIN` (any project), or an explicit `ProjectMember` |
| Comment, view activity | Anyone with project access |
| Edit/delete a comment | The comment's author, or anyone who can manage the project |

## Endpoints

### Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Creates only the `User` row. No role assigned. |
| POST | `/auth/login` | — | |
| POST | `/auth/refresh` | ✓ | Re-issues a token with a fresh expiry (sliding renewal, not a stored rotating refresh token). |
| GET | `/auth/me` | ✓ | |
| POST | `/auth/logout` | ✓ | No-op server-side (stateless JWT); documented, not faked. |
| POST | `/auth/forgot-password` | — | Always returns the same message whether or not the email exists. |
| POST | `/auth/reset-password` | — | `{ token, password }` |
| POST | `/auth/change-password` | ✓ | `{ currentPassword, newPassword }` |

### Workspaces
| Method | Path | Who |
|---|---|---|
| POST | `/workspaces` | any authenticated user (becomes `OWNER`) |
| GET | `/workspaces` | lists the caller's own workspaces |
| GET | `/workspaces/:id` | any member |
| PATCH | `/workspaces/:id` | `OWNER` |
| DELETE | `/workspaces/:id` | `OWNER` |
| GET | `/workspaces/:id/members` | any member |
| PATCH | `/workspaces/:id/members/:memberId` | `OWNER` (`{ role }`; setting `role: "OWNER"` performs an atomic ownership transfer) |
| DELETE | `/workspaces/:id/members/:memberId` | `OWNER`/`ADMIN` (the `OWNER`'s own membership can't be removed this way) |
| POST | `/workspaces/:id/invitations` | `OWNER`/`ADMIN` — `{ email, role: "ADMIN"|"MEMBER" }` |

### Invitations (token-based)
| Method | Path | Auth |
|---|---|---|
| GET | `/invitations/:token` | — (public lookup) |
| POST | `/invitations/:token/accept` | ✓ (logged-in email must match the invited email) |
| POST | `/invitations/:token/decline` | — |

### Teams
| Method | Path | Who |
|---|---|---|
| POST | `/workspaces/:workspaceId/teams` | `OWNER`/`ADMIN` |
| GET | `/workspaces/:workspaceId/teams` | any member |
| GET / PATCH / DELETE | `/teams/:id` | any member (GET) / `OWNER`/`ADMIN` (PATCH, DELETE) |
| POST / DELETE | `/teams/:teamId/members`, `/teams/:teamId/members/:userId` | `OWNER`/`ADMIN`; target user must already be a workspace member |

### Projects
| Method | Path | Who |
|---|---|---|
| POST | `/workspaces/:workspaceId/projects` | `OWNER`/`ADMIN` |
| GET | `/workspaces/:workspaceId/projects` | any member (sees all if `OWNER`/`ADMIN`, else only projects they belong to) |
| GET | `/projects/:id` | `OWNER`/`ADMIN`, or a `ProjectMember` |
| PATCH | `/projects/:id` | `OWNER`/`ADMIN`, or that project's `MANAGER` |
| DELETE | `/projects/:id` | workspace `OWNER` only |
| GET/POST/PATCH/DELETE | `/projects/:projectId/members[...]` | manage-level: `OWNER`/`ADMIN`/`MANAGER`; view: anyone with project access |

### Tasks
| Method | Path | Who |
|---|---|---|
| POST | `/projects/:projectId/tasks` | manage-level (`OWNER`/`ADMIN`/`MANAGER`) |
| GET | `/projects/:projectId/tasks` | anyone with project access; filterable by `status`, `priority`, `assigneeId` |
| GET | `/tasks/:id` | anyone with project access |
| PATCH | `/tasks/:id` | manage-level → any field; assignee → `status` only |
| DELETE | `/tasks/:id` | manage-level |

### Comments
| Method | Path | Who |
|---|---|---|
| POST/GET | `/tasks/:taskId/comments` | anyone with project access |
| PATCH/DELETE | `/comments/:id` | the author, or manage-level (moderation) |

### Activity & Notifications
| Method | Path | Who |
|---|---|---|
| GET | `/workspaces/:workspaceId/activity` | any workspace member |
| GET | `/projects/:projectId/activity` | anyone with project access |
| GET | `/notifications` | the caller's own; `?unread=true` to filter |
| PATCH | `/notifications/:id/read` | the caller's own |
| PATCH | `/notifications/read-all` | the caller |

## Known limitations

- `/auth/refresh` is a sliding renewal, not a persisted/rotating refresh token — a stolen access token remains valid until its own expiry.
- `logout` is a client-side no-op (stateless JWT); no server-side token blacklist yet.
- `DELETE /users/me` (pre-existing, not in this spec's API list) will fail with a foreign-key conflict if the user has created any workspace/team/project/task — this is intentional (data integrity over silent cascading deletes) but worth knowing before wiring up account deletion in the UI.
