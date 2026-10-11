# QA: ride fixes 2 (2026-10-10-ride-fixes-2)

**Result: PASS** — T-410, T-411, T-313, BE-65 behave as specified. Two Low findings.

- App 4e6794d (native rebuild, patched RNCGeolocation.mm), backend 56f0979; local backend only
- Passenger iPhone 17 FFD40F6E, driver iPhone 17 E375B9F1 (iOS 26.5)

## Checks
1. PASS T-410: driver still >60 s, request card up, Map tab + locate, accept (ride 204). 11 points over 5 min while switching tabs: every point reached `driver_locations` the same second; passenger pin moved. Arrived refused at 552 m / 419 m; at pickup, one tap succeeded without backgrounding. (Driver sim shut down by itself mid-run — environment; app resumed fine after reboot.) `01*`–`05a`
2. PASS T-411: server sentence + "About 552 m away." on its own line, fully visible, below the back button. `04a`, `04c`
3. PASS T-313: hand-panned map kept during the ride; after Done it recentred with "1 driver nearby". `03a`, `06b`
4. PASS BE-65: driver listed as nearby immediately after Done (no 2-min gap). `07a`
Fare: final Rs 150 cash; driver earnings PKR 120.

## New findings
| Sev | Finding | Task |
|---|---|---|
| Low | Passenger recentre after Done ignores the bottom sheet; drivers south of the passenger hidden under it | T-314 |
| Low | Driver ride screen: map does not follow/show the driver; status bar unreadable on light map. Driver Map tab camera doesn't follow the driver | T-412 |
| Low (confirm) | Back button on driver ride screen seemed slow while the T-411 toast is up (maybe tool timing) | T-412 |

## Visual (Phase 6)
"Swap" chip clipped in Trip Details; nearby driver shown as generic pin, not a car icon; Debug LogBox banner over tab bar (dev only).

## Data
Ride 204 completed. No active rides of ours. Both sims signed in; driver Online on Map. Backend and Metro left running.
