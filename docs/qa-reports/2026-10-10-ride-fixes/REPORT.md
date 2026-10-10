# QA: ride fixes (2026-10-10-ride-fixes)

**Result: FAIL** — all five checks behaved as specified, but a HIGH bug was found: driver GPS froze mid-ride.

- Scope: T-408, T-311, T-409, T-312 (app 02c44db, backend 4c23629 with BE-64)
- Devices: passenger iPhone 17 FFD40F6E, driver iPhone 17 E375B9F1 (iOS 26.5); local backend only

## Checks
1. PASS T-408: request card on driver Home within 5 s, above tab bar; still visible on Settings; on Map it sits above my-location/Go Offline, both tappable. `01a`, `01c`, `01d`
2. PASS T-311: no "Ride Requested Successfully!" modal; review shows "Estimated fare/total" + note. `01b`, `02`
3. PASS T-312: passenger map framed driver + pickup (ride 203); after manual pan the map stayed put through all stages. Refit-on-move not exercised (GPS froze). `03a`, `03b`, `04d`
4. PASS T-409 (first tap >300 m): tracking post then `/arrived` in the same second; toast with server message, title stays "Head to pickup", button enabled, DB still accepted. `04a`
   PASS with workaround (second tap at pickup): app kept posting the old fix; rejected again until the app was backgrounded and reopened, then arrived succeeded. `04b`, `04c`
5. PASS: start + complete; passenger "Final fare Rs 150"; driver earnings PKR 120. Nearby drivers reappeared after ~2.5 min (server 2-min position bucket); app polls every 30 s. `05a`–`05d`

## New bugs
| Sev | Finding | Task |
|---|---|---|
| HIGH | Driver GPS freezes silently: heartbeat keeps posting last fix, no new fixes for ~7 min; app's location use dropped to zero after opening Map with a request card up (location client torn down/re-created). HOME + reopen fixes it | T-410 |
| Low/Med | T-409 toast truncates the distance ("…About 9…"), no separator, covers back button | T-411 |
| Low | Passenger map stays in paused (hand-panned) view after ride ends; pickup/nearby drivers off screen | T-313 |
| Low (BE) | Nearby drivers hidden ~2 min after a ride ends (2-min position bucket) | BE-65 |

## Visual issues (Phase 6)
Passenger map buttons inside the status bar; "Swap" chip clipped; driver Home hero/pill/stat tiles clipped; driver Map Offline pin still green.

## Data
Ride 203 completed (passenger 3, driver 2). No active rides of ours. Both sims signed in; driver Online on Map.
