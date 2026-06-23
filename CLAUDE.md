# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is a **pre-implementation** project. The only file currently present is `TZ-task-management-backend.md`, a technical specification. No code has been written yet.

## What We're Building

A Plane/Jira-inspired task management REST API. Multi-tenant (workspace-scoped), clean and lightweight — not a feature-complete Jira clone.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js LTS + TypeScript |
| Framework | Fastify |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod (+ Fastify JSON schemas) |
| Auth | JWT access (~15 min) + rotating refresh tokens |
| Password | argon2 |
| Logging | pino |
| API docs | `@fastify/swagger` (OpenAPI at `/docs`) |
| Testing | Vitest + Supertest |
| Container | Docker + docker-compose |

## Commands (once scaffold exists)

```bash
docker-compose up          # start Postgres + app
npm run dev                # watch mode
npm run build              # tsc compile
npm run test               # vitest
npm run test -- path/to/file.test.ts  # single test file
npm run lint               # ESLint + Prettier check
npx prisma migrate dev     # apply migrations
npx prisma generate        # regenerate Prisma client after schema changes
npx prisma db seed         # seed initial data
```

## Project Structure

```
src/
  app.ts                 # Fastify instance + plugin registration
  server.ts              # bootstrap / listen
  config/                # env parsing, constants (validated at boot)
  plugins/               # auth hook, error-handler, rate-limit, swagger
  modules/
    auth/                # routes.ts, controller.ts, service.ts, schema.ts
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
  lib/                   # jwt helpers, password hashing, pagination
  prisma/                # schema.prisma, migrations/, seed.ts
tests/
```

Each feature module is self-contained: `routes.ts` → `controller.ts` → `service.ts` → Prisma. Business logic lives exclusively in services.

## Architecture Rules

**Layering:** Routes declare paths/schemas → Controllers parse input and shape responses (no business logic) → Services enforce business rules and permissions → Prisma for all data access. Services are the single source of truth for authorization — never authorize only at the route.

**Multi-tenancy:** Single DB, shared schema, `workspace_id` on every tenant-owned row. Every workspace-scoped request resolves membership before any handler runs (Fastify hook/plugin).

**Auth flow:** JWT access token in `Authorization: Bearer` header. Refresh token endpoint rotates tokens and revokes on logout.

## Key Data Model Decisions

- `Issue.sequence_id` — per-project running number forming the human-readable key (e.g. `MOB-123`).
- `State.group` — one of `backlog | unstarted | started | completed | cancelled` — enables progress % without a rules engine.
- `Issue.parent_id` — self-reference for sub-issues; **single level only** (no deep nesting in MVP).
- Labels are **project-scoped** (not workspace-level).
- Issue/comment bodies stored as **markdown text** (not structured JSON).
- Email invites deferred to Phase 3 — MVP uses add-existing-user only.

## API Conventions

- Base path: `/api/v1`
- Workspace resources: `/api/v1/workspaces/:workspaceSlug/...`
- Error envelope: `{ "error": { "code", "message", "details" } }`
- Pagination: cursor-based by default (`cursor` + `limit`); offset optional.
- Issue filtering: combinable query params (`state[]`, `priority[]`, `assignee[]`, `label[]`, `due_before`, `due_after`, `search`), AND semantics.
- Health check: `GET /health`

## Phased Delivery

- **Phase 0** — Repo scaffold, Fastify skeleton, Prisma + Postgres, base plugins, CI.
- **Phase 1 (MVP)** — Auth, Workspaces + members, Projects + default states, Issues CRUD, Labels, Comments, basic filtering/pagination.
- **Phase 2** — Cycles, Modules, issue relations, full filtering/grouping, Activity log.
- **Phase 3** — Attachments (object storage), Notifications, email invites, OAuth.
- **Phase 4** — Rate limiting, security hardening, index review, docs completeness, deploy config.

## Security Requirements

- Validate all input via Zod/Fastify schemas before it reaches services.
- Rate-limit auth and write endpoints (`@fastify/rate-limit`).
- CORS per environment; security headers via `@fastify/helmet`.
- No secrets in code — env vars only, validated at startup.
- Passwords never logged or returned in responses.
