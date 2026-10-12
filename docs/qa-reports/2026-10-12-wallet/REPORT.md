# QA: wallet (2026-10-12-wallet-b)

**Result: FAIL (design only)** — wallet, commission settlements, earnings, stats and dark mode all pass; check 1 fails on emoji/non-pill buttons in the ride flow (UI-R10/UI-R13 scope). Three new functional bugs.

- App 998f09d (MDI build), backend after BE-71; local only; sign-in by phone OTP 246810
- Passenger iPhone 17 FFD40F6E, driver iPhone 17 E375B9F1

## Checks
1. Icons/pills/money: PASS no "?" boxes, "Rs 1,234" on both roles, wallet/home pills. FAIL fare-confirm sheet emoji (🚗 📏 🔔) + clipped "Rs 150" heading; ride-flow buttons not pills (both roles).
2. Ride → wallet: PASS ride 201; driver −Rs 2,118 = commission owed; earning Rs 120 neutral, commission −Rs 30 red; detail breakdown correct; passenger cash-only wallet; filters. Minor: ride rows show "Payment method: Cash at office".
3. Pay commission: PASS prefill, min Rs 1, > owed, bank ref required, submit → Waiting for review, cancel, resubmit, admin approve → owed drops + "Commission Paid +Rs 500", reject note visible. FAIL Report payment ignored while the number keypad is open (no Done key).
4. PASS driver Today tiles, Earnings day/week/month, passenger Home stats.
5. PASS dark mode on Wallet/Earnings/settlements.

## New bugs
| Sev | Finding | Task |
|---|---|---|
| Medium | Pay commission: Report payment does nothing while the keypad is open; keypad has no Done key | T-509 |
| Low | Ride ledger rows labelled "Cash at office" (settlement wording) | T-509 |
| Low/Med | Notifications list stale on tab focus while the badge updates | T-513 |
| Low | "Ride Completed" notification says "Fare: PKR 150"; drivers get passenger-facing text | BE-72 |
| Low (design) | Emoji + non-pill buttons in fare-confirm and driver ride sheets | UI-R10 / UI-R13 |

## Data
Ride 201 completed; settlements 1 cancelled, 2 approved (Rs 500), 3 rejected. Both signed in; driver Online; no active rides.
