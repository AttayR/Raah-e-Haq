# QA: T-551 + T-552 (2026-10-16)

QA RESULT: PASS (one copy bug on the new request card; new low-severity issues filed as T-553)
SCOPE: fix/phase-2-onboarding ca6b38b, native rebuild with the updated react-native patch; iPhone 17 QA sims; local backend

## T-548 regression — PASS
DOB and bio Done bars; Address none (1-01 … 1-03).

## T-551 — PASS
- Autofocused phone pad and code pad show Done at once; Change Phone Number too (1-04 … 1-07).
- "Current location" and "Pinned on map" labels are selected on tap and replaced by typing (1-08, 1-09, 1-11, 1-12).
- Back / edit chips clear the old route; re-picking keeps 3 stops in the route (14.02 km vs 10.81 km) (1-10, 1-13 … 1-15).
- One unreproduced "Phone must be in +92… format" on the first Send code after fast typing.

## T-552 — PASS (ride #210, 3 stops, Rs 453)
- Driver card: Stop 1 and Stop 2 one line each, "+1 more stop", Reject/fare/Accept visible (2-01). Copy bug: label reads "Stops 3–3".
- Trip: no stale line at start; camera frames car + 3 stops + drop-off clear of the controls (2-04); each completed stop drops its pin and the route refetches (2-05 … 2-08); completed with stops itemised (Rs 75), commission Rs 91, earnings Rs 362 (2-09).

## New issues (T-553)
1. "Stops 3–3" label (copy.ts:16).
2. Booking sheet stays compact after a suggestion pick or Back (PassengerMapScreen compact = searchFocused).
3. Ride camera leaves no margin for markers at the sheet edge (passenger and driver).
4. "+" opens the old Request Ride modal with a clipped header, also during an active ride (V-01).
5. Stop suggestions open under the keyboard (V-02).
6. First Send code after fast typing gave a format error (not reproduced).
7. "I've arrived" ~450 m from pickup: no visible feedback (not confirmed).
Also: picking a pickup collapses the sheet without moving the map; the vehicle-step trip card lists no stops.

## Data
Ride #210 completed, no ratings; no active rides for QA accounts; driver offline; passenger address/bio null.
