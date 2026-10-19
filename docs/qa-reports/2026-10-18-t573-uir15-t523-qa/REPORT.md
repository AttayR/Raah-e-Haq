# QA: T-573, UI-R15, T-523 (2026-10-18, finished 2026-10-19)

QA RESULT: FAIL on one new bug (native SIGSEGV on the passenger app in Roman Urdu, not reproduced on a second try). T-573 PASS. UI-R15 PASS (minor visual notes). T-523 main flows PASS; remaining English mostly in T-575 scope.
DEVICE: QA sims iPhone 17, iOS 26.5 (passenger FFD40F6E…, driver E375B9F1…), Debug apps on Metro 8081 at 0eddfe5. Local backend only. Timing from `simctl recordVideo` frame sheets; requests checked in the `artisan serve` log. Run paused once on a usage limit and resumed.

## T-573
1. Strike cancel #238: "ab" → "Please write at least 3 characters", no POST; keyboard, Done bar, counter (01–03). PASS (error/counter hidden under the footer with the keyboard up — bug 2)
2. Scrim closes the idle sheet. PASS
3. No-show on #238 (arrived_at backdated): Keep, then taps at ~0.05/0.1/0.2 s over 4 rounds — ride stayed arrived, no cancel call (05). PASS
4. Keep → reopen within ~0.3 s → 3–8 taps while rising: nothing sent, copy stayed "Passenger didn't come" (06). PASS
5. Double-tap Cancel + scrim + Keep while sending: exactly one POST /rides/238/cancel; sheet not closed mid-send (07). PASS
6. Parcel #239: same checks, sender copy, one POST (08, 09). PASS
7. Note: sheet showed Rs 50 / Rs 30 fee but the server charged Rs 0 (BE-91 per-pair daily cap already used by #236) — bug 3.

## UI-R15
8. Activity light: inline title, segments, chips, summary strip (10); pinned with hairline on scroll (11). PASS
9. Sticky day headers (12–14); completed rows no pill, cancelled pill + "No charge"/"Rs 30 fee". PASS (in-progress pill not observed)
10. Pagination loads pages without bursts. PASS
11. Pull to refresh: rides + me/stats; wallet + transactions. PASS
12. Cancelled-with-fee parcel details: map, "Cancelled", Rs 30; share text has no phone or name (16). PASS
13. Dark mode Activity and details (17, 18). PASS
14. Wallet: large balance, "Ride payment" rows, debit not red, Add money opens (15, 19, 20). PASS
15. Driver Account → Ride history and cancelled details (21, 22). PASS

## T-523
16. Driver Language → Roman Urdu: stays on Account, tabs Drive/Kamai/Inbox/Account (23). PASS
17. Driver online: Drive, Kamai, Inbox chrome, request card, ride screen, PIN, complete — one card, no duplicate toasts (24–26, 33, 34, 37). PASS
18. Passenger: Account, Home greeting/"Kahan jana hai?", Activity, Wallet, booking, live ride, rating, ride complete (27–29, 32, 35, 39). PASS
19. Cold relaunch opens in Roman Urdu with no English frame (30). PASS
20. Live ride #240: language switch both ways on Account — stayed on Account, Booking not pushed, "Return to your ride" works in the new language (36). PASS
21. Switching back to English restores text on both roles. PASS
22. Passenger crash: Roman Urdu → Home → "Kahan jana hai?" → type "Liberty" → app exited (SIGSEGV). Not reproduced after a cold launch (31, 32). FAIL (bug 1)

## LogBox
Driver "Driver location: no new fix, restarting the watcher" with a static sim location; passenger "Cannot connect to Metro" during the pause. No red boxes.

## Visual
- Strike cancel sheet with keyboard: error cut off, counter hidden (02/03).
- Once a sticky day header went missing after a fast fling (not reproducible).
- Re-tapping the Activity tab doesn't scroll to top.
- Home with a live ride: quick chips row cut off by the tab bar (36).
- Driver stepper "Pohanch gaya" wraps to two lines (37).
- English left in Roman Urdu: planner title and step chips, wallet labels/headers, Activity summary labels and "Cancel" pill, Kamai stat labels, Inbox segments, ride details fare labels, server notifications and rating tags (26, 29, 31, 38).

## New bugs (filed)
1. HIGH — passenger SIGSEGV in Roman Urdu opening the planner (crash report RaaHeHaq-2026-10-18-184423.ips: EXC_BAD_ACCESS on the JS thread in `Scheduler::uiManagerDidFinishTransaction` via `RuntimeScheduler_Modern::updateRendering`; suspected Fabric commit race with the per-screen locale remount). → T-576
2. Low — strike cancel sheet error and counter under the sticky footer with the keyboard up. → T-577
3. Low — no-show sheet promises a fee the server won't charge when the BE-91 pair cap is reached. → BE-109 + T-577
4. Low — Home quick chips cut off by the tab bar with "Return to your ride". → T-577
5. Low — Roman Urdu gaps beyond T-575's list. → added to T-575

## Local data
Rides #238 (car, no-show, fee 0 by pair cap), #239 (parcel, same), #240 (car completed, ratings skipped). Arrived_at backdated on #238/#239. Parcel tier and driver 2 opt-in restored; cache flushed. Sims: passenger 3 on Home, driver 2 offline, both English.
