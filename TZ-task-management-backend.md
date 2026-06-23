# Technical Specification (ТЗ) — Task Management Backend

| | |
|---|---|
| **Project** | Task Management API (Plane-style) |
| **Component** | Backend / REST API only |
| **Version** | 0.1 (Draft) |
| **Date** | 2026-06-23 |
| **Status** | For review |

---

## 1. Overview

### 1.1 Purpose
This document defines the requirements and architecture for the **backend** of a task management system, inspired by [Plane](https://plane.so) and conceptually adjacent to Jira and YouTrack. The product philosophy is **clean and lightweight** — an opinionated, fast API with a small, well-chosen feature set rather than a sprawling enterprise configuration surface.

The deliverable is a REST API that exposes everything a future frontend (web/mobile) would need to manage work: workspaces, projects, issues, workflow states, cycles, comments, and the supporting machinery (auth, members, labels, activity, notifications).

### 1.2 Goal of the build
Ship a **launchable MVP** that can grow into a real product. Decisions favor maintainability and a clean data model over premature breadth. Multi-tenancy is built in from day one because retrofitting it later is expensive.

### 1.3 Scope
**In scope:** the HTTP API, data model, authentication/authorization, business rules, validation, and API documentation.

**Out of scope (this phase):** any frontend/UI, real-time websockets, third-party integrations (GitHub, Slack), billing, and analytics dashboards. These are noted in §11 as future work.

### 1.4 Terminology
- **Workspace** — the top-level tenant. An organization or team. Everything belongs to a workspace.
- **Project** — a container for issues inside a workspace (e.g. "Mobile App", "Marketing Site").
- **Issue** — the core unit of work (a task, bug, story). Issues can have sub-issues.
- **State** — a workflow status an issue sits in (Backlog, Todo, In Progress, Done, Cancelled). Customizable per project.
- **Cycle** — a time-boxed iteration (Plane's equivalent of a sprint).
- **Module** — a thematic grouping of issues (e.g. a feature or epic), not time-boxed.
- **Label** — a colored tag attached to issues.

---

## 2. Goals & Non-Goals

**Goals**
- A clean, consistent, well-documented REST API.
- Solid multi-tenant data isolation (workspace-scoped).
- Fast issue listing with filtering, sorting, and pagination.
- Role-based access control that is simple but real.
- A schema that supports the signature Plane features (cycles, modules, sub-issues, custom states).

**Non-Goals (MVP)**
- A configurable workflow engine with arbitrary state machines and transition rules. We ship sensible default states that are editable, not a rules engine.
- A query language (no JQL). Filtering is done via structured query parameters.
- Pixel-level feature parity with Jira/Plane. We cover the core 80%.

---

## 3. Tech Stack & Architecture

### 3.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js (LTS) | Required by you |
| Language | TypeScript | Type safety, cleaner large codebase |
| Framework | Fastify | Lightweight, fast, built-in schema validation |
| Database | PostgreSQL | Relational data fits issues/relations well |
| ORM | Prisma | Type-safe queries + first-class migrations |
| Validation | Zod (+ Fastify schemas) | Runtime validation, shared types |
| Auth | JWT (access + refresh) | Stateless API auth |
| Password hashing | argon2 (or bcrypt) | Strong, standard |
| Logging | pino | Native to Fastify, fast structured logs |
| API docs | `@fastify/swagger` (OpenAPI) | Auto-generated docs from schemas |
| Testing | Vitest + Supertest | Fast unit + integration tests |
| Container | Docker + docker-compose | Reproducible local + deploy |

### 3.2 Architecture
A pragmatic **layered architecture**, not over-engineered:

```
HTTP (Fastify routes)  →  Controllers / handlers  →  Services (business logic)  →  Repositories (Prisma)  →  PostgreSQL
```

- **Routes** declare the path, method, auth requirement, and request/response schema.
- **Controllers** parse input, call a service, shape the response. No business logic here.
- **Services** hold business rules (permission checks, side effects like activity logging and notifications).
- **Repositories / Prisma** own data access. Services do not write raw queries scattered around.

Cross-cutting concerns are Fastify **plugins/hooks**: authentication, the workspace/permission resolver, error handling, and rate limiting.

### 3.3 Multi-tenancy model
Single database, **shared schema**, **workspace_id on every tenant-owned row**. Every request that touches workspace data resolves the current workspace and verifies membership before any handler runs. This keeps tenants isolated without the operational cost of a database-per-tenant model — appropriate for an MVP.

### 3.4 Project structure
```
src/
  app.ts                 # Fastify instance + plugin registration
  server.ts              # bootstrap / listen
  config/                # env parsing, constants
  plugins/               # auth, error-handler, rate-limit, swagger
  modules/
    auth/                # routes, controller, service, schemas
    workspaces/
    projects/
    issues/
    states/
    labels/
    cycles/
    modules/
    comments/
    attachments/
    activity/
    notifications/
  lib/                   # jwt, password, pagination helpers
  prisma/                # schema.prisma, migrations, seed
tests/
```
Each feature is a self-contained module (`routes.ts`, `controller.ts`, `service.ts`, `schema.ts`) so the codebase stays navigable as it grows.

---

## 4. Roles & Permissions

Permissions exist at two levels.

**Workspace roles**
| Role | Capabilities |
|---|---|
| Owner | Full control, including deleting the workspace and managing billing (future). Exactly one (transferable). |
| Admin | Manage members, projects, and all settings. Cannot delete the workspace. |
| Member | Create/edit issues, projects they belong to; standard contributor. |
| Guest | Limited read (and optionally comment) access to specific projects. |

**Project membership**
Members are added to specific projects. A user must be a workspace member to be a project member. Project-level access controls who can see and modify a project's issues. (Fine-grained per-field permissions are out of scope for MVP.)

**Enforcement**
Every protected route runs through an auth hook (valid JWT → user) and a permission hook (membership + role check for the target workspace/project). Authorization is enforced in the service layer as the single source of truth, never only at the route.

---

## 5. Data Model

Below are the core entities, their key fields, and relationships. All tenant-owned tables carry `workspace_id`. All tables include `id` (UUID), `created_at`, `updated_at`; soft-deletable tables also include `deleted_at`.

### 5.1 User
Global (not workspace-scoped). The account identity.
- `email` (unique), `password_hash`, `display_name`, `avatar_url`, `is_active`
- Relations: belongs to many workspaces via `WorkspaceMember`.

### 5.2 Workspace
The tenant.
- `name`, `slug` (unique, URL-friendly), `owner_id`
- Relations: has many members, projects, labels, states.

### 5.3 WorkspaceMember
Join between User and Workspace.
- `workspace_id`, `user_id`, `role` (`owner` | `admin` | `member` | `guest`)
- Unique on (`workspace_id`, `user_id`).

### 5.4 Project
- `workspace_id`, `name`, `identifier` (short key, e.g. `MOB` → issues become `MOB-123`), `description`, `lead_id`, `is_archived`
- Unique on (`workspace_id`, `identifier`).
- Relations: has many issues, states, cycles, modules, project members.

### 5.5 ProjectMember
- `project_id`, `user_id`, `role` (project-level role, optional MVP refinement)
- Unique on (`project_id`, `user_id`).

### 5.6 State (workflow status)
Per-project, customizable, ordered.
- `project_id`, `name`, `color`, `group` (`backlog` | `unstarted` | `started` | `completed` | `cancelled`), `order`, `is_default`
- The `group` enables logic like "% complete" and board columns without a full rules engine. Default set seeded on project creation.

### 5.7 Issue (core entity)
- `workspace_id`, `project_id`, `sequence_id` (per-project running number → `MOB-123`)
- `title`, `description` (rich text / markdown stored as text or JSON)
- `state_id`, `priority` (`none` | `low` | `medium` | `high` | `urgent`)
- `parent_id` (self-reference → sub-issues)
- `cycle_id` (nullable), `estimate_points` (nullable)
- `start_date`, `due_date`, `completed_at`
- `created_by_id`, `sort_order` (for manual ordering on boards)
- Relations: many assignees (`IssueAssignee`), many labels (`IssueLabel`), many comments, attachments, links, activity entries; belongs to many modules (`ModuleIssue`).

### 5.8 IssueAssignee
- `issue_id`, `user_id`. Unique on the pair. (Issues support multiple assignees.)

### 5.9 Label
- `workspace_id` (or `project_id` — see Open Questions), `name`, `color`
- Relations: many issues via `IssueLabel`.

### 5.10 IssueLabel
- `issue_id`, `label_id`. Unique on the pair.

### 5.11 Cycle
Time-boxed iteration.
- `project_id`, `name`, `description`, `start_date`, `end_date`, `status` (derived: upcoming / active / completed)
- Relations: has many issues (via `Issue.cycle_id`).

### 5.12 Module
Thematic grouping (feature/epic).
- `project_id`, `name`, `description`, `lead_id`, `status`, `target_date`
- Relations: many issues via `ModuleIssue` (many-to-many).

### 5.13 ModuleIssue
- `module_id`, `issue_id`. Unique on the pair.

### 5.14 IssueLink (relations between issues)
- `issue_id`, `related_issue_id`, `relation_type` (`blocks` | `blocked_by` | `relates_to` | `duplicates`)
- Lets issues reference one another beyond parent/child.

### 5.15 Comment
- `issue_id`, `author_id`, `body` (markdown), `parent_comment_id` (optional threading)
- Soft-deletable.

### 5.16 Attachment
- `issue_id`, `uploaded_by_id`, `file_name`, `file_size`, `mime_type`, `storage_key` (S3-compatible key or local path)
- Files stored on object storage (S3/MinIO) in production; the DB holds metadata only.

### 5.17 Activity (audit trail)
- `workspace_id`, `issue_id` (nullable), `actor_id`, `action` (e.g. `issue.state_changed`), `field`, `old_value`, `new_value`, `created_at`
- Powers the issue history feed and is the basis for notifications.

### 5.18 Notification
- `recipient_id`, `workspace_id`, `actor_id`, `activity_id` (or denormalized fields), `type`, `is_read`, `read_at`
- Generated on relevant events (assigned to issue, mentioned, comment on watched issue).

### 5.19 Relationship summary
- A **User** belongs to many **Workspaces** (through `WorkspaceMember`, with a role).
- A **Workspace** has many **Projects**.
- A **Project** has many **Issues**, **States**, **Cycles**, **Modules**.
- An **Issue** belongs to one **State**, optionally one **Cycle** and one parent **Issue**; has many **Assignees**, **Labels**, **Comments**, **Attachments**, **Links**, and **Activity** entries; and belongs to many **Modules**.

> A visual ER diagram can be generated separately on request.

---

## 6. API Specification

Conventions:
- Base path: `/api/v1`
- JSON request/response bodies; `Content-Type: application/json`
- Auth via `Authorization: Bearer <access_token>` unless noted Public.
- Workspace-scoped resources are addressed under `/workspaces/:workspaceSlug/...`.
- Standard codes: `200` OK, `201` Created, `204` No Content, `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `422` semantic validation, `429` rate-limited.

### 6.1 Auth
| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Create account | Public |
| POST | `/auth/login` | Email + password → tokens | Public |
| POST | `/auth/refresh` | Refresh access token | Public (refresh token) |
| POST | `/auth/logout` | Invalidate refresh token | Required |
| GET | `/auth/me` | Current user profile | Required |
| PATCH | `/auth/me` | Update own profile | Required |

### 6.2 Workspaces
| Method | Path | Description |
|---|---|---|
| GET | `/workspaces` | List workspaces the user belongs to |
| POST | `/workspaces` | Create workspace (creator → owner) |
| GET | `/workspaces/:slug` | Workspace detail |
| PATCH | `/workspaces/:slug` | Update (admin+) |
| DELETE | `/workspaces/:slug` | Delete (owner) |
| GET | `/workspaces/:slug/members` | List members |
| POST | `/workspaces/:slug/members/invite` | Invite by email (admin+) |
| PATCH | `/workspaces/:slug/members/:userId` | Change role (admin+) |
| DELETE | `/workspaces/:slug/members/:userId` | Remove member (admin+) |

### 6.3 Projects
| Method | Path | Description |
|---|---|---|
| GET | `/workspaces/:slug/projects` | List projects |
| POST | `/workspaces/:slug/projects` | Create project (seeds default states) |
| GET | `/workspaces/:slug/projects/:projectId` | Project detail |
| PATCH | `/workspaces/:slug/projects/:projectId` | Update |
| DELETE | `/workspaces/:slug/projects/:projectId` | Archive/delete |
| GET | `/.../projects/:projectId/members` | List project members |
| POST | `/.../projects/:projectId/members` | Add member |
| DELETE | `/.../projects/:projectId/members/:userId` | Remove member |

### 6.4 Issues
| Method | Path | Description |
|---|---|---|
| GET | `/.../projects/:projectId/issues` | List issues (filter/sort/paginate — §7) |
| POST | `/.../projects/:projectId/issues` | Create issue |
| GET | `/.../projects/:projectId/issues/:issueId` | Issue detail |
| PATCH | `/.../projects/:projectId/issues/:issueId` | Update (title, state, priority, dates, etc.) |
| DELETE | `/.../projects/:projectId/issues/:issueId` | Delete |
| GET | `/.../issues/:issueId/sub-issues` | List sub-issues |
| POST | `/.../issues/:issueId/assignees` | Add assignee |
| DELETE | `/.../issues/:issueId/assignees/:userId` | Remove assignee |
| POST | `/.../issues/:issueId/labels` | Attach label |
| DELETE | `/.../issues/:issueId/labels/:labelId` | Detach label |
| POST | `/.../issues/:issueId/links` | Create relation to another issue |
| DELETE | `/.../issues/:issueId/links/:linkId` | Remove relation |
| GET | `/.../issues/:issueId/activity` | Issue history |

### 6.5 States
| Method | Path | Description |
|---|---|---|
| GET | `/.../projects/:projectId/states` | List states |
| POST | `/.../projects/:projectId/states` | Create state |
| PATCH | `/.../projects/:projectId/states/:stateId` | Update (name, color, order) |
| DELETE | `/.../projects/:projectId/states/:stateId` | Delete (must reassign issues) |

### 6.6 Labels
| Method | Path | Description |
|---|---|---|
| GET | `/.../labels` | List labels |
| POST | `/.../labels` | Create label |
| PATCH | `/.../labels/:labelId` | Update |
| DELETE | `/.../labels/:labelId` | Delete |

### 6.7 Cycles
| Method | Path | Description |
|---|---|---|
| GET | `/.../projects/:projectId/cycles` | List cycles |
| POST | `/.../projects/:projectId/cycles` | Create cycle |
| GET | `/.../cycles/:cycleId` | Cycle detail (+ progress summary) |
| PATCH | `/.../cycles/:cycleId` | Update |
| DELETE | `/.../cycles/:cycleId` | Delete |
| POST | `/.../cycles/:cycleId/issues` | Add issues to cycle |
| DELETE | `/.../cycles/:cycleId/issues/:issueId` | Remove issue from cycle |

### 6.8 Modules
| Method | Path | Description |
|---|---|---|
| GET | `/.../projects/:projectId/modules` | List modules |
| POST | `/.../projects/:projectId/modules` | Create module |
| GET | `/.../modules/:moduleId` | Module detail (+ progress) |
| PATCH | `/.../modules/:moduleId` | Update |
| DELETE | `/.../modules/:moduleId` | Delete |
| POST | `/.../modules/:moduleId/issues` | Add issues |
| DELETE | `/.../modules/:moduleId/issues/:issueId` | Remove issue |

### 6.9 Comments
| Method | Path | Description |
|---|---|---|
| GET | `/.../issues/:issueId/comments` | List comments |
| POST | `/.../issues/:issueId/comments` | Add comment |
| PATCH | `/.../comments/:commentId` | Edit own comment |
| DELETE | `/.../comments/:commentId` | Delete own comment (or admin) |

### 6.10 Attachments
| Method | Path | Description |
|---|---|---|
| POST | `/.../issues/:issueId/attachments` | Request upload URL / upload file |
| GET | `/.../issues/:issueId/attachments` | List attachments |
| DELETE | `/.../attachments/:attachmentId` | Delete |

### 6.11 Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/workspaces/:slug/notifications` | List (filter by read/unread) |
| POST | `/.../notifications/:id/read` | Mark read |
| POST | `/.../notifications/read-all` | Mark all read |

---

## 7. Filtering, Sorting, Pagination, Search

The issue list is the most-used endpoint and must support flexible querying via structured query parameters (no custom query language).

**Filtering** (combinable, AND semantics):
- `state[]`, `priority[]`, `assignee[]`, `label[]`, `cycle`, `module`, `parent`, `created_by`
- Date ranges: `due_before`, `due_after`, `created_after`, etc.
- `search` — free-text match on title/description.

**Sorting:** `sort_by` (`created_at` | `updated_at` | `priority` | `due_date` | `sort_order`) + `order` (`asc` | `desc`).

**Pagination:** cursor-based by default (`cursor`, `limit`) for stable infinite scroll; offset (`page`, `per_page`) optionally supported. Responses include pagination metadata (`next_cursor`, `total` where feasible).

**Grouping (optional, for board views):** `group_by` (`state` | `priority` | `assignee`) returns issues bucketed for column rendering.

---

## 8. Non-Functional Requirements

**Security**
- Passwords hashed with argon2 (or bcrypt, cost-tuned). Never stored or logged in plaintext.
- JWT: short-lived access token (~15 min) + longer refresh token (rotating, revocable on logout).
- All input validated against schemas (Zod/Fastify) before reaching services.
- Authorization enforced server-side on every workspace/project resource.
- Rate limiting (`@fastify/rate-limit`) on auth and write endpoints.
- CORS configured per environment; security headers via `@fastify/helmet`.
- No secrets in code — environment variables, validated at boot.

**Performance**
- Indexes on all foreign keys and common filter columns (`workspace_id`, `project_id`, `state_id`, `assignee`, `due_date`).
- Avoid N+1 via Prisma `include`/`select` and batched queries.
- Cursor pagination on large lists; hard cap on `limit`.

**Reliability & Errors**
- Consistent error envelope: `{ "error": { "code", "message", "details" } }`.
- Centralized error handler maps known errors to HTTP codes; unknown errors → `500` with a request ID, full detail logged not leaked.

**Observability**
- Structured logging (pino) with request IDs.
- Health endpoint `GET /health` (liveness/readiness).

**Quality**
- Unit tests for services (business rules, permissions) and integration tests for key endpoints. Target meaningful coverage on auth and issue logic, not a vanity percentage.
- Linting + formatting (ESLint + Prettier) enforced in CI.

**API versioning & docs**
- Versioned base path `/api/v1`.
- OpenAPI spec auto-generated from route schemas, served at `/docs`.

---

## 9. Roadmap (Phased Delivery)

**Phase 0 — Foundations**
Repo, TypeScript + Fastify skeleton, Prisma + Postgres via docker-compose, config/env validation, base plugins (logging, error handler, swagger), CI.

**Phase 1 — MVP Core (launchable)**
Auth (register/login/refresh/me), Workspaces + members, Projects + default states, Issues CRUD (state, priority, assignees, dates, sub-issues), Labels, Comments, basic issue list filtering/pagination.

**Phase 2 — Agile machinery**
Cycles, Modules, issue relations/links, full filtering + sorting + grouping, Activity log.

**Phase 3 — Collaboration & polish**
Attachments (object storage), Notifications, email-based invites, saved/shared views, OAuth login.

**Phase 4 — Pre-launch hardening**
Rate limiting, security pass, performance/index review, OpenAPI docs completeness, seed data, deployment config.

---

## 10. Definition of Done (MVP)
- All Phase 1 endpoints implemented, validated, and authorized.
- Multi-tenant isolation verified by tests (no cross-workspace data access).
- OpenAPI docs live and accurate.
- Core flows covered by integration tests.
- One-command local startup (`docker-compose up`) and a documented deploy path.

---

## 11. Out of Scope / Future Considerations
- Real-time updates (WebSocket/SSE) for live boards.
- Integrations: GitHub/GitLab, Slack, webhooks.
- A query language (JQL-style) if power users demand it.
- Custom fields per project.
- Automations / workflow rules engine.
- Billing & subscription tiers.
- Analytics & reporting dashboards.
- Full-text search engine (e.g. Postgres FTS → later Meilisearch/Elastic).

---

## 12. Open Questions
1. **Label scope** — workspace-level (shared across projects) or project-level? Plane uses project-level; workspace-level is simpler for small teams. *Recommendation: project-level.*
2. **Rich text** — store issue/comment bodies as markdown text, or structured JSON (e.g. ProseMirror/Tiptap doc)? Affects the future editor. *Recommendation: markdown text for MVP.*
3. **Invites** — require email sending (SMTP/provider) in Phase 1, or invite-by-adding-existing-users only until Phase 3? *Recommendation: defer email to Phase 3.*
4. **Sub-issue depth** — unlimited nesting or single-level (parent → children only)? *Recommendation: single level for MVP.*
5. **Soft vs hard delete** — which entities are recoverable (issues, comments) vs permanently deleted?
