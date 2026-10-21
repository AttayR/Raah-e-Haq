# Release readiness (2026-10-21)

Final step of the autopilot programme. Sources: [TASKS.md](TASKS.md), [OWNER_NEEDS.md](OWNER_NEEDS.md), [audit/SECURITY.md](audit/SECURITY.md) (Pre-release audit 2026-10-21 and the T-711/BE-142 reviews), [audit/PERFORMANCE.md](audit/PERFORMANCE.md), [api/CONTRACT_NOTES.md](api/CONTRACT_NOTES.md), backend `DEPLOYMENT.md`, and `qa-reports/`.

**Snapshot.** App `fix/phase-2-onboarding` at `94a14f8`: `yarn verify` PASS (TS 0, ESLint 0/0, Jest 3964/3964, bundle OK). Backend `fix/production-hardening` at `681765c`: 2803 tests on sqlite. Tracker: 221 done, 45 verified-no-qa, 18 in-review-qa, 8 in-progress, ~53 todo (many stale, see §2), 2 blocked.

**Verdict.** The code is ready for a **closed pilot** once the owner items in §4 are done and the QA queue in §2a passes. It is not ready for an open store launch yet (no Release-build smoke, no crash reporting, real-money top-up not live).

---

## 1. What works

All QA ran against the **local** backend (seeded fake data) on iPhone 17 simulators (iOS 26.5) and a Pixel 9 Pro API 37 emulator, Debug builds. Nothing has been run against production.

