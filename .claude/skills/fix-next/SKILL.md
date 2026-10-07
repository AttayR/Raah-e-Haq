---
name: fix-next
description: Run the Raah-e-Haq fix loop for the next task (or a given task ID or phase). It picks the task from docs/TASKS.md, has rh-implementer build it, rh-reviewer verify it, rh-qa test it in the simulator when needed, then commits and updates the tracker. Use when the user says "fix next", "continue fixing", "/fix-next T-012" or "/fix-next phase 1".
---

# /fix-next: implement → verify → test → commit

Arguments (optional):
- *(none)*: the next eligible task
- `T-012`: that task
- `phase 1`: keep going through phase 1 until it is done or a task is blocked
- `--no-qa`: skip the simulator step, and mark the task `verified-no-qa` instead of `done`

You are the orchestrator. You do not write app code yourself. You pick the task, delegate, judge the reports, commit and update the tracker.

## 0. Preconditions
- `git branch --show-current` must be `fix/production-hardening`. If not, stop and ask.
- `git status --short` must be clean, apart from untracked files under `docs/qa-reports/`. If there are leftover changes, show them to the user and ask whether to discard or keep them. Never discard silently.
- Read `CLAUDE.md`, `docs/FIX_PLAN.md` and `docs/TASKS.md`.

## 1. Pick the task
- The eligible task is the first row in `docs/TASKS.md` with status `todo` where every ID in **Depends** is `done` or `verified-no-qa`. Phases go in order: never start Phase N+1 while Phase N has `todo` tasks, unless the user names the task.
- Tasks marked `Owner: owner` (backend or console work) are not for agents. Skip them and list them for the user at the end.
- Set the task's status to `in-progress` in `docs/TASKS.md`. Don't commit that change on its own.
- Tell the user in one line which task you are starting.

## 2. Implement
Launch the **rh-implementer** agent with:
> Task: T-xxx. Follow your procedure. Branch fix/production-hardening.

On a retry, also pass the reviewer's ISSUES list verbatim.

If the report says `BLOCKED`:
1. Set the status to `blocked` with the reason in the Notes column.
2. Revert only that task's file changes. Show the user the diff first, then use `git restore` on those files and `git clean` only on files the implementer created.
3. Move on, or stop if the user asked for that task specifically.

## 3. Verify (independent)
Launch the **rh-reviewer** agent with the task ID and the implementer's full report.
- **PASS:** go to step 4.
- **FAIL:** send the ISSUES back to rh-implementer (as a retry). Allow at most **2 retries**. After that, set the status to `blocked` with the reviewer's top issue, show the user the diff and the issues, and ask whether to keep or revert.

Also run `yarn verify` yourself as a final check. Don't trust either report blindly.

## 4. QA (when the task's QA column is `yes` and `--no-qa` isn't given)
- Make sure a test account is signed in on the simulator. `docs/QA_SCENARIOS.md` lists the accounts. If none is signed in, ask the user to sign in, and wait. **Never type credentials or OTPs.**
- Launch the **rh-qa** agent with the task ID, the scenario IDs from the task row, and the implementer's NOTES FOR QA.
- **FAIL caused by this task:** treat it like a reviewer FAIL (counts toward the retry limit).
- **FAIL from something unrelated** (a known open finding): record it in the task Notes. It doesn't block.
- **BLOCKED** (no account or simulator): mark the task `verified-no-qa`, note why, and tell the user.

## 5. Commit
1. `yarn verify:update` to lower the baseline.
2. Set the task status to `done` (or `verified-no-qa`) in `docs/TASKS.md`, with the date and the short commit hash once known, plus any notes.
3. Stage only the task's files, `.quality/baseline.json`, `docs/TASKS.md`, and the QA report folder if one was created. Never `git add -A`.
4. Commit:

```
<type>(T-xxx): <task title, lower case>

<2-4 lines: what changed and why; findings fixed: AUTH-01, ...>

Verified: reviewer PASS, gate TS <n>→<m>, ESLint <a>→<b>, Jest <status>; QA <PASS|n/a>
```

5. Never push. Never open a PR unless the user asks.

## 6. Report to the user (short; Roman Urdu is fine if the user writes that way)
- Task done, plus the commit hash
- What changed (2-3 bullets)
- Gate numbers before and after
- QA result, and screenshot paths if any
- New bugs found, which you add to `docs/TASKS.md` as new `todo` rows (next free ID, correct phase) and as findings in the matching `docs/audit/*.md`
- What's next

In `phase N` mode, loop back to step 1 until the phase is done, a task is blocked, or the user interrupts. Give a one-line update after each task.
