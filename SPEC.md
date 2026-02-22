# Master Prompt: Agentic Support & Ticketing System

> Single source of truth. All agents reference this file.

---

## System Overview

A support and ticketing system where **human agents and bot agents** are first-class citizens. Tickets are created via a **channel bot**, managed through a **web dashboard**, and notifications are sent via **email** asynchronously.

### Principles

- Agents are first-class — bots and humans share the same model and capabilities.
- No sprints or phases in the product. Tickets flow through statuses.
- Every action is logged in an audit trail.

### Terminology

- **Agent** — any entity (human or bot) that can work on tickets.
- **Project** — groups related tickets and agents.
- **Ticket** — a unit of work, assigned to exactly one agent at a time.
- **Comment** — a timestamped message on a ticket from any agent.

---

## Data Models

### Project
- id, name (unique), description, created_at, updated_at
- Has many tickets. Has many agents (via join table).

### Agent
- id, name, type (HUMAN | BOT), email, role (ADMIN | MEMBER), skills (tags), is_active, created_at, updated_at

### Ticket
- id, project_id, title, description, status, priority, assigned_to (one agent or null), created_by, created_at, updated_at, resolved_at, closed_at
- **Statuses:** OPEN → IN_PROGRESS → RESOLVED → CLOSED. Can move to BLOCKED from IN_PROGRESS and back.
- **Priorities:** LOW, MEDIUM, HIGH, CRITICAL

### Comment
- id, ticket_id, author_id, body, created_at, updated_at

### AuditLog
- id, entity_type, entity_id, action, performed_by, old_value (JSON), new_value (JSON), timestamp

---

## Core Capabilities

- **Web dashboard** with project list, ticket board (kanban by status), ticket detail with comments and audit trail, and agent management (admin only).
- **Assignment** — one agent per ticket. Members self-assign, admins can reassign. Bots that get stuck set BLOCKED and tag a human.
- **Email notifications** — async on assignment, comments, status changes, and escalation. Per-agent preferences (all, critical-only, none).

---

## Permissions

| Action | ADMIN | MEMBER |
|--------|-------|--------|
| Create/delete projects | ✅ | ❌ |
| Manage project agents | ✅ | ❌ |
| Create tickets | ✅ | ✅ |
| Update own tickets | ✅ | ✅ |
| Update others' tickets | ✅ | ❌ |
| Self-assign | ✅ | ✅ |
| Reassign | ✅ | ❌ |
| Delete tickets | ✅ | ❌ |
| Comment on any ticket | ✅ | ✅ |

---

## API Surface

- **Projects** — CRUD, manage agents per project.
- **Tickets** — CRUD, assign, change status. Nested under projects.
- **Comments** — CRUD on tickets.
- **Agents** — Register, list, get, update.
- **Audit** — Trail per ticket or per project.

---

## Build Phases

### Phase 1: Foundation
Database schema, migrations, seed data. CRUD API for all models. Ticket status validation. Audit logging.

### Phase 2: Roles & Permissions
RBAC at the API layer. Assignment validation (agent must belong to project). Escalation flow for BLOCKED tickets.

### Phase 3: Web Dashboard
Project list, ticket board/list, ticket detail with comments and audit trail, auth, agent management.

### Phase 4: Email Notifications
Background job queue. Sends on assignment, comments, status changes, escalation. Per-agent preferences. Retry logic.

### Phase 5: Polish & Scale
Pagination, rate limiting, search, error handling, API docs, tests, deployment config.

---

*Update this document when requirements change.*
