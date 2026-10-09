# Raah-e-Haq: project rules for Claude

Ride-hailing app for Pakistan (passenger + driver), React Native 0.80 bare app (iOS + Android), TypeScript, Redux Toolkit, React Navigation 7, Firebase, Google Maps. Backend: Laravel REST API at `https://raahehaq.com/api` plus WebSockets at `wss://raahehaq.com/ws/...`.

The app is being taken from prototype to production through a tracked fix programme. Start every session by reading:

1. `docs/FIX_PLAN.md`: phases and the order of work
2. `docs/TASKS.md`: the task tracker (source of truth for what is done or next)
3. `docs/AUDIT.md` (summary) and `docs/audit/*.md`: the findings each task refers to (IDs like `AUTH-03`, `PAX-12`)
4. `docs/QA_SCENARIOS.md`: test accounts and scenarios (before any simulator testing)

## Commands

| What | Command |
|---|---|
| Install | `yarn install` (yarn only; never npm, never commit `package-lock.json` changes) |
| iOS pods | `cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec pod install` |
| Metro | `yarn start` |
| Run iOS | `yarn ios` |
| Type check | `yarn typecheck` |
| Lint | `yarn lint` |
| Unit tests | `yarn test` |
| **Quality gate** | `yarn verify` (must PASS before any commit) |
| Lower the baseline after a fix | `yarn verify:update` |
| Backend server (local) | `cd ~/My-Projects/Raah-e-Haq-backend && /opt/homebrew/opt/php@8.3/bin/php artisan serve` |
| Backend tests | `cd ~/My-Projects/Raah-e-Haq-backend && /opt/homebrew/opt/php@8.3/bin/php artisan test` |
| Backend reset local DB | `… php artisan migrate:fresh --seed` (local only) |

## Quality gate (ratchet)

`scripts/quality-gate.js` compares TypeScript errors, ESLint errors and warnings, and Jest status against `.quality/baseline.json`.

- A change may never raise any number. Once Jest passes, it must keep passing.
- After a verified fix, run `yarn verify:update` so the baseline drops and the gain is locked in. Commit `.quality/baseline.json` with the fix.
- Never edit `.quality/baseline.json` by hand, never add `// @ts-ignore`, `eslint-disable` or `any` just to make numbers drop. The reviewer agent rejects this.

## Owner decisions (2026-10-08) — agents act on these without asking again

- **Autonomy.** The owner is away and wants the app taken to production level end to end: every screen and feature working with real (dynamic) data, mature consistent design, security handled. Agents implement, test, verify, debug and fix on their own. Stop and ask only for the items under "Still needs the owner" below.
- **We own the backend now.** The Laravel backend lives at `~/My-Projects/Raah-e-Haq-backend` (GitHub `Mubashir-Majeed/Raah-e-haq`). Backend tasks are `BE-xx` in `docs/TASKS.md`, done by **rh-backend**.
- **Product defaults (B-08):** payments are **cash only** for now (wallet shows balance/history, no top-up flow); **in-ride chat** between passenger and driver; location is **foreground only** (app open or ride active), no background location.
- **Branches and pushing.** Work happens on separate branches (see "Branches"); never commit directly on `main`/`master`. Owner decision 2026-10-09: keep `main` up to date by fast-forwarding it to the latest verified phase branch (app: `git push origin <phase-branch>:main`; backend: `git branch -f main fix/production-hardening` then push). Never force-push, never open or merge a PR, never delete remote branches.
- **Backend remote (2026-10-09).** The backend now lives in the owner's own private repo `AttayR/Raah-e-Haq-backend`, git remote `mine` (`origin` stays the read-only Mubashir-Majeed repo). Push `main` and `fix/production-hardening` to `mine`. B-14 is resolved this way.
- **Commits.** Commit message: `fix(T-012): <summary>` (or `feat`, `refactor`, `test`, `chore`, `style`). **No `Co-Authored-By` trailer and no mention of Claude or AI in any commit message.**
- **Still needs the owner:** anything on Hostinger/hPanel or a server, Google Cloud/Firebase consoles (key rotation), Apple/Google store accounts and signing keys, real payment gateways, spending money, and anything touching production data or real users.

## Branches

