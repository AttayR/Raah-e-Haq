# QA report: T-104 Token in Keychain + single-flight 401 handling

- Date: 2026-10-08 · Result: **PASS**
- Device: iPhone 17 (iOS 26.5) simulator, Debug build of the T-104 tree (native rebuild, RNKeychain linked), Metro :8088
- Backend: local only (`.env.development` API_URL=http://localhost:8000/api checked); seeded accounts; no rides, no reseed

## Steps
1. **PASS** (a) Upgrade: signed in on the pre-T-104 build (JS from 2bec5bc served on a temporary Metro), installed the new build over it → still signed in, `/auth/profile` 200. AsyncStorage keys went from `auth_token, persist:root, user_data` to `auth_storage_installed, persist:root, user_data`; `persist:root` apiAuth.token null; `user_data` reduced. (a1, a2)
2. **PASS** (b) Mid-session revoke (token row deleted in local DB), Map tab loads → Login; exactly one `/api/auth/logout`; no further requests for 25 s. (b1)
3. **PASS** (c) Cold start with revoked token → one `/auth/profile` 401 → Login, no loop. (c1)
4. **PASS** (c) Regression: sign in again, revoke again, load → Login, exactly one logout. (c2)
5. **PASS** (d) Wrong password → "Invalid credentials", no logout, no flash (error box below the fold). (d1, d2)
6. **PASS** (g) Booking flow to the fare review step: no "please log in" error; ride NOT requested. (g1-g4)
7. **PASS** (e) Passenger and driver logout: Login, one logout each, server token revoked, local storage cleared. (e1-e6)
8. **PASS** (f) Uninstall + reinstall while the server token was valid → starts signed out, stays signed out on a second launch (stale Keychain entry wiped). (f1, f2)

## Issues (routed)
- Login error rendered below the fold (P3) → T-603.
- Keyboard covers Login fields and Map destination input; Map buttons/sheet under status bar; Driver Home header and stat cards clipped; Driver Settings rows without labels → design track (known).
- `notificationService.ts:48` logs the expected 401 at error level (red LogBox on forced logout) → T-107 logging sweep.
- Map tab fires `/api/notifications` and `/unread-count` three times each (login twice) → T-502 (PAX-17).
- Fare sheet "Cancel" says "Cancel Ride" before any ride exists → T-305.
- Fare computed on device; Home stats/badge hardcoded (known: T-306, T-506).

## Data and environment
- No rides. Passenger tokens deleted 4× in local DB (3 test revokes + orphan cleanup); driver keeps its 2 pre-existing tokens.
- Simulator now has a fresh T-104 install, signed out; RCT_jsLocation localhost:8088; temporary Metro :8089 stopped and its export deleted.
- Unrelated backend traffic at 10:17 (register/phone verify) came from the BE-35 builder's local smoke, not this simulator.

Screenshots: this folder (21 files).
