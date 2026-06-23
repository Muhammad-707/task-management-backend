---
description: Resume the build — read roadmap + last session, report status, work the next task.
---

You are resuming work on the Task Management Backend. Do the following **in order**:

1. **Read `ROADMAP.md`** (project root). Focus on the **Current Status** block and the first
   unchecked `- [ ]` task. Also read the **Resolved Decisions** section — treat those as
   settled; do not re-open them.

2. **Read the most recent session log** in `.claude/sessions/`. Session files are named by
   sortable timestamp (`YYYY-MM-DD-HHMM.md`), so the lexicographically **last** file is the
   latest. If the directory has no logs yet (only `.gitkeep`), note that this is the first
   working session. Also: if `handoff.md` exists in the project root (written by the global
   80%-context handoff rule), read it and fold its **Next Step** into your plan.

3. **Consult the spec as needed** — read `TZ-task-management-backend.md` for requirements and
   `CLAUDE.md` for the architecture rules (layering, multi-tenancy, auth flow, security).
   Don't re-read the whole TZ if the task is narrow; read the relevant sections.

4. **Report to the user** before writing code — a short status:
   - Current phase
   - What is already complete (recent checked items / what the last session finished)
   - The specific next task(s) you're about to work on

5. **Begin implementing** the next unchecked task. Follow `CLAUDE.md` strictly: routes →
   controllers (no business logic) → services (business rules + authorization, the single
   source of truth) → Prisma. Validate all input via Zod/Fastify schemas. Keep each feature a
   self-contained module (`routes.ts`, `controller.ts`, `service.ts`, `schema.ts`).

When you finish a chunk of work (or the user says to stop), they will run `/stop` to
checkpoint progress — you don't need to update the roadmap or session log here.

$ARGUMENTS
