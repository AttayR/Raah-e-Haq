# QA: T-520 safety, T-524, T-531/T-532 (2026-10-14)

Build 35557af, Debug (native rebuild), local backend with RIDES_PIN_ENABLED=true, TELEPHONY_DRIVER=fake. Passenger FFD40F6E, driver E375B9F1 (iPhone 17, iOS 26.5). Rides #210, #211.

| Scenario | Result | Evidence |
|---|---|---|
| A. Cold start: native → JS splash, no white flash, home without waiting, backend down still opens | PASS (logo blinks 0.4–0.9 s between splashes; dark splash before a light app) | A01–A09 |
| B. Safety: PIN card, PIN pad (wrong/right/lockout 2:00), SOS sheet + confirm + one incident + SMS composer, driver shield, share page in Safari + revoke 404 | PASS except **Share trip in the app does nothing** (local http share URL rejected by the https-only check, no error toast); Call can't be verified on the simulator (no Phone app) | B01–B21 |
| C. No sideways turn at start, PIN card hidden after start, completion, chat "closes at" then read-only | PASS | C01–C08 |
| D. Emergency contacts add/edit/delete, duplicate error, max 3 | PASS | D01–D10 |
| E. Nearby drivers on Home, Activity icons, vehicle lines, "Lib" → Lahore, Drive follows | PASS | E01–E06 |
| F. Rating sheets, inbox | PASS | F01–F06 |

Bugs → T-539: Share trip silent failure; SOS and PIN sheets have no side padding; keyboard closes after each wrong PIN; logo blink between native and JS splash; trip panel name slides under the handle; fake telephony number looks like a real Karachi number (backend). Local data: SOS incident #1 open, two QA emergency contacts on the passenger.
