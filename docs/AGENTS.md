# The Agent System

The fix programme is run by Claude Code using three project agents and two skills, all committed in `.claude/`.

## Pieces

| Piece | File | Role | Can edit code? |
|---|---|---|---|
| Project rules | `CLAUDE.md` | Commands, conventions, **production-safety rules**. Every session and agent reads it. | n/a |
| `rh-implementer` | `.claude/agents/rh-implementer.md` | Implements exactly one task from TASKS.md, with tests; must pass the gate | Yes |
| `rh-reviewer` | `.claude/agents/rh-reviewer.md` | Independent verifier: diff vs acceptance criteria, regression hunt, shortcut detection, gate. PASS or FAIL | **No** (read-only tools) |
| `rh-qa` | `.claude/agents/rh-qa.md` | Builds and drives the app in the iOS Simulator, follows QA_SCENARIOS, screenshots, report | No (writes only under `docs/qa-reports/`) |
| `/fix-next` | `.claude/skills/fix-next/SKILL.md` | Orchestrator: pick task → implement → review (up to 2 retries) → QA → commit → update tracker | (via agents) |
| `/qa-run` | `.claude/skills/qa-run/SKILL.md` | Smoke or regression QA runs | No |
| Quality gate | `scripts/quality-gate.js`, `.quality/baseline.json` | Ratchet on TS errors, ESLint, Jest (+ bundle after T-001). Numbers may only go down | n/a |

## Typical commands (in Claude Code, from this repo)

```
/fix-next              # next eligible task
/fix-next T-007        # a specific task
/fix-next phase 0      # run the whole of Phase 0, one commit per task
/fix-next --no-qa      # skip simulator QA (task marked verified-no-qa)
/qa-run smoke          # read-only smoke test in the simulator
/qa-run E2E-01         # full two-simulator ride (creates data, asks first)
yarn verify            # run the gate yourself
```

## Why this is trustworthy

1. **Separation of duties.** The agent that writes code never approves it. The reviewer has no edit tools and must cite file:line evidence for every acceptance criterion.
2. **Ratchet.** `yarn verify` fails if any number gets worse. Hiding errors (`@ts-ignore`, `eslint-disable`, `as any`, deleting tests, editing the baseline) means an automatic reviewer FAIL.
3. **Evidence.** Each commit message records the reviewer verdict, the gate numbers before and after, and the QA result. QA screenshots are kept in `docs/qa-reports/`.
4. **Small steps.** One task per commit on `fix/production-hardening`. Any task can be reverted on its own.
5. **Production safety.** Test accounts only. No credentials typed by agents. Cleanup of every ride created. No touching real users' rides.

## What the owner needs to do

- **B-07 first:** create one passenger and one driver test account, put their identifiers in `docs/QA_SCENARIOS.md`, and sign them in on two simulators when QA asks.
- Work through the other `B-*` items in `docs/TASKS.md` (backend, keys, signing, product decisions) as their phases come up.
- Review commits. Push and open PRs when you're happy. Agents never push.

---

## Roman Urdu: short guide

- **Kya hai:** teen agents hain. **Implementer** code fix karta hai. **Reviewer** alag se check karta hai aur code ko haath nahi lagata. **QA** simulator mein app chala kar test karta hai.
- **Kaise chalayein:** Claude Code mein `/fix-next` likhein, agla task ho jayega. Poora phase ek saath chalana ho to `/fix-next phase 0` likhein.
- **Guarantee:** har commit se pehle `yarn verify` chalta hai. Errors barhe to commit nahi hoga. Har task ka alag commit hota hai, aur push sirf aapke kehne par hoga.
- **Production safety:** sirf test accounts use honge. Agent kabhi password ya OTP type nahi karega, login aap khud karenge. Testing mein jo bhi ride bane wo cancel ya complete karna zaroori hai.
- **Aapka kaam:** sab se pehle B-07 karein: ek passenger aur ek driver test account banayein aur `docs/QA_SCENARIOS.md` mein likh dein. Baaki `B-*` items (backend, keys, signing) apne phase par chahiye honge.
