# QA: ride flow end to end (2026-10-10-ride-e2e-b)

**Result: PASS** (one medium-high finding: driver gets no requests on the Home tab)

- Scope: T-302, T-304, T-402, T-403, T-404, T-405
- Devices: passenger iPhone 17 (iOS 26.5) FFD40F6E; driver iPhone 17 (iOS 26.5) E375B9F1
- Build: Debug from bc61367, JS via Metro :8088 at 8400ee4; backend local only (`API_URL=http://localhost:8000/api`), no reseed

## Steps
1. PASS: driver signs in by email, goes Online (`driver_status=available`); T-402 tracker posts `/tracking/update-location` every ~30 s (first post ~60 s, after the permission prompt). `01`
2. PASS: passenger books Car, Gulberg III → Model Town Park, 6.54 km / 16 min; server breakdown base 100 + distance 98 + time 32 = Rs 230; all four vehicle prices from the server. `02`
3. PASS: one tap Confirm & Request → ride 201, "Finding you a driver…" with Cancel. `03`
4. PASS with finding: request card shows **only on the driver Map tab**; Home never polls `/rides/pending`. On Map: card with passenger, pickup, drop-off, PKR 230 Cash, 0.4 km / 1 min; Accept → DriverRide "Head to pickup". `04a`, `04b`
5. PASS with finding: passenger sees "Your driver is on the way" with real driver/vehicle (Mazda CX-9 · Gray, P-0001-23). Driver marker at the screen edge; "Ride Requested Successfully!" modal still open after accept. `05`, `05b`
6. PASS: I've arrived → passenger "Your driver has arrived" within one 10 s poll. `06`
7. PASS: Start trip → "Trip in progress". `07`
8. PASS: Complete → both apps show server total Rs 200 (100 + 98 + 2, 1 min actual); DB completed, cash, paid; driver earnings PKR 160; driver back to Available. `08a`–`08c`
9. PASS: ride 202 requested, passenger cancels while searching; driver card clears within one poll; DB cancelled_by passenger. `09a`–`09c`

## New bugs (filed in docs/TASKS.md)
| # | Sev | Finding | Task |
|---|---|---|---|
| 1 | Med-High | Driver receives no requests on Home tab; only `DriverMapScreen` polls `/rides/pending` | T-408 |
| 2 | Medium | "Ride Requested Successfully!" modal persists across stage changes, hides driver card, duplicates Cancel | T-311 |
| 3 | Low | Passenger map doesn't fit the driver marker while driver is on the way | T-311 |
| 4 | Low/product | Booking estimate (Rs 230) vs final (Rs 200): label "estimated" vs "final" | T-311 |
| 5 | Low (BE) | `/arrived` accepted 0.4 km from pickup; no distance check | BE-64 |
| 6 | Low | Place search not limited to Pakistan (Surat, India suggested) | T-303 (existing) |
| 7 | Low | "No drivers nearby" right after completion until next 30 s refresh | T-311 |
| 8 | Low | Home stats hardcoded (driver + passenger), expired offer | Phase 5 (existing) |

## Visual issues (Phase 6 design track)
- Passenger booking map: locate/refresh/+ buttons overlap the status bar / Dynamic Island.
- Trip Details card: "Swap" cut off at the right edge.
- Destination search: keyboard hides most suggestions.
- Driver sign-in: keyboard covers email/password fields.
- Driver Home: grey dim overlay; stat labels truncated.
- Driver Map: map labels behind the status-bar clock.

## Data created (local DB only)
Ride 201 completed (Rs 200 cash, paid); ride 202 cancelled by passenger; driver_locations heartbeats for driver 2. No active rides remain. Both simulators left signed in; driver Online on Map.
