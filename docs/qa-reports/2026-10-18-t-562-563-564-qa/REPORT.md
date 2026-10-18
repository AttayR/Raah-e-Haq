# QA: T-562, T-563, T-564 (2026-10-18)

QA RESULT: PASS (4 new minor bugs, none blocking)
SCOPE: T-562 (modal queue follow-ups), T-563 (refused-parcel follow-ups), T-564 (registration labels, name rule, toast, pinned Done)
DEVICE: iPhone 17, iOS 26.5 sims (passenger FFD40F6E…, driver E375B9F1…), installed Debug apps loading JS from this project's Metro at HEAD bb48bbe (no native change since a203b81; headless xcodebuild failed on missing codegen output `RCTAppDependencyProvider.h`). Local backend only (`.env.development` → localhost:8000, SMS driver `log`).

Software keyboard lagged 2–3 s (test artefact). Pickup camera is blocked on the sim; parcel #227 pickup was done locally through `ParcelDelivery::pickup()`.

## T-562
1. Booking sheet + Cancel ride confirm over the sheet; Keep Ride; Confirm cancels #223, next sheet opens (01, 02). PASS
2. Driver Cancel-ride sheet Keep/Submit; Arrived → PIN sheet starts the trip (03, 04). PASS
3. Parcel code sheet open across ~10 s of polls; slides out, rating sheet opens, trip card responds (14). PASS
4. Confirm then a sheet ~0.6 s later opens (19). PASS with note N1.
5. Scrim tap closes; drag down and back up keeps the sheet open, Cancel closes it later. PASS
6. Booking error ModernModal (PHONE_NOT_VERIFIED set up locally, restored): shows over the sheet, Not now, Verify number → Profile, no freeze (17, 18). PASS

## T-563
7. Driver refuses parcel #226 → "Parcel refused" + no-strike line (07). PASS
8. No LogBox toast and no console warning/error during the refusal; the earlier warning did not reproduce. Only location-watcher warnings during the run. PASS
9. Sender live panel #226: Requested, Accepted, Arrived done, then Cancelled + reason card; no "Driver asked for more?" (08, 09). PASS
10. Receipt #226 keeps Accepted/Arrived, no report button (10, 11). PASS
11. Delivered parcel #227 and normal ride #224 offer the report (16, 06); old parcel #218 hides it only because the 24 h window passed (12). PASS

## T-564
12. Experience picker "1 year", "2 years"; sheet titles without "*" (23, 24). PASS
13. Same red "*" on every step, light and dark (20, 25–27). PASS
14. "Ali 2" → letters-only error; "Mehr-un-Nisa" passes (21, 22). PASS
15. Driver +923009990565 (user #26): one-line "Registration received", approval caption, ends "Application under review" (28, 29). PASS with bug 1.
16. Passenger +923009990564 (user #27): same toast, no caption, OTP → Home (30). PASS with bug 1.
17. Done pinned above the home indicator for completed and cancelled rides, body scrolls behind it (02, 05). PASS

## Notes
- N1 (low): taps right after a dialog/sheet closes are dropped during the fade-out; a second Cancel-ride dialog took ~1 s. No freeze. Covered by T-565.
- ModernModal "Verify number" label wraps in a narrow pill (17).
- Receipt "Ride ID" wraps its last digit (10, 11).

## New bugs (filed as T-567)
1. Register success toast covers the Verify title and subtitle for ~4 s (low) — `RegistrationPhoneStep.tsx`, toast placement.
2. Driver registration drops the emergency contact name and relation; only the number is sent (medium) — `src/features/auth/registration/buildRegistrationRequest.ts` driver branch; server accepts `emergency_contact_name` / `emergency_contact_relation`.
3. Refused/cancelled parcel receipt shows "Payment status: Pending" (low) — `RideDetailsScreen.tsx` payment row.
4. Parcel wording: driver at a parcel pickup sees "Waiting for the passenger…" (13); passenger rating after a parcel offers car-ride tags (15) (low).

## Local data
Rides #223–#228 (none active; #225 adds a local driver cancel record for driver 2). Users #26 (driver, pending, 8 docs, vehicle LEA-5651) and #27 (passenger, active). Parcel tier off, driver 2 opt-in off and offline, user 3 `phone_verified_at` restored. Both sims left on sign-in.
