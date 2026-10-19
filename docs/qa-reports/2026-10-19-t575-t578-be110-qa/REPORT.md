# QA: T-578, T-575 (Roman Urdu phase 2), BE-110 / BE-111 (2026-10-19)

QA RESULT: FAIL (low severity only). Every T-578 item PASS; T-575 and BE-110/111 mostly PASS with Roman Urdu leftovers.
DEVICE: iPhone 17, iOS 26.5 (passenger FFD40F6E…, driver E375B9F1…). Debug app on Metro 8081 at d50be08; local backend at 3af6c48.

## T-578
1. Home with live accepted ride #244 shows "Return to your ride" (01). PASS
2. Booking open: GET /rides/244 every 10 s + driver-location every 4 s, no doubles. PASS
3. Home focused: only GET /rides/244 ~every 10 s, no driver-location reads. PASS
4. First driver cancel requeued (server default) → Home "Finding you a driver…" on the next poll (02). PASS
5. Ending driver cancel (requeue_count set to 3 locally): card cleared within ~11 s; no reads after (03). PASS
6. No-show Rs 50 (local fee caps raised temporarily, arrived_at backdated): toast fits two lines (07). PASS
7. Driver Activity "Rs 50 fee"; details "Rs 50 / Cancellation fee" (05, 06). PASS
8. Send a parcel, declaration unticked: each Send scrolls to the checkbox, spacing unchanged (08). PASS
9. Driver parcel "Cancel delivery" button/sheet, "Delivery cancelled." toast, "Delivery details" (17–19). PASS
10. Parcel cancelled after arrival (#247): driver and sender timelines show Accepted + Arrived (20, 21). PASS
11. Passenger parcel copy in Roman Urdu: "Delivery ki tafseel", "Is delivery ko rate karein", "Cash (pickup par diya)" (22, 23). PASS

## T-575
12. Switch stores users.locale=ur-Latn; wallet relabels without manual refresh (11). PASS
13. Activity "Kul rides", "Ausat rating", "Cancel hui" (10). PASS
14. Planner "Safar plan karein", "1. Kahan se" (12). PASS ("1 driver nearby" English — bug 3)
15. Kamai "Safar", "Platform ka hissa", "Peer, 19 Oct" (25). PASS
16. Inbox "Itlaat", "Paighamat", "Bina parhe" (15). PASS
17. Ride details "Bunyadi fare", "Platform ka hissa (20%)" (26). PASS
18. Registration role cards stay English after a live switch; Roman Urdu after a cold start (28, 33). FAIL (bug 1)
19. Step 1 empty errors in Roman Urdu (no "[Function]"); relation, colour, licence sheets Roman Urdu (29–32). PASS
20. Review + submit (English values in DB) — NOT RUN (stopped before Documents; no account created).
21. "Current location" across a switch — NOT RUN.

## BE-110 / BE-111
22. Invalid OTP "OTP ghalat hai ya expire ho chuka hai" (27); API validation messages in Roman Urdu with ur-Latn, English with en. PASS
23. Rating tags in Roman Urdu (24). PASS
24. Vehicle tiers in booking "Car/Bike" (server keeps English) while Activity says "Gaari" — PARTIAL (bug 6)
25. Roman Urdu passenger notifications: "Driver Mil Gaya", "Driver Pohanch Gaya", no-show "…wallet se kaat li gayi" (15). PASS (driver gets no notification on these events, so English-recipient path not observable here)
26. Parcel notifications delivery wording ("Rider Mil Gaya", "Delivery Cancel…"). PASS
27. Booking error in Roman Urdu in the app — NOT RUN.
28. Switch back to English restores both apps; users.locale back to en. PASS

## Visual
- Passenger parcel searching: "Ride cancel karein" (16).
- Driver at a parcel pickup: plain "Cancel" next to "Refuse parcel".
- Driver parcel cancellation card: "You cancelled this ride." / "Cancelled rides are not charged." (19).
- Receipt labels "Receipt", "Payment", "Payment status", "Paid" English in Roman Urdu (22, 23).
- Parcel declaration and prohibited items English (server config).
- Plate placeholder "ABC-1234 or ABC-1234-D" English.
- Driver LogBox "Warning: An unhandled error was promised…" after a requeue cancel (cut off).
- After Home clears a cancelled ride, "Where to?" first shows the old outcome card (04).

## New bugs (filed as T-579, BE-112)
1. LOW/MED — registration role cards don't follow a live language switch (`src/screens/Auth/steps/RoleStep.tsx` builds ROLES at module scope). → T-579
2. LOW — parcel copy leftovers (passenger searching cancel, driver at-pickup Cancel, cancellation card). → T-579
3. LOW — NearbyDrivers status text hardcoded English. → T-579
4. LOW — receipt labels untranslated; plate placeholder no Roman Urdu. → T-579
5. LOW (backend) — parcel declaration / prohibited items no Roman Urdu. → BE-112
6. LOW — tier names inconsistent (booking "Car" vs Activity "Gaari"). → BE-112 + T-579
7. LOW — driver LogBox unhandled promise after a requeue cancel. → T-579

## Local data
#244 (driver cancel after requeue; requeue_count set by hand, one decline row deleted), #245 and #246 (no-show Rs 50), #247 (parcel cancelled after arrival; requeue_count set by hand). Passenger wallet 20.00 → −80.00; driver −2804 → −2788. Notifications 145–153. Restored: backend .env fee caps, parcel tier inactive, driver opt-in 0, users 2 and 3 locale en. No active rides. Sims signed in, English; driver offline.
