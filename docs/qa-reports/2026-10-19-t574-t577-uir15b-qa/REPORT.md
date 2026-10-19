# QA: T-576, T-577, T-574, UI-R15b (2026-10-19)

QA RESULT: PASS for everything in scope that could be exercised. 4 new bugs outside the criteria (1 medium, 3 low). Not tested: Cmd+R (tooling has no modifiers), Earnings loading skeleton (loads instantly locally), wizard Vehicle/Documents steps (step 1 checked), Inbox Messages re-tap (no chats).
DEVICE: QA sims iPhone 17, iOS 26.5 (passenger FFD40F6E…, driver E375B9F1…). Debug build of e560bc3 rebuilt natively with the patched RCTKeyCommands (pod install regenerated codegen; the two tracked files it rewrote were restored). Metro 8081. Local backend only.

## T-576
1. Passenger Home, nothing focused: bare "r" and "d" → no reload, no dev menu, no new bundle; "Liberty" unfocused → no reload (01). PASS
2. Login with keyboard down: "r"/"d" do nothing (47). PASS
3. Cmd+R still reloads — NOT TESTED (no modifier keys in the tool; by code the exact-flag match keeps Cmd+R).
4. "Where to?" focuses the destination; "Liberty" lands in the field; 11 openings in English and Roman Urdu incl. right after switching and after a ride ended; no crash, no new crash report (02, 03). PASS (text sent within ~50 ms of the tap was lost before mount — not human-reachable)
5. No keyboard pop on Back from the vehicle step, Back with a destination set, after a ride ends, or from the saved "Home" chip (04, 05). PASS

## T-577
6. Strike cancel "ab": counter and error above the buttons, no POST (08). PASS
7. No-show #241 (verified, not capped): "The passenger pays the Rs 50 no-show fee…"; one extra GET at sheet open (09a/09b). PASS
8. Cancel as no-show: DB fee 50.00; toast says charged Rs 50 (10). PASS (toast text truncated)
9. Capped parcel #242: "No fee will be charged." + "Keep delivery"; DB fee 0.00; toast just "Ride cancelled." (24, 25). PASS
10. Home with a live ride: chips fully above the tab bar (07). PASS
11. Roman Urdu stepper: "Request hui / Raaste mein / Aa gaya / Trip par", one line each (22, 23). PASS
12. Tab re-tap scrolls to top: Activity rides and wallet, Inbox notifications (both roles), Earnings (13a/b, 14b/c, 40). PASS
13. Inbox Messages re-tap — NOT TESTED (no chats).

## T-574
14. Parcel Done → Home in one tap: cancelled #242 and delivered #243 (26→27, 31→32). PASS
15. Driver: "Parcel accepted…", "Delivery complete", "Keep delivery" (19, 24, 28, 29). PASS ("Parcel returned" not run)
16. Sender: "Your rider cancelled this delivery.", "Thanks for sending…", rating "Your rider / How was the delivery?", details "YOUR RIDER" + "Rider asked for more?"; driver details "YOUR SENDER" (26, 30, 31, 33, 34). PASS
17. Wizard toast on step 1: first red label visible below the toast (48). PASS (Vehicle/Documents re-check open)
18. Request loading at once (parcel spinner caught); car double tap → one ride #241 (06, 18). PASS

## UI-R15b
19. Q1 Account bar hairline on drag-stop and fling-stop, gone at top (20, 21, 45a/b). PASS
20. Q5 title baseline identical across quick tab switches in both roles. PASS
21. Q4 hairline under Inbox/Earnings pinned controls after fling; gone after re-tap/fling to top and after a period change (14b/c, 38, 39). PASS
22. Q3 Earnings loading skeleton — NOT TESTED (instant local load); no title/segment jump on period switch.
23. Pull-to-refresh on Inbox, Account (both roles), Earnings: request fired, settled screen pixel-identical. PASS
24. Q6 Roman Urdu Inbox title + "Sab parh liye" one line (46). PASS

## LogBox
Driver: yellow "Open debugger to view warnings." only. No red boxes, no crashes.

## Visual / copy notes
- No-show cancel toast truncated (10).
- Cancelled (not refused) parcel timeline on the sender screen skips accepted/arrived (26).
- Parcel leftovers: "Ride details" title, "Rate this trip", "Cash (paid to driver)", driver "Ride cancel karein", driver cancel toast "Ride cancelled." on a parcel.
- Server notifications use ride wording for parcels ("Driver Arrived", "Your driver cancelled the ride").
- Ride details map renders black when partly scrolled off (likely sim lite mode) (33/34).

## New bugs (filed as T-578, BE-111)
1. MEDIUM — passenger Home keeps "Return to your ride / Your driver is on the way" after the driver cancels (≥45 s); Home doesn't poll the ride (11, 12). → T-578
2. LOW — driver ride history row and details header say "No charge" for a no-show the passenger paid Rs 50 for (35). → T-578
3. LOW — Send a parcel second submit: error toast but no scroll to the off-screen prohibited-items checkbox (15–17). → T-578
4. LOW (server copy) — no-show notification "A no-show fee of Rs 50 was added to your wallet" reads like a credit; parcel notifications use ride wording. → BE-111

## Local data
#241 car no-show Rs 50 charged; #242 parcel no-show fee 0 (pair cap); #243 parcel completed (pickup via tinker, ratings skipped). None active. Parcel tier and driver 2 opt-in restored; cache flushed. Sims: passenger 3 on Home, driver 2 offline, English.
