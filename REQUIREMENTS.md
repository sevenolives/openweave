# Agent Desk — Requirements Document

## What This Is

A support and ticketing system where **humans and bots are equal**. An "agent" isn't just a person — it's anything that can pick up a ticket and do work. A bot agent and a human agent use the same API, same permissions model, same assignment flow.

Tickets come in, get assigned, get worked, get closed. Everything is logged. Nothing disappears.

---

## Core Concepts

### Agents (Not "Users")
The system doesn't have traditional "users" — it has **agents**. Every agent has a type: `HUMAN` or `BOT`. Both types:
- Get assigned tickets
- Write comments
- Change ticket status
- Show up in audit logs the same way

A bot that gets stuck sets the ticket to `BLOCKED` and tags a human. That's the escalation model — simple, no workflow engine needed.

### Projects
Projects group related tickets and agents together. An agent must belong to a project to work on its tickets. This is enforced at the API level — you can't assign a ticket to an agent outside the project.

### Tickets
A ticket is a unit of work with a strict status flow:

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
              ↕
           BLOCKED
```

- Only one agent assigned at a time
- Members can self-assign; only admins can reassign
- Priority levels: LOW, MEDIUM, HIGH, CRITICAL
- Timestamps tracked: created, updated, resolved, closed

### Comments
Threaded conversation on tickets. Any agent (human or bot) can comment. Comments are how work gets documented.

### Audit Trail
Every mutation is logged: who did what, when, what changed (old value → new value). This is non-negotiable — the audit log is how you trust the system.

---

## Permissions (RBAC)

Two roles: **ADMIN** and **MEMBER**. Clean split:

| What | Admin | Member |
|------|-------|--------|
| Create/delete projects | ✅ | ❌ |
| Add/remove agents from projects | ✅ | ❌ |
| Create tickets | ✅ | ✅ |
| Update own tickets | ✅ | ✅ |
| Update others' tickets | ✅ | ❌ |
| Self-assign tickets | ✅ | ✅ |
| Reassign tickets | ✅ | ❌ |
| Delete tickets | ✅ | ❌ |
| Comment on any ticket | ✅ | ✅ |

No complex permission trees. Two roles, clear boundaries.

---

## Architecture

### Backend: Django + DRF
- **Custom User model** using `AbstractUser` (not `AbstractBaseUser` — per best practices, we keep Django's built-in auth working)
- Agent IS the user model — no separate user/agent tables
- Django REST Framework for the API
- SimpleJWT for authentication
- PostgreSQL in production (Railway), SQLite for local dev
- `dj_database_url` for environment-based DB config

### Frontend: Next.js + Tailwind
- Project list → Ticket board (kanban by status) → Ticket detail
- JWT auth flow (localStorage, refresh on 401)
- Responsive: card layout on mobile, table on desktop
- Dashboard shows what matters: open tickets, assignments, recent activity

### Deployment: Railway
- Two services: backend (Django/Gunicorn) + frontend (Next.js)
- Backend start command: `collectstatic && migrate && createsuperadmin && gunicorn` (idempotent, runs every restart)
- Deploy via Railway GraphQL API with `serviceInstanceDeploy` + `latestCommit: true`

### Email: Async via Celery
- Background job queue for notifications
- Triggers: assignment, comments, status changes, escalation (BLOCKED)
- Per-agent preferences: all notifications, critical-only, or none
- Retry logic for failed sends

---

## API Design

All endpoints return paginated responses: `{ count, next, previous, results }`

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/` | List projects |
| POST | `/api/projects/` | Create project (admin) |
| GET | `/api/projects/:id/` | Project detail |
| PATCH | `/api/projects/:id/` | Update project (admin) |
| DELETE | `/api/projects/:id/` | Delete project (admin) |
| GET | `/api/projects/:id/agents/` | List project agents |
| POST | `/api/projects/:id/agents/` | Add agent to project (admin) |
| DELETE | `/api/projects/:id/agents/:agent_id/` | Remove agent (admin) |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/tickets/` | List tickets (filterable by status, priority, assignee) |
| POST | `/api/projects/:id/tickets/` | Create ticket |
| GET | `/api/projects/:id/tickets/:tid/` | Ticket detail |
| PATCH | `/api/projects/:id/tickets/:tid/` | Update ticket |
| DELETE | `/api/projects/:id/tickets/:tid/` | Delete ticket (admin) |
| POST | `/api/projects/:id/tickets/:tid/assign/` | Assign/self-assign |

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/tickets/:tid/comments/` | List comments |
| POST | `/api/projects/:id/tickets/:tid/comments/` | Add comment |
| PATCH | `/api/projects/:id/tickets/:tid/comments/:cid/` | Edit comment |
| DELETE | `/api/projects/:id/tickets/:tid/comments/:cid/` | Delete comment |

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents/register/` | Register new agent |
| GET | `/api/agents/` | List agents |
| GET | `/api/agents/:id/` | Agent detail |
| PATCH | `/api/agents/:id/` | Update agent |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | Get JWT tokens (email + password) |
| POST | `/api/auth/refresh/` | Refresh access token |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/audit/` | Audit trail for project |
| GET | `/api/projects/:id/tickets/:tid/audit/` | Audit trail for ticket |

---

## Build Order

| Phase | What | Key Deliverables |
|-------|------|-----------------|
| **1. Foundation** | Schema, migrations, seed data, CRUD API, status validation, audit logging | Working API, all models, audit trail |
| **2. Roles & Permissions** | RBAC enforcement, assignment validation, BLOCKED escalation | Secure API, project-scoped assignments |
| **3. Web Dashboard** | Project list, kanban board, ticket detail, auth, agent management | Usable frontend |
| **4. Email Notifications** | Celery workers, notification triggers, agent preferences, retry | Async email on key events |
| **5. Polish & Scale** | Pagination, rate limiting, search, error handling, API docs, tests | Production-ready system |

---

## Key Design Decisions

1. **Agent = User model.** No separate tables. The Django custom user IS the agent. Simpler queries, simpler auth.
2. **Strict status machine.** No arbitrary status jumps. OPEN → IN_PROGRESS → RESOLVED → CLOSED, with BLOCKED as a side state. Enforced in the API, not just the frontend.
3. **Audit everything.** Old value, new value, who, when. On every write operation. Non-optional.
4. **Project-scoped assignments.** An agent must be a member of the project to be assigned a ticket in it. Enforced server-side.
5. **Bot agents are first-class.** Same model, same API, same permissions. A bot authenticates with JWT just like a human.
6. **Idempotent deploys.** Every management command handles "already exists" gracefully. Start commands run on every restart.

---

*This document reflects my understanding of the agent-desk system. Flag anything that's off.*
