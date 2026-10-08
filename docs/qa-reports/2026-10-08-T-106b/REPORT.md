# QA report: T-106 retry 1 (dark mode, toasts, rejected list)

- Date: 2026-10-08 · Result: **PASS**
- Device: iPhone 17 (iOS 26.5) simulator, Debug, Metro :8088; local backend only (`.env.development` checked; `AUTH_PENDING_LOGIN_TOKENS=true` locally); BE-41 reseeded accounts
- Contrast measured from screenshot pixels

## Steps
1. **PASS** Dark, pending-driver@: no "Login successful!"; actions above "Needs your attention (2)"; Sign Out 8.34:1, Upload new photo 9.25:1, disabled Send for review 5.38:1, Cancel 9.25:1, Check Status 14.9:1; Choose new photos opens 6 pickers; Sign Out → Login. (zoom-01..05, 03, 06)
2. **PASS** Show more / fewer with 4 items (two temporary rows, deleted after): 3 + "Show 1 more" → 4 + "Show fewer". (04, 05)
3. **PASS** Dark admin@: "This app is for passengers and drivers", accent icon 8.34:1, Sign Out works. (11, 12)
4. **PASS** Dark suspended variant (pending@ suspended mid-session, Check Status): readable; Sign Out → Login, `/api/auth/logout` logged. (16, 17)
5. **PASS** Light pending-driver@: actions above list, "Vehicle #1", pickers expand/collapse. (18-21)
6. **PASS** Document re-upload → toast, list drops to 1, row pending; restored afterwards. (22)
7. **PASS** rejected@ email login: toast line 1 server message, line 2 "Reason: QA: documents did not match", visible ~6 s; inline error shows both. (24, 25)
8. **PASS** pending@: no success toast; Check Status → passenger copy. (13, 15)
9. **PASS** passenger@: "Login successful!" and Passenger home. (26)
10. **PASS** suspended@ login: suspended toast + inline error, stays on Login. (08, 09)
11. **PASS** Ordinary toast layout unchanged. (zoom-10)

## Issues (routed, not T-106)
- Dark-mode danger icons #CE0A0A on near-black 3.38:1 (just passes 3:1) → T-601 dark danger tint.
- Upload success toast short (~2.4 s) → T-602 toast durations.
- Login ignores dark mode, keyboard covers fields; Settings status-bar contrast; Passenger home demo stats/expired offers → design track / T-506.
- Dev LogBox warning after normal sign-out (a logout cleanup step logs "failed; continuing") → T-107.

## Data
- Temporary rows deleted; pending@ restored to pending; re-uploaded document restored to rejected with its placeholder rewritten; uploaded jpg deleted; private storage matches the pre-run snapshot; 0 tokens left; no rides; no reseed.

Screenshots: this folder (65 files, this run only).
