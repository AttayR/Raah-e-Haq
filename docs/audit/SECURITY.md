# Audit: Security (app + backend)

Audited on 2026-10-08 by rh-security (`audit all`), reading code only.
- **App:** `fix/production-hardening` at `4ddf223`.
- **Backend:** `~/My-Projects/Raah-e-Haq-backend`, branch `main` at `d9f2f12`. The `fix/production-hardening` branch described in CLAUDE.md doesn't exist there yet.

No request was sent to production or to any other server, and no scanner was run. Secret values are not reproduced in this file. Tools used: `git ls-files`/`git grep`, `yarn audit` (prod deps), `composer audit --locked`, `php artisan route:list` (local, offline).

Severity: **critical** (any user can take over accounts, money or the admin panel) · **high** (PII exposure or a realistic path to account compromise) · **medium** · **low**.

## Already recorded elsewhere (not repeated here)

| Topic | Where |
|---|---|
| Google Maps key committed, unrestricted and still in git history (rotation is the only fix) | INF-06, PAX-01, B-02, T-109 |
| Release signed with the debug keystore | INF-03, B-05, T-108 |
| Credential, token and PII logs in the app | AUTH-03, INF-04, INF-33, DRV-22, T-006 |
| OTP returned and shown in the app; OTP logged by the SMS stub; `otp_code` returned when `APP_DEBUG=true` | AUTH-02, INF-05, FEAT-16, B-01, BE-16, T-101 |
| Token and PII in plain AsyncStorage | INF-20, T-104 |
| Android release allows cleartext | INF-21, T-108 |
| Notifications socket without auth; no WebSocket server at all | INF-13, FEAT-12, BE-12 |
| `GET /rides` returns every ride (`$user->role` is always null); no ownership on show/update/cancel/destroy; `passenger_id` from the body | FEAT-02, PAX-02, BE-01 |
| assign-driver not atomic, `driver_id` from the body, no driver-role check | FEAT-03, DRV-05, BE-03 |
| Client sets ride status and fare through `PUT /rides/{id}` | FEAT-04, DRV-05, BE-04 |
| `update-location` has no driver-role check; any user reads any driver's latest location | FEAT-06, BE-06 |

## Findings

