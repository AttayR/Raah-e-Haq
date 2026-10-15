# QA: T-521 fares, T-504 profile photo, T-540 polish (2026-10-16)

Build d43f278 (Debug), local backend FARE_FEES_ENABLED=true, RIDES_PIN_ENABLED=true, TELEPHONY_DRIVER=fake. Passenger FFD40F6E, driver E375B9F1 (iPhone 17, iOS 26.5). Rides #213–#216.

| Scenario | Result | Evidence |
|---|---|---|
| A. Offer stepper (band 140–190, step 10), driver sees offer, Fare locked | PASS (fast taps partly dropped) | A1–A6 |
| B. Fee terms, free-until / costs-now confirm, verified waiting timer, no-show fee → "You owe", >Rs 150 blocks booking → Top up | PASS except Activity shows "No charge" on a charged ride | B1–B7 |
| C. Strike warning, "Passenger didn't come" after 5 min (no strike), driver cancel → "Finding another driver" | PASS (re-accept by same driver blocked by design) | C1–C3c |
| D. Overcharge report during trip, admin list shows it | PASS except report sheet has no side padding | D1–D3 |
| E. Driver split, earnings, weekly statements, strikes | PASS except duplicate React key on previous week | E1–E6 |
| F. Profile photo both roles, driver under review, other party's photo on cards | PASS (progress not visible with a tiny file) | F1–F7 |
| G. Composer on keyboard, dividers, toast position, error recovery | PARTIAL (passenger banner auto-clear and map placeholder not seen) | G1–G4b |

Bugs → T-543: Activity "No charge" on fee-charged rides; statement duplicate key (vehicle type + rate); report sheet padding; passenger has no way back into a live ride (no Home banner, Activity opens static details); fee copy reads like a credit ("charged to your wallet"); Top up not prefilled with the owed amount; profile toast covers avatar; driver ride details header scrolls away; Home keeps old route after cancel; driver cancel sheet closed by itself once (investigate). Seed driver photo is a flat purple PNG (BE-15 seed).
