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
| 12 | Production clean-up: change the admin password, remove seeded test users and fake data, purge old logs | B-12 |
| 13 | **Apple Developer** and **Google Play** accounts; iOS certificates; Android release signing keystore | B-05, B-21 |

## Decisions still open

- Square crop for profile photos (needs a new native library) — yes or no.
- Admin panel visual redesign — yes or no.
- Keep Firebase Analytics — yes or no (B-20).
