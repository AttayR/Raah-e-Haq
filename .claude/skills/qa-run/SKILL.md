---
name: qa-run
description: Run end-to-end QA scenarios for Raah-e-Haq in the iOS Simulator via the rh-qa agent. Use for a smoke test, a full regression, or specific scenarios, e.g. "/qa-run smoke", "/qa-run PAX-E2E-01", "/qa-run all".
---

# /qa-run

Arguments:
- `smoke` (default): the scenarios tagged `smoke` in `docs/QA_SCENARIOS.md`
- `all`: every scenario
- one or more scenario IDs: just those

## Steps
1. Read `docs/QA_SCENARIOS.md`. Confirm the "Test accounts" section is filled in. If it isn't, stop and ask the owner to add the test accounts and sign one in on the simulator.
2. Tell the user that QA uses the **production** backend, list the scenarios, and say which ones create server data (rides). Ask once for a go-ahead if any scenario creates rides. A smoke run that only reads data needs no confirmation.
3. Launch the **rh-qa** agent with the scenario list and today's date as the run name, e.g. `2026-10-03-smoke`.
4. When it returns:
   - Summarise PASS/FAIL per scenario for the user.
   - Confirm that every ride it created was cleaned up. If one wasn't, tell the user right away, with the ride ID.
   - For each new bug, add a finding to the matching `docs/audit/*.md` (next free ID) and a `todo` row to `docs/TASKS.md`. Don't commit unless the user asks. QA reports can be committed with the next task.
5. Point the user to `docs/qa-reports/<run>/REPORT.md`.
