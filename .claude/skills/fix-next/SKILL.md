---
name: fix-next
description: Run the Raah-e-Haq fix loop for one task (the next eligible one, a given task ID, or a whole phase). Routes the task to the right builder (rh-implementer for T-, rh-backend for BE-, rh-designer for UI-), then rh-reviewer and rh-security verify it, rh-debugger handles failures, rh-qa tests it in the simulator against the local backend, then it commits and updates the tracker. Use when the user says "fix next", "continue fixing", "/fix-next T-012" or "/fix-next phase 1".
---

# /fix-next: build → verify → secure → test → commit

Arguments (optional):
- *(none)*: the next eligible task
- `T-012` / `BE-03` / `UI-04`: that task
- `phase 1`: keep going through phase 1 until it is done or every remaining task is blocked
- `--no-qa`: skip the simulator step, and mark the task `verified-no-qa` instead of `done`

You are the orchestrator. You do not write app or backend code yourself. You pick the task, delegate, judge the reports, commit and update the tracker. **You run autonomously** under the owner decisions in `CLAUDE.md`: don't ask the owner for anything those decisions already cover. Record owner-only items in the tracker and keep going.

## 0. Preconditions
- Read `CLAUDE.md`, `docs/FIX_PLAN.md` and `docs/TASKS.md`.
- **Branch.** App repo: be on the current phase branch (see CLAUDE.md "Branches"). If the task is in a phase whose branch doesn't exist yet, create it from the latest phase branch (`git switch -c fix/phase-N-<name>`). Backend repo: `fix/production-hardening` (create from `main` if missing). Never work on `main`/`master`.
- **Clean tree.** `git status --short` must be clean in the repo(s) the task touches, apart from untracked files under `docs/qa-reports/`. If there are leftover changes from an interrupted run of the same task, hand them to the builder as a starting point. If they're unrelated, commit them only if they are clearly finished work with a passing gate; otherwise `git stash push -u -m "orphan-<date>"`, note the stash in the tracker, and continue. Never discard work.
- **Local backend up** (for QA and BE tasks): `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/` → 200, else start it in the background (command in CLAUDE.md).

## 1. Pick the task
- The eligible task is the first row in `docs/TASKS.md` with status `todo` where every ID in **Depends** is `done` or `verified-no-qa`. Phases go in order. Inside a phase, a `BE-…` task that an app task depends on goes first.
- `Owner: owner` tasks are not for agents. Skip them, and make sure the final report lists them.
- Set the task's status to `in-progress` in `docs/TASKS.md` (don't commit that change on its own).
- One line to the user: which task you're starting.

## 2. Build
Route by prefix:
- `T-…` → **rh-implementer** · `BE-…` → **rh-backend** · `UI-…` (or a task whose title says design/redesign/theme) → **rh-designer**

Prompt: `Task: <ID>. Follow your procedure.` plus, on a retry, the ISSUES lists from the reviewer/security/QA verbatim.

If the builder reports `BLOCKED`:
- Needs a dependency that doesn't exist yet (e.g. an endpoint): create the missing task (next free ID, same phase, Owner `agent`), make the blocked task depend on it, revert the partial change (`git stash push -u -m "<ID>-partial"` and note it), and continue with the new task.
- Needs the owner (console, hosting, keys, money, product decision not in CLAUDE.md): set `blocked`, put the reason in Notes, stash the partial change, move on.

## 3. Verify (independent, in this order)
1. **rh-reviewer** with the task ID and the builder's full report. For BE tasks, tell it the repo is `~/My-Projects/Raah-e-Haq-backend` and to run `php artisan test` there.
2. **rh-security** in `diff <ID>` mode with the builder's report.
3. Run the gate yourself: `yarn verify` (app) and/or `php artisan test` (backend). Don't trust any report blindly.

On any FAIL: send the combined ISSUES back to the builder (retry 1). If it fails again, give the failure evidence to **rh-debugger** (retry 2). If it still fails, set `blocked` with the top issue, stash the change (`<ID>-failed`), and move on.

## 4. QA (when the task's QA column is `yes` and `--no-qa` isn't given)
- Launch **rh-qa** with the task ID, the scenario IDs, the builder's NOTES FOR QA, and the run name `<date>-<ID>`. It signs in with local test accounts itself.
- **FAIL caused by this task:** treat it like a reviewer FAIL (counts toward the retry limit; the debugger gets the QA report and screenshots).
- **FAIL from something unrelated:** add it as a new bug task (step 6) and don't block.
- **BLOCKED** (simulator unavailable, build broken by environment): try once to fix the environment (restart Metro/backend, rebuild). If still blocked, mark `verified-no-qa` and note why.
- If the QA agent couldn't write its report file, save its returned report as `docs/qa-reports/<run>/REPORT.md` yourself.

## 5. Commit
1. App: `yarn verify:update` to lower the baseline.
2. Set the task status to `done` (or `verified-no-qa`) in `docs/TASKS.md`, with the date and notes.
3. Stage only the task's files, `.quality/baseline.json`, `docs/TASKS.md`, and the QA report folder. Never `git add -A`. Never stage `.env.development`, `.env.production`, `.env` or anything with secrets.
4. Commit (no `Co-Authored-By`, no mention of Claude or AI):

```
<type>(<ID>): <task title, lower case>

<2-4 lines: what changed and why; findings fixed: AUTH-01, ...>

Verified: reviewer PASS, security PASS, gate TS <n>→<m>, ESLint <a>→<b>, Jest <status>; QA <PASS|n/a>
```

5. Put the short hash in the task's Notes. Because amending changes the hash, record it in the **next** commit's tracker update (or a final `chore(tracker)` commit at the end of the run), never by amending.
6. BE tasks commit in the backend repo; the tracker update commits in the app repo.

## 6. New bugs
For each new bug from any agent: add a finding to the matching `docs/audit/*.md` (next free ID) and a `todo` row plus a task section with acceptance criteria to `docs/TASKS.md` (next free ID, correct phase, Owner `agent` unless it truly needs the owner).

## 7. Report (short; Roman Urdu when the user writes that way)
- Task done, commit hash, branch
- What changed (2–3 bullets)
- Gate numbers before and after
- QA result and screenshot paths
- New tasks added, tasks blocked and why
- What's next

In `phase N` mode, loop back to step 1 until the phase is done or only blocked/owner tasks remain. Give a one-line update after each task.
