# QA: UI-R8, T-579, BE-112 (2026-10-19)

QA RESULT: FAIL (1 medium-high, 2 medium, several low).
DEVICE: iPhone 17, iOS 26.5 (passenger FFD40F6E… light, driver E375B9F1… dark during the run). App 9e7c45c, native Debug rebuild, fresh install + privacy reset on both sims. Backend local, 28abaae. Backend stopped ~40 s once for the error-banner check, then restarted. No reseed.

## UI-R8 — cold launch
1. Light cold launch: native navy splash → identical JS splash → Login; no white/black frame, no jump, light status bar (01). PASS
2. Dark cold launch: same (02). PASS
3. Saffron bar after ~800 ms — NOT TESTED (no JS throttling on the sim).

## UI-R8 — pre-prompts
4. Passenger location primer after sign-in, Continue + Not now (03). PASS
5. Not now → OS not asked, Home shows "Turn on location" (04). PASS
6. Chip asks the OS (05). PASS
7. After "Don't Allow" the chip disappears until a tab switch; then it opens Settings. FAIL (minor, bug 4)
8. Booking with location denied → full-screen "Location is off" with no back and no manual search (06). FAIL (bug 3, likely pre-UI-R8)
9. Driver location primer, Continue only (07); appears at sign-in (Drive map watch), not at Go online. PASS (UX note, bug 8)
10. OS dialog → Allow While Using (08). PASS
11. Go online → notifications primer with one "Not now"; not shown again (09). PASS
12. Passenger notifications primer once on first booking (Roman Urdu, one "Abhi nahi"); searching sheet after it, no freeze (26). PASS
13. Explicit dialog queued behind a primer — PARTIAL (no freeze seen; not set up explicitly).
14. Driver location revoked → "Location needed" card clipped in the 137 pt peek sheet; title/body/buttons hidden; can't expand (10). FAIL (bug 1)
15. Granting location clears the card on foreground. PASS (Try again not tappable — clipped)
16. 1.35x text: account status and support sheet not clipped (37). PASS

## UI-R8 — account status
17. Pending passenger: new layout, "Hi Saad.", Check status, Contact support, Sign out (11). PASS
18. Check status spinner, one GET /auth/profile, "not approved yet" toast (12). PASS (hero shifts ~20 pt while checking)
19. Pull to refresh runs the same check. PASS
20. Backend stopped → red Banner (13). PASS
21. Support sheet "Email help@raahehaq.com"; no Mail app on the sim → fallback toast (14, 15). PASS
22. Sign out dialog → "Signing out…" with Check status disabled → Login (16, 17). PASS
23. rejected@ email login stays on Login with a toast including the reason (UI-R6 403 rule), not the account-status screen QA_SCENARIOS describes. FAIL or docs mismatch (bug 5)
24. Rejected variant shows title + server reason (18). PASS
25. Suspended after rejected still shows the old rejection reason (19). FAIL (bug 2)
26. Pending driver documents with badges; Upload → POST → "In review" (20–22). PASS

## T-579
27. Role cards Roman Urdu after a live switch (35). PASS
28. Parcel searching "Delivery cancel karein" + dialog (27). PASS
29. Live panel right after cancelling a delivery: "Aap ne ye ride cancel ki." (28). FAIL (minor, bug 6)
30. Sender cancelled-parcel card delivery wording (29). PASS ("CANCELLATION" header English)
31. "1 driver qareeb hai" on the booking map (23). PASS
32. Receipt "Raseed / Adaigi / Adaigi ki surat / Ada ho gaya" (30). PASS
33. Plate placeholder — NOT REACHED (code checked).
34. Tiers "Gaari"/"AC gaari" (Roman Urdu), "Car"/"Car AC" (English) after relaunch (24, 38). PASS (fare step "Gaari: Gaari")
35. After a live switch back to English, booking still showed "AC gaari" until relaunch (36). FAIL (minor, bug 7)
36. Driver accept → cancel with requeue → Drive: toast "Ride cancel ho gayi", no LogBox, no JS errors; passenger "Doosra driver dhoond rahe hain" (33, 34). PASS

## BE-112
37. Parcel form prohibited list + declaration in Roman Urdu; booking succeeds (#248) (25). PASS
38. Driver opt-in Roman Urdu list (32); English unchanged (31). PASS

## New bugs (filed as T-580)
1. MED-HIGH — Drive "Location needed" card clipped at peek height (Open Settings / Try again invisible). DriverDriveScreen DRIVE_PEEK_HEIGHT/snap points, DriveSheet, LocationNeededCard.
2. LOW-MED — suspended shows the stale rejection reason (normalizeUser withRefusedStatus, accountStatusView).
3. MED — booking with location denied is a dead end (no back, no manual search); expected a Banner + manual search (PassengerMapScreen showLocationWait, BookingNotices).
4. LOW — Home "Turn on location" chip disappears after "Don't Allow" (useNativeLocation permissionStatus not updated on iOS refusal).
5. LOW-MED or docs — rejected/suspended email login shows a toast on Login (UI-R6 403 rule) instead of account status; align docs or behaviour.
6. LOW — live cancelled-parcel panel uses ride wording.
7. LOW — tier names keep the old language after a live switch (vehicle-types cache not cleared on locale change).
8. LOW (UX) — driver location primer shows at sign-in (Drive map watch), not at Go online.
9. Cosmetic — "CANCELLATION" header English, "Gaari: Gaari" on the fare step, ~20 pt account-status hero shift during Check status.

## Local data
#248 parcel cancelled while searching; #249 car accepted by driver 2, driver-cancelled (requeue, one strike), then passenger-cancelled. Pending driver user 5: document row #69 (vehicle_front, pending) left in place. Restored: car_ac/parcel tiers inactive, driver 2 opt-in 0, 03009990004 back to pending, users 2/3 locale en, sim text size and appearance. No active rides; driver 2 offline. Location granted on both sims; notifications never asked.
