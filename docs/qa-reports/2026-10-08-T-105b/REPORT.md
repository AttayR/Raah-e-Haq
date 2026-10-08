# QA report: T-105 retry 1 (blocked-status routing)

- Date: 2026-10-08 · Result: **PASS**
- Device: iPhone 17 (iOS 26.5) simulator, installed Debug build, Metro :8088 (fix/phase-1-auth working tree); local backend only (`.env.development` checked)

## Steps
1. **PASS** (c1) Passenger signed in → home; set `suspended` in local DB, relaunch → account-status screen (not home). (01, 02)
2. **PASS** (c2) Backend stopped, relaunch while suspended → account-status from the cached blocked status; backend restarted (200). (03)
3. **PASS** (c3) `rejected` → account-status; `active` → Passenger home again. (04, 05)
4. **PASS** (c1) Sign Out from account-status: confirm dialog → Login, `/api/auth/logout` logged. (06, 07)
5. **PASS** (a) Driver → Driver home; relaunch → Driver home. (08, 09)
6. **PASS** (b) Backend stopped, driver relaunch → Driver home from cache; backend restarted. (10)
7. **PASS** (f) Driver logout → Login; stays on Login after relaunch. (11-15)

## Issues (not T-105; routed)
- Account-status copy is driver "Application Under Review" for suspended/rejected passengers → T-106.
- Driver Settings rows without labels; Driver Home header/stat cards clipped; Login keyboard covers fields; demo stats → design track / T-506.

Data: only users.id=3 status changes, all restored to active; no rides. Backend stopped and restarted twice (running, 200).
Screenshots: this folder (15 files, this run only).
