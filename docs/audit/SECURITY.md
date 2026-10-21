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

## Phase 1 gate audit (app + backend, 2026-10-08)
rh-security, `audit` mode, reading code only. **App:** `fix/phase-1-auth` at `17aff38` (T-101 to T-113). **Backend:** `fix/production-hardening` at `a565a08` (BE-16 to BE-51). No request was sent to any server. Tools: `git`/`grep`, `php artisan route:list --json` (local, offline), `composer audit --locked`, `yarn audit --groups dependencies`, `yarn verify` (PASS: TS 128, ESLint 82/133, Jest 430/430, bundle ok).

**Status of earlier findings after Phase 1**
| Finding | Status |
|---|---|
| SEC-01 role checks | Fixed in code (BE-18). Every `api/users`, `payments`, `security`, `analytics` admin route and all of `admin/*` carry `role:admin` (route list checked). |
| SEC-02 seeded admin | Fixed in code (BE-19). The live account is still owner work (B-12). |
| SEC-03 driver privacy | Fixed (BE-20 + T-110). The app calls only `/rides/nearby-drivers` (opaque ids, radius clamped 1-10 km) and reads the driver's phone and position only during an active ride. |
| SEC-04 registration logging | Fixed (BE-21, BE-26). No backend `Log::` call takes request values. Phones are masked (`Phone::mask`), and `QueryException` is reported without its bindings. |
| SEC-05 public documents | Fixed (BE-22). Documents sit on a private disk behind short-lived `signed:relative` URLs, and `PrivateFileController` checks the path and sends `no-store` and a sandbox CSP. |
| SEC-06 debug in production | Fixed in code (BE-23). `config/app.php` forces debug off outside local/testing, and `ProductionConfigGuard` also flags an empty `APP_KEY`, the `log` SMS driver, `TRUSTED_PROXIES=*` and a non-https maps URL. Checking the live server is owner work (B-12). |
| SEC-07 token lifetime | Fixed (BE-25, BE-32, BE-43). Tokens expire after 30 idle days and slide on use. Moving an account out of active/pending renames and caps its tokens, and `EnsureUserIsActive` refuses them on every route except logout. Every `auth:sanctum` route except `logout`/`logout-all` carries the middleware, and it reads the live status on every request, so a bulk status update can't leave a working token. A password change or reset revokes the other tokens. The only remaining gap is that no absolute cap is set by default (`SANCTUM_EXPIRATION` is empty). This is accepted. |
| SEC-08 OTP abuse | Fixed (BE-27, BE-28, BE-33, BE-35). Codes are hashed and consumed atomically. Every OTP path (login, registration, phone change, keep-phone code, decoy registration) goes through `OtpLimiter` per phone, per IP and per account, plus the SMS budget and sub-budget. SMS goes out only through `SmsService::send`, which checks the country allowlist. |
| SEC-13 enumeration | Fixed (BE-27, BE-38). send-otp, forgot-password (API and web) and register give one answer whether or not the account exists. |
| SEC-18 notification cache | Partly fixed. Logout clears it (T-102/T-104), but it is still cached in plain text while signed in. |
| SEC-21 token to foreign `baseURL` | Fixed (T-104). `isTokenTarget` compares the resolved `apiClient.getUri(config)` origin and fails closed on URLs it can't parse. |
| SEC-10, SEC-11 dependencies | Unchanged: composer 46 advisories in 14 packages; yarn 8 critical, 141 high, 80 moderate, 7 low. BE-50 makes the `guzzlehttp/guzzle` and `psr7` advisories more relevant, because the server now makes outbound calls with the server key in the query string. `allow_redirects=false` reduces the risk. Do `composer update` (SEC-10) before production. |
| SEC-17, SEC-20 | Still open, low. Release cleartext is now blocked at OS level (T-108 Android config; iOS ATS), so an `http://` URL in `.env.production` fails at run time instead of leaking. The logger still doesn't mask `Bearer …` inside strings. |

**What Phase 1 got right (checked, no finding)**
- **Token storage:** the token is in Keychain/Keystore (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). There is a one-time migration from the plain key and a reinstall guard. Writes are serialised and tagged with the session epoch. Logout clears the Keychain and AsyncStorage, resets every slice, purges redux-persist, and stops sockets, location tracking, notifications and in-flight requests. Only `apiAuth` is persisted, with no token, no OTP and no sensitive fields (v1 migration drops the Firebase `auth`/`user` slices).
- **401/403 handling:**
  - A 401 on a request that carried the current session's token triggers one logout (single flight). Sign-in and logout paths are excluded.
  - A 403 `ACCOUNT_*` on any route merges the refused status into the user and routes to account status.
  - Routing reads only the normalised `role`/`status` and fails closed: an unknown status becomes `inactive`, `admin` and unknown roles go to account status. The server enforces roles anyway.
- **OTP:** the app never keeps, shows or logs `otp_code`. The `verification_token` lives in memory only. The backend echoes the code only when `APP_ENV=local` and debug is on.
- **Web paths match the API:** web login, register, forgot/reset password, email verify and profile phone change all go through the same `AccountStatus`, `EmailOwnership` (BE-38/44), `PhoneVerification` and `OtpLimiter` code. `EnsureUserIsActive` is appended to the whole web group.
- **Maps proxy (BE-50):**
  - The key is only server-side and only https. Redirects are not followed, and an upstream exception (whose URL holds the key) is never reported.
  - Inputs are validated and coordinates are rounded before they go upstream.
  - Limits: per IP, per user per minute and per day, plus a global daily budget. Caching is off by default.
  - Error bodies use fixed copy.
- **Build config:**
  - Release signing comes only from `RH_UPLOAD_*`; a release build never falls back to the debug key.
  - Release has `cleartextTrafficPermitted=false`. The debug override is limited to localhost, 127.0.0.1 and 10.0.2.2.
  - iOS has `NSAllowsArbitraryLoads=false` and no background location (B-08). Usage strings are accurate.
  - The Maps key comes from the git-ignored env file through `manifestPlaceholders` and Info.plist preprocessing.
  - The react-native-config patch prints only the number of keys.
  - Secrets: no new tracked secrets in either repo. The only `AIza…` strings are the public-by-design Firebase configs and a fake key in `MapsProxyTest`.

### SEC-26 · medium · backend authN: API password login has no per-account limit (the web login has one)
**Evidence**
- `app/Http/Controllers/Api/AuthController.php:38-63` (`POST /api/auth/login`) calls `Auth::attempt` with only the per-IP `throttle:20,1` shared by all `auth/*` routes (`routes/api.php:33`).
- There is no per-email counter or lockout, and failed attempts aren't recorded. The login validation accepts `min:6` (`:42`), while the password policy is `Password::defaults()` (8 characters, no other rule).
- The web login does have a limit: `app/Http/Requests/Auth/LoginRequest.php:42-96` allows 5 tries per email+IP, with `RateLimiter::hit` on failure and on `signupIsPending`. The API path skips it.
- Under Pakistani carrier-grade NAT, 20 auth requests per minute per IP is also tight: one client on a shared IP can block sign-in for everyone else on that address (availability).

**Impact:** an attacker who rotates IPs can guess passwords for a known email without limit. This is the BE-28 "limiter that one path bypasses" pattern, for passwords instead of OTPs.

**Required fix**
- Add a per-account limiter on API login: for example 5 failures per 15 minutes per email+IP, plus about 20 per hour per email across all IPs. Over the limit, answer 429 with `code: rate_limited` and `retry_after` in the BE-28 envelope.
- Count unknown emails the same way, so the limiter can't be used to enumerate accounts.
- Share the limiter key with `LoginRequest`, so the web and API paths together get one budget per account.
- Clear the counter on success.
- Consider raising the per-IP auth throttle and leaning on the per-phone, per-email and per-account limits instead (CGNAT).
- Add feature tests.

### SEC-27 · medium · backend authN: checks of the current password are unthrottled on every path except email change
**Evidence**
- `EmailOwnership::checkChangePassword` (`app/Services/EmailOwnership.php:394-414`) allows 5 wrong passwords per account per 15 minutes (BE-38/42), so that "a stolen session alone can't move the account to another inbox".
- The other paths that check the current password have no such limit:
  - `POST /api/profile/change-password`: `Api/ProfileController.php:227-243` calls `Hash::check` under only the general `throttle:120,1` per user. On success it sets a new password and revokes every other token.
  - Web `PUT /password`: `Auth/PasswordController.php:19`, `current_password` rule, no throttle.
  - Web `POST /confirm-password`: `Auth/ConfirmablePasswordController.php:27`, no throttle.
  - Web `DELETE /profile`: `ProfileController.php` `destroy`, `current_password` rule, no throttle.

**Impact:** whoever holds a stolen token or session can guess the current password at about 120 tries a minute. Once the guess is right, they change the password, which signs the victim out on every other device, and then take over the email. This bypasses the protection BE-38 added for email change.

**Required fix**
- Use one per-account limiter for every current-password check (for example the `email-change-password:{id}` key renamed to `password-check:{id}`, 5 per 15 minutes), with a 429 that carries `retry_after`. Apply it to API change-password, web `PUT /password`, `confirm-password` and `DELETE /profile`.
- Add feature tests for each path.

