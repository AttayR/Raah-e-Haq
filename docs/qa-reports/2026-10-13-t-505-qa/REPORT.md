# QA: T-505 ride rating + UI-R5 ride components (2026-10-13)

Build be3a31b (JS reload), local backend. Passenger FFD40F6E, driver E375B9F1 (iPhone 17, iOS 26.5). Ride #207.

| Scenario | Result | Evidence |
|---|---|---|
| 1 Full ride, UI-R5 cards, driver docked footer | PASS | s1-* |
| 2 Passenger sheet, star bands, max tags, submit, toast | PASS except comment hidden under keyboard | s2-01..07, FAIL s2-08/09 |
| 3 Driver Skip, no re-prompt | PASS | s3-* |
| 4 Ride details: Your rating / Rate this trip | PASS | s4-* |
| 5 Already rated (409) closes quietly | PASS | s5-* |
| 6 "New" for < 3 ratings | PASS | s6-01 |
| 7 Dark mode sheet | PASS | s7-01 |

Bugs → T-519: rating sheet body collapses to ~40 pt with the keyboard open (comment box hidden); driver name "Test Driver" vs "Test" in details; driver Home shows "Resume ride" for a completed ride until Done.
Bug → T-517: driver ride map not framed on the trip (no pickup/route/car visible).
