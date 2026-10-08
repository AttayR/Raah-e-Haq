# QA report: Phase 1 phase-gate regression (run 2026-10-08-phase-1-gate)

**QA RESULT: PASS.** There were no gate failures; known tracked issues are listed below.

- **Scope:** smoke scenarios (SMOKE-01..04, AUTH-OTP-01) plus Phase 1 auth: email login (passenger and driver), phone OTP, account-status screens, logout, 401 session expiry, relaunch persistence, nearby drivers.
- **Device:** iPhone 17 (iOS 26.5) simulator, Debug build of fix/phase-1-auth @ 17aff38 (clean tree), Metro :8088.
- **Backend:** local only (`.env.development` → localhost:8000). The backend `.env` was not edited and nothing was reseeded.
- **Simulators:** one. No end-to-end ride flow is in scope, so no rides were created. The driver side of the nearby check used one API login and two `update-location` calls.
- **"Offline":** simulated by briefly stopping the local `artisan serve`, then restarting it.

## Results
| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | SMOKE-01: app launches | PASS. No red screen; opens on Login when signed out. | 01 |
| 2 | SMOKE-04: error feedback | PASS. Empty login shows inline required errors. With the backend down, Send Code shows a "Network error" toast and an inline message. | 03, 21 |
| 3 | Email login (passenger) | PASS. Toast, then Passenger Home. | 05, 41 |
| 4 | SMOKE-02: passenger tabs | PASS. All five tabs render. | 06–09 |
| 5 | Relaunch persistence (AUTH-E2E-01) | PASS. Stays signed in with no Login flash, including when the backend is down. No offline message (T-608). A yellow dev LogBox appears. | 10–12 |
| 6 | Nearby drivers (PAX-E2E-01 / T-110) | PASS. Status goes from "No drivers nearby" to "1 driver nearby" with a marker. Polls every 30 s. No calls to drivers-in-radius. | 13a/b |
| 7 | Session expiry (401) | PASS. One 401, exactly one /auth/logout, lands on Login, then no further requests. | 14 |
| 8 | Phone OTP, made-up number (AUTH-OTP-01) | PASS within the T-111 scope. Neutral copy, server countdown, no OTP shown, wrong code shows an error, expiry is handled. A successful verify was not driven (no account behind the number). | 15–20 |
| 9 | Email login (driver) + SMOKE-03 | PASS. Driver Home renders, Map shows offline by default, all tabs open. | 22–29 |
| 10 | Driver logout | PASS. Confirm, then Login. Token revoked; relaunch stays on Login. | 30–32 |
| 11 | rejected@ | PASS. Refused with the not-approved message and the rejection reason, inline and as a toast. | 33–34 |
| 12 | suspended@ | PASS. Suspended toast; stays on Login. | 35 |
| 13 | pending-driver@ | PASS. "Application under review" screen with 2 items to fix and upload buttons. Check Status works; Sign Out works. | 36–40 |
| 14 | Passenger logout + relaunch (AUTH-E2E-02) | PASS | 42–46 |

## Known issues seen (already tracked)
- **Login:** first tap on a field sometimes doesn't focus it, and the keyboard covers the fields (T-204 / T-603, AUTH-13).
- **Demo data still shown:** Passenger Home stats, weather and expired offers (T-506); Notifications (T-502); Chat (T-510); Driver Home stats (T-507).
- **Driver:** Settings rows have no labels (T-618). Map opens on Karachi instead of the device location (T-402).
- **Map:** buttons overlap the status bar (design track).
- **Offline:** no offline indicator (T-608).
- **Dev only:** a yellow LogBox ("Open debugger to view warnings") appears after an offline relaunch and after a rejected login.

## New bugs
None confirmed.

Unconfirmed (low): after one passenger logout (19:19:54 PKT), that token was still in `personal_access_tokens`. The repeat at 19:24–19:25 revoked correctly. Another agent was exercising the same local backend at that time (BE-53 smoke and tests), so the cause is unclear. The leftover token was deleted by hand. This is now a watch item in the tracker.

## Environment notes
- Requests from another agent were seen at 19:13–19:21 PKT: 8 logins, 3 change-password calls, 2 logouts. These match the BE-53 backend smoke run in parallel.
- Simulator text-tool quirks: characters were dropped after "." in emails, and the dev menu opened once.

## Server data (local only)
- No rides created.
- 2 driver-location rows; the driver ends offline.
- All QA tokens revoked or deleted.
- One OTP send and one wrong verify on a made-up number, reset afterwards.
- No `.env` change, no reseed.
