# QA report: T-003 Babel worklets plugin + release console strip (2026-10-08)

**Result:** PASS (SMOKE-01) · iPhone 17, iOS 26.5 · Debug build, local backend, Metro :8088 (reset cache)

1. [PASS] Safety: `.env.development` → localhost; backend 200; Metro running.
2. [PASS] App relaunched, bundle rebuilt from clean cache; no red screen. (01)
3. [PASS] No Reanimated/worklets deprecation warning in Metro or device log.
4. [PASS] Signed in as local passenger; Home loads. (04)
5. [PASS] Map loads, marker, reverse geocode, panning. (05, 06)
6. [PASS] Tab switches, stack push and edge-swipe back animate correctly. (09–13)
7. [PASS] Home entrance animation completes. (13)
8. [PASS] `logger.debug` prints in Debug (via device log / DevTools in RN 0.80); addresses show `[REDACTED]`; no tokens/emails/phones in device-js-log.txt.

Note: app code doesn't use Reanimated animations directly; this confirms Reanimated boots cleanly with the new plugin. Release-bundle stripping is covered by `__tests__/config/babel.config.test.ts`.

## Issues seen (routed to design tasks)
- Keyboard covers inputs on Login (Email) and Map destination search — medium → T-603, T-604.
- Map floating buttons under status bar / Dynamic Island → T-604.
- Home: address overflow, clipped promo title, expired promo date (fake data, FEAT-10), header circle over clock → T-604 / T-506.
- Notifications "Mark all" wraps → T-607. Settings status bar contrast → T-618.

**Server data created:** none.
