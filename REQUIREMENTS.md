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

*This document reflects the current state of agent-desk. Update when requirements change.*
