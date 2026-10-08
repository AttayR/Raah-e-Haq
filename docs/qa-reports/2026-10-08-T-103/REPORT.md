# QA report: T-103 Auth bootstrap (splash, offline-tolerant init)

- Date: 2026-10-08 · Result: **PASS**
- Device: iPhone 17 (iOS 26.5) simulator, Debug, Metro :8088 (fix/phase-1-auth working tree, JS-only change)
- Backend: local only (`.env.development` API_URL=http://localhost:8000/api checked); seeded accounts; no rides, no reseed
- Method: each cold start recorded (`simctl io recordVideo`), frames at 5 fps laid out as timelines; JS splash visible ~200-400 ms on localhost

## Steps
1. **PASS** (a) Cold start signed out: native launch screen → themed splash → Login; no other screen. (a1-*)
2. **PASS** (b) Passenger signed in: splash → Passenger Home, no Login frame. (b1, b2-*)
3. **PASS** (b) Driver signed in: splash → Driver Home, no Login or passenger frame. (b3, b4-*)
4. **PASS** (c) Backend stopped, relaunch: stays signed in on Home. Backend restarted, curl 200. (c1-*)
5. **PASS** (d) Passenger tokens deleted in local DB: relaunch → Login; next relaunch also Login. (d1-*, d2-*)
6. **N/A** (e) Pending login is 403 while `AUTH_PENDING_LOGIN_TOKENS` is off (T-106). (e1)
7. **PASS** (f) Wrong password error, relaunch: no stale banner on either tab. (f1-f3)
8. **PASS** (g) Logout → Login with no splash in between; token revoked; relaunch shows Login. (g1-g3)
9. **PASS, visual issue** (h) Dark mode: splash background follows scheme; navy spinner barely visible on near-black. (h1-*)

## Issues (routed)
- Dark splash spinner low contrast → T-601 (dark primary/onBackground token).
- Native LaunchScreen is the RN template, mismatched with the JS splash → T-601/T-602 design track.
- Login keyboard covers fields; two taps needed with keyboard open → T-603 (already tracked).
- Offline: no offline indicator on Home; empty-message `logger.error` from RideService#getNotifications → T-104 (logging) / design states.
- Dev LogBox for expected login 401/403 → T-107 (already tracked for OTP thunks).
- Driver Settings menu without labels; tab bar stayed dark after toggling appearance (needs clean repro) → design audit / T-610.
- Not covered: hanging server (accepts then stalls) — splash would last until the axios timeout.

## Data and environment
- Local DB: 3 passenger tokens deleted (check d); logins/logout created/revoked tokens. No rides.
- Restored: backend on 127.0.0.1:8000 (200), appearance light, app signed out on Login.

Screenshots: this folder (23 files).
