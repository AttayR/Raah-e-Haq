# QA report: T-102 Single logout thunk used everywhere

- Date: 2026-10-08 · Result: **PASS**
- Device: iPhone 17 (iOS 26.5) simulator, Debug, Metro :8088 (fix/phase-1-auth working tree)
- Backend: local only (`.env.development` API_URL=http://localhost:8000/api checked); seeded accounts, email + password login; no reseed

## Steps
1. **PASS** Passenger Home > Sign Out: dialog "Sign Out" / "Are you sure you want to sign out?", Cancel + red Sign Out; Cancel stays. (02, 03)
2. **PASS** Confirm (double tap): Login within ~1 s, no half-cleared frame; one `/api/auth/logout`, passenger token count 2→1. (04, 05)
3. **PASS** Kill + relaunch stays on Login; driver login afterwards shows only driver data, fields empty. (06, 08)
4. **PASS** Driver Home > Sign Out and Driver Settings > logout: dialog, Cancel stays, Login after confirm; one logout request each, token count drops. (09-18)
5. **PASS** Passenger login after driver: no driver data. (19)
6. **PASS** Passenger Settings > Logout double tap → one dialog; confirm double tap → one POST, token revoked. (21-24)
7. **N/A** Driver Pending Approval not reachable: pending login gets 403 while `AUTH_PENDING_LOGIN_TOKENS` is off (BE-25, flips with T-106). (25)
8. **PASS** Offline (local backend stopped): "server revoke failed; continuing", Login within 1-2 s; relaunch stays on Login. Backend restarted, curl 200. Connection-refused path only; hanging-connection 8 s timeout not exercised. (27-29)

## Issues seen (not T-102, already tracked)
- Login keyboard covers fields; first tap only dismisses keyboard (AUTH-13 / T-603).
- Driver Settings rows are unlabeled icons; logout row has no text (design audit, Settings 1 and 3).
- Passenger Home header under status bar when scrolled; "$24.50" demo value (T-604 / demo-data tasks).
- Driver Home header clipped, stat labels clipped, red-on-green "Completed" (design track).
- Debug toast after logout: React Native Firebase namespaced-API deprecation warning (pre-existing; goes with T-107).

## Data and environment
- No rides created. Tokens only; one orphaned passenger token from the offline test (expected).
- Testing note: Metro watches `docs/`, so saving PNGs under docs/qa-reports reloads the app mid-test; screenshots were taken in scratch and copied at the end.

Screenshots: this folder (00-launch.png … 29-relaunch-after-offline-logout.png, 50 files).