- App repo: `fix/production-hardening` holds Phase 0 work done so far. Each later phase gets its own branch cut from the previous phase branch: `fix/phase-1-auth`, `fix/phase-2-onboarding`, … (names from `docs/FIX_PLAN.md`). One task = one commit on the current phase branch.
- Backend repo: `fix/production-hardening` cut from `main`; same one-task-one-commit rule.
- At the end of a phase (all tasks `done`/`verified-no-qa`/`blocked`), push that phase branch with `git push -u origin <branch>` (never `--force`).

## Workflow (agents)

`/autopilot` drives everything (`.claude/skills/autopilot/SKILL.md`); `/fix-next` runs one task (`.claude/skills/fix-next/SKILL.md`).

| Agent | Role | Edits code? |
|---|---|---|
| **rh-auditor** | Maps every screen/action to real data and backend routes; turns MOCK/BROKEN/MISSING items into tasks | No (docs only) |
| **rh-implementer** | Implements one app task (`T-…`) with tests | Yes (app) |
| **rh-backend** | Implements one backend task (`BE-…`) with feature tests | Yes (backend) |
| **rh-design-director** | Pixel-by-pixel revamp of passenger + driver UI: audits every screen, writes the design system and per-screen specs in `docs/design/`, creates UI tasks, and is the design QA gate for each one | No (docs/specs only) |
| **rh-designer** | Implements design tasks (tokens, UI kit, screen redesigns) to the director's spec | Yes (app UI) |
| **rh-debugger** | Root-causes failures, fixes with a regression test | Yes |
| **rh-reviewer** | Independent PASS/FAIL on the diff, criteria and gate | No |
| **rh-security** | Security PASS/FAIL on every diff; phase/area audits | No (docs only) |
| **rh-qa** | Drives the app in the iOS Simulator against the local backend, screenshots, report | No (reports only) |

The orchestrator (main session) commits only after reviewer, security and (when required) QA pass, then updates `docs/TASKS.md`.

## QA and backend safety (non-negotiable)

**Default target is the LOCAL backend** (`http://localhost:8000`, Debug build, `.env.development`). It holds only fake seeded data.

- **Local backend:** agents may sign in on the simulator with the seeded local test accounts listed in `docs/QA_SCENARIOS.md` → "Local test accounts" (owner approved, 2026-10-08), create/accept/cancel/complete test rides, and reseed with `php artisan migrate:fresh --seed` when needed. Only do this when the Debug build points at `localhost` (check `.env.development`).
- **Production (`raahehaq.com`) — owner only.** Agents never sign in to, write to, or test against production. Never type production credentials or OTPs, never create production accounts, never touch real users' data. Read-only health checks (single requests, like `scripts/api-health.js`) are fine.
- **No load.** No scripted request loops, no load tests, no polling faster than the app itself does, against any server.
- **Never deploy.** No SSH, FTP or hPanel actions; no migrations against any remote database.
- When unsure whether an action could reach a real user, don't do it; record it for the owner.

## Code conventions (target state; apply to code you touch)

- TypeScript strict. No new `any`; type API responses in `src/services/api` types.
- All HTTP through the shared axios client in `src/services/api.ts`. No raw `fetch` to the backend, no hardcoded base URLs. Configuration comes from `src/config/env.ts` (T-005).
- No `console.log` in new code; use the logger once it exists. Never log tokens, phone numbers, CNIC or full user objects.
- Colours, spacing and typography come from `src/theme`. No hardcoded hex colours in screens.
- **Nothing user-facing is hardcoded.** Stats, lists, offers, banners, notifications, chats, prices, fares, settings and profile data come from the backend (or a documented config/i18n file for static copy). If the endpoint doesn't exist, create a `BE-…` task instead of faking data. Demo arrays and fake numbers in screens are bugs.
- Every async UI path has loading, error and empty states.
- Every `setInterval`, listener, WebSocket and geolocation watcher is cleaned up on unmount.
- Keep screens under ~400 lines. Extract components and hooks when touching a large screen.
- Every bug fix adds or updates a test when the code is testable (`__tests__/` or next to the file as `*.test.ts(x)`).
- Do not delete a file without first verifying (with grep) that nothing imports it.

## Secrets

The Google Maps key and Firebase configs are committed today (see AUDIT `INF-*`). Don't add more secrets. Don't print keys in reports. Key rotation and restriction are the owner's job (Google Cloud console). Agents only prepare the code.
