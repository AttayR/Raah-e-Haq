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

## Quality gate (ratchet)

`scripts/quality-gate.js` compares TypeScript errors, ESLint errors and warnings, and Jest status against `.quality/baseline.json`.

- A change may never raise any number. Once Jest passes, it must keep passing.
- After a verified fix, run `yarn verify:update` so the baseline drops and the gain is locked in. Commit `.quality/baseline.json` with the fix.
- Never edit `.quality/baseline.json` by hand, never add `// @ts-ignore`, `eslint-disable` or `any` just to make numbers drop. The reviewer agent rejects this.

## Workflow (agents)

Work goes through `/fix-next` (see `.claude/skills/fix-next/SKILL.md`):

1. **rh-implementer** makes the change for exactly one task.
2. **rh-reviewer** independently checks the diff, the acceptance criteria and the gate. It does not edit code.
3. **rh-qa** drives the app in the iOS Simulator for tasks marked `QA: yes` and records evidence.
4. The orchestrator (the main session) commits only after the reviewer and QA have passed, then updates `docs/TASKS.md`.

One task = one commit on branch `fix/production-hardening`. Commit message: `fix(T-012): <summary>` (or `feat`, `refactor`, `test`, `chore`), with the Co-Authored-By trailer. Never push, open a PR, rebase or force anything without the owner asking.

## PRODUCTION SAFETY (non-negotiable)

The owner chose to test against the **production** backend. Real passengers and drivers use it.

- **Only test accounts.** Use only the accounts listed in `docs/QA_SCENARIOS.md`, under "Test accounts". If that list is empty, stop and ask the owner.
- **Claude never types passwords or OTP codes and never creates accounts.** The owner signs in on the simulator manually. The session persists through redux-persist, and QA continues from there.
- **Never touch real users' data.** Never accept, cancel, rate or message a ride that a test account did not create. A driver test account must not go online in an area where real passengers could match. Coordinate the passenger and driver test accounts so they match each other.
- **Clean up.** Every ride created during QA is cancelled or completed before the QA run ends. Record its ID in the QA report.
- **No load.** No scripted request loops, no load tests, no polling faster than the app itself does.
- **No destructive API calls** (DELETE endpoints, profile wipes) outside the test accounts.
- When unsure whether an action could reach a real user, stop and ask.

## Code conventions (target state; apply to code you touch)

- TypeScript strict. No new `any`; type API responses in `src/services/api` types.
- All HTTP through the shared axios client in `src/services/api.ts`. No raw `fetch` to the backend, no hardcoded base URLs. Configuration comes from the env config once task T-0xx lands (see TASKS).
- No `console.log` in new code; use the logger once it exists. Never log tokens, phone numbers, CNIC or full user objects.
- Colours, spacing and typography come from `src/theme`. No hardcoded hex colours in screens.
- Every async UI path has loading, error and empty states.
- Every `setInterval`, listener, WebSocket and geolocation watcher is cleaned up on unmount.
- Keep screens under ~400 lines. Extract components and hooks when touching a large screen.
- Every bug fix adds or updates a test when the code is testable (`__tests__/` or next to the file as `*.test.ts(x)`).
- Do not delete a file without first verifying (with grep) that nothing imports it.

## Secrets

The Google Maps key and Firebase configs are committed today (see AUDIT `INF-*`). Don't add more secrets. Don't print keys in reports. Key rotation and restriction are the owner's job (Google Cloud console). Agents only prepare the code.
