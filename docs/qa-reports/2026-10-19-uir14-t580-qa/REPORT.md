# QA: UI-R14 (Inbox content) and T-580 (2026-10-19)

QA RESULT: FAIL (2 medium, 3 low-medium, several low/cosmetic). Every T-580 item passes except the Home chip after "Don't Allow".
DEVICE: iPhone 17, iOS 26.5 (passenger FFD40F6E… light; driver E375B9F1… dark for driver UI-R14 checks, back to light). iPhone SE not tested (no SE sim; new-sim access requests time out while the owner is away).
BUILD: app 2cef2a6 Debug on Metro 8081; backend local 28abaae. Backend stopped ~30 s for the chat retry test, then restarted. No reseed.

## UI-R14 — Notifications
1. Sticky day headers, one card per day, unread dot + bold title (01–03). PASS
2. Category tiles: ride car tile, wallet tile, chat tile (04). PASS
3. Pagination pages 2–4 with footer spinner. PASS
4. Pull to refresh → GET /notifications + unread-count (05). PASS
5. Tab re-tap scrolls to top at rest (ignored during momentum). PASS
6. Tap marks read (POST …/155/read). A stale "Ride Cancel" (#249, requeued) opened the live booking screen for a long-cancelled ride (06, 07). PASS with bug 3
7. Long-press an unread row marks read but ALSO opens its target (2/2) (08). FAIL (bug 1)
8. Unread filter (09). PASS (first chip tap during initial load ignored)
9. "Mark all read" only while unread > 0; clears rows; "You're all caught up"; tab badge drops (10). PASS
10. Driver dark: same layout; Trip Completed opens Earnings, badge 27 → 26 (11, 12). PASS
11. Chat notification opens the thread (37). PASS

## UI-R14 — Messages
12. Per-role empty copy (13, 14). PASS
13. Live ride #250: "Current ride" with unread 1; cleared after opening; "You: I'm at the pickup" (19, 30). PASS
14. After completion "Earlier"; "Ended" only after the 30-min grace (completed_at moved back 35 min, restored) (31, 34, 35). PASS
15. Messages list stayed on "Current ride" ~2 min after completion until refocus. LOW (bug 7)

## UI-R14 — Chat thread (#250)
16. Header surface under the status bar, no band; Call ~16 pt from the edge; passenger subtitle "Mitsubishi Outlander · Z-0001-19", driver "Your passenger"; Call hidden once closed (16, 20, 33, 36). PASS
17. Empty-thread note rendered upside down on the driver's empty thread (16, 17). FAIL (bug 2)
18. Loading skeleton + disabled composer — NOT SEEN (loads within a frame); placeholders "Message Ali"/"Message Bilal" correct.
19. Composer on the keyboard, no gap/overlap, light/dark; grows ~5 lines; counter from 900 (22, 23, 28). PASS
20. Sent → read double tick on both sides without leaving (21, 24, 25). PASS
21. Backend stopped → "Not sent. Check your connection. Tap to retry."; retry after restart delivered #9 (26b, 27). PASS (copy longer than spec)
22. Quick replies rule; double tap sent once (18). PASS
23. JazzCash transfer message shows the safety note (29). PASS
24. Closed bar after the grace window, history stays; grace-window bar "Chat closes at …" with composer open (32, 33, 36). PASS
25. First Send tap right after typing ignored twice on the passenger (not on the driver). OBS (bug 8)

## T-580
26. Driver location revoked → whole "Location needed" card with Open Settings + Try again; grant → normal peek, map recentres, no relaunch (38, 39). PASS
27. Passenger location denied → map + sheet + Back, "Location is off" banner with "Turn on", no current-location chip, "Choose on map" (41). PASS
28. Manual pickup + destination → fare → booked #251 → cancelled (42–44). PASS
29. Already-denied: Home chip opens Settings (40). PASS
30. Right after "Don't Allow" from the chip, the chip disappears until a tab switch (2/2); LogBox warning at that moment (45–47). FAIL (bug 4)
31. Rejected shows reason card; suspended with the old reason in DB shows none; restored to active → Home + toast (48, 50). PASS
32. Check status: hero still; "Your account status has not changed." PASS
33. Parcel #252 cancelled while searching (Roman Urdu): "Aap ne ye delivery cancel ki." (53). PASS
34. Language switch both ways → tiers relabel with exactly one GET each (51, 55). PASS
35. Roman Urdu "CANCEL KI TAFSEEL" and "Gaari chuni gayi · 2.26 km · 6 min" (52, 54). PASS

## LogBox
- "Render Error: Cannot read property 'rowAvatar' of undefined" (ChatRow) once before the first full reload — hot-reload leftover, gone after relaunch (00).
- Empty "Console Error" from RideService#getRides at cold start while the account is refused (49) — bug 5.
- Recurring "Open debugger to view warnings." (15).

## New bugs (filed as T-581)
1. MEDIUM — long-press on an unread notification marks read and also opens it (NotificationRow onPress after onLongPress).
2. MEDIUM — empty chat-thread note upside down (ListEmptyComponent of an inverted FlatList on RN 0.80).
3. LOW-MED — old requeued "driver cancelled" notification opens the live booking screen for a long-cancelled ride (notifications routing trusts `requeued` without the ride's current status).
4. LOW-MED — T-580 Home chip after "Don't Allow" still disappears on iOS 26.5 (useNativeLocation iOS branch).
5. LOW — refused account (403 ACCOUNT_*) makes getRides log an empty console.error (rideService.ts:533); don't log expected refusals or skip /rides while blocked.
6. LOW — map default region is Karachi while the service area is Lahore (mapsConfig DEFAULT_REGION).
7. LOW — Messages list doesn't refresh while open (finished ride stays in Current ride until refocus).
8. LOW (confirm) — first Send tap after typing ignored on the passenger.
9. COSMETIC — failed-send copy longer than spec; "Ride ID" English on the Roman Urdu receipt; "Send a parcel" stays on Home after the parcel tier is switched off until relaunch.

## Local data
#250 car completed (chat #7–#11 fake text; completed_at moved back and restored), #251 car booked with location off then cancelled, #252 parcel cancelled while searching. Notifications 153–155 read + mark-all for passenger 3; driver Trip Completed read. Restored: user 3 status/reason, parcel tier off, users 2/3 locale en. Seeded rides #1–#3 were already active and untouched. Driver offline; location granted on both; English.
