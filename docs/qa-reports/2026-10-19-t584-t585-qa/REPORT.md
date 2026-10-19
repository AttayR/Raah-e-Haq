# QA: T-584, T-585, T-588 (2026-10-19)

QA RESULT: FAIL (1 medium-low, 2 low, 4 observations; step 15 NOT RUN). Everything in scope works; the failure is a red LogBox on a failed cancel.
DEVICE: iPhone 17, iOS 26.5 — passenger FFD40F6E…, driver E375B9F1…, light. App f8b046a on Metro 8081; local backend (50 online test drivers, bot stopped). No reseed; backend stopped twice and restarted.

## T-584
1a. Cancel request → toast "Request cancelled" → Home peek, no panel; #290 fee 0 (01a–01b). PASS
1b. Roman Urdu dialog and toast "Request cancel ho gayi" (01c, 01d). PASS
2. Dialog open, driver accepts #308, confirm → "Ride cancelled" panel without chevron, Done → Home (02a, 02b). PASS (finding 2)
3. "QA test one" + immediate Send → full text once, field empty; double tap → one row (03a, 03b). PASS
4. Work chip frames the route (en, ur); recentre returns to pickup/user (04a–04c). PASS
5. No LogBox on estimate error, cold start offline, or any 409 (05a, 05b, 06a–06c). PASS

## T-585
6. 409 note visible on Booking for a ride (#294), a parcel (#295, no parcel created) and Roman Urdu (#293) (06a–06c). PASS
7. Swipe right after Request held 5/5 (#296–#300); during Try again held 2/2 (07a–07e). PASS
8. Swipe on No driver found / completed / cancelled → Home, ride cleared, single transition (08a–08f). PASS
9. Failed cancel (backend down) → toast "Couldn't cancel. Try again.", no alert, ride stays — but red LogBox 2/2 (09a–09d). FAIL (bug 1)
10. Session ended during search / on ended panel → clean Login; re-sign-in restores state; yellow LogBox in the first case (10a–10d). PASS (finding 3)
11. Driver offer: no LogBox at the offer; yellow LogBox after Accept (11a, 11b). PARTIAL (finding 3)

## T-588
12. Done after opening from Inbox (#309) and Activity (#310), two in a row → Home tab (12a–12c). PASS
13. Arrived 150 m short → car moves onto the pickup pin a few seconds after the label (13a–13c). PASS (obs 2)
14. Accept shown ~3–4 s, start ~2 s; GET /rides/{id} every 3 s requested/arrived, 10 s accepted/started; no reads in background, one read on foreground; 0 × 429. PASS (obs 1)
15. Release tap-to-render — NOT RUN: Release uses .env.production (raahehaq.com); needs a Release build pointed at localhost.

## Regression
#309–#311 request → accept → PIN → complete, Rs 150; driver commission 20% −Rs 30, net Rs 120. PASS

## Bugs and findings (filed as T-589)
1. MEDIUM-LOW — failed cancel logs at error (rideService.ts:602 logger.error) → red LogBox in Debug.
2. LOW — cancel dialog keeps the request copy ("Cancelling now is free") after a driver accepts while it is open.
3. LOW — unreadable yellow LogBox: driver after Accept; passenger after a session ends during a search and after re-sign-in.

## Observations
1. Extra GET /rides/{id} every 4–7 s while on Home/Activity with an accepted ride; duplicate reads at status changes (second reader off Booking).
2. Arrived snap waits for the next driver-location read (4 s).
3. Sign-out simulated by revoking the token; Account → Sign out during a search not tried.
4. Re-login phone field once showed 9/10 digits and the first Send Code tap was ignored (possible simulator typing artifact).

## Local data
Rides #290–#313 for passenger 3, all ended (cancelled free, no_driver with requested_at restored, or completed #309–#311 unrated). Chat rows 18–19. Temporary tokens 47, 49 deleted. Passenger locale en; driver offline at 31.5119, 74.3473. Backend running on 127.0.0.1:8000.
