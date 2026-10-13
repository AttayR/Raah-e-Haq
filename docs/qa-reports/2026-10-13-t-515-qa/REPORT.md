# QA: T-515 wallet top-up + T-516 saved places (2026-10-13)

Build b425b2f, Debug, local backend (fake provider). Passenger FFD40F6E, driver E375B9F1 (iPhone 17, iOS 26.5).

| Scenario | Result | Evidence |
|---|---|---|
| (a) Add money visible, presets/limits, field errors | PASS | a01–a03 |
| (b) Card top-up Pay / Decline, detail card | FAIL (history not refreshed on return; pull-to-refresh fixes) | b01–b07 |
| (c) Mobile wallet 1234 paid / 0000 declined / 9999 pending | PASS | c02–c05 |
| (d) Polling pauses in background, resumes on return | PASS | d01 |
| (e) Driver top-up lowers commission owed (Rs 1,648 → 648) | PASS | e01–e05 |
| (f) Top-up notification opens wallet | PASS | f01–f02 |
| (g) raahehaq://wallet/topup deep link; other paths ignored | PASS | g01–g03 |
| (h) Saved places add/edit/delete, Set pickup | PASS | h01–h08 |

Bugs → T-518: (1) wallet history stale after top-up (usePagedList skips refetch on focus); (2) provider label "Fake" vs "Test gateway"; (3) top-up detail shows "Payment method: Wallet", top-up id wraps.
Minor (UI-R10): after Set pickup the booking opens on the destination step without a pickup summary.