| Area | Status | Evidence |
|---|---|---|
| Auth: phone OTP, email login, session restore, logout everywhere, OTP never shown | Works | [phase-1-gate](qa-reports/2026-10-08-phase-1-gate/REPORT.md), [T-107b](qa-reports/2026-10-08-T-107b/REPORT.md), [T-113](qa-reports/2026-10-08-T-113/REPORT.md) |
| Registration both roles (driver 18+, licence, documents, server field errors) | Works | [ios27-registration](qa-reports/2026-10-11-ios27-registration/REPORT.md), [chat-notifications](qa-reports/2026-10-11-chat-notifications/REPORT.md) (driver path) |
| Passenger: map-first Home, Where to, stops, choose ride, server fare, offer within band, finding driver, requeue, no-driver, cancel (free/fee), trip, receipt, rating | Works | [ride-e2e-b](qa-reports/2026-10-10-ride-e2e-b/REPORT.md), [fares-photo-qa](qa-reports/2026-10-16-fares-photo-qa/REPORT.md), [uir10-t582-qa](qa-reports/2026-10-19-uir10-t582-qa/REPORT.md), [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) (UI-R12, ride #327) |
| Driver: Drive online/offline, request sheet (fare, net, commission), accept, PIN, slide start/complete, cash collected, rating, request banner on any tab | Works | [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) (UI-R11, UI-R13), [android-smoke-2](qa-reports/2026-10-21-android-smoke-2/REPORT.md) (T-708) |
| Driver earnings, stats, online time, commission per ride | Works (T-600 fix awaits QA) | [wallet](qa-reports/2026-10-12-wallet/REPORT.md), [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) (UI-R16, UI-R17) |
| Wallet: ledger, ride settlement, commission owed, pay commission (bank ref, admin approve/reject), history, filters | Works | [wallet](qa-reports/2026-10-12-wallet/REPORT.md) |
| Wallet top-up (JazzCash/Easypaisa) | Works against the **local fake gateway only** | [t-515-qa](qa-reports/2026-10-13-t-515-qa/REPORT.md), [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) (Rs 160 top-up) |
| Safety: ride PIN, SOS (15 + contacts), emergency contacts, share live trip + revoke, masked call (fake provider → chat only) | Works | [safety-qa](qa-reports/2026-10-14-safety-qa/REPORT.md), [switch-safety-qa](qa-reports/2026-10-15-switch-safety-qa/REPORT.md) |
| Parcel by bike, AC tier, women mode | Works | [t-560-r7-561-qa](qa-reports/2026-10-16-t-560-r7-561-qa/REPORT.md) (after [t-522-qa](qa-reports/2026-10-16-t-522-qa/REPORT.md) FAIL fixed), [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) (#330) |
| Help & support (tickets, reply, closed), Get help on a ride | Works (T-591 awaits QA) | [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) (UI-R18) |
| Invite (code, copy, share) | Works; link and amounts appear once the owner sets them | [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) |
| Account deletion (SMS code, cooling-off, restore, 423 blocks) + public `/account/delete` | Works | [trip-help-qa](qa-reports/2026-10-20-trip-help-qa/REPORT.md) (accounts 79, 80) |
| Inbox: notifications, chat, unread badge | Works | [uir14-t580-qa](qa-reports/2026-10-19-uir14-t580-qa/REPORT.md), [realtime-smoke](qa-reports/2026-10-21-realtime-smoke/REPORT.md) |
| Activity: history, receipt, ride details | Works | [ui-r15](qa-reports/2026-10-18-ui-r15/), [t573-uir15-t523-qa](qa-reports/2026-10-18-t573-uir15-t523-qa/REPORT.md) |
| English + Roman Urdu | Works, minor copy leftovers | [t575-t578-be110-qa](qa-reports/2026-10-19-t575-t578-be110-qa/REPORT.md) |
| Realtime (Reverb): subscribe, ride.requested, status, driver position, chat, background/foreground, logout, Reverb down → polling | **PASS 9/9** locally | [realtime-smoke](qa-reports/2026-10-21-realtime-smoke/REPORT.md) |
| Cold start, battery, polling cadence, bundle size | PERF-01..23 tasks closed (T-531..T-537); R8 on, arm ABIs only | [audit/PERFORMANCE.md](audit/PERFORMANCE.md), [safety-qa](qa-reports/2026-10-14-safety-qa/REPORT.md) (cold start A) |

**Platform status**

| Platform | Status |
|---|---|
| iOS (simulator, Debug) | Main QA platform; all flows above PASS. |
| Android (emulator, Debug) | Round 1 issues ([android-smoke](qa-reports/2026-10-21-android-smoke/)) fixed. Round 2: 9/10 PASS ([android-smoke-2](qa-reports/2026-10-21-android-smoke-2/REPORT.md)). Approximate location (T-712) and stale map route (T-713, [t713](qa-reports/2026-10-21-t713/)) fixed and device-verified; need an Android rebuild + smoke round 3. |
| Release builds (both) | **Never built or smoke-tested.** Needs signing (B-05/B-21) and T-705. |
| Physical devices | Not tested. |

---

## 2. Open tasks

### 2a. Built, waiting for QA (in-review-qa). One QA round clears these.

| ID | What | Blocks release? |
|---|---|---|
| T-592 | Android 15+ keyboard (IME inset) | Yes (Android): sign-in fields under the keyboard otherwise |
| T-593 / T-712 | Android approximate location via fused provider | Yes (Android): Home said "Turn on location" with approximate only |
| T-596 | Driver precise location on Android 12+ | Yes (Android drivers) |
| T-713 | Android map keeps stale route/marker (react-native-maps patch) | Yes (Android) |
| T-711 | axios 1.20.0, logout clears recents/invite cache, top-up URL allowlist | Yes: needs one native multipart upload smoke (avatar/document) |
| T-594 | Android polish (empty state, OTP submit, label, back, avatar) | No |
| T-591, T-595, T-598, T-600, T-707, T-709, T-714 | Receipt help, chat badge, driver rating tap, online time, net vs cash, cancel dialog, admin login copy + booking cooldown | No (fixes; verify in the same round) |
| T-708 | Request banner on any driver tab | No (PASS on Android round 2; confirm on iOS) |
| UI-R9b, UI-R18, UI-R19, UI-R20b | Design re-checks + QA (UI-R20b collapse fix cc23f15) | No (design polish) |

### 2b. Still to build

| ID | What | Why open | Blocks? |
|---|---|---|---|
| T-606 | Root ErrorBoundary + crash reporting; logger masks (SEC-20) | Only map screens have a boundary today; no crash telemetry | **Yes for pilot** (blind otherwise) |
| T-705 | Android versioning, final iOS config | versionCode 1 / 1.0; iOS Release keeps `NSAllowsLocalNetworking` (SEC-17); simulator bundle id still `org.reactjs.native.example…` | **Yes for store** |
| T-205 | Remove pre-BE-35 token-storing fallback in `registerUserWithImages` | Leftover path (AUTH-17) | Should (small) |
| T-503 | Final fake-data sweep | One TODO left: registration vehicle-type list hardcoded (`registrationForm.ts:15`) | Should |
| T-701 | Dead code + deps (SEC-11 rest: firebase JS SDK via RNFB app, build tooling) | Waits on B-20 | No (medium, mostly not bundled) |
| T-506 / T-507 | Home offers/banners, vehicle year/colour on Drive | Wait on BE-10 / BE-15 | No (hidden, not faked) |
| T-586 part 2 | Nearby vehicles while finding driver, assigned-marker crossfade | Design + QA pending | No |
| T-522, T-523 | Parcel follow-ups; Urdu phase 2 | Phase 1 shipped | No |
| T-412 | Driver camera follow | Polish | No |
| T-703, T-704, T-706 | Maestro E2E, CI, README | Engineering hygiene | No |
| BE-115 | Road distance for estimates | Needs Maps server key (B-15); straight line × 1.3 fallback works | No (fare accuracy; do soon after) |
| BE-10, BE-15, BE-17, BE-90, BE-59 | Banners 500, profile extras, referral/public URLs leftovers, admin ride edit, audit log for admin identity edits | Small backend follow-ups | No (BE-59 should land early) |

### 2c. Blocked

| ID | Why | Blocks? |
|---|---|---|
| BE-134 | Retention prune; waits on the legal retention figure | No for pilot (records kept, not lost); yes before the first deletion reaches its retention date |
| T-710 | Dev-only LogBox toast, not reproducible | No (Debug only) |

### 2d. Tracker hygiene (not release work)

These `todo`/`in-progress` rows look superseded and should be closed by the orchestrator after a check: T-303..T-310 (phase 3, notes say done 2026-10-10 / delivered later), T-407 (foreground only is shipped; security confirmed no background mode), T-208 and T-611 (UI-R7 done), T-511/T-619 (UI-R18), T-602/T-608/T-609 (UI-R2/R3/R5 done), T-604/T-605/T-614/T-615/T-616/T-618 (UI-R9/R11/R12/R13/R17/R16 done), T-702 (gate already 0/0/0), B-01/B-03/B-04/B-06 (superseded), B-07/B-08 (local accounts approved; B-08 decided 2026-10-08).

---

## 3. Known risks and accepted lows (SECURITY.md)

**Pre-release verdict:** the one code blocker (SEC-36) and SEC-37, SEC-38, SEC-39..44 are resolved (BE-139..142, T-711). No open high in code.

| Item | Severity | State |
|---|---|---|
| SEC-11 app deps (firebase JS SDK via `@react-native-firebase/app`, build tooling) | medium | Open, T-701; axios fixed |
| SEC-12 Firebase rules deny-all | — | Owner B-13 |
| SEC-14/15 backend repo: `raah_e_haq_admin.sql`, `composer.phar`, `reh`, `test_ride_api.php` (targets production) tracked | low | Open; don't deploy these files |
| SEC-16 admin `per_page` unbounded, banner URLs unvalidated | low | Open (admin only) |
| SEC-17 `http://` accepted in release env; iOS Release `NSAllowsLocalNetworking` | low | Open, T-705 |
| SEC-20 logger: no `Bearer` mask, no dob/gender/ip keys | low | Open, T-606 |
| SEC-22 SMS budget drain / existence oracle | low | **Accepted** |
| SEC-23 SIM-holder residual oracle | low | **Accepted** |
| Client GPS spoofing (arrival, no-show fees) | — | **Accepted by owner 2026-10-15**; fees off by default (`FARE_FEES_ENABLED=false`) |
| SEC-34 #2 retention prune | medium | Blocked, BE-134 (legal figure) |
| SEC-38 residuals: lock audit only at exact max; parallel enrolment confirms; lockout DoS needs the password | low | Accepted (no task); treat `admin_2fa_locked` as password compromised |
| Trust-on-first-use 2FA enrolment | low | Mitigated by enrolling every admin right after deploy |
| T-711 low: checkout host label on an unparseable later URL | low | Fixed in T-711 (navigation refused) |
| `reverb:start --debug` logs auth signatures | — | Never run `--debug` in production |

---

## 4. Owner checklist (in order)

### 4.1 Hosting and SSL (B-09, B-10)
- [ ] A VPS (nginx + PHP 8.3-FPM + MySQL + supervisor). Hostinger shared hosting cannot run Reverb or a queue worker: there keep `BROADCAST_CONNECTION=null` (the app polls).
- [ ] SSL: `sudo certbot --nginx -d raahehaq.com`; cron `0 12 * * * /usr/bin/certbot renew --quiet`.
- [ ] nginx vhost from DEPLOYMENT.md §3 (catch-all 444, path-only log for `/api/files/private/`).

### 4.2 Backend deploy (DEPLOYMENT.md)
Before: back up DB and files; close stale open rides on production (OWNER_NEEDS #12); run the migrations once on a **staging copy** of the production dump (B-17 wallet ledger, BE-91 goodwill retype).

```bash
cd /var/www/raah-e-haq-admin            # checkout of fix/production-hardening (or main)
composer install --optimize-autoloader --no-dev
npm install && npm run build
cp .env.production.example .env        # first install only
php artisan key:generate                # first install only; never change APP_KEY later (use APP_PREVIOUS_KEYS)
# fill .env (4.3), then:
php artisan migrate --force             # after the backup, at a quiet hour (see note)
php artisan db:seed --force             # reference data only in production
php artisan raahehaq:create-admin       # interactive SSH, first install
php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan optimize
```
- **BE-139 note:** migration `2026_10_21_100000_restrict_user_delete_on_rides_and_safety_incidents` rebuilds `rides` and `safety_incidents` on MySQL (table copy). Run it after the backup at a quiet hour.
- [ ] Scheduler cron (web user): `* * * * * cd /var/www/raah-e-haq-admin && php artisan schedule:run >> /dev/null 2>&1` (token prune, auto-accept, retention prunes, deletion processing, realtime failed-job prune).
- [ ] Supervisor `/etc/supervisor/conf.d/raahehaq.conf`: `raahehaq-reverb` (`php artisan reverb:start --host=127.0.0.1 --port=8080`, `minfds=10000`) and `raahehaq-queue` (`php artisan queue:work --queue=default,low --sleep=1 --tries=3 --max-time=3600`); then `sudo supervisorctl reread && sudo supervisorctl update`.
- [ ] After every deploy: `php artisan reverb:restart && php artisan queue:restart`.
- [ ] nginx `location /app/` proxy to `http://127.0.0.1:8080` (Upgrade headers, `proxy_read_timeout 120s`, `limit_conn ws_per_ip 20` with `limit_conn_zone` in `http {}`), `location /apps/ { return 404; }`; `sudo nginx -t && sudo systemctl reload nginx`. Port 8080 stays closed.
- [ ] Checks (one request each): `grep -E '^APP_(ENV|DEBUG)=' .env`; `curl -s -o /dev/null -w "%{http_code}\n" https://raahehaq.com/up` (200); `php artisan route:list --path=broadcasting`; `curl -s https://raahehaq.com/api/settings/public | grep -o '"realtime":{[^}]*}'` (enabled, `wss://raahehaq.com/app/<key>`); `sudo supervisorctl status`; the log greps in DEPLOYMENT.md §2.
- [ ] One-time data commands from DEPLOYMENT.md §2: `raahehaq:strip-notification-phones`, phone normalisation (BE-27), `raahehaq:privatize-documents`, referral review (BE-31), old seeded accounts (B-12: admin password, delete test users and fake data, purge `laravel.log`).

### 4.3 Production `.env`
| Key | Value |
|---|---|
| `APP_ENV` / `APP_DEBUG` | `production` / `false` |
| `APP_URL` | `https://raahehaq.com`, **same origin as the app's `API_URL`** (no `www.` mismatch, or top-up checkout fails closed) |
| `BROADCAST_CONNECTION`, `QUEUE_CONNECTION` | `reverb`, `database` |
| `REVERB_APP_ID` / `KEY` / `SECRET` | real random values, 16+ chars each, secret ≠ key (`php -r 'echo bin2hex(random_bytes(16)), PHP_EOL;'`) |
| `REVERB_PUBLIC_HOST/PORT/SCHEME`, `REVERB_ALLOWED_ORIGINS` | `raahehaq.com` / `443` / `https`, `https://raahehaq.com` |
| `ADMIN_2FA_REQUIRED`, `ADMIN_SESSION_IDLE_MINUTES` | `true`, `30` |
| `support_email` | admin panel app setting (not `.env`): the real support address |
| `REFERRAL_SHARE_URL` + reward amounts | add (not in the template); link shown only once set |
| `ACCOUNT_DELETION_RETENTION_YEARS` | the legal figure (placeholder 5; not in the template) |
| `SMS_DRIVER`, `TWILIO_*`, `SMS_DAILY_BUDGET` | `twilio` + credentials (B-11) |
| `SMS_UNVERIFIED_EXEMPT_BEFORE` | the deploy time; empty blocks existing unverified users from booking |
| `GOOGLE_MAPS_SERVER_KEY` | new restricted server key (B-15); empty = maps 503 |
| `FIREBASE_CREDENTIALS` | FCM service account (B-11) |
| `TRUSTED_PROXIES`, `AUTH_PENDING_LOGIN_TOKENS` | per B-16 |
| `JAZZCASH_ENABLED` / `EASYPAISA_ENABLED` | `false` until the go-live checklist passes |
| `TELEPHONY_DRIVER`, `AI_PROVIDER` | `none` (chat only), `local` until B-19 / B-22 |
| `LOG_LEVEL`, `SESSION_SECURE_COOKIE`, `SESSION_ENCRYPT` | `warning`, `true`, `true` |

After any change: `php artisan config:cache`.

### 4.4 Keys and accounts
- [ ] **Google Maps** (B-02): new Android + iOS SDK keys restricted to `com.raahehaq` (add Play app-signing SHA-1/256); separate server key (B-15) with quotas and a budget alert. The old key is in git history.
- [ ] **Firebase** (B-13, B-20): rotate, new `google-services.json` / `GoogleService-Info.plist`; Firestore + Storage rules deny-all; APNs key uploaded; decide on Analytics.
- [ ] **Store accounts and signing** (B-05, B-21): Apple Developer (App ID `com.raahehaq`, distribution cert, push capability); Google Play (upload keystore, Play App Signing). See [RELEASE_NOTES_OWNER.md](RELEASE_NOTES_OWNER.md).
- [ ] **Admin 2FA enrolment right after deploy:** every real admin signs in, enrols an authenticator, stores the 8 recovery codes offline. Check with the SQL in DEPLOYMENT.md "Admin two-factor sign-in". Reset: `php artisan raahehaq:admin-2fa-reset --email=...`.
- [ ] **Play Console "Data deletion" URL:** `https://raahehaq.com/account/delete` (once `APP_URL` is https).
- [ ] **JazzCash / Easypaisa merchants** (B-18): sandbox first, register IPN URLs, run the DEPLOYMENT.md "Go-live checklist" (paid/declined/abandoned, duplicate IPN, one real Rs 100 per provider), then enable.
- [ ] Later: telephony provider (B-19), Anthropic key + spend cap (B-22).

### 4.5 App `.env.production` (git-ignored)
| Key | Value |
|---|---|
| `API_URL` | `https://raahehaq.com/api` (already set) |
| `WS_URL` | **`wss://raahehaq.com`** (today it is `wss://raahehaq.com/ws`: wrong, the app adds `/app/<key>`) |
| `WS_APP_KEY` | = `REVERB_APP_KEY` (missing today; empty = polling only) |
| `MAPS_KEY` | the new restricted app key |
| `APP_BUILD` | build number |

---

## 5. Release build steps

Common: on a clean checkout, `yarn install` (runs `patch-package`: the react-native-maps patch from T-713 must apply), `yarn verify` must PASS, fill `.env.production` (4.5), put the rotated Firebase files in place. Values are baked in at build time: rebuild after any env change. Release builds read `.env.production` (iOS Podfile `ENVFILE`, Android `envConfigFiles`). A Release build talks to production: only the owner runs it there.

**iOS**
1. `cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 bundle exec pod install`
2. Set `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` (now 1.0 / 1) (T-705).
3. Open `ios/RaaHeHaq.xcworkspace`, scheme `RaaHeHaq`, Signing & Capabilities: Team `<APPLE_TEAM_ID>`, bundle id `com.raahehaq`, Push Notifications.
4. Product → Archive (Release), then Distribute → App Store Connect → TestFlight. CLI equivalent:
   `xcodebuild -workspace ios/RaaHeHaq.xcworkspace -scheme RaaHeHaq -configuration Release -archivePath build/RaaHeHaq.xcarchive archive`
   `xcodebuild -exportArchive -archivePath build/RaaHeHaq.xcarchive -exportOptionsPlist <ExportOptions.plist> -exportPath build/ipa`

**Android**
1. `~/.gradle/gradle.properties` (never in the repo): `RH_UPLOAD_STORE_FILE=<path to .jks>`, `RH_UPLOAD_STORE_PASSWORD=<…>`, `RH_UPLOAD_KEY_ALIAS=<…>`, `RH_UPLOAD_KEY_PASSWORD=<…>`. Without them a release build stops (never debug-signed).
2. Bump `versionCode` / `versionName` in `android/app/build.gradle` (now 1 / "1.0") (T-705).
3. `cd android && ./gradlew clean bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab` (R8 + shrink on, armeabi-v7a + arm64-v8a).
4. Device smoke: `./gradlew assembleRelease` and `adb install app/build/outputs/apk/release/app-release.apk`.
5. Upload to Play internal/closed testing; add the app-signing SHA-1/256 to the Maps key and Firebase.

**Release smoke (first time, both platforms):** launch, sign in by SMS, map tiles, a full ride with a test driver, push received, keychain session after restart, top-up WebView opens (sandbox), avatar/document upload (T-711), realtime connects (`meta.realtime` enabled).

---

## 6. Pilot-launch recommendation

**Go for a closed pilot, not a public launch.**

| | Recommendation |
|---|---|
| Scope | One city, ~20–50 vetted drivers, invited passengers; TestFlight + Play closed testing |
| Money | Cash rides; commission settled by bank reference (tested). Keep JazzCash/Easypaisa **off** until the merchant go-live checklist passes |
| Features | PIN, SOS, share trip, chat on; masked calls off (chat only); `FARE_FEES_ENABLED=false` at first (GPS spoofing accepted risk); AI local |
| Realtime | Turn Reverb on if the host is a VPS; otherwise polling (works, slower) |
| Before day 1 | §4.1–4.5 done; QA round for §2a (iOS + Android rebuild, smoke round 3); first Release-build smoke on both platforms (§5); T-606 crash reporting; T-205; admin 2FA enrolled |
| Watch | `laravel.log` critical alarms (SMS budget, maps budget, APP_URL), `admin_2fa_locked`, queue and Reverb `supervisorctl status`, Maps/SMS spend alerts |
| Exit to public launch | 2 weeks without a P1 crash or money mismatch; BE-115 road fares live; T-705, T-701, BE-59 done; legal retention figure set (BE-134); merchant top-up live; store listings and privacy policy approved |
