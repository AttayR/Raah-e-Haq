# What the owner needs to provide (2026-10-16)

Everything below is built and tested in code against a local stand-in. Each item only needs an account, key or decision that belongs to the owner. Never commit any of these values; set them in the production `.env` (backend) or the release build config (app). IDs refer to `docs/TASKS.md`.

## Keys and accounts

| # | What | Where it goes | Today | Task |
|---|---|---|---|---|
| 1 | **Google Maps app keys** (new Android + iOS keys, restricted to the app's package / bundle id) | app `.env.production` `MAPS_KEY` (Android manifest and iOS read it at build time) | The old key is committed in git history; rotate it | B-02 |
| 2 | **Google Maps server key** (Directions, Places, Geocoding only; restricted to the server IP; daily quota + budget alert) | backend `GOOGLE_MAPS_SERVER_KEY` | Not set; the backend proxy runs without it locally | B-15 |
| 3 | **Firebase**: new `google-services.json` / `GoogleService-Info.plist` after key rotation; Firestore + Storage rules to deny-all; decide whether to keep Firebase Analytics | `android/app/`, `ios/` | Current files are committed | B-13, B-20 |
| 4 | **Firebase service-account JSON** for push notifications (FCM) | backend `.env` (path or JSON) | Pushes are queued but not delivered without it | B-11 |
| 5 | **SMS gateway account** (e.g. Twilio, Pakistan only) for OTP, with a daily budget alert | backend `SMS_DRIVER`, credentials, `SMS_DAILY_BUDGET` | Local test code 246810 only | B-11, B-16 |
| 6 | **JazzCash and Easypaisa merchant accounts** (sandbox first, then production), callback URLs registered | backend payment `.env` keys | Fake local gateway | B-18 |
| 7 | **Telephony provider** for masked calls (Pakistan proxy numbers) | backend `TELEPHONY_DRIVER` + credentials | Fake provider | B-19 |
| 8 | **Anthropic API key** + monthly spend cap for AI fraud/dispute review | backend `ANTHROPIC_API_KEY` | Local rule-based reviewer | B-22 |

## Hosting and release

| # | What | Task |
|---|---|---|
| 9 | Production server for the Laravel backend: SSL for raahehaq.com, `/api` served, queue worker running, `APP_ENV=production`, `APP_DEBUG=false`, `TRUSTED_PROXIES` set | B-09, B-16 |
| 10 | Hosting for real-time updates (Laravel Reverb + wss proxy), needed for the WebSockets work | B-10 |
| 11 | Before the wallet goes live: run the migration on a staging copy of the production database first | B-17 |
| 12 | Production clean-up: change the admin password, remove seeded test users and fake data, purge old logs. Before deploying BE-113/BE-114: close stale open rides on production (old pending/searching/requested, and any stuck accepted/started), otherwise those passengers can't book; then run migrate before switching code (BE-110 users.locale, BE-113 idempotency table, BE-114 no_driver enum) and `config:cache` (BE-108). BE-116/BE-120 add tables ride_offers and ride_auto_assignments, users.auto_accept_* columns and an admin setting (all additive, auto-accept off for everyone); the Laravel scheduler (`schedule:run` every minute via cron) must be running for `rides:auto-accept` and the retention prunes. BE-124 adds table driver_online_sessions (additive) and a 5-minute sweep command | B-12 |
| 13 | **Apple Developer** and **Google Play** accounts; iOS certificates; Android release signing keystore | B-05, B-21 |

## Decisions still open

- Square crop for profile photos (needs a new native library) — yes or no.
- Admin panel visual redesign — yes or no.
- Keep Firebase Analytics — yes or no (B-20).
- Account deletion (BE-129): confirm with legal how many years trips, payments, safety reports, support requests and ratings are kept (ACCOUNT_DELETION_RETENTION_YEARS, placeholder 5; users see it; the prune job BE-134 waits on it), how forfeited wallet credit is booked, and the kept-data list (vehicle and plate, device checks, chats on reported rides). Put https://raahehaq.com/account/delete in the Play Console "Data deletion" field once APP_URL is https.
- Support email: set the real support address in the production app settings (`support_email`; the local seed uses support@raah-e-haq.com, the app's offline fallback is help@raahehaq.com).
- Invite programme: set REFERRAL_SHARE_URL and the referrer/referee reward amounts.
