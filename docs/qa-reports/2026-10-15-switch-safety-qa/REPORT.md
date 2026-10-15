# QA: T-538 switches + T-539 safety follow-ups (2026-10-15)

Build 7667884 (native rebuild), local backend with BE-60/84 migrated, RIDES_PIN_ENABLED=true, TELEPHONY_DRIVER=fake. Passenger FFD40F6E, driver E375B9F1 (iPhone 17, iOS 26.5). Ride #212.

| Scenario | Result | Evidence |
|---|---|---|
| Notification switches both roles, light/dark, master off/on, persist, backend-down rollback | PASS | S1-01..12 |
| Cold start: no logo blink native → JS splash | PASS | S2-01..09 |
| Share trip (localhost link), Stop sharing, failure toast above SOS sheet | PASS | S3-02..05 |
| SOS/PIN sheet margins, wrong PIN keeps keypad, correct PIN starts, PIN card hidden after start | PASS | S4-01..05 |
| Trip panel clips below the handle with hairline | PASS | S5-01 |
| Masked call returns +92000… (backend) | PASS | backend log |
| Chat, completion, ratings, inbox | PASS | S7-01..07 |

Minor bugs → T-540: chat composer floats ~70 pt above the keyboard (driver); notification settings dividers misaligned on icon-less rows; top error toast covers the header back button; dark map placeholder in light theme; stale "Network error" banner on booking after recovery. Driver avatar purple circle = seed PNG (BE-15).
