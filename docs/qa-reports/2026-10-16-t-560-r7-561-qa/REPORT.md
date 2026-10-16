# QA: T-560, UI-R7, T-561 (2026-10-16)

QA RESULT: PASS (7 minor new bugs, none blocking)
SCOPE: T-560 (BottomSheet modal queue), UI-R7 (registration wizard), T-561 (parcel/AC/tier follow-ups)
DEVICE: iPhone 17, iOS 26.5 sims (passenger FFD40F6E…, driver E375B9F1…), Debug build at a203b81, local backend only (`.env.development` → localhost:8000, SMS driver `log`)

Sims ran headless with a hardware keyboard, so "footer hidden by keyboard" and the Done bar were judged from focus/layout state. The pickup camera step is blocked on the simulator; the pickup for ride #218 was done through `ParcelDelivery::pickup()` locally.

## T-561
1. Car-only driver: no "Parcel deliveries" row (02). PASS
2. With an approved bike (vehicle #11): row appears after the 60 s cache and a refocus; toggle works (03). PASS
3. New tier after >2 min and refocus: one catalogue read each; parcel chip first on Home (01 → 04); "Car AC" in booking (21). PASS. A booking screen that stays focused keeps the old list until refocus (by design).
4. Send a parcel: drop-off suggestions fully visible (14); receiver phone Done bar, footer hidden while focused, back after Done (05). PASS
5. Driver before pickup: "Collect Rs 100 in cash from the sender" (07). PASS
6. Sender at driver_arrived: hand-over wording with Rs 100 (10). PASS
7. Long plate `LHR-QA-2026-5610` fits on one line (10). PASS
8. Refused parcel #217: sender subtitle and red "Refused at the pickup / Reason: …" card (12). PASS
9. Receipt #217: cancellation card text, badge and reason (13). PASS
10. #218 after pickup: green "paid in cash at the pickup" (15). PASS
11. Driver trip-complete "Paid in cash at the pickup" (19). PASS
12. Sender delivered footnote (20). PASS
13. Driver AC ride #219: "AC" badge (22). PASS
14. Activity: "Car AC" (23). PASS
15. Pickup camera: BLOCKED on simulator.

## T-560
16. Women-mode fallback sheet (#220) opens inside booking; "Allow any driver" releases the request to the male QA driver; Cancel dialog works (25–27). PASS
17. "Keep waiting" (#222): sheet closes, inline row stays, Cancel dialog opens over it (28). PASS
18. Driver parcel delivery: code sheet → delivered → rating sheet at once → trip card, no freeze (17, 18). PASS
19. Refuse-reason sheet open/cancel/reopen/submit; driver PIN sheet. PASS
20. Passenger Keep Ride dialog; rating Skip and Submit. PASS
21. No stuck touches. PASS

## UI-R7
22. Role choice gates Continue (29). PASS
23. Passenger 3 steps (+923009990561, user #24), CNIC masked on review, OTP → Home (30, 31). PASS
24. Back while submitting (passenger and driver): ignored, one `POST /auth/register` each. PASS
25. Driver 5 steps (+923009990562, user #25): 18+ hint, 8 uploads, payout masked, ends "Application under review"; DB pending (35). PASS
26. SelectField opened while a text field has focus: sheet opens, value set, focus released; one after another works (32, 33). PASS

## New bugs (filed as T-564; refused-parcel items folded into T-563)
1. "1 years" in the experience picker (low) — `src/features/auth/copy/registrationFields.ts`.
2. SelectField sheet title includes the required "*" (low) — `src/components/ui/SelectField.tsx`.
3. Emergency-contact name accepts digits/punctuation (low).
4. Register success toast cut off at 2 lines, covers the Verify subtitle (36) (low).
5. Refused parcel, sender: progress hides accepted/arrived; "Driver asked for more?" shows on a no-charge ride and says "Driver" not "rider" (12) (low–medium).
6. Driver after refusing a parcel sees generic "Ride cancelled / no longer assigned"; a dev LogBox warning at the same moment (11) (low).
7. Required "*" colour differs on the Documents step (cosmetic).
Also: passenger completed-ride "Done" button sits close to the home indicator.

## Local data
Rides #217–#222 (none left active), users #24 (active) and #25 (pending, 8 docs), vehicle #11 (approved bike for driver 2, kept). Parcel and Car AC tiers switched back off; driver 2 opt-in off and offline; passenger 3 gender restored. Seeded demo rides 1–3 untouched.
