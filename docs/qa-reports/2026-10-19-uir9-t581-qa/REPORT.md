# QA: UI-R9 (passenger Home + destination search) and T-581 (2026-10-19)

QA RESULT: FAIL (1 low-medium, 4 low, 2 observations). Every T-581 item works except Messages pull to refresh. Other failures are UI-R9 spec gaps.
DEVICE: iPhone 17, iOS 26.5 — passenger FFD40F6E… (light, plus a dark pass and a 1.3x text pass), driver E375B9F1… (light). App f9306ae on Metro 8081; local backend 28abaae. Backend stopped twice ~30 s (Home error, chat retry) and restarted. No reseed.

## UI-R9 — Home
1. Peek 170 pt above the real tab bar; chip row clean (01). PASS
2. Locate ~16 pt above the sheet at peek/half, hidden at full (01, 02, 31). PASS
3. Chip order: parcel first when on (40), "Turn on location" first when off (43), then Home/Work, ≤3 recents, "+ Add", "Saved places". PASS
4. Recents from completed rides only; cancelled #252 shows "No charge" in the card but no chip (30, 32). PASS
5. No Home → "Add home" opens the editor on Home (06, 07); with Home → "+ Add". PASS
6. Half: Recent rides card with fare/"No charge" and day · time (02, 30). PASS
7. Backend stopped: no place chips, no Add chip (03); compact error fully visible at half (04); Try again recovered rides (05). PASS (saved chips not back until relaunch — obs 6)
8. Empty-account hint — N/A (no empty local passenger).
9. Recent chip "Plot 65" and saved "Work" open Booking at the vehicle step (28, 33). PASS
10. After a ride ends (#253 completed, #254 cancelled) the peek stays ~202 pt with "Recent rides" header at peek (2/2); relaunch restores 170 (26, 29, 49). FAIL (bug 1)
11. Dark Home and search (34, 35). PASS
12. 1.3x text: chips one line, row scrolls (36, 36b). PASS

## UI-R9 — Destination search
13. "Where to?" opens with keyboard, destination focused, sheet full, Saved + Recent shortcuts (08, 35). PASS
14. Typing hides shortcuts and quick row; clearing restores (09, 14). PASS
15. "Set location on map" footer only with "No places found" or an error, not while results show (13, 47). FAIL (bug 2)
16. Pickup focused → saved "Work" → keyboard closes, pickup fills, list switches to destination, "Use current location" appears (15). PASS
17. Destination shortcut → route + vehicle step (16). PASS
18. After a shortcut pick, fresh suggestions on typing (17). PASS
19. "Use current location" only when pickup isn't current (08 vs 15). PASS
20. Choose on map: info Banner + Cancel; tap sets the point and draws the route; trip card says "Pinned on map" (address resolved only at create) (18, 19). PARTIAL (bug 4)
21. No second GET /rides within 60 s opening search from Home. PASS
22. OBS: once a fast swipe on suggestions picked the row under the finger (10); not reproduced.

## T-581
23. Long-press unread notification: dot clears, nothing opens (2/2) (37). PASS
24. Empty chat note upright for both roles (20, 21). PASS
25. Old requeued "Ride Cancel" (#249) → Ride details (38). PASS
26. Live ride row (#254) → Booking (48). PASS
27. "Turn on location" → 12 s → "Don't Allow": chip stays, opens Settings (top level) (43, 44). PASS
28. Allow after 12 s: map centres, chip goes (45). PASS
29. Suspended account: no red/empty Console Error from getRides (46). PASS
30. Location off → map over Lahore (43). PASS
31. Messages open while #253 completed → moved to Earlier within ~16 s; GET /chats every 15 s (24, 25). PASS
32. Messages pull to refresh: no spinner, no extra GET (3 tries). FAIL (bug 3)
33. Type + immediate Send sent on the first tap, but stored "QA test" when "QA test one" was typed; " one" stayed (22). PASS with bug 5
34. Backend stopped → "Not sent. Tap to retry."; retry delivered #14 (23). PASS
35. Roman Urdu receipt "Ride ki ID" (39). PASS
36. Parcel tier off + background 2 min 20 s → chip gone; GET /public/vehicle-types on foreground (40, 41). PASS

## LogBox
Yellow "Open debugger to view warnings." ~10 s after the OS location prompt opened (both runs) and at cold start on the suspended account. Likely `logger.warn('Location error:', …)` in useNativeLocation.ts when the lookup times out under the prompt. No red errors.

## Visual
- Home peek stays tall after a ride ends (bug 1).
- While typing, a sliver of the hidden pickup row shows under the handle (09, 47).
- Passenger "Ride cancelled" panel (before pickup) still offers "Driver asked for more?".
- After Done on the completed/cancelled panel the passenger lands on "Plan your trip" instead of Home; "1 driver nearby" stayed after the driver went offline.

## New bugs (filed as T-582)
1. LOW-MED — Home peek stays ~202 after a ride ends (HomeSheet live-peek flag stale or BottomSheet not re-snapping on a smaller peek).
2. LOW — "Set location on map" footer missing while suggestions show (LocationSearch.tsx:338).
3. LOW — Messages pull to refresh never fires (ChatList RefreshControl on a short list; alwaysBounceVertical).
4. LOW — Choose on map shows "Pinned on map" instead of an address until create.
5. LOW (confirm) — immediate Send can drop the last typed characters.
6. OBS — Try again recovers rides but not saved places after a failed first read.
7. OBS — expected situations logged as warnings (location timeout under the prompt, suspended cold start).

## Local data
#253 car completed (chat #12–#14 fake text); #254 accepted then passenger-cancelled; notifications 170/171 read. Restored: saved place 1, ride #252 dropoff, user 3 status, parcel tier, locales. No active ride; driver offline. Passenger location granted again; driver sim custom location 31.5119, 74.3473. Both signed in, English.
