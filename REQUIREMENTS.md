# Agent Desk — Requirements Document

## What This Is

A multi-tenant support and ticketing system where **humans and bots are equal**. Teams operate in **workspaces** — isolated containers with their own projects, tickets, and members. Onboarding is via **invite links** — share a URL, join a workspace. No manual account creation needed.

---

## Core Concepts

### Workspaces
The top-level container. Every workspace is isolated — its own projects, tickets, and members. A user can belong to multiple workspaces (e.g., a bot agent serving several teams).

- Any authenticated user can create a workspace.
- The creator becomes the workspace owner (ADMIN).
- Invite links let others join — both humans and bots use the same flow.
- All data (projects, tickets, comments) is scoped to a workspace.

### Invite Links
The onboarding mechanism. No email invites, no admin manually creating accounts.

- A workspace ADMIN creates an invite link → gets a URL like `/invite/{token}`.
- Share the URL with anyone — humans click it in a browser, bots use it via API.
- Optional expiry date and max uses per link.
- ADMINs can deactivate links at any time.
- Clicking an invite: not logged in → register/login → join. Already logged in → join. Already a member → redirect to workspace.

### Users (Not "Agents")
The system uses Django's standard User model (`AbstractUser`) with extra columns. No custom auth, no renamed tables. A "user" is anything that can pick up a ticket — human or bot.

- `agent_type`: HUMAN or BOT
- `role`: ADMIN or MEMBER (within a workspace, via WorkspaceMember)
- `skills`: tags/JSON for capability matching
- Both types get assigned tickets, write comments, change status, show up in audit logs the same way.

A bot that gets stuck sets the ticket to `BLOCKED` and tags a human. That's the escalation model — simple, no workflow engine.

### Projects
Projects group related tickets and users within a workspace. A user must belong to a project to work on its tickets (enforced server-side).

### Tickets
A unit of work with a strict status flow:

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
              ↕
           BLOCKED
```

- One user assigned at a time
- Members self-assign; admins reassign
- Priorities: LOW, MEDIUM, HIGH, CRITICAL
- Timestamps: created, updated, resolved, closed

### Comments
Conversation on tickets. Any user (human or bot) can comment.

### Audit Trail
Every mutation is logged: who, what, when, old value → new value. Non-optional.

---

## Permissions

Two roles at the workspace level: **ADMIN** and **MEMBER**.

| What | Admin | Member |
|------|-------|--------|
| Create/delete projects | ✅ | ❌ |
| Add/remove project members | ✅ | ❌ |
| Create/manage invite links | ✅ | ❌ |
| Remove workspace members | ✅ | ❌ |
| Create tickets | ✅ | ✅ |
| Update own tickets | ✅ | ✅ |
| Update others' tickets | ✅ | ❌ |
| Self-assign tickets | ✅ | ✅ |
| Reassign tickets | ✅ | ❌ |
| Delete tickets | ✅ | ❌ |
| Delete projects (empty) | ✅ | ❌ |
| Delete comments (own or any) | ✅ | Own only |
| Remove users from workspace | ✅ | ❌ |
| Comment on any ticket | ✅ | ✅ |

---

## Architecture

### Backend: Django + DRF
- Standard Django User model (`AbstractUser` + extra columns). No custom auth backends.
- Vanilla SimpleJWT for authentication (`TokenObtainPairView`, username + password).
- Strict REST API — PATCH only (no PUT), no custom action endpoints, filter via query params.
- `django-filter` for filtering, `drf-spectacular` for API docs (Swagger + ReDoc).
- PostgreSQL in production (Railway), SQLite for local dev via `dj_database_url`.
- No Celery, no Redis, no python-decouple. Use `os.environ.get()` for config.

### Frontend: Next.js + Tailwind
- Workspace switcher in nav for multi-workspace users.
- URL structure: `/w/{workspace-slug}/dashboard`, `/w/{workspace-slug}/projects`, etc.
- Invite flow: `/invite/{token}` → register/login → join workspace.
- JWT auth (localStorage, refresh on 401).
- Responsive: card layout on mobile, table on desktop.

### Deployment: Railway
- Three services: backend (Django/Gunicorn), frontend (Next.js), Postgres.
- `railway.json` in each service dir. NIXPACKS builder. No Dockerfiles.
- Backend start: `collectstatic && migrate && createsuperadmin && seed && gunicorn` (idempotent).
- Deploy via Railway GraphQL API with `serviceInstanceDeploy`.

---

## API Design (Strict REST)

All endpoints return paginated responses: `{ count, next, previous, results }`.
PATCH only — no PUT. No custom action endpoints. Filter via query params.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | JWT tokens (username + password) |
| POST | `/api/auth/token/refresh/` | Refresh access token |

### Workspaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspaces/` | List user's workspaces |
| POST | `/api/workspaces/` | Create workspace |
| GET | `/api/workspaces/:id/` | Workspace detail |
| PATCH | `/api/workspaces/:id/` | Update workspace |
| DELETE | `/api/workspaces/:id/` | Delete workspace (owner) |

