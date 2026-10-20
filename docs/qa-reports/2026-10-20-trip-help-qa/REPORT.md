# QA: trip, help and in-review tasks (2026-10-20/21)

QA RESULT: FAIL (1 high, 1 medium, 3 low, 1 question). Run on main 0d6fbe7, local backend, iPhone 17 x2 (passenger Ali FFD40F6E, driver Bilal E375B9F1). Report text by rh-qa, saved by the orchestrator.

| Task | Result | Notes |
|---|---|---|
| T-587 reach + auto-accept | PASS (partial) | "Sent to 1 driver" then "1 driver viewing" (19, 22); offer-viewed/declined reach the backend. Auto-accept paused on the simulator (mocked location). |
| T-589 cancel follow-ups | PASS | Cancel dialog open across accept switches live to the free-window copy (22, 23). No LogBox. |
| T-590 nearby markers | PASS | Poll ~15 s on Home, stops off focus; coarse marker drawn; count matches meta (49). |
| UI-R11 Drive v2 + request sheet | PASS (2 minor) | Request sheet matches server (Rs 150, You keep Rs 120 · 20%), 20 s ring (04); rider cancelled (27). |
| UI-R12 passenger trip | PASS | Ride #327 end to end, receipt Rs 150, rating saved; fee cancel #329; free cancel #331; parcel "Delivery cancelled" #330. |
| UI-R13 driver trip | PASS (1 minor) | Arrived, PIN, slide start/complete without crash; receipt 100+35+12+3=150, 30 commission, 120 kept. |
| UI-R16 Account / Profile | PASS | Stats match /me/stats both roles; edit name; appearance switch. |
| UI-R17 Earnings | PASS (1 minor) | Day/week/month match /driver/earnings; strikes; paging; trip row opens details. |
| UI-R18 Help / Invite / Delete | PASS | Ticket create/reply/closed; invite copy/share; delete + restore on throwaway 79 and 80. |
| UI-R20b Home services | FAIL | Bug 1 (already fixed by cc23f15 after this run's base). |
| UI-R21 brand orange | PASS | |

## Bugs
1. HIGH — Home Ride/Parcel row collapsed after any ride a driver accepted (28, 29), 3/3. Root cause (stale Reanimated height) fixed in cc23f15; recheck on the next run.
2. MEDIUM — Driver receipt: stars + tag then an immediate "Cash collected" did not post the rating; the second tap did (14). → T-598.
3. LOW — First tap only dismisses the keyboard on Send Code / Verify Code and the parcel form. → T-599.
4. LOW — Drive Today card online time stale (54 min vs 67 in /me/stats and Earnings) (44 vs 45). → T-600.
5. LOW — Driver ride details hero pairs the driver's net (Rs 190) with "Cash (collected by you)" while the rider paid Rs 237 (47). → T-601.
6. QUESTION — An incoming request is only visible on the Drive tab; no in-app banner on other tabs. → T-602.

## Local data
Rides #327 completed, #328–#331 cancelled; Ali topped up Rs 160 via the local test gateway (now Rs 0); ticket #152 closed; deletion requests #3/#4 cancelled (79, 80 active). Sims left in English/light, Bilal offline, no active rides.
