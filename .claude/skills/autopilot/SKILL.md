---
name: autopilot
description: Take Raah-e-Haq to production level end to end without the owner present. Audits feature completeness and security, plans the work into tasks, then runs every phase through /fix-next (app, backend and design tasks), runs regression QA and a security audit at each phase boundary, pushes each finished phase branch, and keeps going until only owner-only items remain. Use when the owner says "autopilot", "sab kuch done karo", "finish the app", or "/autopilot" (optionally "/autopilot phase 2" to start from a phase).
---

# /autopilot: the whole programme, unattended

You are the orchestrator for the whole programme. Owner decisions in `CLAUDE.md` are your standing permission: don't stop to ask about anything they cover. Stop only for the "Still needs the owner" items, and even then record them and continue with other work.

## 0. Setup (once per run)
1. Read `CLAUDE.md`, `docs/FIX_PLAN.md`, `docs/TASKS.md`, `docs/AGENTS.md`.
2. Keep the machine awake for the run (`request_keep_awake`, `until: "session_idle"`), if the tool is available.
3. Make sure the local backend and MySQL are up (`brew services list | grep mysql`, `curl` port 8000). Start them if not.
4. Make sure both repos are on the right branch (CLAUDE.md "Branches").

## 1. Plan (first run, or when TASKS.md hasn't been audited in the last 7 days)
Run these in parallel, then reconcile:
- **rh-auditor**: full feature-completeness audit (writes `docs/audit/FEATURES.md`, adds `T-…`/`BE-…` tasks for every MOCK/BROKEN/MISSING item).
- **rh-security** `audit all`: writes `docs/audit/SECURITY.md`, adds tasks for critical/high findings.

Then you:
- Convert agent-capable owner items to agent tasks: backend items that are code (OTP not returned, endpoints, atomic assignment, WebSocket server with Laravel Reverb, channel auth) become `BE-…` tasks with acceptance criteria. Hosting, keys, signing and store items stay `owner`.
- Add a **design track**: `UI-01` design tokens + light/dark theme, `UI-02` core component library (`src/components/ui`), then one `UI-…` task per screen group (auth, passenger home/booking, ride in progress, driver home/requests, profile/settings, wallet/history, notifications/chat), each depending on `UI-02` and on the feature tasks for that screen, so redesigns land on screens that already use real data.
- Make sure dependencies are explicit so `/fix-next` picks a valid order. Commit the planning docs: `docs(plan): feature and security audit, task plan`.

## 2. Execute phase by phase
For each phase in `docs/FIX_PLAN.md` order, starting from the first one with `todo` tasks:
1. Create or switch to the phase branch (CLAUDE.md "Branches").
2. Run the `/fix-next phase N` procedure (`.claude/skills/fix-next/SKILL.md`) until the phase has no eligible `todo` tasks left.
3. **Phase gate:**
   - Full regression: **rh-qa** on all `smoke` scenarios plus the scenarios for this phase (two simulators for end-to-end ride flows), on the local backend.
   - **rh-security** `audit` on the areas this phase touched.
   - Any new bug becomes a task in the current phase and goes back through step 2. Don't leave a phase with a failing smoke test.
4. Commit the tracker (`chore(tracker): phase N complete`) and push the phase branch: `git push -u origin <branch>` (app repo, and backend repo if it changed). Never push `main`, never force, never open a PR.
5. One short update to the user (Roman Urdu): phase, tasks done, blocked items, branch pushed.

## 3. Finish
When every phase is done or only `blocked`/`owner` tasks remain:
- Final full regression (`/qa-run all` procedure) and `rh-security audit all`.
- Write `docs/RELEASE_READINESS.md`: what works (with QA evidence), what's blocked and why, the owner checklist (hosting/SSL/deploy steps for the backend, key rotation, signing, store listings), and the exact deploy steps for the Laravel backend including Reverb.
- Commit and push the final branch(es). Report to the user.

## Rules that never relax
- Production backend and real users: never touched (CLAUDE.md safety section).
- No `Co-Authored-By` or AI mention in commits.
- The gate only ratchets down; no shortcuts (`@ts-ignore`, `eslint-disable`, `as any`, skipped tests).
- One task, one commit. Never `git add -A`. Never commit `.env*` except `.env.example`.
- If context gets long, rely on `docs/TASKS.md` as the source of truth: it must always reflect reality, so a fresh session can resume with `/autopilot`.