### Workspace Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workspace-members/?workspace=:id` | List members |
| PATCH | `/api/workspace-members/:id/` | Update role (admin) |
| DELETE | `/api/workspace-members/:id/` | Remove member (admin) |

### Invites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invites/?workspace=:id` | List invites (admin) |
| POST | `/api/invites/` | Create invite |
| PATCH | `/api/invites/:id/` | Update invite |
| DELETE | `/api/invites/:id/` | Delete invite |
| POST | `/api/invites/join/` | Join via token |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/` | List users |
| POST | `/api/users/` | Register |
| GET | `/api/users/:id/` | Detail |
| PATCH | `/api/users/:id/` | Update |
| GET | `/api/users/me/` | Current user |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/?workspace=:id` | List (workspace-scoped) |
| POST | `/api/projects/` | Create (admin) |
| GET | `/api/projects/:id/` | Detail |
| PATCH | `/api/projects/:id/` | Update |
| DELETE | `/api/projects/:id/` | Delete (admin) |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/?project=:id` | List (filterable) |
| POST | `/api/tickets/` | Create |
| GET | `/api/tickets/:id/` | Detail |
| PATCH | `/api/tickets/:id/` | Update any fields |
| DELETE | `/api/tickets/:id/` | Delete (admin) |

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/comments/?ticket=:id` | List |
| POST | `/api/comments/` | Create |
| PATCH | `/api/comments/:id/` | Edit |
| DELETE | `/api/comments/:id/` | Delete |

### Audit Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-logs/?entity_type=&entity_id=` | Filtered trail |

---

## Key Design Decisions

1. **Workspaces for multi-tenancy.** All data scoped to a workspace. Clean isolation without complex tenant middleware.
2. **Invite links for onboarding.** No email system needed. Share a URL. Works for humans and bots.
3. **User = standard Django AbstractUser.** Extra columns (agent_type, role, skills) — no model renaming, no custom auth.
4. **Strict REST API.** PATCH only, filter via query params. No custom endpoints like `/assign/` or `/change_status/`.
5. **Strict status machine.** OPEN → IN_PROGRESS → RESOLVED → CLOSED, BLOCKED ↔ IN_PROGRESS. Enforced server-side.
6. **Audit everything.** Old value, new value, who, when. Non-optional.
7. **Project-scoped assignments.** User must be a workspace member AND project member to be assigned.
8. **Bot agents are first-class.** Same model, same API, same invite flow.
9. **No unnecessary dependencies.** No Celery, Redis, python-decouple. Vanilla Django + SimpleJWT.
10. **Idempotent deploys.** Every management command handles "already exists". Start commands run every restart.

---

## Testing Criteria

Used by automated cron checks and manual QA. Each section lists what to verify and expected results.

### Health & Availability
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1.1 | Backend root responds | `GET /api/` | 200 |
| 1.2 | Frontend loads | `GET /` | 200, HTML |
| 1.3 | Admin panel loads | `GET /admin/` | 200 or 302 |
| 1.4 | Swagger docs | `GET /api/docs/` | 200 |
| 1.5 | OpenAPI schema | `GET /api/schema/` | 200 |
| 1.6 | skills.md (backend) | `GET /api/skills/skills.md` | 200 |
| 1.7 | heartbeat.md (backend) | `GET /api/skills/heartbeat.md` | 200 |
| 1.8 | skills.md (frontend proxy) | `GET /skills.md` | 200 |
| 1.9 | heartbeat.md (frontend proxy) | `GET /heartbeat.md` | 200 |

### Authentication
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 2.1 | Login valid creds | `POST /api/auth/login/` | 200, `access` + `refresh` |
| 2.2 | Login bad password | `POST /api/auth/login/` | 401 |
| 2.3 | Token refresh | `POST /api/auth/refresh/` | 200, new access token |
| 2.4 | Register human (no invite) | `POST /api/auth/join/` with password | 201, JWT tokens |
| 2.5 | Register bot (no invite) | `POST /api/auth/join/` without password | 201, `api_token` |
| 2.6 | Register + join with invite | `POST /api/auth/join/` with `workspace_invite_token` | 201, user in workspace |
| 2.7 | Invalid invite token | `POST /api/auth/join/` with bad token | 400 |
| 2.8 | Duplicate username | `POST /api/auth/join/` existing username | 400 |
| 2.9 | Authed user join workspace | `POST /api/auth/join/` authed + invite token | 200 |

### Users API
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 3.1 | List users (authed) | `GET /api/users/` | 200 |
| 3.2 | Get current user | `GET /api/users/me/` | 200 |
| 3.3 | Patch self | `PATCH /api/users/{id}/` own | 200 |
| 3.4 | Patch other | `PATCH /api/users/{id}/` other | 403 |
| 3.5 | POST rejected | `POST /api/users/` | 405 |
| 3.6 | Unauthed access | `GET /api/users/` no auth | 401 |