### SEC-28 · medium · backend integrity: web profile lets drivers and passengers rewrite their CNIC and licence number after approval
**Evidence**
- `app/Http/Requests/ProfileUpdateRequest.php:37-41` accepts `cnic` (required), `license_number` and `vehicle_type`.
- `ProfileController::update` (`app/Http/Controllers/ProfileController.php:63`) fills them straight into the user. The form is `resources/views/profile/edit.blade.php:141,197`.
- Any active user can sign in on the web `/login` and reach `/profile/edit`, because only `/admin` is restricted to admins.
- Nothing sends the driver back to review or writes an audit event.
- The API `PUT /profile` deliberately doesn't accept these fields (`Api/ProfileController.php:31-47`). The web path bypasses that.
- The rule dates from the original admin-panel commit (`6d89b1f`), so this was not introduced in Phase 1.

**Impact:** after admin approval, a driver can replace the CNIC and licence on record with any value. The verified identity that admins, support or the police rely on after an incident then no longer matches the person who was reviewed.

**Required fix**
- Show identity fields read-only for non-admins: drop `cnic`, `license_number` and `vehicle_type` from `ProfileUpdateRequest`, and hide the inputs in `profile/edit.blade.php`.
- If changing them is a product need, a change sends the account back to `pending` review with a `PhoneMoveAudit`-style admin event.
- Add a feature test: a driver's `PATCH /profile` with a new `cnic` leaves it unchanged.

### SEC-29 · low · app storage: the cached user keeps contact PII in plain AsyncStorage
**Evidence**
- `src/core/auth/storedUser.ts:9-10` is a blocklist. It drops CNIC, licence, bank, emergency contact, date of birth and rejection reason, but keeps `phone`, `pending_phone`, `email`, `address`, `gender`, `bio` and `profile_image_url`.
- Both copies are written in plain text: `user_data` (`src/services/authStorage.ts:208,220`) and `persist:root` `apiAuth.user` (`src/store/persistTransforms.ts` `withoutSecrets`).
- The cache is only there so an offline cold start routes on `role`/`status` (T-104).
- This was raised as "consider stripping address/gender" in the T-104/T-107 reviews and not acted on.

**Impact:** a device backup, a forensic dump or a rooted device exposes the user's phone, email and home address. Logout does clear both copies.

**Required fix**
- Turn `toStoredUser` into an allowlist: `id`, `name`, `role`, `roles`, `status`, `phone_verified_at`, and optionally `profile_image_url`. Fetch everything else from `GET /auth/profile`.
- Add a unit test that an unknown new field is not stored.

### SEC-30 · low · backend: inconsistent API error envelopes, and admin free text in logs
**Evidence**
- `bootstrap/app.php:56-120` renders the app envelope only for validation errors, throttle 429s and lock timeouts. 401 (`AuthenticationException`), 403 from `signed`, 404, 405 and 500 still use Laravel's default `{message}` body with no `success:false` and no `code`.
- The `nearby-drivers` limiter has its own 429 response (`app/Providers/AppServiceProvider.php:86-90`) without `code: rate_limited`, so it bypasses the BE-28 envelope.
- The app maps errors by HTTP status, so nothing breaks today (`src/core/api/errors.ts:102-107`).
- `Admin/DriverVerificationController.php:102,112` logs the admin's free-text `rejection_reason`, which can contain document numbers.

**Impact:** low. Clients that branch on `code` (T-111 style) can mis-handle these paths, and the log can hold PII an admin typed.

**Required fix**
- Render `AuthenticationException`, `HttpExceptionInterface` and `InvalidSignatureException` for `api/*` in the `{success:false, message, code}` envelope (`unauthenticated`, `not_found`, `forbidden`, `server_error`).
- Add `code: rate_limited` to the nearby-drivers 429.
- Log only the length of `rejection_reason`, or a flag that one was given.

### Phase 1 gate checklist
| Item | Result |
|---|---|
| App 1 Secrets | OK. No new tracked secrets. Maps key only in ignored env files (git history: B-02). Build logs no longer print values (T-112). |
| App 2 Token storage | OK. Keychain, epoch-guarded, full logout. SEC-29 (low) |
| App 3 Logging | OK for Phase 1 code (keyed summaries via `logApiFailure`). SEC-20 still open (low) |
| App 4 Transport | OK. Release cleartext off on both platforms. SEC-17 (low) |
| App 5 Auth flows | OK. OTP never kept. 401 leads to logout. 403 `ACCOUNT_*` routes to account status. Roles are enforced server-side (BE-18). |
| App 6 Input/navigation | OK. No WebView, `eval` or deep links. The `tel:` link is validated (T-110). Push handlers come later (T-502). |
| App 7 Permissions | OK. Foreground location only (B-08). Polling runs only while the app is active. |
| App 8 Dependencies | SEC-11 unchanged |
| BE 1 Config | OK in code (guard and template). Live check: B-12, B-16 |
| BE 2 AuthN | SEC-26, SEC-27 (medium). OTP, tokens and revocation OK. |
| BE 3 AuthZ/IDOR | OK for Phase 1 scope. Rides beyond BE-24/BE-30 stay with BE-01..04. |
| BE 4 Mass assignment | SEC-28 (web profile identity fields). The API profile allowlists its fields. |
| BE 5 Injection | OK. Maps inputs are validated and the query is built by Guzzle. |
| BE 6 Uploads | OK (BE-22) |
| BE 7 Races | OK for OTP consume, phone claim (locks), token refresh (delete-as-claim) and status change (row lock). Wallet stays with SEC-09 / BE-09. |
| BE 8 WebSockets | n/a (no server yet, BE-12) |
| BE 9 Headers/CORS | OK. Signed email pages send `no-referrer`, private files send `no-store` and a sandbox CSP. SEC-30 (low) |

**Phase 1 gate verdict: PASS.** No critical or high finding is open in the code. Before production, the owner still has to do B-02, B-11, B-12, B-13, B-15 and B-16. Production is down (B-09).

## Design rulings 2026-10-19: map vehicles, request reach, auto-accept (BE-116)

These are rulings on proposals that are not built yet: `docs/design/screens/map-vehicles.md` §0 D2/D3, §2 and §6 asks 2, 4 and 5, plus BE-116 (b) and (c). The code read for them is `app/Support/DriverPrivacy.php`, `DriverLocation::getDriversInRadius` (`app/Models/DriverLocation.php:150`), `RidesController::getNearbyDrivers` (`:1309`) and `getPendingRides` (`:1172`), `WomenMode::availabilityNear` (`app/Services/WomenMode.php:266`), and the `nearby-drivers` limiter (`app/Providers/AppServiceProvider.php:151`, 12/min per user and 30/min per IP). Severity is what the risk would be if the proposal shipped as written.

### SEC-31 · high · privacy: proposed "fixed 80–150 m hourly offset + 15 s delay" for public driver positions
**Ruling: FAIL as proposed. CONDITIONS for the variant below (BE-118).**

**Why the proposal fails**
- **A fixed offset does not survive map matching.** A track shifted by a constant vector lies off the roads. Fitting the shift back onto the road network after a few hundred metres with one or two turns gives the true path to within a few metres. So the offset protects nothing while the car moves, and it draws cars driving through buildings, which hurts the "like Uber" goal.
- **Averaging.** If the offset depends on the viewer (as it would by tying it to the viewer-bound `publicId`), N throwaway accounts give N independent zero-mean offsets, and their mean has an error of about 115/√N m (about 35 m with 10 accounts). If the offset depends only on the driver, every viewer gets identical coordinates, which links the viewer-bound ids and defeats `publicId`.
- **Hour boundaries.** A driver parked online (at home, at a stand) gives one new sample p+o_k every hour. After an 8-hour night the mean is within about 40 m of the true point. Each hourly step also shows up as a 100–300 m jump on a still marker, which marks it as parked.
- **The delay is too short.** 15 s is less than the time needed to notice that a driver has stopped, so the stop point is published. That is how a driver gets tracked home.
- **Following.** The query centre is chosen by the client and is not bound to anything. One account can re-centre on a driver 12 times a minute and follow it across town. Once positions are continuous, the hourly id rotation is bridged by continuity (the app does this itself, §2.5).
- **Women drivers.** Gender is not on the map today, which is good. But any rule that treats women drivers differently (coarser, hidden or delayed) would single them out on the map.

**Approved variant: delayed, rounded, zoned (all parameters are server constants in `config/rides.php`, with enforced floors so an admin can loosen them only down to the floor)**
1. **Fine path only when every one of these holds.**
   - The caller has the `passenger` role, an active status and a verified phone. Drivers and others get the coarse path.
   - The driver is moving (item 4) and outside their privacy zones (item 5).
   - At least **3** available drivers are in the response radius (k-minimum).
   - The driver is among the **15** nearest.
   - The driver is within **3 km** of the query centre.

   Everything else uses today's coarse path, unchanged: 0.005° grid, 120 s bucket.
