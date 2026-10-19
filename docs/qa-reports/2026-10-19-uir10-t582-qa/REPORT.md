# QA: UI-R10 (choose ride + finding driver), T-582 part 1, BE-113/BE-114 seen from the app (2026-10-19)

QA RESULT: FAIL (1 medium, 3 low, 2 observations). Choose ride, the double-tap guard, finding driver, requeue and relaunch work. Failures: "Cancel request" lands on a "Ride cancelled" panel instead of a toast + Home; immediate Send still drops the last word. BE-113/BE-114 work on the server; the app shows them only generically (T-583).
DEVICE: iPhone 17, iOS 26.5 — passenger FFD40F6E… (light + dark pass), driver E375B9F1… (light). App 447c216 on Metro 8081; local backend 7e6878a. Backend stopped twice ~30 s and restarted. No reseed.

## UI-R10 — choose a ride
1. Route pill "6 min · 2.4 km" and short trip line from the estimate (01, 08). PASS
2. Trip line and route pill go back to search (02, 52). PASS
3. Default tier: first priced (Car) first time, then last used (Bike) (01, 33, 39, 51). PASS
4. Bike → "Request Bike · Rs 80"; Offer + → Rs 90 within one screenshot (~0.3–0.5 s; 150 ms not measurable) (08, 09). PASS
5. Fare details expand in place with "Hide fare details" (10, 11). PASS
6. Footer hairline while content runs under it (07). PASS
7. Stop via map: pin "1", route through it, prices update; "· 1 stop"; removing restores prices (12–16). PASS (stop row "Pinned on map" — T-582 part 2)
8. Two map controls, back + locate (01, 13). PASS
9. Offline banner — SKIP (needs host Wi-Fi change).
10. Backend stopped → "Couldn't get prices" + Try again, route pill hidden; recovers (19, 20). PASS (yellow LogBox)
11. "Discard this trip?" Keep editing / Discard → Home peek (03, 53). PASS
12. Dark choose ride and fare block (17, 18). PASS

## UI-R10 — request and finding driver
13. Request tapped twice + Back: one POST /api/rides, one ride (#255), one ride_idempotency_keys row; Back ignored (21). 3 key rows for 3 bookings over the run. PASS
14. Finding driver: no back, pulse, trip card, "Bike · Rs 95 Cash" = CTA, Cancel request; edge swipe does nothing (21, 23). PASS
15. After 60 s "Still looking. More drivers are joining." (24). PASS
16. Relaunch mid-search restores the state (25). PASS
17. Driver accepts → "Your driver is on the way", PersonCard, "Fare locked: Rs 95", PIN (26, 27). PASS
18. Driver cancels → "Finding another driver" warning subtitle, pulse restarts, copy holds past 60 s; server requeues #255 (28, 28b, 29). PASS
19. Cancel request dialog copy and button order; Keep looking keeps searching (22). PASS
20. Confirm Cancel request → "Ride cancelled / You cancelled this ride / Done" panel, no toast; Done → "Plan your trip"; two Backs + Discard to reach Home (30, 31). 2/2. FAIL (bug 1)

## BE-113 / BE-114 in the app (handled by T-583)
21. 409 RIDE_ALREADY_ACTIVE (#256 created via API with a temporary local token, revoked): legacy red "Ride Request Failed" modal with the server text, OK back to choose ride, no "Open it"; no extra ride; relaunch opens #256 (34–36). OBS
22. Expiry while open (#256 backdated 11 min): next poll → cancelled/no_driver, "No Driver Found" notification; app shows generic "This ride was cancelled." (37). OBS
23. Expiry while closed (#257): first GET /rides expires it; app opens on Home silently; only the Inbox notification (38). OBS

## T-582 part 1
24. Ride ends while Booking covers Home (#258 completed): Home peek ~166–170 pt, locate ~16 pt above (40–42). PASS
25. "Set location on map" from the first character, last under suggestions (04, 06). PASS
26. Messages pull to refresh: spinner + GET /api/chats 3/3 (44). PASS
27. Immediate Send of "QA test one" stored "QA test"; " one" stayed in the field (45). 1 try (fast text injection). FAIL (bug 2)
28. Backend down cold start → "Saved places" chip + rides error; Try again restores rides and saved chips (46–48). PASS
29. Location prompt open 25 s → no LogBox; Allow → chip goes (49–51). PASS

## LogBox
Yellow "Open debugger to view warnings." three times: estimate failure (19), 409 on POST /rides (34), cold start offline (46). No red errors. Likely logger.warn on expected errors.

## Visual
- From a Home chip ("Work") the camera sits on the pickup and the route runs off the left edge (39); from search it is framed (01, 07).
- Route pill unchanged after adding a stop while prices rose (13, 15).
- 409 uses the legacy red modal, not the kit Dialog.
- Cancelled panels keep a back chevron (30, 37).

## New bugs (filed as T-584; bug 4 is T-583)
1. MEDIUM — Cancel request ends on a "Ride cancelled" panel instead of toast "Request cancelled" → Home peek (spec passenger-finding-driver.md "Cancel tap"). cancel.ts, FindingDriver.tsx, ActiveRidePanel.tsx.
2. LOW — immediate Send still drops the last word (ChatComposer; read latest text from a ref updated in onChange).
3. LOW — choose ride from a Home chip doesn't fit the route above the sheet (booking map fit runs before sheet/estimate settle).
4. LOW — 409 and no_driver need real states (T-583).
5. OBS — route pill distance/time don't change with a stop; check /rides/estimate via-stop distance.
6. OBS — yellow LogBox on expected network/409 errors; move to debug.

## Local data
#255 bike requested → accepted → driver-cancelled (requeued) → passenger-cancelled free; #256/#257 van API-created, expired no_driver (requested_at restored); #258 bike completed Rs 80, not rated; #259 bike accepted then passenger-cancelled, fee 0, chat #15 "QA test". Notifications ~176–181; 3 idempotency rows. Temporary token deleted. No active ride; driver offline; driver sim location 31.5119, 74.3473; passenger location granted; light; both signed in, English. Backend running on 127.0.0.1:8000.