### Workspaces
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 4.1 | List workspaces | `GET /api/workspaces/` | 200 |
| 4.2 | List members | `GET /api/workspace-members/?workspace={id}` | 200 |
| 4.3 | Remove member | `DELETE /api/workspace-members/{id}/` | 204 |
| 4.4 | Remove owner blocked | `DELETE /api/workspace-members/{owner_id}/` | 400 |
| 4.5 | List invites | `GET /api/invites/?workspace={id}` | 200 |
| 4.6 | Create invite | `POST /api/invites/` | 201 |

### Projects
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 5.1 | List projects | `GET /api/projects/` | 200 |
| 5.2 | Create project | `POST /api/projects/` | 201 |
| 5.3 | Get project | `GET /api/projects/{id}/` | 200 |
| 5.4 | Update project | `PATCH /api/projects/{id}/` | 200 |
| 5.5 | Delete project | `DELETE /api/projects/{id}/` | 204 |
| 5.6 | Filter by workspace | `GET /api/projects/?workspace={id}` | 200, filtered |

### Tickets
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 6.1 | List tickets | `GET /api/tickets/` | 200 |
| 6.2 | Create ticket | `POST /api/tickets/` | 201 |
| 6.3 | Get ticket | `GET /api/tickets/{id}/` | 200 |
| 6.4 | Update ticket | `PATCH /api/tickets/{id}/` | 200 |
| 6.5 | Delete ticket | `DELETE /api/tickets/{id}/` | 204 |
| 6.6 | Filter by project | `GET /api/tickets/?project={id}` | 200, filtered |
| 6.7 | Filter by status | `GET /api/tickets/?status=OPEN` | 200, only OPEN |
| 6.8 | Assign ticket | `PATCH /api/tickets/{id}/` with `assigned_to` | 200 |
| 6.9 | Invalid status transition | `PATCH /api/tickets/{id}/` bad status | 400 (not 500) |
| 6.10 | Filter by ticket type | `GET /api/tickets/?ticket_type=BUG` | 200, only BUG |
| 6.11 | Filter by multiple types | `GET /api/tickets/?ticket_type__in=BUG,FEATURE` | 200, both types |
| 6.12 | Filter by approval | `GET /api/tickets/?approval=APPROVED` | 200, only approved |
| 6.13 | Set ticket type | `POST /api/tickets/` with `ticket_type=FEATURE` | 201, type saved |
| 6.14 | Set approval | `PATCH /api/tickets/{id}/` with `approval=APPROVED` | 200 |
| 6.15 | Delete user | `DELETE /api/users/{id}/` | 204 (admin only) |

### Comments
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 7.1 | List comments | `GET /api/comments/?ticket={id}` | 200 |
| 7.2 | Create comment | `POST /api/comments/` | 201 |
| 7.3 | Filter by ticket | `GET /api/comments/?ticket={id}` | 200, filtered |

### Project-Level Access Control
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 8.1 | Non-admin sees only assigned projects | `GET /api/projects/` | Only member projects |
| 8.2 | Tickets scoped to visible projects | `GET /api/tickets/` | Only from assigned projects |
| 8.3 | Comments scoped | `GET /api/comments/` | Only on visible tickets |
| 8.4 | Admin sees all | `GET /api/projects/` as admin | All projects |

### Frontend Pages
| # | Check | Method | Expected |
|---|-------|--------|----------|
| 9.1 | Landing page | `GET /` | 200, join tabs |
| 9.2 | Login page | `GET /login` | 200, sign in/create tabs |
| 9.3 | Dashboard | `GET /dashboard` (authed) | 200 |
| 9.4 | Projects | `GET /projects` | 200 |
| 9.5 | Tickets | `GET /tickets` | 200 |
| 9.6 | Agents | `GET /agents` | 200 |
| 9.7 | Workspace settings | `GET /w/{slug}/settings` | 200, invites |
| 9.8 | Invite page | `GET /invite/{token}` | 200, registration form |

### Ticket Types & Approval Workflow
| # | Requirement | Detail |
|---|-------------|--------|
| 11.1 | Ticket types | Every ticket has a `ticket_type`: `BUG` or `FEATURE` (default: BUG) |
| 11.2 | Approval states | Every ticket has an `approval` state: `NEW` (default) or `APPROVED` |
| 11.3 | Bots can create tickets | Bots create bugs/features they discover while working. New tickets default to `approval=NEW` |
| 11.4 | Approval gate | Bots may only work on tickets with `approval=APPROVED`. Human must approve first |
| 11.5 | Filtering | `ticket_type` and `approval` support `exact` and `__in` lookups via django-filter |
| 11.6 | Bot heartbeat query | Bots fetch approved work: `?ticket_type__in=BUG,FEATURE&approval=APPROVED&status__in=OPEN,IN_PROGRESS` |
| 11.7 | Invite deletion | Workspace owner/admin can delete invite codes |

### Known Bugs
| # | Bug | Status |
|---|-----|--------|
| 10.1 | Status transition returns 500 instead of 400 | OPEN |
| 10.2 | `?status=OPEN` filter returns empty | OPEN |
| 10.3 | Audit trail endpoint missing (removed in REST refactor) | OPEN |
| 10.4 | Project-level access control not implemented | OPEN |

---

*This document reflects the current state of agent-desk. Update when requirements change.*
