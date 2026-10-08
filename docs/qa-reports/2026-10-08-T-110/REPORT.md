# QA report: T-110 nearby drivers (run 2026-10-08-T-110)

**Result: PASS for T-110.** Two new bugs were found outside T-110's code (→ PAX-23 high, PAX-24 medium).
iPhone 17 (iOS 26.5), Debug build of the uncommitted fix/phase-1-auth tree, local backend only (`.env.development` → localhost:8000). 2026-10-08 17:30–17:53.

## Setup
- The passenger signed in on the simulator (local seeded account). A local driver token came from one API login; no token or password is recorded here.
- Driver position: single `POST /api/tracking/update-location` calls at 31.5235,74.3612, ≥2 min apart (3 × available, then 1 × offline for cleanup).
- Timing evidence comes from the artisan serve request log.

## PAX-E2E-01: nearby drivers
| # | Check | Result |
|---|---|---|
| 1 | Before setup: "No drivers nearby right now", no markers (02a/02b). The loading text was never captured, because local responses take under 1 ms. | PASS (note) |
| 2 | After the next 2-min bucket: "1 driver nearby" plus a marker about 400 m away (03a/03b) | PASS |
| 3 | API payload: opaque string id, rating 0, car, 0.4 km, 1 min; no name or phone. The callout couldn't be opened (see PAX-24). | PASS (API) |
| 4 | Polls every 30 s; moving the pickup refetches with ≥10 s gaps (17:39:12 → 17:39:22); no app gap under 10 s | PASS |
| 5 | 0 calls to `/tracking/drivers-in-radius`; no red LogBox from this feature | PASS |
| 6 | Leaving the Map tab stops polling for 100 s; returning refetches at once (08/09) | PASS |
| 7 | 50 s in the background: no requests; on return, a refetch within 1 s (11) | PASS |
| 8 | When the driver location is older than 5 min, the marker disappears (07) | PASS |

## PAX-E2E-02: request and cancel
- An Economy request failed with 422 (`vehicle_type: 'economy'` sent unmapped) and a red LogBox. **FAIL, not caused by T-110** (PAX-23).
- A Bike request created ride #201. While requesting, the status chip is hidden and polling stops (3 min 19 s with no requests) (18).
- Cancel returns to "Plan your trip", and polling resumes at once (21/22).

## E2E-01 step 4: accept through the API
- The driver accepted #201 through `assign-driver`. The passenger sees the driver card with Call (19).
- After cancel: no card, no Call button, no error toast (21/22).
- Complete flow and the invalid-phone case: N/A here (the invalid phone is covered by unit tests).

## Visual issues (outside T-110 → design track / Phase 3)
- Floating map buttons and the "N drivers nearby" chip overlap the status bar (02b, 04, 10, 11).
- The Vehicle sheet fills the screen and can't be swiped down.
- Two success modals stack after a request (16b).
- "Requesting Ride…" stays visible above the driver card after accept (19).
- Known, already tracked: login keyboard (T-204), fare total and Bike emoji (T-306), plus-code pickup address (T-303).

## New bugs
1. **PAX-24 (medium):** tapping a nearby-driver marker sets the destination instead of opening its callout (2 of 2 times). The map `onPress` doesn't skip `marker-press`. → T-304.
2. **PAX-23 (high):** Economy, Comfort and Premium requests always fail with 422; only Bike works. `onRequestRide` (PassengerMapScreen.tsx ~471) skips `vehicleTypeMapping` and hardcodes passenger_id 11 and placeholder addresses. The expected 422 is logged with logger.error, which shows a red LogBox. → T-302.
3. Minor: `GET /rides/{id}` is polled every 10 s while requesting or accepted. → T-304.

## Server data (local only)
- Ride #201 (requested → accepted → cancelled).
- 4 location rows for the local driver, who ends offline.
- 2 extra local login tokens.
- No reseed.