2. **Delay D = 45 s** (floor 30 s). The position is the last available ping at or before now−D. It is never extrapolated. Who is listed still follows the latest ping (BE-65).
3. **Rounding** to 0.0005° on both axes (about 55 m; floor 0.0003°). No random offset and no per-viewer noise: the output is a deterministic function of the delayed ping, so averaging recovers nothing. Heading comes from the same ping in 15° steps (BE-76) and is null when the driver is stationary. This rounding is also the zoom cap. The server never sends more precision whatever the passenger's zoom.
4. **Moving** means ≥ 40 m of true displacement over the last **30 s** of live pings, and a latest speed ≥ 1.5 m/s when speed is reported. This is judged on live pings, not delayed ones. Because D (45 s) is longer than the 30 s window, a stop point is never on the fine path. A stationary driver falls back to the coarse path.
5. **Privacy zones, 1.0 km radius** (floor 0.5 km), centred on (a) the first available ping of the current online session and (b) the driver's last **5** go-offline points from the last 30 days.
   - Inside a zone the driver is **not drawn at all**: no fine marker and no coarse marker. They are still counted and still dispatchable.
   - Zone centres are kept server-side only, rounded to 0.001°, and pruned after 30 days (SEC-24).
   - They never appear in any API response.
6. **Id rotation.** The public id changes at session start, on every coarse/hidden → fine transition, and at least hourly. Implementation: a per-driver visibility epoch is mixed into `publicId`. A marker can then not be linked across a stop, a zone or a new session.
7. **Anti-following budget.**
   - Fine positions are served in at most **6 distinct 2 km cells per account per rolling hour**, using the `WomenMode::allowedCell` pattern (atomic, fails closed). Past the budget the answer is the coarse path (200, not 429), so the app keeps working.
   - The `nearby-drivers` limit drops from 12/min to **6/min plus 300/hour** per user (amended 2026-10-20 from 180/h: the app's 4/min poll is 240/h). The IP limit stays at 30/min. The app polls 4/min.
8. **Counts (BE-116 a).** `by_tier` and `online_total` are computed from the **coarse** (grid, 120 s bucket) positions of all listed drivers, including zoned ones. A client-chosen centre with a 1 km minimum radius can then never home in on a hidden driver more finely than today's accepted 550 m cell. Counts never split by gender.
9. **Uniform treatment.** No rule may depend on gender or on `WomenMode::driverEligible`. A feature test asserts byte-identical output for a female and a male driver with the same pings. `WomenMode::availabilityNear` stays on the coarse path.
10. **No logs or caches** of fine public positions beyond the 15 s response cache. Fine responses are not stored per viewer.
11. **Follow detection (feeds BE-92).** Flag an account for admin review when ≥ 10 queries in 20 min, spread over ≥ 3 cells, are each centred within 1 km of the same driver's true position. Admin decides; nothing is automatic.

**Effect on the app (T-586).** None of the §2 motion rules change. A stationary or zoned driver relocates with a crossfade or leaves with a fade. The 15 m jitter rule absorbs the 55 m rounding at speed.

### SEC-32 · medium · privacy: "b2", viewer-scoped ids of drivers sent or viewing a request
**Ruling: CONDITIONS (BE-119). Without them, counts only.**

**Risks**
- In women mode the set of drivers sent the request is exactly the verified female drivers. Marking them on the map bypasses BE-87's rule that the map never narrows by gender, and the availability endpoint's limits (boolean only, 4/min, 30/h, cell budget).
- Ids of drivers that are not drawn (zoned, stationary-coarse, beyond 15, outside the radius) would reveal and link hidden drivers.
- `viewing` and `declined` per marker is a live behavioural signal about one vehicle, which invites retaliation.

**Conditions**
1. Ids go only to the ride's passenger, only while the ride is `requested`, and only inside `GET /rides/{id}` (the ride poll). There is no separate timer.
2. `sent_ids` and `viewing_ids` are the **intersection** with the fine-path ids in that viewer's own nearby response at the same instant (same `publicId` and epoch). Every other recipient appears only in the counts.
3. **Women-mode rides (`female_driver_only = true`): no ids, and `sent`/`viewing` counts are null as well**, so the app shows "Sending to drivers nearby…". This also amends BE-116 (b). After `allow_any_driver`, or after a requeue (T-546), reach counts and ids only come from offers made after the switch. Offers made before the switch never surface.
4. No `declined` ids ever, and no `declined` count to the passenger.
5. `POST /rides/{id}/offer-viewed` is `role:driver`.
   - It is accepted only when this driver was served the ride (a `ride_offers` row exists) and the ride is still `requested`. Otherwise it returns 404, so it is no ride-id oracle.
   - It is idempotent (the first view wins) and throttled at 30/min.
6. `ride_offers` (ride, driver, served_at, viewed_at, declined_at) is pruned after 30 days (SEC-24/25).

**Amendment 2026-10-21 (BE-119 + BE-136 diff review, backend `a184115`, `4583fdc`): PASS.**
- **`viewing` includes drivers who declined. Accepted.** A decline also stamps `viewed_at` if it was empty, and `declined_at` is never read for the passenger. So a decline never changes `sent`, `viewing` or the ids. A decline without a prior open looks the same as an open. Condition 4 holds more strictly than before (the old `viewing` dropped on a decline, which leaked the decline as a count change).
- **Fine-marker cache. Accepted.** Key `ride-reach-fine-markers:{viewer}`, 30 s TTL (= `ID_CONTINUITY_SECONDS`). It holds only driver id => that viewer's own fine public id, plus a random epoch, with no positions. Each nearby answer replaces it, and an answer with no fine markers clears it. It fails closed (counts only). It is filled from exactly the drawn set (after the radius and tier filters, fine precision only), so a hidden, coarse, zoned or out-of-radius driver never gets an id.
- **No identity leak and no cross-epoch linking.** The ids come from the existing per-viewer, per-session, salted HMAC (SEC-31 item 6). The ride poll only repeats ids from that viewer's latest answer and never mints or keeps older ones. `sent_ids` and `viewing_ids` are sorted by public id, so the order says nothing about internal ids. `meta.fine_epoch` and `reach.epoch` are random per answer.
- Ids go only to `passenger_id === viewer`, only while `requested` (`RideReach::visible`), and only in `GET /rides/{id}`. Women mode gives no ids and null counts. After `allow_any_driver` or a requeue, `requested_at` is reset, so only later offers surface (`liveOffers`).
- **BE-136 `chat.unread_count`.** The block appears only when `$isPassenger || $isDriver`. `unreadCountFor` returns 0 for non-participants, expired chats, rides with no driver, and messages from an earlier driver. `GET /rides` stays scoped to the caller and adds one correlated subquery (`withUnreadCount`), so there is no N+1. Admins get no block.
- Suite: 2641 tests OK on sqlite in-memory.

### SEC-33 · high · abuse: driver auto-accept (BE-116 c)
**Ruling: CONDITIONS (BE-120, must ship in the same release as BE-116 c).**

**Risks**
- **Targeted assignment, passenger side.** A stalker reads the map, books near a chosen driver, and gets a deterministic match. Acceptance reveals the driver's name, photo and exact live position (`canSeeDriverDetails`). Cancelling and re-booking repeats it. Auto-accept removes the per-ride consent that blocks this today.
- **Targeted assignment, driver side.** A driver parks near a target's home with a wide radius and a low minimum fare, and gets that person's pickup.
- **Women-mode bypass.** Auto-assignment skips the feed filter or races the fallback timer.
- **Gaming.** GPS spoofing to be "nearest", or accepting everything and cancelling the bad ones.
- **Ghost accepts.** An inattentive driver with the phone in a pocket is auto-assigned.

**Conditions**
1. **One assignment code path.** Auto-assignment goes through the same function as manual accept (`acceptRideAsDriver`): a transaction, a conditional update on `status = requested AND driver_id IS NULL`, a driver row lock, one active ride, and `DriverAvailability` = available. It re-checks every feed rule at assignment time:
   - the tier is in `AcTier::servableTypes` (recomputed);
   - the driver has not declined this ride (`ride_driver_declines`);
   - the ride is not the driver's own booking;
   - for `female_driver_only` rides, `WomenMode::driverEligible`;
   - the driver is not matched to anyone but a female driver before the passenger chooses `allow_any_driver`.
2. **Freshness and plausibility.** The latest ping is ≤ **30 s** old (foreground only, B-08), and the true pickup distance is ≤ `max_pickup_km`.
   - A ping with the mock-location flag (Android `mocked`, iOS `isSimulatedBySoftware`, sent by the app) makes the driver ineligible for auto-assignment for the session.
   - A jump > 50 m/s between pings makes them ineligible for 30 min and flags them to BE-92.
3. **Bounds.** `max_pickup_km` is 0.5–3.0 km (default 2). `min_fare` is checked against the server's `total_fare`, including stops and the passenger's offer within the band, at assignment. `tiers` ⊆ eligible tiers. Settings go through `validated()` only, and `PUT` is throttled at 10/min. The driver's settings are never exposed to passengers.
4. **Eligibility** to enable, re-checked at each assignment:
   - the driver is active and approved, with an approved vehicle;
   - ≥ **5** completed rides;
   - cancel strikes in 7 days below the admin threshold (default 3);
   - no open safety incident against the driver.
5. **Window.** Auto-assign only after the ride has been offered for **W s** (admin-tunable 10–60, default 15) so manual drivers can accept. Among auto-accept drivers, pick **at random among those whose pickup distance is ≤ best + 0.5 km**, not strictly the nearest.
6. **Pair and fishing limits.**
   - The same passenger–driver pair is auto-matched at most once per 24 h; after that, manual only.
   - A pair is never auto-matched if there is any safety incident or report between them.
   - A passenger who cancels ≥ 2 auto-assigned rides within 1 h is not auto-assigned for 24 h.
7. **Women drivers.** Drivers for whom `WomenMode::driverEligible` holds get a "women passengers only" auto-accept filter, **on by default**, enforced by the server.
8. **Parcels excluded** from auto-accept in v1, because the driver must see the parcel declaration (BE-88).
9. **Auto-off.** 2 cancels of auto-accepted rides by the driver within 24 h turn auto-accept off on the server, with a `message`. An admin can disable it per driver. Every auto-assignment is recorded (ride, driver, settings snapshot) for disputes. The takeover shows the drop-off area, and the strike rule stays.


**BE-127 residuals (2026-10-20).** Zone centres are the rounded point plus a deterministic 200–400 m HMAC offset (driver, 0.01° cell; reused for zones within 0.5 km), and zones hide within a constant 1.4 km so the edge reveals only the centre (true point always ≥1.0 km inside). Accepted residuals: (1) an attacker who already knows one true point of a driver can derive the shared offset of that driver's other zones in the same cell/reuse chain (tighten later with a per-place salt); (2) a place gets a small number of offsets over its lifetime (typically ≤4, more in rare cell layouts) after 30-day resets or APP_KEY rotation — add an APP_KEY-rotation note to the owner runbook; (3) an empty APP_KEY makes nearby-drivers fail closed (500, no leak); (4) pre-BE-127 rows were true-centred for up to 30 days after deploy.

## Diff review 2026-10-20: self-service account deletion (BE-129)

### SEC-34 · medium · privacy: account deletion (BE-129, backend c10807f)
**Verdict: PASS, with follow-ups.** The diff is 338d28a..c10807f on backend branch `be-129`. The full backend suite passes on sqlite: 2591 tests, including the 25 in `AccountDeletionTest`.

**Checked and safe**
- **OTP.** The code has its own purpose (`account_delete`), and the hash is bound to purpose and user. It has its own send pool (`delete-` cooldown, window, and a daily cap of 5), its own wrong-code counter shared by the app and the web page, and a TTL clamped to 60–600 s. It is single-use (`is_used`), and issuing a new code deletes the previous one. A login code is refused, and a code tried for an unknown number is checked against `user_id = 0`, so it always fails. Echoing the code happens only with APP_ENV=local and debug on.
- **Web page `/account/delete`.**
  - Enumeration: "send code" gives the same answer for every valid number. The lookup and the SMS run after the response, and the limits count the number whether or not an account exists.
  - The web middleware applies CSRF to every POST, and GET has no side effects.
  - The session id is regenerated after a correct code. The proof lasts 15 min (clamped to 5–60), is bound to the user id and the phone in the session, and is re-checked on every confirm or cancel.
  - Every route has a per-IP throttle. Every response carries `Referrer-Policy: no-referrer`, and the page has a noindex meta tag. No personal data appears in a URL.
- **Revocation.** `schedule()` deletes every Sanctum token and every `user_devices` row, and signs a driver out, inside the users row lock.
- **423 guards.** Booking re-checks under the `RideBookingGuard::lockPassenger` row lock. Going online is refused in `DriverAvailability::set`. Every assignment path (driver accept, admin assign and update, admin create with a driver, auto-accept) goes through `RideAssignment` → `whileAvailable`, which refuses a scheduled account under the driver row lock.
- **Locks.** The order is users → wallet, the same as WalletLedger, top-ups, settlements and `Wallet`. `precheck` runs before the code is used up, and `schedule` checks again under both locks.
- **Anonymisation.** It clears every PII column on `users`, deletes files on the private and public disks after commit, removes documents, vehicle photos and papers, saved places, emergency contacts, devices, notifications, preferences, the live location, privacy zones and OTPs, revokes shares, and deletes chats the user sent unless the ride has a safety report. The ledger is kept and the wallet is blocked.
- **Audit rows.** They hold ids, the channel, dates, the reason slug and the amount forfeited. The client IP and user agent are cleared by the existing BE-46 job.
- **Migration.** It only adds things: two nullable columns, one index and a new table, with re-runnable guards. The `restrictOnDelete` foreign key is handled by the admin hard-delete (`LINKED_RECORDS`).
- **Settings fallback.** It applies only when the admin value is empty, and it is URL-validated.

**Follow-ups (none blocks this diff)**
1. **Medium: parcel receiver PII is not scrubbed.** `anonymise()` (AccountDeletions.php:441) leaves `parcels.receiver_name`, `receiver_phone` (encrypted), `item_description` and `pickup_photo_path` on parcels the deleted user sent. Nothing else scrubs them either. Fix: null or blank these fields, and delete the pickup photo, for the user's finished parcel rides (keep them only where a safety incident exists).
2. **Medium: the retention promise is not enforced.** The page and the API tell the user "we keep these for N years" (`retention_years`), but no job removes or further anonymises kept rides, tracking, tickets, ratings or safety records after N years. Fix: add a pruning job once the owner sets the legal figure (B-item), or reword the copy until then.
3. **Medium: money during the cooling-off period.**
   - Top-ups are not refused while a deletion is scheduled (`TopUps.php:133` checks only `wallet.status`). Credit added after the acknowledgement is forfeited without consent. Fix: return 423 `ACCOUNT_DELETION_SCHEDULED` on top-up creation.
   - At `anonymise()`, either postpone while a `payment_intent` is pending or a payout settlement is pending, or cancel those first. Otherwise a payout can be approved after the bank details are nulled.
4. **Low: admin ride creation is not guarded.** It does not refuse a passenger in the cooling-off period (`Admin/RideController.php:136`), and the open ride then postpones the anonymisation. Fix: the same 423 check under the passenger lock.
5. **Low: session cleanup.** Use `session()->regenerate(true)` (web controller line 158). On `schedule()`, also delete the user's `sessions` rows. On `anonymise()`, also delete their `password_reset_tokens` (keyed by the real email). `device_sightings` stay linked to the user id: keeping them for fraud checks is accepted, but list them under "what we keep".
6. **Low: the fallback URL can be http.** `ACCOUNT_DELETION_URL`, or `APP_URL` when that is empty, may be `http://` (SettingsController.php:129). Require https for `account_deletion_url` outside local.
7. **Low or info:**
   - Anyone can send up to 5 deletion SMS per day to any registered number. The per-IP throttle and the global SMS budget make this acceptable.
   - An open ride that never closes postpones the anonymisation forever, with only a log line. Alert an admin after 7 days.
   - Consider an `X-Robots-Tag: noindex` header in addition to the meta tag.

**Rulings on the builder's out-of-scope notes**
- *A pending payout settlement is not a blocker at request time.* **Accepted for the request.** It is not accepted for the anonymisation: see follow-up 3.
- *Audit rows are pruned at 180 days.* **Accepted.** The rows hold no personal data beyond the IP and user agent, which BE-46 clears. `account_deletion_requests` keeps the lasting history without personal data.
- *Free text inside kept records is kept.* **Accepted** for safety reports, support tickets, fare disputes and rating comments: these are evidence and dispute records, and the user is told they are kept. This holds only if they fall under the retention prune (follow-up 2). Structured third-party PII such as parcel receivers is **not** free text and must be scrubbed (follow-up 1).

**Follow-up review 2026-10-20 (BE-132 61bd5c2, BE-133 c26dc27, backend branch `be-132`): PASS.** Diff c10807f..c26dc27. Full suite on in-memory sqlite: 2611 tests OK, 20 of them new (`AccountDeletionPrivacyTest`, `AccountDeletionMoneyTest`).
- **#1 resolved.** `anonymise()` scrubs the receiver name (nothing kept, not even the initial), phone, item, codes and notes on every parcel the user sent, unless the ride has a safety incident. The pickup photo (`uploads/parcels/…`, private disk) is deleted after commit. Parcels the user carried as a driver are left alone. The retention scrub now goes through the same `ParcelDelivery::scrubPersonalData`.
- **#2 still open.** Retention prune: waits for the owner's legal figure.
- **#3 resolved.** `POST /wallet/topups` returns 423 `ACCOUNT_DELETION_SCHEDULED` under the users lock, before the idempotent replay. `can_top_up` is false during the cooling-off period. The request is blocked while a top-up is open (`TOPUP_PENDING`). `anonymise()` waits on an open ride, an open top-up, a pending settlement or a non-zero `pending_balance`, checked under the users and wallet locks (the same order as credit and `approveSettlement`).
- **#4 resolved.** Admin ride creation returns 423 under `lockPassenger`. Admin update cannot change `passenger_id`.
- **#5 resolved.** `regenerate(true)`; `schedule()` deletes the user's database sessions; `anonymise()` deletes `password_reset_tokens` for the real email and the pending email (both stored as plain text). `device_checks` is listed under "what we keep" in the API and on the web page.
- **#6 resolved.** `account_deletion_url` is https-only outside local and testing; an http value or APP_URL gives null.
- **#7 resolved (alert and header).** One `SecurityEvent` (`account_deletion_postponed`, ids, reason and dates only) once the wait passes `postponed_alert_days` (default 7). It is not raised again while one is still new or under investigation. `X-Robots-Tag: noindex, nofollow` is sent on every `/account/delete` response, a 429 included, through the priority list. The SMS-volume point stays accepted.
- **Ruling: `POST /wallet/settlements` during the cooling-off period stays allowed.** It is the driver's own money. A payout before the forfeiture is the outcome that best respects consent. Approval takes the users and wallet locks, and `anonymise()` waits for any pending settlement while the bank details are still there. A driver who keeps opening requests only delays their own deletion, and the 7-day alert catches that. Nice to have: show "deletion scheduled" on the admin settlement review.
- **New, low (not blocking): a late top-up credit during the cooling-off period.** `TopUps::lateRecheckAllowed` can still credit a failed or expired intent up to `late_recheck_hours` (24 h) after it was created. The `TOPUP_PENDING` blocker only looks at open intents inside the grace window. So a top-up that expired just before the request, and was then paid late, lands after the acknowledgement and is forfeited. Fix: count failed or expired intents still inside the late-recheck window (and not `AMOUNT_MISMATCH`) in `TOPUP_PENDING`, or make the late-credit path flag `needs_review` when a deletion is scheduled.

**Follow-up review 2026-10-20 (BE-135 0eed827 on c26dc27, worktree `rh-backend-be-135`): PASS.** Diff c26dc27..0eed827. Full suite on in-memory sqlite: 2620 tests OK, 9 new in `AccountDeletionLateTopUpTest`.
- **Late-credit gap resolved.** `TOPUP_PENDING` now also counts open, failed or expired intents created inside `late_recheck_hours` (not `AMOUNT_MISMATCH`), with `retry_after_at`. The rule matches `lateRecheckAllowed`, and it is read in `precheck` under the users and wallet locks. As a second line of defence, `credit()` flags a late success `needs_review` (`success_during_account_deletion`) while a deletion is scheduled. In that case nothing is posted to the ledger and the intent status does not change, so no credit is doubled and none is lost silently.
- **Lock order unchanged.** `credit()` takes users, then wallet, then intent. `schedule()` and `approveSettlement` take users, then wallet.
- **Admin.** A flagged intent shows under "Needs review" in the top-ups list (`meta->needs_review` filter). The settlements page badge is inside `auth` + `role:admin`, and a test checks that a non-admin is refused. The query loads only `deletion_scheduled_for` and `anonymized_at` in addition to the existing fields.
- **New, low (not blocking):**
  1. *The flag can be undone.* `credit()` does not look at `meta.needs_review`. If the user cancels the deletion while still inside the late window, a replayed signed IPN or return, or a late inquiry, credits the intent. If an admin has already refunded it at the provider, the money is paid twice. Today this path is only reachable if the blocker is bypassed (for example, `late_recheck_hours` raised after scheduling). Fix: in `credit()`, never auto-credit an intent whose `review_reason` is `success_during_account_deletion`; leave it to the admin. Or add an admin "resolved/refunded" mark that `credit()` respects.
  2. *Only the late path is guarded.* `$deleting` is computed only when `$late` (TopUps.php:343). An intent that is still open, older than the late window and missed by the sweep is in neither blocker, so a success for it is credited during the cooling-off period. Fix: drop `$late &&` from `$deleting`.
  3. *Info.* `PaymentIntent::REVIEW_REASON_LABELS` has no entry for `success_during_account_deletion` (the generic fallback is shown). Add wording that tells the admin to refund through the provider. There is still no in-app refund action for needs-review intents (AdminTopUpController:22, pre-existing).

### SEC-35 · medium · realtime: Laravel Reverb hint events (BE-12, backend 58a6937 on 4583fdc)
**Verdict: PASS, with follow-ups.** Diff 4583fdc..58a6937 on backend branch `be-12`, worktree `rh-backend-be-12`. Full suite on in-memory sqlite: 2663 tests OK, including the `RealtimeTest` cases (channel auth, crafted ids, blocked callers, payload shapes, throttle, broadcaster gate, failure isolation). `composer audit`: no advisories.

**Checked and safe**
- **Channel auth.** `POST /broadcasting/auth` runs `auth:sanctum` → `active` (SEC-07/BE-32: blocked accounts and revoked tokens refused) → `PrivateChannelsOnly` (only `private-*`; `presence-*` and `private-encrypted-*` refused, so Laravel's prefix stripping cannot open `presence-user.{own id}`). There is no `web` group, so no session or cookie auth and no CSRF surface. Ids are parsed strictly (`ctype_digit`, no leading zero), so `05`, `5abc`, `-5` and `5.0` never match. `ride.{id}`: passenger or the *current* `driver_id` only, so no admin, no stranger, and no requeued ride's earlier driver at subscribe time. A missing ride and a foreign ride both return 403, so there is no existence oracle. `user.{id}`: self only. `driver.{id}`: self, and only with the driver role. The Pusher signature binds `socket_id`, so an auth response cannot be replayed on another connection.
- **Payloads.** Every event carries only ids, statuses, counts and timestamps. There are no names, phones, addresses, fares or chat text. `notification.created` carries id and category only. `ride.requested` has no ride id at all, so a nudged driver whom the feed hides learns nothing. `ride.request_withdrawn` goes only to drivers in `ride_offers`, who already hold that id.
- **Driver position.** `ride.driver_location` goes only to `private-user.{passenger_id}`, never to the ride channel, so a requeued ride's earlier driver never sees the new driver. It is sent only for a driver whose effective state is `on_ride` and only for an accepted ride in `ACTIVE_RIDE_STATUSES`. It carries exactly `PUBLIC_LOCATION_FIELDS`, the same as `GET /rides/{id}/driver-location`, and is throttled to one per 3 s per ride (`Cache::add`, floor 1 s). Available-driver pings are never broadcast, and the recipient query returns ids only, so no nearby positions leak (SEC-31/32 intact). Women mode: the nudge reaches only verified female drivers, each on their own private channel, so nothing narrows the passenger map (SEC-32 condition 3 unaffected).
- **Log leak (SEC-04).** `Realtime::enabled()` sends nothing unless `broadcasting.default` is `reverb` or `pusher`. The local `.env` has `log`, which sends nothing. phpunit forces `null`. There is no other `ShouldBroadcast` in `app/`: `ChatMessageSent` stays a plain event. Failures are reported through `ApiError::report`, with the event class name only, and never reach the caller. `ShouldDispatchAfterCommit` means a rolled-back assignment publishes nothing.
- **Reverb config.** Client events are off (`accept_client_events_from=none`). The per-connection rate limit is on (60/60 s). `max_message_size` is 10 kB.
- **Settings and secrets.** `meta.realtime` holds the public key, host, port, scheme, `websocket_url` and `auth_endpoint`, and never the secret (a test asserts this). SEC-19: the hardcoded `wss://raahehaq.com/ws/...` literals are gone, and the URL comes from config. `.env` is still ignored. The examples hold placeholders only, and `.env.production.example` keeps `BROADCAST_CONNECTION=null` until the owner sets Reverb up (B-10).
- **Deployment.** nginx proxies `/app/` inside the existing TLS 443 server block (wss), and `location /apps/ { return 404; }` hides Reverb's HTTP publish API. Reverb listens on 127.0.0.1:8080 and port 8080 stays closed in the firewall. The API publishes over loopback. The supervisor command has no `--debug`. Hostinger shared hosting keeps `null`.
- **Supply chain.** `laravel/reverb` is pinned exactly at `1.11.1`. The lock adds only new packages (pusher-php-server 7.3.0, ratchet/rfc6455, reactphp/*, clue/redis-*, evenement), all from their canonical GitHub repos. Nothing already present was upgraded.

**Follow-ups (none blocks this diff)**
1. **Medium: stale subscriptions after access is lost.** A subscription is checked once, at subscribe time. (a) A passenger whose account is blocked, or whose token is revoked or logged out mid-ride, keeps receiving `ride.driver_location` (exact driver coordinates) on an open socket until it disconnects. (b) A requeued ride's earlier driver keeps receiving `ride.status` hints for that ride (statuses only, accepted by design in `RealtimeEvent`). Fix (backend): in `Realtime::driverLocation()`, send only when the passenger's `status` is active and they hold at least one unrevoked token; on block, revoke or logout, optionally terminate the user's connections via Reverb's API. Fix (app, T-406): disconnect the socket and unsubscribe every channel on logout, on a 401/403, and when a ride leaves the user's active state.
2. **Low: `/broadcasting/auth` is not throttled.** No `throttle` middleware is applied (route:list shows auth:sanctum, active, PrivateChannelsOnly only), and each call costs a token lookup and a ride query. Fix: add a named limiter (for example 30/min per user) to the `withBroadcasting` middleware list. The route also accepts GET (framework default). That is harmless with bearer tokens, but POST-only is cleaner.
3. **Low: connection limits and origins.** `max_connections` is unlimited (`REVERB_APP_MAX_CONNECTIONS` unset) and `REVERB_ALLOWED_ORIGINS=*` in `.env.production.example`. Origin checks protect only browsers, and private channels need a bearer token (not cookies), so cross-site WebSocket hijacking is not exploitable today. Fix: set a `max_connections` ceiling in DEPLOYMENT.md, add an nginx `limit_conn` per IP on `/app/`, and set the origin list to the admin domain if a browser client is ever added.
4. **Low: coordinates at rest in the queue.** With `QUEUE_CONNECTION=database`, each `ride.driver_location` job, and any failed copy in `failed_jobs`, stores the driver's coordinates. A slow worker can also deliver a position after the ride has ended. Fix: give the broadcast `$tries = 1` and a short `retryUntil`/`deleteWhenMissingModels`-style expiry for location events, and schedule `queue:prune-failed --hours=24`. Optionally re-check the ride status in `broadcastWhen()`.
5. **Low: placeholder credentials.** `.env.example` ships `REVERB_APP_SECRET=change-me-secret`. Fix: `Realtime::enabled()` (or the existing production config check) should refuse or warn when the key or secret is empty, `CHANGE_ME` or `change-me-*` outside local.

## Pre-release audit 2026-10-21

rh-security, `audit all`, reading code only. **App:** `fix/phase-2-onboarding` at `3506707` (code as of `88aef14`). **Backend:** `fix/production-hardening` at `477df7d`. No request was sent to any server, and no local or production database was touched. Tools: `git ls-files`/`git grep`, `php artisan route:list --json` (offline), `composer audit --locked` (no advisories), `yarn audit --groups dependencies` (6 critical, 133 high, 72 moderate, 6 low), backend suite on in-memory sqlite (2694 tests OK, 42449 assertions), `yarn verify`.

### Status of earlier findings

| Finding | Status on 2026-10-21 |
|---|---|
| SEC-01 role checks | Holds. All 119 `admin/*` routes carry `role:admin`. Every non-admin `api/*` route is either public on purpose (auth, health, signed files, payment callbacks, public settings and banners) or behind `auth:sanctum` + `active`. Admin actions inside `SupportController` check `hasRole('admin')`. |
| SEC-02, SEC-06 | Fixed in code. `config/app.php:45` forces debug off outside local/testing, and OTP echo needs `APP_ENV=local` plus debug (`OtpResponse::echoesCode`). The live server is still owner work (B-12, B-16). |
| SEC-03, SEC-31, SEC-32, SEC-33 | Hold (BE-20, BE-118, BE-119, BE-120, BE-127). **But see SEC-37:** a legacy location-write path skips the SEC-33 spoofing check. |
| SEC-04, SEC-30 | Hold. No `Log::` call takes request values. SMS logs mask the phone. Realtime failure logs (BE-138) carry the event class and reason only. |
| SEC-05 uploads | Holds. Identity documents, vehicle papers and parcel photos go to the private `local` disk (`UserFiles::diskFor`, `ParcelDelivery::pickup`), with mime and size rules. Avatars are re-encoded (`ProfilePhoto`). Files are served only through `signed:relative` + `PrivateFileController`. |
| SEC-07, SEC-08, SEC-13, SEC-26, SEC-27, SEC-28 | Hold (BE-25, BE-27, BE-28, BE-53, BE-54). Every current-password check, web `DELETE /profile` included, uses `ThrottledCurrentPassword`. |
| SEC-09 wallet | Holds (BE-09 ledger: users → wallet lock order, amounts in minor units). |
| SEC-10 composer | Fixed. `composer audit --locked`: no advisories. |
| SEC-11 app dependencies | **Still open (medium), T-701.** `axios` is still 1.12.2 (high advisories, runtime). The `firebase` JS SDK (12.2.1) now comes in transitively through `@react-native-firebase/app` (critical `protobufjs` and `websocket-driver`, high `@grpc/grpc-js`; mostly not bundled on native). `@react-native-firebase/auth` is still installed (`@xmldom/xmldom` high), although T-107 removed the Firebase auth path. The rest is build-time tooling under `react-native`. Upgrade axios before release; it should not wait for the rest of T-701. |
| SEC-12 Firebase rules | Owner, B-13, open. |
| SEC-14, SEC-15 repo hygiene | **Still open (low).** `raah_e_haq_admin.sql`, `composer.phar`, `reh` and `test_ride_api.php` are still tracked, and `test_ride_api.php:14` still targets `https://raahehaq.com/api`. |
| SEC-16 input bounds | **Still open (low), admin-only.** `per_page` is unbounded (`PaymentsController.php:18`, `SecurityController.php:16,26,35`, `AnalyticsController.php:22`). Banner `image_url`/`action_url` are `string` only (`SettingsController.php:49-50`). |
| SEC-17 transport | **Still open (low).** `src/config/env.ts:55-59` accepts `http://`/`ws://` in release, and `Info.plist:44` keeps `NSAllowsLocalNetworking` for Release. The realtime client refuses non-wss in release (`resolveRealtimeConfig`), and OS cleartext blocks still apply. |
| SEC-18 notification cache | Resolved. `notificationService` is gone, and logout removes the legacy key (`sessionThunks.ts:137`). |
| SEC-19 socket URLs | Resolved (BE-12, T-406). The app connects only with `env.WS_URL` + `WS_APP_KEY`. The server's `meta.realtime` must match it, or the app stays on polling. |
| SEC-20 logger | **Still open (low), T-606.** `logger.ts:21` still has no `Bearer …` string mask and no dob/gender/ip keys. `placesService.ts:139` logs the reverse-geocoded address at debug level (stripped in release). |
| SEC-21, SEC-29 | Hold (T-104, T-114). |
| SEC-22, SEC-23 | Accepted, unchanged. |
| SEC-24, SEC-25 | Hold (BE-46). |
| SEC-34 account deletion | Holds, except #2 (the retention prune, BE-134, blocked on the owner's legal figure). The BE-135 lows are folded in: `TopUps.php:339` never auto-credits a flagged intent, `$deleting` no longer depends on `$late` (`:354`), and the review label is worded. **But see SEC-36:** the old web delete still bypasses the whole flow. |
| SEC-35 realtime | Follow-ups 1-5 resolved in `0a95617`/`384f16c`: `Realtime::passengerReachable` (active user with a live token), re-checked when the job runs, `tries=1`; `/broadcasting/auth` is POST-only with the `broadcast-auth` limiter; failed position jobs are pruned after 24 h; placeholder or short credentials turn realtime off outside local. App (T-406): auth goes through the shared axios client, so the token goes only to the API origin. A 401/403 drops channels, `reset` runs on logout, and nothing logs payloads. |

**New areas checked, no finding:** reach ids (BE-119) and `chat.unread_count` (BE-136) are unchanged since the SEC-32 amendment. The T-708 request banner shows only fare, net and distance, with no passenger data. T-593/T-596 changed no manifest permissions: FINE + COARSE + POST_NOTIFICATIONS only, no background location, iOS `UIBackgroundModes` = `remote-notification` only (B-08). Push-open targets are validated as positive integers. The account-deletion app flow never keeps or logs the code. AI fact packs (BE-92) use role labels, coarse areas and `PiiScrubber`. The fake payment gateway works only in local/testing (`FakeGateway::enabled`), and its callbacks are HMAC-checked. Secrets: no new tracked secrets in either repo. The env templates hold only empty or `CHANGE_ME` values. `.env` was never committed.

### SEC-36 · high · RESOLVED (BE-139) · backend: web `DELETE /profile` hard-deletes accounts, bypasses BE-129 and wipes safety evidence
**Evidence**
- `routes/web.php:202`: `DELETE /profile` → `ProfileController::destroy` (`app/Http/Controllers/ProfileController.php:138-165`). Its only middleware is `auth`. The form is `resources/views/profile/partials/delete-user-form.blade.php`. Any active passenger or driver can sign in on the web `/login` and reach it.
- The handler checks the password and then calls the BE-70 `AccountDeletion::delete` (`app/Services/AccountDeletion.php:53-73`), which runs `$user->delete()`. The only thing that stops it is money history (`blocker`: transactions, settlements, a non-zero balance). The BE-129 path (`AccountDeletions`: OTP, cooling-off period, active-ride and commission blockers, anonymisation, file deletion) is never used.
- So any account with no completed ride (a passenger whose rides were all cancelled, or a new or pending driver) is deleted at once, and the foreign keys cascade:
  - `rides.passenger_id` is `onDelete('cascade')` (`2025_09_17_115751_create_rides_table.php:17`), so every ride of that passenger is deleted, **an active or requested ride included**.
  - Through `ride_id` cascades, the delete also removes `safety_incidents` (`2026_10_14_100100_…:19`, including reports the **driver** filed about this passenger), `fare_disputes`, `ride_messages` (both sides of the chat) and the other ride-scoped rows. `safety_incidents.reporter_id` also cascades (`:20`).
- No user `deleting` hook removes files, so CNIC, licence and vehicle documents on the private disk, and the public avatar, are orphaned with no owner, no admin view and no prune.
- The admin hard deletes (`Api/UsersController::destroy`, `Admin/UserController:318`) use the same service and cascade the same way.
- `tests/Feature/ProfileTest.php:69-80` asserts that the hard delete works.

**Impact**
- A harasser who has not finished a ride (for example, books, abuses the driver and cancels) can erase the driver's safety report, the chat and the ride record from the web. That defeats the safety-first rule and the "kept for N years" promise of BE-129.
- Deleting mid-ride removes the ride under the driver.
- The identity documents of deleted drivers stay on disk forever, outside every retention and erase rule.

**Required fix**
- Web `DELETE /profile` for non-admins: remove the form and the route action, and send users to `/account/delete` (the BE-129 OTP flow, cooling-off and anonymise). Alternatively, call `AccountDeletions` precheck and schedule after a password and OTP check.
- `AccountDeletion::delete` (admin hard delete) must also refuse with `LINKED_RECORDS` when the user has any ride (as passenger or driver), safety incident, fare dispute or rating. Admins anonymise through `AccountDeletions` instead.
- Optionally, change `rides.passenger_id` and `safety_incidents.reporter_id` to `restrictOnDelete` as the database backstop.
- When a hard delete is still allowed (an account with no records at all), delete the user's private and public files after commit (`UserFiles::deleteStored`).
- Feature tests:
  - The web delete of a passenger with a cancelled ride and a driver-filed safety incident leaves the ride and the incident in place, and schedules the deletion (or refuses).
  - The admin delete of the same user returns 409.
  - Files are removed when a hard delete is allowed.

**Status (2026-10-21): resolved by BE-139 (backend `1844f20`), security diff review PASS.**
- Web `DELETE /profile` (`ProfileController::destroy`): every non-admin gets a 302 to `/account/delete`, or a 403 `USE_ACCOUNT_DELETION_FLOW` for JSON. This happens before the password check, so the BE-53 limiter is not spent. The Blade form is removed and nothing references it any more.
- `AccountDeletion::blocker` now also refuses `USER_HAS_LINKED_RECORDS` for any ride (passenger or driver), safety incident (reporter, passenger or driver), fare dispute or rating. It runs again under the users row lock. A RESTRICT violation maps to the same code. Both admin paths (`Api/UsersController::destroy`, `Admin/UserController::destroy`) go through it. No artisan command or seeder deletes users. The BE-129 `anonymise` path only updates the users row and never deletes it.
- Migration `2026_10_21_100000_…`: sets `rides.passenger_id` and `safety_incidents.reporter_id` to RESTRICT. It finds the FK by column plus `foreign_table = users` (`Schema::getForeignKeys`, which gives a name on MySQL and none on SQLite) and skips the change when the rule is already set. With no FK, it adds one only if there are no orphan rows. Each Schema command is its own `ALTER`, so a run that fails halfway can be run again. It only changes the delete rule, so existing rows still validate on MySQL.
- Files: `storedFiles()` reads only this user's columns, their own vehicles and their own driver documents, inside the lock. `deleteFiles()` normalises each path (`..`, schemes and NUL are refused) and deletes only under the private and public prefixes, and only after commit. The test also checks that another user's file stays.
- Suite on SQLite: 2706 tests OK.
- Residual (low, no task): the hard delete still cascades a few rows that are not covered by the linked-records check: `risk_signals.user_id` (fraud evidence), `ride_offers` and the auto-accept rows of a driver with no assigned ride, `referrals`, `support_tickets`/`ticket_replies`, and `notifications.created_by`/`banners.created_by` when an admin account is deleted. Only an admin can trigger this. Fold `risk_signals` (and admin-authored rows) into `hasLinkedRecords` the next time this service is touched. Separately, if a future schema was imported with a non-`bigint unsigned` column, the no-FK branch would fail on `ADD CONSTRAINT`. That fails loudly and can be re-run, so it is acceptable.

### SEC-37 · medium · RESOLVED (BE-140) · backend: legacy `POST /api/websocket/subscribe-driver` writes driver locations outside every location rule (bypasses the SEC-33 spoofing check)
**Evidence**
- `app/Http/Controllers/Api/WebSocketController.php:73-139` stores a `DriverLocation` (`updateLocation`, `:110-122`), sends a session heartbeat and feeds privacy zones on every call.
- Compared with `POST /tracking/update-location` (`DriverTrackingController.php:36-78`), this path:
  - has no `role:driver` and no `throttle:driver-location` (route list: only `throttle:120,1` + `active`);
  - has no validation of `address`, `speed`, `heading` or `accuracy` (`$request->address ?? null`, any length or type, stored as is);
  - never calls `AutoAccept::onPing`, so no `is_mocked` flag and no jump detection;
  - sends no realtime hint.
- The jump detector compares each ping with the previous stored row (`AutoAccept.php:277`). A spoofer therefore "teleports" through `subscribe-driver` (no check), then sends normal `update-location` pings from the new spot. The jump is never seen, and the driver stays eligible to be the "nearest" for auto-accept (SEC-33 condition 2) and for the pickup-distance checks.
- The app no longer calls this endpoint: T-406 removed `webSocketService` (`grep subscribe-driver src` finds nothing). `subscribe-ride` is likewise only a config echo now.

**Impact:** the anti-spoofing control for auto-accept can be bypassed, which is the targeted-assignment risk in SEC-33. Unbounded strings also get into `driver_locations.address`.

**Required fix**
- Remove the location write from `subscribe-driver` (return only the realtime config), or delete both legacy `websocket/subscribe-*` routes, now that `/settings/public` `meta.realtime` replaces them.
- If a write must stay, it goes through the same validated service as `update-location`: rules, `role:driver`, the `driver-location` limiter and `AutoAccept::onPing`.
- Update `DriverAvailabilityTest.php:447`. Add a test that a teleport through any location write is flagged.

**Status (2026-10-21): resolved by BE-140 (backend `04a7ecf`), security diff review PASS.**
- Both `websocket/subscribe-*` routes are deleted (404 in `RealtimeTest`). The stub `send*` helpers are deleted too, and one of them also wrote locations. `GET websocket/events` stays and is read-only.
- Nothing calls the removed routes: no hits in the app `src/`, and no backend callers apart from the 404 tests. `AutoAcceptHardeningTest` now shows that the old teleport is refused.
- Remaining `DriverLocation` writers: `Api/DriverTrackingController::updateLocation` (the ruled path); the status-only updates in `RideAssignment:287` and `RideLifecycle:796` (no coordinates); and the admin web `POST /admin/driver-tracking/update-location`. See SEC-44 for the admin route.

### SEC-38 · medium · backend: admin accounts have a single factor (web panel and admin API tokens)
**Evidence**
- There is no 2FA/TOTP anywhere in the backend: no package and no columns (`grep -i 'two_factor|totp|fortify'` finds nothing).
- An admin signs in on the web `/login` with email and password (`LoginRequest`, BE-53 limiter only). The session lifetime is 120 min (`config/session.php:35`).
- `POST /api/auth/login` also issues an admin Sanctum token that is valid for 30 idle days (`SANCTUM_IDLE_EXPIRATION`) and has full `role:admin` API power: `payments/wallets/{wallet}/adjust`, transaction reversal, settlement approval, driver approval and gender verification, signed CNIC and licence URLs (`users/{user}/documents`), user export and notification broadcasts.
- `DEPLOYMENT.md` documents no IP allowlist for `/admin` or the admin API.

**Impact:** one phished or reused admin password, or one leaked admin token, gives control of money, driver approvals and every user's identity documents. That is the highest-value target in the platform.

**Required fix**
- TOTP 2FA, required for every `admin` role user on the web login: enrolment, recovery codes, and a `2fa` middleware on the `admin.*` group.
- Refuse `POST /api/auth/login` tokens for admins (403 `ADMIN_USE_PANEL`), or issue them only after the second factor with a short absolute cap (for example 12 h).
- Shorter idle lifetime for admin web sessions (for example 30 min).
- Optional: an `ADMIN_ALLOWED_IPS` allowlist, documented in DEPLOYMENT.md.
- Feature tests.
- **Owner:** enrol each real admin after deploy.

### SEC-39 · low · backend: unthrottled public web endpoints
- `POST /contact` (`LandingController.php:22-58`) has no throttle and writes a log line per call. `GET /stats` (`:63-79`) has no throttle, runs two `COUNT` queries per call and discloses total user and driver counts. The API twins (`api/public/*`) are throttled.
- **Fix:** `throttle:10,1` on `/contact` and `throttle:60,1` plus a 5-minute cache on `/stats`, or delete them if the landing page no longer uses them.

### SEC-40 · low · backend: no per-passenger limit on booking and free cancelling
- `POST /api/rides` and `POST /api/rides/{ride}/cancel` carry only the general `throttle:120,1`. `RideBookingGuard` stops concurrent rides and duplicates, but not a book → cancel loop. Cancelling while `requested` is free.
- Each booking fans out a `ride.requested` hint to up to 50 nearby drivers (`Realtime::requestRecipients`) and puts a phantom request on their feed and banner (T-708). The recipient query runs in the worker each time.
- **Fix:** a per-passenger booking limiter (for example 6 per 10 min) and a cooldown after about 3 requested-state cancels in 15 min, with 429 `rate_limited` and `retry_after` in the BE-28 envelope. Add tests.

### SEC-41 · low · backend: no security headers on the admin panel from the app itself
- Only `PublicTripHeaders` and `PrivateFileController` set `X-Frame-Options`/`nosniff`/CSP. The `DEPLOYMENT.md:745-746` nginx block adds `X-Frame-Options SAMEORIGIN` and `nosniff`, but no HSTS. Hostinger shared hosting (Apache, `public/.htaccess`) adds none, so `/admin` can be framed (clickjacking on wallet adjustments and driver approval).
- **Fix:** a web-group middleware that sends `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`, plus `Strict-Transport-Security` in production. Add a test.

### SEC-42 · low · app storage: hidden recent destinations kept in plain text across logout
- `src/features/passenger-home/hiddenRecents.ts:11,49` stores the normalised **address** of every destination the user hid (`recentDestinations.ts:11,32`) under one global key, `home_hidden_recents`. The key is not per user, and logout doesn't remove it: `authStorage.clear` removes only `LEGACY_KEYS` + `USER_KEY`. The invite-code cache (`features/invite/hooks.ts:37`, per user) is also left behind.
- On a shared phone, the next account inherits the list, and the list survives in backups. These are places the user chose to hide, which may be sensitive.
- **Fix:** clear both on logout (the logout wipe step), or store hidden recents as a hash of the key, per user. Add a unit test.

### SEC-43 · low · app: the top-up checkout WebView accepts any https start URL
- `TopUpCheckoutScreen.tsx:72,130-145` loads `params.url` (the server's `next_action.redirect`) when `isAllowedCheckoutUrl` holds, and that check is "any https" (`topUpLinks.ts:69-74`). Later navigations are also any https.
- The hardening is good: no JS bridge (`onMessage`), incognito, no new windows, every non-https scheme blocked and nothing handed to the OS. But the in-app view has no address bar, so a tampered or misconfigured response could show a look-alike page that asks for a JazzCash/Easypaisa PIN.
- **Fix:** accept a start URL only on the API origin (`/api/payments/checkout/…`) or on an allowlist of the gateway hosts (sandbox and production, from env). Show the current host in the header. Add a unit test.

### SEC-44 · low · backend: admin web route writes any driver's position and status outside the location rules
- `routes/web.php:155` → `Admin/DriverTrackingController::updateLocation` (`:161-191`) calls `DriverLocation::updateLocation` for any `driver_id`, with any coordinates and `status` (`online|available|busy|offline`). There is no `AutoAccept::onPing`, no availability service (the users row and the online session are untouched) and no realtime hint. `:233` `trackRideLocation` does the same for `ride_tracking`.
- Guarded by `auth` + `role:admin` + CSRF and validated. No admin view calls either route (`grep` in `resources/` finds nothing).
- **Impact:** a compromised admin (see SEC-38, single factor) can plant a driver's position or mark them `available`, and that steers the nearest-driver and auto-accept selection without the jump check. It is not reachable by passengers or drivers.
- **Fix:** delete both unused admin write routes, or route them through the same service as `tracking/update-location` (including `onPing`) and audit-log them. Add a test that they return 404, or that they are flagged.
- Recorded during the BE-140 review. It is not a regression from that change.

### Pre-release checklist
| Item | Result |
|---|---|
| App 1 Secrets | OK. Only the public-by-design Firebase configs and the default `debug.keystore`. `.env.example` has empty values. Maps key history: B-02. |
| App 2 Token storage | OK (Keychain, full logout). SEC-42 (low) |
| App 3 Logging | OK in release (console stripped except `error`, through the strict redactor). SEC-20 (low) still open |
| App 4 Transport | OK at OS level. SEC-17 (low) |
| App 5 Auth flows | OK. OTP never kept or shown. 401 → logout. 403 `ACCOUNT_*` → status screen. Realtime auth through the shared client. |
| App 6 Input/navigation | OK. Deep link `raahehaq://wallet/topup` reads only an id (shape-checked); push targets validated. SEC-43 (low) |
| App 7 Permissions | OK. Foreground only (B-08). T-593/T-596 added no permissions. |
| App 8 Dependencies | SEC-11 (medium) open: axios |
| BE 1 Config | OK in code. Live: B-12, B-16. SEC-14/15 (low) |
| BE 2 AuthN | OK for OTP, tokens and limiters. SEC-38 (medium): admin single factor |
| BE 3 AuthZ/IDOR | OK. Every parameterised route checked (policies, `visibleTo`, `user_id` scoping, `role:*`). |
| BE 4 Mass assignment | OK (the identity fields stay locked) |
| BE 5 Injection | OK. Raw fragments are constants or bound. |
| BE 6 Uploads | OK. SEC-36: files orphaned on a hard delete |
| BE 7 Races | OK (assignment, ledger, deletion lock order) |
| BE 8 WebSockets | OK (SEC-35 resolved). SEC-37: legacy subscribe endpoint |
| BE 9 Headers/CORS | Framework CORS default, token auth. SEC-41 (low) |

**Verdict: one release blocker in code, SEC-36 (high).** SEC-37, SEC-38 and SEC-11 (axios) should land before release as well. Owner items before launch: B-02, B-05/B-21, B-10, B-11, B-12, B-13, B-15, B-16, B-17, B-18, B-22, and the BE-134 legal figure.

**Tasks:** BE-139 (SEC-36), BE-140 (SEC-37), BE-141 (SEC-38). SEC-11 stays with T-701; its axios upgrade should be done before release. Lows SEC-39..43 have no task yet (fold into related work).

## T-711 security review (diff, 2026-10-21): SEC-11 partial, SEC-42 and SEC-43 resolved

Verdict PASS. The uncommitted T-711 diff was reviewed at 99f42e4. `yarn verify` PASS (0/0/0, Jest 3918/3918).

| Item | Status after T-711 |
|---|---|
| SEC-11 app dependencies | **Partly resolved (axios).** `axios` is pinned to exactly `1.20.0`. It pulls `follow-redirects` 1.16.1 and `form-data` 4.0.6. The `https-proxy-agent` dependency is Node-only: the `react-native` export maps to `dist/browser`. `yarn audit --groups dependencies` now reports 6 critical, 121 high, 51 moderate and 5 low, with no axios, follow-redirects or form-data advisory. **Still open (T-701):** the `firebase` JS SDK (via `@react-native-firebase/app`: `protobufjs`, `websocket-driver`, `@grpc/grpc-js`); build tooling (`minimatch`, `brace-expansion`, `js-yaml`, `nanoid`, `browserslist`, `ws` under `react-native`/CLI, `image-size`, `shell-quote`). Correction to the SEC-11 evidence: `@xmldom/xmldom` comes from `react-native-asset` → `plist` (build-time), not from `@react-native-firebase/auth`. That package stays on purpose, because `src/services/legacyFirebaseSignOut.ts` (from `AuthProvider`) signs out pre-T-107 sessions. Client compatibility: the interceptors, `onSessionAuthRefusal` (T-406), `isTokenTarget` (`getUri`), the 30 s and per-call timeouts and CancelToken are all unchanged APIs. For a React Native `FormData`, axios ≥1.17 now drops the explicit `multipart/form-data` header so the native layer sets the boundary. That is the correct behaviour, but it is a runtime change: an avatar, document or registration upload should be smoke-tested on a device. |
| SEC-42 hidden recents / invite code | **Resolved.** Hidden recents are kept per user (`home_hidden_recents.<id>`), and nothing is stored while signed out. Logout removes every `home_hidden_recents*` key, including the old global one, and every `rh.invite.code.*` key (`sessionThunks.ts` steps). The in-memory invite caches are dropped by the session epoch (`queryCache.ts:169`). `__tests__/store/logout.test.ts` checks this. The addresses are still plain text while signed in, which the fix allows. |
| SEC-43 checkout start URL | **Resolved.** `isAllowedCheckoutStartUrl` (`src/features/wallet/topUpLinks.ts`) is used in both `AddMoneyScreen` and `TopUpCheckoutScreen`. It accepts only two kinds of start URL. (1) `<API path>/payments/checkout/<id>` on the exact API scheme, host and port. The id is shape-checked, so no `/`, `.` or `%` can follow. (2) https with no explicit port on `payments.jazzcash.com.pk` or `easypay.easypaisa.com.pk`, which match `config/payments.php`. The sandbox hosts and local names are accepted only when `__DEV__`. Probed and refused: user-info (`a@b`, `a:443@b`, `\@`), trailing-dot hosts, suffix and sub-domain look-alikes, Cyrillic and punycode hosts, `%2e` and `..` paths, non-default ports, http, leading or embedded whitespace, and other schemes. The current host is shown under the title. The match fails closed if the backend `APP_URL` host ever differs from `API_URL` (for example `www.`): the flow then goes to the status screen. |
| New, low (this diff) | `TopUpCheckoutScreen` `onNavigationStateChange` sets the host to `checkoutHostOf(state.url)`. A later navigation that `isAllowedCheckoutUrl` allows (any https) but `parseWebUrl` cannot parse (user-info, `_` in host, IPv6) sets the host to null, so the label disappears exactly on the spoof-shaped URL. Fix: refuse later navigations whose host can't be parsed, or keep showing the raw authority. Fold into the next wallet task. |
