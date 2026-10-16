# QA: T-533, T-553, T-555 (2026-10-16)

QA RESULT: PASS (no regressions; small new issues filed as T-556)
SCOPE: fix/phase-2-onboarding 6d63a1e; pod install + clean build (only MaterialCommunityIcons.ttf in the .app); iPhone 17 QA sims; local backend with BE-89

## Results
- T-533 icons — PASS: login, registration step 1, OTP, account status, tabs, map controls, wallet, earnings, driver ride back arrow, chat, stars render; all 112 kit glyph names exist in the MDI map. OffersRow is not used by any screen.
- T-553 — PASS: no "+" button anywhere; sheet leaves compact mode after picks; pickup pick moves the map; stop suggestions above the keyboard; trip card lists 3 stops; driver card "Stop 3"; refused arrival shows the banner with distance (no toast); ride #211 with 3 stops completed; cameras keep framed markers above the sheet. The Send-code format error reproduced only with the simulator's text injection lag (not app state).
- T-555 — PASS: driver sees the sender note, passenger the recipient note on a JazzCash money request; plain "JazzCash se top up kiya" has no note; "Captain Ali" refused under the name field, DB name unchanged.

## New issues (T-556)
1. Registration active-step icon white on white (pre-existing).
2. Developer copy "(API accepts only these values)" in the registration relationship hint.
3. Driver card with exactly 3 stops shows "+1 more stop" instead of the third address.
4. Ride cameras clip markers they don't frame (other stops under the sheet/status bar).
5. Receipt "Time · 2 min" next to the locked 18-min time charge.
6. Edit profile: sticky Save covers "About you" on first open.
Also: arrival distance above 1 km as km; stop-search header cut off while typing; Phone Verification has no back button; one "Stop done" tap ignored once.

## Data
Ride #211 (3 stops, Rs 320) completed; chat messages above; names restored; driver offline; no active QA rides.
