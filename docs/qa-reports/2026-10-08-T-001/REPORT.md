# QA report: T-001 release-bundle blockers (2026-10-08)

**Result:** PASS (SMOKE-01) · **Device:** iPhone 17, iOS 26.5 · Debug build on the local backend (`.env.development` → localhost:8000)

1. [PASS] Debug build: 0 errors.
2. [PASS] Launch: no red screen. Opened on Home with a stale pre-reseed session; LogBox "No auth" errors (known AUTH-05: 401 doesn't redirect to Login). (step02)
3. [PASS] Settings tab renders. (step03, step04)
4. [PASS] Logout returns to Login. (step05)
5. [PASS] Logo renders on Login, no broken image. (step05)
6. [PASS] Login scrolls; "Create New Account" reachable. (step06)
7. [PASS] Cold relaunch opens on Login with the logo, no errors. (step07)

## Visual / new issues (low)
- Login first view: bottom navy band clips "Create New Account" → design track (T-603).
- Passenger Settings: white status bar over light background, low contrast → design track (T-604).
- Home address text overflows without ellipsis → design track (T-604).
- Logout (in "Danger Zone") has no confirmation → T-102.
- Known mocks: Home stats, promos, notifications (FEAT-08/10/11).

**Server data created:** none.
