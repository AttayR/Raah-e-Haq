# QA: iOS 27 launch + registration errors (2026-10-11-ios27-registration)

**Result: T-115 PASS; T-202 passenger path PASS; T-202 driver licence-plate path BLOCKED** (another agent used the iOS 27 sim mid-run).

- App 338c154 (native rebuild; built Info.plist has `RaaHeHaq.SceneDelegate`), backend 60a6bd9; local backend only
- iPhone 18 Pro iOS 27.0 EB72E406; iPhone 17 iOS 26.5 FFD40F6E (passenger), E375B9F1 (driver)

## T-115
1–8 PASS on iOS 27: cold launch stays up; email login keyboard; location prompt (first attempt "Location Error", Retry fixed — env); booking map tiles + "1 driver nearby"; HOME/reopen and lock/unlock resume same PID; OTP number pad + 246810; no new crash report. `01`–`07`, `16`
9–11 PASS on iOS 26.5: passenger home + map tiles; driver Online + Map; request → driver card → passenger cancel → card cleared (ride 205 cancelled). `08`–`15`

## T-202
12 PASS: server-only 422 (`qa..t202@example.com`) → jumped to step 1, scrolled to Email, server message under it, one toast; backend logged `fields:["email"]`, no user created. `17`–`19`
13 PASS: editing Email cleared the error. `20`
14 BLOCKED: driver duplicate licence plate (P-0001-23) not completed — another session relaunched/drove the iOS 27 sim. Re-run later.

## New bugs
| Sev | Finding | Task |
|---|---|---|
| High | Date of Birth (YYYY-MM-DD) uses a numeric keypad with no "-" on iOS; real users can't type it | T-206 |
| Low | Passenger documents step marks optional CNIC images with a required `*` | T-206 |
| Medium (process) | Agents shared the QA simulator; Metro showed a red box from a `.claude/worktrees/*/App.tsx` path | orchestrator: one dedicated sim per QA run |

## Visual
Login keyboard covers fields (T-204, in progress); passenger home stats static (Phase 5); status-bar clock briefly dark on navy after JS reload.

## Data
Ride 205 cancelled. No users/vehicles created.
