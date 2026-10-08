# QA report: T-106 Account-status screen (run 1)

- Date: 2026-10-08 · Result: **FAIL** (dark-mode contrast) → retry 1
- Device: iPhone 17 (iOS 26.5) simulator, Debug, Metro :8088; local backend only (`.env.development` checked), `AUTH_PENDING_LOGIN_TOKENS=true` locally

## Steps
1. **PASS** Pending passenger: "Account awaiting approval", no documents, readable title; Check Status → "not approved yet"; after activation → Passenger home. (01-03)
2. **PASS** Suspended mid-session: Map tab's `/api/rides` 403 → "Account suspended"; Check Status → unchanged; Sign Out → Login although `/auth/logout` answered 403. (04-06)
3. **PASS, defect** Rejected login: inline error shows server message + "Reason: Test reason"; the toast cuts the reason line. (07, 07b)
4. **PASS** Admin: "This app is for passengers and drivers", Sign Out only. (08, 09)
5. **PASS** Pending driver: "Needs your attention" with reasons; document re-upload → toast, item leaves list, row pending; vehicle re-upload (front+back) → pending; 409 path refreshes list; approval → Check Status → Driver home. (10-18, 24, 25)
6. **FAIL** Dark mode: "Sign Out" and "Upload new photo" outline buttons are navy on near-black (~1.5:1). (19-22b)
7. **N/A** iPhone SE: no SE simulator installed.

## Issues
- Fixed in T-106 retry: dark-mode outline buttons; toast truncating the reason; rejected list not scaling / vehicles unlabeled; pending-passenger toast wording; "Login successful!" before status screens.
- Routed: ThemeProvider not following live appearance changes (T-601); unauthenticated `/api/rides` polls after sign-out (T-304); `/auth/logout` 403 for blocked accounts leaves the server token (BE-43); notifications 403 logged as error (T-107); Login keyboard and Driver Home/Settings layout (design track).

## Data
- All temporary DB edits reverted and checked against a snapshot; uploaded test JPEGs and pending@'s orphan token deleted. No rides.

Screenshots: this folder (29 files).
