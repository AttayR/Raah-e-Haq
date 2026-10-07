# QA report: T-005 Env config (2026-10-08)

**Result:** PASS (SMOKE-01, SMOKE-02)
**Device:** iPhone 17 (iOS 26.5) simulator, Debug build only
**Backend:** LOCAL Laravel at http://localhost:8000 (production raahehaq.com is down; owner instructed not to test against production). Release build was not run.

## Steps
1. [PASS] Debug build used `ENVFILE=.env.development`; generated config has `API_URL=http://localhost:8000/api`, `WS_URL=ws://localhost:8080`.
2. [PASS] SMOKE-01: app launches to Login, no red screen, no "[env] Missing required config". (01-launch-login.png, 02-login-scrolled.png)
3. Owner signed in manually with the local seeded passenger account (`passenger@raah-e-haq.com`). No credentials typed by agents.
4. [PASS] Local backend log shows the app's requests at 2026-10-08 00:25:09: `POST /api/auth/login`, `/api/notifications`, `/api/notifications/unread-count`. No request to raahehaq.com observed (Metro, device and system logs checked; static grep of src clean).
5. [PASS] SMOKE-02: Home renders "Test Passenger"; Map (Google Maps tiles load with key from env), Notifications, Chat and Settings tabs all open without crash or error toast. (03–07 screenshots)

## Observations (not caused by T-005)
- Home stats, notifications list and chat threads appear to be hardcoded demo content rather than API data (existing prototype findings).
- Login: the bottom safe-area band hides half of "Create New Account" until scrolled (cosmetic).
- Expected noise: ws://localhost:8080 has no server; FCM aps-environment error on simulator.

## Environment notes
- Metro ran on port 8088 (8081 was taken by another project); simulator default `RCT_jsLocation=localhost:8088` set for this app only.

## Server data created
None (sign-in only, on local fake data).