### SEC-01 · critical · backend authz: no role check on any API route or on the admin panel
**Evidence**
- `php artisan route:list`: 0 of 91 `api/*` routes and 0 of 87 `admin/*` routes carry role middleware. `RoleMiddleware` is aliased in `bootstrap/app.php:15-17` but never used. There are no policies (`app/Policies` doesn't exist). The only in-controller role checks are in `Api/SupportController.php`.
- `routes/web.php:33`: the whole admin panel is `middleware(['auth'])` only.
- `routes/auth.php:15-18`: public web registration is open. `RegisteredUserController.php:158` and `Api/AuthController.php:440` make every passenger `active` immediately.
- Using only a self-registered passenger token, any caller can:
  - `GET /api/users` (`UsersController.php:16-43`): list every user with phone, date of birth and gender.
  - `PUT /api/users/{id}` (`UsersController.php:184`): set another user's password, `status` and `roles`, which includes making yourself admin. `DELETE /api/users/{id}` (`:324`) deletes any user.
  - `POST /api/payments/wallets/{wallet}/adjust` (`PaymentsController.php:40`): credit or debit any wallet by any amount. `GET /api/payments/transactions` (`:15`) lists every user's transactions.
  - Write app settings with arbitrary keys (`SettingsController.php:23`) and create, toggle or delete Home banners with any `image_url`/`action_url` (`:44`).
  - Read `security/audit-logs`, `security/login-attempts` (emails and IPs), `security/security-events`, `analytics/events` and `analytics/export` (`SecurityController.php`, `AnalyticsController.php`).
  - Complete any referral (`ReferralsController.php:82`) and change the referral reward settings (`:200`).
- **Web:** anyone who registers a passenger account on `/register` can sign in on `/login` and open the whole `/admin` panel: user export, driver approval, wallet adjustment, notifications broadcast.

**Impact:** full takeover of the platform (accounts, money, admin panel) by anyone who can register.

**Required fix**
- Put every admin-only API endpoint in a `role:admin` group (users CRUD, payments, settings writes, banners writes, security, analytics, referral settings and completion), and wrap `routes/web.php` `admin.*` in `role:admin`. The middleware should return a JSON 403 for API requests instead of redirecting.
- Add policies for anything a non-admin may touch on their own data.
- Disable public web registration, or keep it and stop it ever granting panel access.
- Add feature tests: a passenger and a driver get 403 on every admin route; an admin gets 200.

### SEC-02 · critical · backend config: production seeding creates an admin with a known password plus test accounts
**Evidence**
- `database/seeders/AdminUserSeeder.php:19-22` creates the admin with a hardcoded, very common 8-character password.
- `UserSeeder.php` creates admin, driver, passenger and pending accounts with the `UserFactory` default password (`database/factories/UserFactory.php:30`, the Laravel default).
- `DatabaseSeeder.php` also seeds fake rides, payments, wallets, analytics and security events.
- `DEPLOYMENT.md:76-77` tells whoever deploys to run `php artisan db:seed --force` in production.

**Impact:** if production was deployed by the guide, anyone can sign in to the admin panel (and to the API as admin) with a password that is public in this repository. Production would also hold fake rides and fake money.

**Required fix**
- **Owner:** check the production admin account and any seeded test users (`users` rows whose emails match the seeders). Change the admin password and delete the test users. This needs server access.
- **Code:**
  - The production seeder runs only `RoleSeeder` and `AppSettingsSeeder`.
  - Demo seeders return early unless `app()->environment('local', 'testing')`.
  - The first admin is created by an artisan command that prompts for the password.
  - `DEPLOYMENT.md` is updated to match.

### SEC-03 · high · backend privacy: driver identity and live position exposed to any caller
**Evidence**
- `RidesController.php:395-450` (`GET /rides/nearby-drivers`) returns each driver's **name and phone** with exact latitude and longitude (`:433-439`) to any authenticated user, within a radius of up to 50 km.
- `DriverTrackingController.php:38-47` (`GET /tracking/drivers-in-radius`) has no limit on `radius_km` and returns raw `driver_locations` rows, so one call returns every available driver.
- BE-06 covers the missing driver-role check on `update-location` and `latest`. Its scope doesn't include these two endpoints.

**Impact:** anyone can map and contact every online driver, and can track a specific driver (a stalking or safety risk).

**Required fix**
- `nearby-drivers` returns only id, vehicle type, ETA and a coarse or jittered position, with no name or phone, and caps the radius at about 5-10 km.
- `drivers-in-radius` becomes admin-only (or is deleted) and validates `radius_km` with a max.
- A driver's phone and exact location go only to the passenger of an accepted, active ride with that driver.
- Feature tests cover all of the above.

### SEC-04 · high · backend logging: full registration payload written to the log
**Evidence**
- `Api/AuthController.php:311-312` logs `$request->all()` on every API registration, and `:374-377` logs it again on validation failure.
- `Auth/RegisteredUserController.php:33-34, 96` does the same for web registration.
- The payload contains the password and confirmation, CNIC, bank account number, bank name and branch, phone, date of birth, address and emergency contacts.
- `.env.example:21` sets `LOG_LEVEL=debug`.

**Impact:** plaintext passwords and national ID and bank data for every user who signs up are stored in `storage/logs/laravel.log`. Anyone with hosting or log access, or with a leaked backup, can read them.

**Required fix**
- Remove these log calls. Log only the user id and validation-error keys, never the values.
- Add a test, or grep in CI, that no `Log::` call receives `$request->all()`.
- **Owner:** purge the existing production `laravel.log` files.

### SEC-05 · high · backend uploads: CNIC, licence and profile images stored on the public disk
**Evidence**
- `Api/AuthController.php:404-405`, `UsersController.php:124, 257` and `RegisteredUserController.php` store with `$file->store($folder, 'public')`.
- That puts the files in `storage/app/public/uploads/{drivers,passengers}/`, which is served without authentication at `APP_URL/storage/...` (`config/filesystems.php:43-45`).
- File names are random, but the URLs are permanent and can't be revoked.

**Impact:** national ID cards and driving licences are publicly downloadable by anyone who has, or leaks, a URL: admin page source, logs, a shared screenshot.

**Required fix**
- Store identity documents on the `local` (private) disk.
- Serve them through an authorised route: the owner, or an admin, gets a temporary signed URL.
- Keep only the avatar public, if needed.
- Migrate the existing files.
- Feature test: an unauthenticated GET of a document returns 403 or 404.

### SEC-06 · high · backend deploy: production would run with debug on
**Evidence**
- `.env.example:2-4` has `APP_ENV=local` and `APP_DEBUG=true`.
- `DEPLOYMENT.md` says `cp .env.example .env` and never sets `APP_ENV=production` or `APP_DEBUG=false`.
- With debug on:
  - `send-otp` returns `otp_code` in the response (`Api/AuthController.php:136`), so anyone can sign in as any phone number.
  - Many handlers return `$e->getMessage()` (for example `UsersController.php:180`, `AuthController.php:555`).
  - Laravel shows full stack traces with environment details.
- B-01 and BE-16 cover the OTP code path itself. This finding is the deploy default that triggers it.

**Impact:** account takeover through OTP, plus disclosure of internals and configuration.

**Required fix**
- **Code:**
  - `DEPLOYMENT.md` lists the production values (`APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=warning`, `SESSION_SECURE_COOKIE=true`).
  - Add an `.env.production.example`.
  - Add a boot-time guard in `AppServiceProvider` that refuses to serve, or logs critical, when `APP_ENV=production` and `APP_DEBUG=true`.
- **Owner:** check the live `.env` on Hostinger.

### SEC-07 · medium · backend sessions: tokens never expire and survive suspension and password changes
**Evidence**
- `config/sanctum.php:43` sets `'expiration' => null`.
- The API login blocks only `pending` and `rejected` (`Api/AuthController.php:49-63, 182-194`), so `inactive` and `suspended` users still get tokens.
- No middleware rejects existing tokens when an admin suspends a user.
- `ProfileController.php:40` (change password) and `AuthController::resetPassword` don't revoke other tokens.

**Impact:** a stolen token works forever. A suspended driver keeps full API access.

**Required fix**
- Set an expiration (for example 30 days) and keep `/auth/refresh`.
- Add an `EnsureUserIsActive` middleware on the `auth:sanctum` group.
- Allow login only when `status === 'active'`.
- Revoke the other tokens on password change and reset.
- Add tests.

### SEC-08 · medium · backend OTP: brute force, SMS flooding and shared phone numbers
**Evidence**
- The only limit is the per-IP `throttle:20,1` shared by all `auth/*` routes (`routes/api.php:30`). There is no per-phone attempt counter, no lockout and no resend cooldown.
- The OTP is stored in plaintext (`Otp.php:36-41`), and `verify` reads then updates, which is not atomic (`:48-58`).
- `phone` is not unique on registration (`Api/AuthController.php:320`). `sendOtp` and `verifyOtp` use `User::where('phone')->first()`, so with two accounts on one number, the OTP signs in to whichever account was created first.

**Impact:**
- An attacker rotating IPs can guess codes.
- Once real SMS is wired up (BE-16), SMS flooding costs money.
- An attacker who registers a victim's number first owns that number's OTP login.

**Required fix**
- Per-phone limits (for example 5 verify attempts per code, 3 sends per 15 minutes), stored hashed.
- Atomic consume (conditional update).
- Make `phone` unique (normalised to E.164) with a migration.
- Do this together with BE-16.

### SEC-09 · medium · backend money: wallet changes are not atomic and accept negative amounts
**Evidence**
- `Wallet.php:39-75`: `addMoney` and `deductMoney` do check-then-`increment`/`decrement` and create the transaction outside any DB transaction, with no row lock.
- `PaymentsController.php:44-48` validates `amount` only as `numeric`, so a `credit` with a negative amount debits without the balance check.

**Impact:** balances can drift or go negative under concurrency or abuse, even once SEC-01 restricts the endpoint to admins. This matters for BE-09.

**Required fix**
- `DB::transaction` with `lockForUpdate()` on the wallet row.
- `amount` validated as `gt:0`.
- Write the ledger entry in the same transaction.
- Concurrency test.

### SEC-10 · medium · backend dependencies: 46 known advisories
**Evidence:** `composer audit --locked` reports 46 advisories in 14 packages. The highs are:
- `laravel/framework` v12.29.0: CRLF in the email rule
- `symfony/http-foundation`: PATH_INFO parsing
- `symfony/mime`: header/SMTP injection
- `guzzlehttp/guzzle`: host-check bypass
- `league/commonmark`: several DoS issues
- `phpunit/phpunit` (dev only)

**Required fix:** `composer update` within the existing constraints, run `php artisan test`, and commit `composer.lock`.

### SEC-11 · medium · app dependencies: vulnerable axios at runtime; an unused SDK brings critical advisories
**Evidence**
- `yarn audit --groups dependencies` reports 8 critical, 141 high, 80 moderate and 7 low advisories. Most are build-time tooling under `react-native`.
- **Runtime-relevant:**
  - `axios` 1.12.2 (`package.json`, the shared HTTP client) has 13 high advisories: prototype-pollution gadgets with header injection and response tampering, proxy-credential leaks, and DoS.
  - The unused `firebase` JS SDK (INF-31) pulls critical `protobufjs` and `websocket-driver`.
  - `@react-native-firebase/auth` pulls `@xmldom/xmldom` highs. It goes away with T-107.

**Required fix**
- Upgrade `axios` to the latest 1.x.
- Remove `firebase` (JS) now rather than waiting for T-701.
- Re-run `yarn audit` and record the remaining build-only items as accepted.

### SEC-12 · medium · Firebase: Firestore and Storage rules are unverified
**Evidence**
- The app ships the Firebase config (`android/app/google-services.json`, `ios/GoogleService-Info.plist`; Firebase API keys are public by design).
- Legacy code reads and writes Firestore `users` (`src/services/userService.ts:34-132`, including `getUsersByRole` and `getUserByPhone`) and Storage `users/{uid}/…` (`src/services/firebaseAuth.ts:483`).
- No `firestore.rules`, `storage.rules` or `firebase.json` is in the repo.

**Impact:** if the project was created in "test mode", anyone with the shipped config can read or write every Firestore document and Storage file.

**Required fix**
- **Owner:** in the Firebase console, set Firestore and Storage rules to deny all (the app is moving to the Laravel API; FCM doesn't need them).
- **Code:** after T-107 deletes the Firebase auth path, remove `@react-native-firebase/firestore` and `/storage`.

### SEC-13 · low · backend: account enumeration
**Evidence**
- `send-otp` answers 404 "No user found with this phone number" (`Api/AuthController.php:111-116`).
- `forgot-password` answers 404 "No user found with this email address" (`:527-532`).

**Required fix:** return the same 200 message whether or not the account exists.

### SEC-14 · low · backend repo: committed database dump (assessed: synthetic data)
**Evidence**
- `raah_e_haq_admin.sql` (484 KB) is a phpMyAdmin export from `localhost`, dated 2025-09-18.
- **Contents (counted, not printed):**
  - 3 `users`. Their names and emails exactly match the seeder placeholders (company domain). `phone` and `cnic` are empty, but `password` (bcrypt) and `remember_token` are present.
  - 2 `sessions` rows with payloads, 150 `login_attempts` (company domain only), 500 `analytics_events`.
  - 651 distinct IPs, generated by `generateIPAddress()` and `generateRandomIP()` in the seeders.
  - 50 `rides` using 5 distinct addresses, 256 `ride_tracking` rows, 1 vehicle.
- **Conclusion:** no real personal data was found. It is seed output.

**Impact:** low. It discloses the schema and hashes of known seed passwords. If production was seeded the same way (SEC-02), these are the same accounts.

**Required fix:** `git rm` the dump, add `*.sql` to `.gitignore`. Rewriting history isn't needed for synthetic data.

### SEC-15 · low · backend repo hygiene: binaries and a script that targets production
**Evidence**
- `composer.phar` (3.1 MB, an unverified binary) and `composer-setup.php` are committed.
- `test_ride_api.php:14` hardcodes `https://raahehaq.com/api` and would create and accept rides on production if run. Its tokens are placeholders, not real.
- `reh` is an empty file.
- `test_images/` holds 11 images, each about 5-11 KB at exactly 800×500, 400×400 or 800×600, with no camera metadata. These are generated placeholders, not real documents.

**Required fix:** delete `composer.phar`, `composer-setup.php`, `reh` and `test_ride_api.php` (or rewrite it as a feature test against the local app), and keep `test_images/` only if a test uses it.

### SEC-16 · low · backend input bounds
**Evidence**
- `per_page` is unbounded in `PaymentsController.php:17,67`, `SecurityController.php:16,26,35` and `AnalyticsController.php:22`.
- `SettingsController::updateSettings` accepts arbitrary keys and types.
- Banner `image_url` and `action_url` aren't validated as URLs (`SettingsController.php:44-60`), so a banner can link anywhere from the app's Home screen.

**Required fix**
- `per_page` validated as `integer|max:100`.
- Settings keys allow-listed.
- `url` plus an `https` rule on banner URLs.
- These endpoints are admin-only after SEC-01.

### SEC-17 · low · app transport: no HTTPS enforcement per build
**Evidence**
- `src/config/env.ts:46-51` accepts `http://` and `ws://` for every build, so a wrong `.env.production` would ship cleartext without any error. Today `.env.production` correctly uses `https`/`wss`.
- iOS `Info.plist:33-34` sets `NSAllowsLocalNetworking=true` for Release as well as Debug.

**Required fix**
- In `readEnv`, require `https://` and `wss://` when `!__DEV__`, with a unit test.
- Set `NSAllowsLocalNetworking` only in the Debug configuration, or accept it as low risk. It allows only local addresses.

### SEC-18 · low · app storage: notification history cached in plain AsyncStorage
**Evidence:** `src/services/notificationService.ts:247` stores up to 100 notifications unencrypted. Ride notifications carry the driver's name and phone (`RidesController.php:283-287`).

**Required fix:** don't cache notifications. Read them from `GET /notifications` (T-502), or clear the cache on logout (T-102).

### SEC-19 · low · app transport: WebSocket URLs from API responses are opened without checks and bypass `env.WS_URL`
Found in the Phase 0 gate audit (app `087162a`).

**Evidence**
- `src/services/webSocketService.ts:52-55, 105-108` passes `websocket_url` from `POST /websocket/subscribe-ride` and `/subscribe-driver` straight to `new WebSocket(...)`. Nothing checks the scheme or host.
- The backend hardcodes the host: `WebSocketController.php:68, 132` returns `wss://raahehaq.com/ws/...`. A Debug build pointed at the local backend therefore still opens sockets to the production host. That defeats T-005's single source for URLs and the "never touch production" rule.
- Only the notifications socket (`:156`) uses `env.WS_URL`.
- Today the impact is nil, because no WebSocket server exists (FEAT-12 / BE-12).

**Impact:** once sockets exist, a misconfigured or tampered response could downgrade the driver's or passenger's live location to `ws://`, or send it to a foreign host. Dev and QA builds would connect to production.

**Required fix**
- **App:** build socket URLs from `env.WS_URL` plus the channel path, or accept a server URL only if its origin equals `env.WS_URL`'s origin and it uses `wss://` when `!__DEV__`. Add a unit test.
- **Backend:** derive `websocket_url` from config (`APP_WS_URL`), not a literal.
- Do this with BE-12 / T-308 (or whichever task builds the real-time layer).

### SEC-20 · low · app logging: gaps in the redacting logger
Found in the Phase 0 gate audit (app `087162a`).

**Evidence** (`src/core/logging/logger.ts`)
- **Strings:** `:26, 51-52` mask only `?key=`/`token=`/`otp=` query values. A `Bearer <token>` or `Authorization: ...` inside a string (an error message or a library message echoing headers) is printed as is, including by `logger.error` in release.
- **Keys:** `:21, 24` don't cover `date_of_birth`/`dob`, `gender` or `ip`, even in strict mode. These fields are sent at registration (`src/services/api.ts:188-189, 311-312`).
- **Debug-level calls with positional PII** that key-based redaction can't catch (dev only, but they land in tracked QA logs such as `docs/qa-reports/2026-10-08-T-003/device-js-log.txt`):
  - `PassengerHomeScreen.tsx:97, 100` (coordinates and reverse-geocoded address)
  - `BasicInfoScreen.tsx:189` and `FirebaseTest.tsx:21` (uid)
  - `placesService.ts:35, 49, 52, 76` (coordinate URL and the geocoding responses; Nominatim removal is PAX-18 / T-303)
- The QA log in the repo holds only seed data and a simulator location (checked), so no real data has leaked.

**Required fix**
- Add a string pattern that masks `Bearer\s+\S+`.
- Add `dob|date_of_birth|gender|\bip\b` to the key set.
- Turn the positional calls into keyed objects, or drop them.
- Extend `__tests__/core/logging/logger.test.ts` for each case.

### SEC-21 · low · app API client: token guard checks only `config.url`, not `baseURL`
Found in the Phase 0 gate audit (app `087162a`).

**Evidence**
- `src/services/api.ts:62-66, 71`: `isApiUrl(config.url)` treats every relative URL as our API.
- A call such as `apiClient.get('/x', {baseURL: 'https://other.host'})` would therefore get the bearer token.
- No caller passes `baseURL` today (checked with grep). Third-party calls (Google, Nominatim) use `fetch`, not `apiClient`.

**Impact:** latent token leak to a third party if a future caller overrides `baseURL`.

**Required fix:** check the resolved URL instead: `isApiUrl(apiClient.getUri(config))`, or compare `config.baseURL ?? API_BASE_URL` too. Add a unit test with a foreign `baseURL`. Do this in T-104 (the interceptor rewrite).

## Phase 0 gate re-audit (app, 2026-10-08, `087162a`)
Scope: T-001 to T-008 end to end (env, logger, babel console stripping, API client and error model, toasts, repo hygiene).
- **Fixed by Phase 0:**
  - No `console.*` remains in `src` outside the logger, and ESLint `no-console` is an error.
  - Release strips every console call except `console.error`, and that call goes through the strict redactor.
  - The bearer token is sent only to the API origin.
  - 5xx and unclassified server text is never shown. The backend no longer returns `$e->getMessage()` from API controllers.
  - The stale bundle and the npm lockfile are gone.
  - Debug Android cleartext is limited to localhost, 127.0.0.1 and 10.0.2.2.
  - `.env.development` and `.env.production` are ignored and were never committed. `.env.production` uses `https`/`wss`.
  - The `AIza…` value in `logger.test.ts` is a short fake, not the real key.
- **Still open, already tracked:**
  - Maps key in native files and git history (INF-06 / T-109 / B-02)
  - Release cleartext in `src/main` `network_security_config.xml` (INF-21 / T-108)
  - Token and `otpData` in AsyncStorage and redux-persist (INF-20, AUTH-02 / T-101, T-104)
  - 401 never logs out; dead `refresh_token` branch (AUTH-05 / T-104)
  - Incomplete logout (AUTH-09 / T-102)
  - Dependency advisories unchanged at 8 critical, 141 high, 80 moderate, 7 low (SEC-11). Phase 0 added only dev dependencies.
  - `http://` accepted in release (SEC-17)
  - Notification cache (SEC-18)
  - Unauthenticated notifications socket (INF-13)
- **Dependency audit tooling:** the repo uses Yarn 1.22, which has no `yarn npm audit`, and T-004 removed `package-lock.json`, so `npm audit` has nothing to read. The read-only `yarn audit --groups dependencies` was used instead.

## Non-security observation (for the feature tracker)
`GET /rides/pending` and `/rides/nearby-drivers` are shadowed by `rides/{ride}` (already FEAT-01 / BE-02).

## Checklist coverage

| Item | Result |
|---|---|
| App 1 Secrets | Tracked: Firebase configs (public by design), `debug.keystore` (Android default), and the Maps key in 3 native files plus the stale bundle (known, INF-06). `.env.*` ignored except the example; the example has no values. No `sk_`/PEM/password literals in source. |
| App 2 Token storage | Known (INF-20 / T-104); no new issue |
| App 3 Logging | Known (T-006); SEC-18 added |
| App 4 Transport | ATS `NSAllowsArbitraryLoads=false`; Android release cleartext known (INF-21); SEC-17 |
| App 5 Auth flows | OTP known (AUTH-02); the client routes on role, but the server doesn't enforce it (SEC-01) |
| App 6 Input/navigation | No WebView, `eval`, deep-link handling or push-open handlers in `src` (n/a today; re-check when T-502 adds push handlers) |
| App 7 Permissions | Known (INF-26); background location stays off per B-08 |
| App 8 Dependencies | SEC-11 |
| BE 1 Config | SEC-02, SEC-06, SEC-14; `.env` was never committed (history checked) |
| BE 2 AuthN | SEC-07, SEC-08, SEC-13; OTP in response known (B-01 / BE-16) |
| BE 3 AuthZ/IDOR | SEC-01, SEC-03; rides known (BE-01, BE-03, BE-04) |
| BE 4 Mass assignment | Controllers build arrays explicitly; `status`/`roles` are reachable only through the unprotected `UsersController` (SEC-01). `ProfileController::update` allow-lists its fields: OK |
| BE 5 Injection | All `selectRaw`/`orderByRaw` calls use bindings or constants; `like` search uses bindings. The only `{!! !!}` in Blade is `json_encode` of server data: OK |
| BE 6 Uploads | MIME and size validated; storage is public (SEC-05) |
| BE 7 Races | assign-driver known (BE-03); wallet (SEC-09); OTP consume (SEC-08) |
| BE 8 WebSockets | No server exists (FEAT-12 / BE-12) |
| BE 9 Headers/CORS | No `config/cors.php`, so the framework default applies (`*` without credentials): acceptable for token auth. Error leakage depends on debug (SEC-06) |

### SEC-22 · low · backend OTP: global SMS budget can be drained by throwaway accounts (and is a weak existence oracle)
- **Where:** backend `app/Services/SmsService.php` (budget), `app/Jobs/SendLoginOtp.php`, `POST /api/auth/register` (unverified pending accounts can receive OTP).
- **Issue:** ~50 self-registered +923 accounts × 10 sends from a few IPs can spend the 500/day budget, turning off phone login for everyone for up to 24 h. An attacker who holds the counter at budget-1 can test one number per window by watching for 503 `sms_unavailable`.
- **Fix:** BE-32 (OTP-verified registration) and BE-33 (sub-budget for never-verified accounts); owner alerting and budget sizing before launch.
- **BE-33 update (2026-10-08):** the unverified sub-budget (25%) now limits throwaway-account drain to that pool, so established users keep logging in. Residual: a narrower variant of the budget oracle (a login probe to a never-verified post-cutoff account spends an unverified slot; ~125 SMS per probe, once per 24 h). Owner items unchanged: alert on "SMS daily budget reached" / "SMS unverified sub-budget reached" and size both budgets before launch.

### SEC-23 · low · backend registration: SIM-holder residual oracle (accepted)
- **Where:** `POST /auth/register` (BE-38).
- **Issue:** a taken email gets a decoy answer that sends no SMS; a free email sends a phone code. Someone holding the SIM given as `phone` can tell the cases apart by whether an SMS arrives. Capped by per-phone (3/15 min, 10/day) and per-IP limits; each free probe creates a `signup_pending` user and mails the address. Real registrations also do a few more DB writes than the decoy (milliseconds).
- **Decision:** accepted — any flow that lets a SIM holder finish signing up reveals this at verify time. Full closure needs email-first verification (BE-40).

### SEC-24 · medium · backend privacy: precise driver location history kept forever
- **Where:** `app/Models/DriverLocation.php` (`updateLocation` inserts a row per update), `ride_tracking`.
- **Fix:** BE-46 — retention/pruning with a documented period.

### SEC-25 · low · backend privacy: other tables with phones/IPs lack retention
- **Where:** `otps` (expired rows never deleted), `analytics_events`, `login_attempts`, `security_events`; audit rows deleted whole after 180 days (loses BE-36/44 evidence).
- **Fix:** BE-46.
