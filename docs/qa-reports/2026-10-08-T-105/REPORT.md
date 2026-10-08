# QA report: T-105 normalizeUser + role/status routing (run 1)

- Date: 2026-10-08 · Result: **FAIL** (check c) → fixed in retry 1, re-run as 2026-10-08-T-105b (PASS)
- Device: iPhone 17 (iOS 26.5) simulator, Debug, Metro :8088; local backend only

## Steps
1. **PASS** (a) Passenger → Passenger home; driver → Driver home. (01, 02, 07)
2. **PASS** (b) Relaunch → splash → same home; backend stopped → cached user still routes home. (03*, 04*, 08*)
3. **FAIL** (c) Passenger set to `suspended` in local DB, relaunch → full Passenger home with "Active User" badge. Server correctly returned 403 `ACCOUNT_SUSPENDED`; initializeAuth kept the cached active user. (05*)
4. **PASS** (d) Admin login → account-status screen (not blank, not home); Sign Out works. Copy is driver-specific (T-106). (11*, 12*)
5. **N/A** (e) pending@ login (403 while `AUTH_PENDING_LOGIN_TOKENS` is off).
6. **PASS** (f) Passenger and driver logout. (06, 10)

## Issues (routed)
- "Check Status" never calls /auth/profile → T-106. Account-status title unreadable on busy background → T-106.
- Login keyboard covers fields; Driver Settings rows unlabeled; Driver Home header/stat cards clipped; demo stats/expired offers; offline notifications logger.error with empty message → design track, T-506, T-107.

Data: users.id=3 status toggled and restored; one probe token created and deleted; no rides.
Screenshots: this folder (27 files; stray copies from a shared scratch folder were removed).
