# Master Prompt: Agentic Support & Ticketing System

> Single source of truth. All agents reference this file.

---

## System Overview

A multi-tenant support and ticketing system where **human agents and bot agents** are first-class citizens. Each team operates in its own **workspace**. Tickets flow through statuses, every action is logged, and onboarding is via **invite links**.

### Principles

- Agents are first-class — bots and humans share the same model and capabilities.
- Workspaces provide isolation — each team gets its own projects, tickets, and members.
- Invite links for onboarding — no admin manually creating accounts. Share a link, they're in.
- No sprints or phases in the product. Tickets flow through statuses.
- Every action is logged in an audit trail.
- Strict REST API — PATCH only, no custom endpoints, filter via query params.
- Vanilla Django — no unnecessary dependencies or customizations.

### Terminology

- **Workspace** — a tenant container. All projects, tickets, and members belong to a workspace.
- **User** — any entity (human or bot) that can work on tickets. Standard Django User model with extra columns.
- **Project** — groups related tickets and users within a workspace.
- **Ticket** — a unit of work, assigned to exactly one user at a time.
- **Comment** — a timestamped message on a ticket from any user.
- **Invite** — a shareable link that lets humans or bots join a workspace.

---

## Data Models

### Workspace
- id, name, slug (unique, URL-safe), owner (FK to User), created_at, updated_at
- Has many projects. Has many members (via WorkspaceMember).

### WorkspaceMember
- id, workspace (FK), user (FK), role (ADMIN | MEMBER), joined_at
- Unique together: (workspace, user)
- The workspace owner is automatically an ADMIN member.

### WorkspaceInvite
- id, workspace (FK), token (UUID, unique), created_by (FK to User)
- expires_at (nullable — null means never expires)
- max_uses (nullable — null means unlimited)
- use_count (default 0)
- is_active (default true)
- created_at

### User (Django AbstractUser + extra columns)
- Standard Django fields: id, username, email, password, is_active, etc.
- Extra columns: name (required display name), user_type (HUMAN | BOT), role (ADMIN | MEMBER), skills (JSON/tags), notification_preference
- A user can belong to multiple workspaces.

### Project
- id, workspace (FK), name, description, created_at, updated_at
- Has many tickets. Has many users (via join table).
- Unique together: (workspace, name)

### Ticket
- id, project (FK), title, description, status, priority, assigned_to (FK to User, nullable), created_by (FK to User), created_at, updated_at, resolved_at, closed_at
- **Statuses:** OPEN → IN_PROGRESS → RESOLVED → CLOSED. Can move to BLOCKED from IN_PROGRESS and back.
- **Priorities:** LOW, MEDIUM, HIGH, CRITICAL

### Comment
- id, ticket (FK), author (FK to User), body, created_at, updated_at

### AuditLog
- id, entity_type, entity_id, action, performed_by (FK to User), old_value (JSON), new_value (JSON), timestamp

---

## Workspace Flow

### Creating a Workspace
1. Any authenticated user can create a workspace.
2. The creator becomes the workspace owner and is added as an ADMIN member.
3. A default invite link is generated automatically.

### Joining a Workspace
1. Someone shares an invite link: `/invite/{token}`
2. If not authenticated → redirect to register/login, then join.
3. If authenticated → join the workspace as MEMBER.
4. If already a member → redirect to workspace dashboard.
5. Invite validation: check is_active, not expired, use_count < max_uses.

### Invite Links
- Workspace ADMINs can create invite links.
- Each link has an optional expiry and optional max uses.
- ADMINs can deactivate links.
- The same link works for both humans and bots — a bot just authenticates via API instead of browser.

### Workspace Switching
- Users who belong to multiple workspaces see a workspace switcher in the nav.
- All API calls are scoped to the current workspace.
- URL structure: `/w/{workspace-slug}/dashboard`, `/w/{workspace-slug}/projects`, etc.

---

## Core Capabilities

- **Web dashboard** with workspace selector, project list, ticket board (kanban by status), ticket detail with comments, and member management (workspace admin only).
- **Assignment** — one user per ticket. Members self-assign, admins can reassign. Bots that get stuck set BLOCKED and tag a human.
- **Invite-based onboarding** — share a link, join a workspace. No email invites needed.

---

## Permissions

| Action | Workspace ADMIN | Workspace MEMBER |
|--------|----------------|-----------------|
| Create/delete projects | ✅ | ❌ |
| Manage project members | ✅ | ❌ |
| Create/manage invite links | ✅ | ❌ |
| Remove workspace members | ✅ | ❌ |
| Create tickets | ✅ | ✅ |
| Update own tickets | ✅ | ✅ |
| Update others' tickets | ✅ | ❌ |
| Self-assign | ✅ | ✅ |
| Reassign | ✅ | ❌ |
| Delete tickets | ✅ | ❌ |
| Comment on any ticket | ✅ | ✅ |

---

## API Surface (Strict REST)

All endpoints use standard HTTP methods. PATCH only (no PUT). Filter via query params. No custom action endpoints.

