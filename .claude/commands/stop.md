---
description: Checkpoint the session — update roadmap, write a session log, commit.
---

You are ending a work session on the Task Management Backend. Checkpoint everything so the
next `/start` can resume cleanly. Do the following **in order**:

1. **Survey what changed this session.** Run `git status` and `git diff` (and `git diff --staged`)
   to see exactly what was added or modified. Base your summary on the actual diff, not memory.

2. **Update `ROADMAP.md`:**
   - Tick (`- [x]`) every task that is genuinely complete this session. Do **not** check tasks
     that are only partially done — note partial progress in the session log instead.
   - Refresh the **Current Status** block: set `Last Session` to today's date, set
     `Current Phase` if it advanced, and set `Next Task` to the first still-unchecked item.

3. **Write a session log** to `.claude/sessions/YYYY-MM-DD-HHMM.md` (use the current local date
   and time so it sorts last). Use exactly these sections:

   ```markdown
   # Session — YYYY-MM-DD HH:MM

   ## Goal
   What this session set out to do.

   ## Done This Session
   What actually got completed (one bullet per item; reference files).

   ## Decisions Made
   Any choices made that aren't already in ROADMAP.md / CLAUDE.md, and why.

   ## Files in Flight
   Files partially done or left mid-change (path + one-line status). Empty if none.

   ## Failed Attempts
   What was tried and didn't work, so the next session avoids repeating it. Empty if none.

   ## Next Step
   The single, specific next action for the next session.
   ```

4. **Commit.** Stage everything and commit:
   - `git add -A`
   - Commit with a concise one-line summary of the session's work, ending the message with:
     ```
     Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
     ```
   - If this is not yet a git repo, run `git init` first. Do not push unless asked.

5. **Tell the user** the session is saved: a one-line recap of what was committed and what the
   recorded **Next Step** is for next time.

$ARGUMENTS
