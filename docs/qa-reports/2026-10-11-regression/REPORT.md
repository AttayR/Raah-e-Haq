# QA: regression (2026-10-11-regression)

**Result: PASS** — all five checks pass; passenger keyboard placement unverified (sim keyboard setting). New low/medium bugs filed.

- App db4050b (native rebuild), backend 2475f6a; local backend only
- Passenger iPhone 17 FFD40F6E, driver iPhone 17 E375B9F1 (iOS 26.5)

## Checks
1. T-512 chat: PASS driver composer above the keyboard (ride 208), messages both ways, read-only notice "until tomorrow at 3:37 PM". UNVERIFIED passenger composer (software keyboard never appeared on that sim). Recheck: composer may keep leftover text after send.
2. T-413: PASS — driver stays on ride screen; Home "Resume ride" card; passenger cancel shown to the driver in ~6 s without a tap (ride 209); dark ride map with readable status bar.
3. BE-68: PASS — sign-out while Online sets offline; sign-in stays offline until Go online.
4. T-207 + T-203: PASS — 17-year DOB refused with the message; licence number input saved; CNIC front/back, licence front, 4 labelled vehicle slots (remove/re-pick keeps the side); registration via OTP 246810 → pending screen lists 8 documents In review; DB types correct; admin reject → driver sees Rejected + reason + Re-upload → back to In review.
5. Smoke: PASS — full ride 208, receipt, notification badge = DB count, light/dark screens.

## New bugs
| Sev | Finding | Task |
|---|---|---|
| Medium | "Location Error" alert from useNativeLocation (passenger Home/Map) pops over unrelated screens (chat thread) and repeats | T-315 |
| Low/Med | After completion passenger sometimes lands on "Finding your location" instead of the receipt | T-315 |
| Low | Passenger "driver on the way" map zoomed in too far | T-315 |
| Low | Passenger rating shows ★ 0.0 on the driver's request card / ride screen while profile shows 4.8 | T-414 |
| Low | Seeded approved driver@ sees every document as "Not uploaded" (no driver_documents seed rows) | BE-69 |
| Low (visual) | Passenger profile screen looks dimmed | T-618 (passenger part) |

## Data
Ride 208 completed (messages 5, 6); ride 209 cancelled by passenger; new pending driver user 14 (qa.regdriver1011@example.test, vehicle 8, documents 3–10). No active rides for passenger@/driver@. Both signed in; driver Online.