**Authentication:** Humans use JWT (Bearer token). Bots use permanent API token (Token auth). Both are accepted on all authenticated endpoints.

**Swagger docs:** `/api/docs/` | **Raw schema:** `/api/schema/` | **ReDoc:** `/api/redoc/`

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login/` | Public | Login: `{username, password}` → `{access, refresh}` JWT tokens |
| POST | `/api/auth/token/refresh/` | Public | Refresh: `{refresh}` → `{access}` |
| POST | `/api/auth/join/` | Public | **Single entry point for registration & workspace joining.** See below. |

#### POST /api/auth/join/ — The Join Endpoint

One endpoint, four cases:

| Case | Request Body | Response |
|------|-------------|----------|
| Register human (no workspace) | `{username, name, password}` | `{user, access, refresh}` |
| Register human + join workspace | `{username, name, password, workspace_invite_token}` | `{user, workspace, access, refresh}` |
| Register bot + join workspace | `{username, name, workspace_invite_token}` (no password) | `{user, workspace, api_token}` |
| Existing user joins workspace | `{workspace_invite_token}` (with auth header) | `{workspace}` |

**Errors (400):** Missing required fields, username already taken, invalid/expired/maxed-out invite, already a workspace member.

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/` | Auth | List all users (searchable: username, email, name; filterable: user_type, role, is_active) |
| GET | `/api/users/me/` | Auth | Current authenticated user's profile |
| PATCH | `/api/users/{id}/` | Admin | Update user fields (name, user_type, role, skills, is_active) |

No `GET /users/{id}/`, no `POST /users/`. Use `/users/me/` for own profile, `/auth/join/` for registration.

### Workspaces
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/workspaces/` | Auth | List workspaces the user belongs to |
| POST | `/api/workspaces/` | Auth | Create workspace: `{name, slug}`. Auto-adds creator as ADMIN + generates default invite. |
| PATCH | `/api/workspaces/{id}/` | Admin | Update workspace name/slug |
| DELETE | `/api/workspaces/{id}/` | Owner | Delete workspace |

### Workspace Members
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/workspace-members/?workspace={id}` | Auth | List members of a workspace (includes user details + role) |
| DELETE | `/api/workspace-members/{id}/` | Admin | Remove a member from the workspace |

No `POST` (members created via `/auth/join/`), no `PATCH` (roles are set at join), no individual `GET`.

### Invites
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/invites/?workspace={id}` | Auth | List invites for a workspace |
| POST | `/api/invites/` | Admin | Create invite: `{workspace, expires_at?, max_uses?}` |

No `PATCH`, no `DELETE`, no individual `GET`. Invites are immutable once created.

### Projects
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects/` | Auth | List projects (filterable by workspace) |
| POST | `/api/projects/` | Admin | Create project: `{name, description, workspace, agent_ids?}` |
| GET | `/api/projects/{id}/` | Auth | Project detail with agents list |
| PATCH | `/api/projects/{id}/` | Admin | Update name, description, agents (send `agent_ids`) |
| DELETE | `/api/projects/{id}/` | Admin | Delete project |

### Tickets
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tickets/?project={id}` | Auth | List tickets. Filters: `status`, `priority`, `assigned_to`, `created_by`, `project`. Search: `title`, `description`. |
| POST | `/api/tickets/` | Auth | Create ticket: `{project, title, description, priority?, assigned_to?}` |
| GET | `/api/tickets/{id}/` | Auth | Ticket detail with assigned_to/created_by details |
| PATCH | `/api/tickets/{id}/` | Auth | Update fields. **Status transitions:** OPEN→IN_PROGRESS→RESOLVED→CLOSED, BLOCKED↔IN_PROGRESS |
| DELETE | `/api/tickets/{id}/` | Admin | Delete ticket |

### Comments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/comments/?ticket={id}` | Auth | List comments for a ticket |
| POST | `/api/comments/` | Auth | Add comment: `{ticket, body}` (author set automatically) |

### Audit Logs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/audit-logs/` | Auth | List audit entries. Filters: `entity_type`, `entity_id`, `action`, `performed_by`. Read-only. |

---

## Build Phases

### Phase 1: Foundation ✅
Database schema, migrations, seed data. CRUD API for all models. Ticket status validation. Audit logging.

### Phase 2: Roles & Permissions ✅
RBAC at the API layer. Assignment validation (user must belong to project). Escalation flow for BLOCKED tickets.

### Phase 3: Web Dashboard ✅
Project list, ticket board/list, ticket detail with comments, auth, user management.

### Phase 4: Simplification ✅
Removed Celery/Redis. Strict REST API. Vanilla Django. No custom auth.

### Phase 5: Workspaces & Invites ✅
Workspace model, WorkspaceMember, WorkspaceInvite. All projects/tickets scoped to workspace. Invite link join flow. Workspace switcher in frontend. Multi-tenant isolation. Single `/auth/join/` endpoint for all registration and workspace joining. Bot token support via DRF TokenAuthentication.

---

*Update this document when requirements change.*
