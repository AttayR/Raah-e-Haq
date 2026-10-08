# Task Tracker

**How to read this file:**
- **Status** lives in the summary table only. The task sections below hold scope and acceptance criteria.
- **Status values:** `todo` · `in-progress` · `blocked` · `verified-no-qa` · `done`
- **Owner:** `agent` (handled by `/fix-next`) or `owner` (the human; agents skip these).
- **QA:** `yes` means rh-qa must exercise it in the simulator. The scenario IDs refer to [QA_SCENARIOS.md](QA_SCENARIOS.md).
- **Updates:** `/fix-next` updates the summary table and adds the commit hash in Notes. New bugs found during work are appended as new rows (next free ID in that phase).

## Summary

| ID | Phase | Title | Depends | QA | Owner | Status | Notes |
|---|---|---|---|---|---|---|---|
| T-001 | 0 | Fix release-bundle blockers + add bundle check to gate | | yes | agent | done | logo rename + useErrorHandler import done early (iOS build fix commit); NotificationScreen + gate bundle check remain; 2026-10-08. Bundle check in gate (bundleOk); NotificationScreen imports fixed (delete denied by permissions, owner may delete; INF-34) |
| T-002 | 0 | Make Jest work (setup, native mocks, App smoke test) | | no | agent | done | 2026-10-07 (904b918). Also fixed no-undef in scripts/api-health.js (added after baseline). Follow-up: stub WebSocket in jest.setup (do in T-005) |
| T-003 | 0 | Babel: worklets plugin + strip console in release | T-002 | yes | agent | done | 2026-10-08. worklets plugin last; remove-console in production keeps error; logger.error calls console.error statically; App.test cold-cache timeout 30s |
| T-004 | 0 | Repo hygiene: stale bundle, lockfile, Podfile node path | | yes | agent | verified-no-qa | Podfile NODE_BINARY removed early (iOS build fix commit); 2026-10-08. Android runtime QA blocked by emulator instability (API 37, host load); APK verified clean; iOS smoke PASS. Re-run Android smoke later |
| T-005 | 0 | Env config: single source for API/WS URLs and keys | T-002 | yes | agent | done | 2026-10-08 (6963f4b). QA on local backend (prod down). Debug→.env.development, Release→.env.production |
| T-006 | 0 | Redacting logger; remove credential/PII logs | T-002 | no | agent | done | 2026-10-08. src/core/logging/logger.ts (strict set on error path); 790 console calls migrated; ESLint no-console in src/ |
| T-007 | 0 | Typed API layer: ApiResponse/ApiError, fix double unwrap, route all calls through axios | T-005 | no | agent | done | 2026-10-08. src/core/api (ApiResponse, ApiError kinds, unwrap); token only to API origin; 5xx text never shown; docs/api/CONTRACT_NOTES.md from real routes |
| T-008 | 0 | One working toast system | T-002 | yes | agent | done | 2026-10-08. src/core/toast (queue, fromError), ModernToast spec 5.16 a11y, SafeAreaProvider at root; 3 dead toast systems removed |
| T-101 | 1 | Stop displaying/persisting OTP | T-007 | yes | agent | todo | Backend part = BE-16 (was B-01); BE-16 contract: send-otp/verify-otp may return 429 with retry_after; show message, resend countdown from retry_after (60 s after each send); otp_code optional/null; use server expires_in (60 s) not hardcoded 300; Phase 0 regression: OTP box + "Use This OTP" + hardcoded "Test Code" still shown (PhoneAuthScreen 266-284); add expiry countdown/expired hint (TTL 60 s); 6-digit pasted code fails 4-6 digit check |
| T-102 | 1 | Single logout thunk used everywhere | T-007 | yes | agent | todo | QA 2026-10-08: add a confirmation dialog before logout |
| T-103 | 1 | Auth bootstrap: splash, offline-tolerant init | T-102 | yes | agent | todo | |
| T-104 | 1 | Token in Keychain + single-flight 401 handling | T-103 | yes | agent | todo |; 401 from verify-otp/login must not trigger the refresh-token branch (api.ts:79-101); BE-25 contract: on 401 clear session and go to login (never refresh after 401); store data.expires_at; optional POST /auth/refresh with Bearer before expiry; remove dead refresh_token logic; SEC-21: isApiUrl should check apiClient.getUri(config) so a per-request baseURL override never gets the token |
| T-105 | 1 | normalizeUser + role/status routing | T-103 | yes | agent | todo | Confirm with B-03 |
| T-106 | 1 | Account-status screen (pending/suspended) rebuilt | T-105 | yes | agent | todo |; BE-25 contract: 403 {code: ACCOUNT_PENDING|ACCOUNT_INACTIVE|ACCOUNT_SUSPENDED|ACCOUNT_REJECTED, data.status}; pending login now returns 200 + token limited to allowlist; Check Status → GET /auth/profile; sign-out → POST /auth/logout; User.status type add inactive; when T-106 ships (pending screen with real Check Status + logoutUser), set AUTH_PENDING_LOGIN_TOKENS=true on the backend; handle 403 ACCOUNT_INACTIVE/SUSPENDED on any route (not just login): log out and show account-status screen |
| T-107 | 1 | Remove Firebase auth path; fix slices & persist config | T-106 | yes | agent | todo | QA T-008: shared auth error not cleared when leaving PhoneAuth / switching login method (banner carries over) |
| T-108 | 1 | Android release hardening in code (signing from env, no cleartext) + iOS plist cleanup | T-004 | no | agent | todo | Keystore = B-05; README: Android emulator dev host defaults to 10.0.2.2:8081 (set bundle location when Metro is on another port); run `./gradlew clean` and `installDebug` as separate commands (reanimated prefab) |
| T-109 | 1 | Maps keys from build config; never logged | T-005 | yes | agent | todo | Rotation = B-02 |
| T-110 | 1 | Nearby drivers via /rides/nearby-drivers (BE-20 contract): opaque string ids, no name/phone, radius <= 10; driver latest location only during active ride (403 = not available); driverPhone from ride.driver.phone while active | T-007 | yes | agent | todo | BE-20 app follow-up; passengers get 403 on /tracking/drivers-in-radius once BE-20 is deployed; nearby id differs per viewer, rating 0.5 steps, positions refresh every 2 min, 429 with retry_after (poll ≥10 s); latest returns 6 fields only |
| T-201 | 2 | Registration: per-step schema validation | T-107 | yes | agent | todo | |
| T-202 | 2 | Registration: server field errors on every input | T-201 | yes | agent | todo | |
| T-203 | 2 | Driver documents + license number actually uploaded | T-202 | yes | agent | todo | Needs B-03 |
| T-204 | 2 | Auth screens: keyboard, safe area, remove dead Google button | T-201 | yes | agent | todo | |
| T-301 | 3 | Active ride in Redux; single booking route; restore on launch | T-107 | yes | agent | todo | |
| T-302 | 3 | Correct ride payload builder (real user, addresses, vehicle, stops) | T-301, BE-01 | yes | agent | todo | Server takes passenger from token (BE-01); drop `passenger_id` from payload |
| T-303 | 3 | Location search: debounce, session token, PK bias, keep address | T-109 | yes | agent | todo | |
| T-304 | 3 | Ride status state machine; polling lifecycle; map-tap mode | T-302 | yes | agent | todo | |
| T-305 | 3 | Request safety: double-tap guard, cancel during create, per-request abort | T-304 | yes | agent | todo | |
| T-306 | 3 | Fare from server | T-302, BE-05 | yes | agent | todo | Uses `POST /rides/estimate` (BE-05, was B-04) |
| T-307 | 3 | Driver-assigned card + passenger tracking screen | T-304 | yes | agent | todo | |
| T-308 | 3 | Location permission UX + shared location watcher | T-301 | yes | agent | todo | |
| T-309 | 3 | Remove crashing Advanced panel + passenger dead duplicates | T-302 | yes | agent | todo | |
| T-310 | 3 | Vehicle options + ETAs from server catalogue | T-306, BE-05, BE-02 | yes | agent | todo | FEAT-05 |
| T-401 | 4 | Driver online/offline in Redux backed by API | T-107, BE-06 | yes | agent | todo | `POST/GET /driver/status` (BE-06, was B-04); BE-30: accept via POST /rides/{id}/assign-driver with no body (token driver); fix DriverMapScreen updateDriverLocation(uid, loc) signature mismatch (posts a string); show 403/409/400 message |
| T-402 | 4 | Driver location tracker rewrite | T-308, T-401 | yes | agent | todo |; Phase 0 regression: driver map opens on Karachi instead of device location |
| T-403 | 4 | Incoming ride requests (poll /rides/pending) | T-402, BE-02 | yes | agent | todo | `/rides/pending` is unreachable until BE-02 (FEAT-01) |
| T-404 | 4 | Accept via assign-driver (409) + reject | T-403, BE-03 | yes | agent | todo | Atomic accept = BE-03 (was B-06) |
| T-405 | 4 | Driver ride screen routed: pickup → start → stops → complete | T-404, BE-04 | yes | agent | todo | Use BE-04 `arrived/start/complete` endpoints, not generic PUT |
| T-406 | 4 | WebSocket manager rewrite | T-007, BE-12 | no | agent | todo | Retarget to Laravel Reverb (Pusher protocol: `laravel-echo` + `pusher-js`, Sanctum `/broadcasting/auth`), BE-12 (was B-06) |
| T-407 | 4 | Background driver location | T-402 | yes | agent | todo | B-08 decided 2026-10-08: foreground only. Scope shrinks to: no background mode/permission shipped (with T-108) |
| T-501 | 5 | Ride history (passenger + driver) from API | T-305, T-405, BE-01 | yes | agent | todo | Includes new driver history screen + ride details/receipt screen (FEATURES.md) |
| T-502 | 5 | Notifications from API + FCM token registration | T-107, BE-11 | yes | agent | todo | Both roles (driver tab is a placeholder); device token via `POST /devices` (BE-11) |
| T-503 | 5 | Remove fake data; hide unbuilt features | T-501 | yes | agent | todo | Final sweep after T-506..T-511 wire real data (owner: real data, not hiding) |
| T-504 | 5 | Profile: real fields + photo upload | T-503, BE-15 | yes | agent | todo | App calls missing `PUT /auth/profile`; switch to `PUT /profile` + `POST /profile/avatar` |
| T-505 | 5 | Rating after ride | T-307, BE-07 | yes | agent | todo | `POST /rides/{id}/rate` (BE-07, was B-04) |
| T-506 | 5 | Passenger Home on real data (stats, offers, recent rides, badge) | BE-08, BE-10, BE-01, T-501, T-502 | yes | agent | todo | FEAT-08/10/18; Phase 0 regression: pull-to-refresh fails silently when backend down (needs error state) |
| T-507 | 5 | Driver Home, Profile and Earnings screen on real data | BE-08, BE-15, BE-01, T-401, T-501 | yes | agent | todo | FEAT-08/15 |
| T-508 | 5 | Wallet: cash-only balance + history from API | BE-09 | yes | agent | todo | FEAT-09 |
| T-509 | 5 | Favourite (saved) places from API | BE-14, T-303 | yes | agent | todo | FEAT-14 |
| T-510 | 5 | In-ride chat passenger ↔ driver (replace demo chats) | BE-13, BE-12, T-406, T-307, T-405 | yes | agent | todo | FEAT-13 |
| T-511 | 5 | Settings, support, invite, account deletion (both roles) | BE-11, BE-15, BE-17, T-102 | yes | agent | todo | FEAT-11/15/17 |
| T-601 | 6 | Theme tokens + ThemeProvider per DESIGN_SYSTEM (palette, light/dark semantic tokens, type scale, spacing, radii, elevation, motion; live appearance; persisted override) | T-008 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-602 | 6 | UI kit core: Text, Icon (one family), Screen, Header, Button, IconButton, TextField, Card, ListItem, Switch, SegmentedControl, Chip, Badge, Avatar | T-601 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-608 | 6 | UI kit feedback + overlays: BottomSheet, Dialog, Toast, Banner/offline, Skeleton, EmptyState, ErrorState | T-602, T-008 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-609 | 6 | UI kit ride components: map style, pins, route line, address pair, vehicle card, fare breakdown, driver/passenger card, status timeline, rating, stat tile, promo card, slide-to-confirm | T-602, T-608 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-610 | 6 | Navigation shell: 4-tab IA per role, headers, tab bar, remove duplicate mounts | T-602, T-309 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director. IA change in DESIGN_SYSTEM §8 |
| T-603 | 6 | Auth screens: login, phone code, forgot-password sheet | T-602, T-608, T-204, T-101 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director; QA 2026-10-08: Login bottom navy band clips "Create New Account" on first view; QA T-003: keyboard covers Login email/password (no keyboard avoidance) — medium; QA T-008: double feedback inline+toast on auth errors (pick one, PAX-16); first tap with keyboard up only dismisses keyboard (keyboardShouldPersistTaps); PhoneAuth number field rewrite scrambles fast typing; Login/PhoneAuth ignore dark mode with mixed input; Phase 0 regression: Verify screen keyboard covers field/button; no back button on PhoneAuth/Verify |
| T-611 | 6 | Auth: registration wizard (role choice, steps, review) | T-602, T-608, T-202, T-203 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-612 | 6 | Splash, account status (pending/rejected/suspended), permission prompts | T-602, T-608, T-103, T-106, T-308 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-604 | 6 | Passenger home + destination search | T-609, T-610, T-506, T-303 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director; QA 2026-10-08: Settings status bar low contrast; Home address overflows without ellipsis; QA T-003: keyboard covers Map destination search; map buttons under status bar/Dynamic Island |
| T-613 | 6 | Passenger choose ride (vehicle + fare) + finding driver | T-604, T-306, T-310, T-305 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-614 | 6 | Passenger driver assigned/arrived, on trip, trip complete + rating | T-613, T-307, T-505 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-605 | 6 | Driver Drive home (offline/online) + incoming request | T-609, T-610, T-401, T-403, T-404, T-507 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-615 | 6 | Driver to pickup/arrived, on trip, trip complete | T-605, T-405 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-616 | 6 | Driver earnings + vehicle & documents | T-609, T-610, T-507, T-501 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-607 | 6 | Inbox: notifications, messages list, chat thread (both roles) | T-608, T-610, T-502, T-510 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-617 | 6 | Activity: ride history, ride details/receipt, wallet | T-608, T-609, T-610, T-501, T-508 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-618 | 6 | Account: settings, profile view/edit, saved places (both roles) | T-608, T-610, T-504, T-509, T-511 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-619 | 6 | Help & support, invite friends, delete account | T-618, T-511 | yes | agent | todo | Builder: rh-designer; Design review: rh-design-director |
| T-606 | 6 | Root ErrorBoundary + crash reporting | T-006 | no | agent | todo | Fallback UI follows ErrorState (DESIGN_SYSTEM §5.20) once T-608 lands; T-003 security: gate should assert release bundle has no console.log; strict mode could mask phone/email/CNIC-shaped substrings in strings and drop stack in release; SEC-20: logger masks "Bearer <token>" in strings, adds dob/gender/ip keys; convert positional PII debug calls (PassengerHomeScreen:97,100, BasicInfoScreen:189, placesService) to keyed objects |
| T-701 | 7 | Delete dead code + unused dependencies | T-605, T-615, T-616 | yes | agent | todo |; SEC-11: remove firebase JS SDK (protobufjs/grpc criticals) and upgrade axios (13 high advisories) as part of dependency cleanup; re-run yarn audit |
| T-702 | 7 | TypeScript + ESLint to zero; gate requires zero | T-701 | no | agent | todo | |
| T-703 | 7 | Maestro E2E flows for QA scenarios | T-405 | no | agent | todo | |
| T-704 | 7 | CI (GitHub Actions) | T-702 | no | agent | todo | |
| T-705 | 7 | Android R8 + versioning; final iOS config | T-108 | yes | agent | todo | Needs B-05 |
| T-706 | 7 | README + docs rewrite | T-704 | no | agent | todo | |
| B-01 | – | Backend: stop returning otp_code; real SMS | | | owner | todo | Superseded by BE-16 (code part, agent). SMS gateway account + credentials stay with owner (B-11) |
| B-02 | – | Rotate + restrict Google Maps keys | | | owner | todo | |
| B-03 | – | Confirm auth `role` field + registration/document contract | | | owner | todo | |
| B-04 | – | Endpoints: fare estimate, driver status, pending rides, rating, history, earnings | | | owner | todo | Superseded by BE-02, BE-05, BE-06, BE-07, BE-08 (+ BE-01 for history); we own the backend |
| B-05 | – | Signing: Android upload keystore, Apple certs | | | owner | todo | |
| B-06 | – | Backend: passenger from token, atomic assign-driver, WS auth | | | owner | todo | Superseded by BE-01, BE-03, BE-12 |
| B-07 | – | Test accounts + safe test location in QA_SCENARIOS.md | | | owner | todo | **Needed before any QA** |
| B-08 | – | Product decisions: background location, chat, wallet | | | owner | todo | |
| B-09 | – | **Production backend down: SSL missing for raahehaq.com + /api not served** (see docs/api/HEALTH_2026-10-03.md) | | | owner | todo | **Blocks all QA and real use** |
| B-10 | – | Production hosting for Laravel Reverb + queue worker (process manager, TLS/wss proxy) | BE-12 | | owner | todo | Server/hPanel work; agents only prepare code + docs |
| B-11 | – | Credentials: Firebase service-account JSON for FCM (BE-11), SMS gateway account (BE-16) | | | owner | todo | Never commit; set in production `.env`; enable Twilio Geo Permissions for Pakistan only; set an SMS spend alert |
| BE-00 | 0 | Backend test harness: SQLite-safe migrations, factories, helpers | | no | agent | done | 2026-10-08 (backend 363d127). tests 2/35 → 39 pass, 3 incomplete (BE-02/18/20/21). FEAT-19: `php artisan test` 33/35 failing today. Prerequisite for every BE task |
| BE-01 | 3 | Rides scoped to caller; passenger from token; ownership checks | BE-00 | yes | agent | todo | FEAT-02 (supersedes B-06 part); also: RideResource.passenger minimal card (first name, photo, rating; phone only to assigned driver while active), full UserResource admin-only (BE-20 security finding 4) |
| BE-02 | 4 | Fix route shadowing of /rides/pending + nearby-drivers; driver from token | BE-00 | yes | agent | todo | FEAT-01 (supersedes B-04 part); Driver privacy (no phone/name, coarse position, radius cap) is owned by BE-20 |
| BE-03 | 4 | Atomic assign-driver with 409; driver from token | BE-01 | yes | agent | todo | FEAT-03 (supersedes B-06 part); driver with an active ride cannot accept another; mark driver busy atomically; admin assigning driver_id must target an active driver who is not the passenger (BE-30 security findings 3, 6) |
| BE-04 | 4 | Ride lifecycle endpoints (arrived/start/complete/driver cancel); server fare + earnings | BE-03, BE-05 | yes | agent | todo | FEAT-04 |
| BE-05 | 3 | Vehicle catalogue + fare estimate endpoint | BE-00 | yes | agent | todo | FEAT-05 (supersedes B-04 part) |
| BE-06 | 4 | Driver status endpoint + location endpoints fixed | BE-00 | yes | agent | todo | FEAT-06 (supersedes B-04 part); normalise driver status: app sends `online`, accept requires `available` (BE-30 review) — treat online as available or migrate the app; until then driver accept returns 400 DRIVER_NOT_AVAILABLE; seeded driver users.is_available=1 while app shows Offline — single source of truth for driver availability |
| BE-07 | 5 | Ride rating endpoint + user rating recompute | BE-04 | yes | agent | todo | FEAT-07 (supersedes B-04 part) |
| BE-08 | 5 | Personal stats (`/me/stats`) + driver earnings | BE-04 | yes | agent | todo | FEAT-08 (supersedes B-04 part) |
| BE-09 | 5 | My wallet (cash only): balance + transactions; lock admin payment routes | BE-04 | yes | agent | todo | FEAT-09; Admin-only locking of payments/* is owned by BE-18; BE-09 does only the user wallet endpoints |
| BE-10 | 5 | Fix banners 500 + filter by date/audience/position | BE-00 | yes | agent | todo | FEAT-10 |
| BE-11 | 5 | Push: device tokens, FCM send, preferences, broadcasts in list | BE-00, BE-18 | yes | agent | todo | FEAT-11; prod creds = B-11; must land after BE-18 (BE-00 security review: admin broadcast path works now) |
| BE-12 | 4 | Realtime with Laravel Reverb (channels, Sanctum broadcast auth, events) | BE-03 | yes | agent | todo | FEAT-12 (supersedes B-06 part); prod hosting = B-10; SEC-19: websocket_url from config/env, not hardcoded wss://raahehaq.com; app builds socket URLs from env.WS_URL (T-308) |
| BE-13 | 5 | In-ride chat API (messages, chats list, broadcast) | BE-12 | yes | agent | todo | FEAT-13 |
| BE-14 | 5 | Saved places CRUD | BE-00 | yes | agent | todo | FEAT-14 |
| BE-15 | 5 | Profile completeness (driver vehicle/licence, stats) + account deletion | BE-00 | yes | agent | todo | FEAT-15 |
| BE-16 | 1 | OTP hardening: never return/log code outside local; SMS driver interface | BE-00 | yes | agent | done | 2026-10-08 (backend 6c89b36). Echo only local+debug; SMS_DRIVER=log outside local → send-otp 500 + critical log (not 503). FEAT-16 (supersedes B-01 code part) |
| BE-17 | 5 | Referral code column fix; support scoping tests; public settings URLs | BE-00 | yes | agent | todo | FEAT-17; createReferral must not accept free-form referred_id (only via referral code at registration) — user enumeration (BE-24 security finding 6) |
| BE-18 | 1 | Role authorization: `role:admin` on admin API routes and the admin panel; close panel access via public web registration | BE-00 | no | agent | done | 2026-10-08 (backend 1093b35). SEC-01 (critical) |
| BE-19 | 1 | Production-safe seeders + prompted admin-create command; fix DEPLOYMENT.md seeding step | BE-00 | no | agent | done | 2026-10-08 (backend 2348cfc). SEC-02 (critical); live part = B-12 |
| BE-20 | 1 | Driver privacy: nearby-drivers without name/phone, coarse position, capped radius; drivers-in-radius admin-only | BE-18 | no | agent | done | 2026-10-08 (backend 4eceaaf). nearby-drivers route unshadowed; viewer-bound ids; 2-min position buckets; 12/min/user limiter. SEC-03 (high); complements BE-06 |
| BE-21 | 1 | Remove registration request logging (API + web) | BE-00 | no | agent | done | 2026-10-08 (backend b0be953); dontFlash now excludes CNIC/phone/bank/emergency fields (forms must be retyped after a validation error — owner to confirm). SEC-04 (high) |
| BE-22 | 1 | CNIC/licence/vehicle documents on private disk + authorized temporary URLs; migrate existing files | BE-18 | no | agent | done | 2026-10-08 (backend c27989c). SEC-05 (high) |
| BE-23 | 1 | Production config guard (refuse debug in production) + production env values in DEPLOYMENT.md | BE-00 | no | agent | done | 2026-10-08 (backend 79bce43). SEC-06 (high); live check = B-12 |
| BE-24 | 1 | Ownership checks: ride GPS path, ride stops, referral show; remove admin debug route; fix referrals route shadowing | BE-18 | no | agent | done | 2026-10-08 (backend 311198f). Also scoped show/cancel/destroy/index (BE-01 part), stops fare recompute, path window, reward claim atomic. BE-18 security review findings 1,2,3,9,10; also cancel()/destroy()/show() ownership if BE-01 has not landed (BE-30 review); stops: 409 if stop already cancelled/completed, recompute fare server-side from active stops (no repeated -25 / no negative fare), passenger-or-admin only (BE-30 security finding 2, high) |
| BE-25 | 1 | Active-user enforcement (suspended/inactive blocked on login and every request) + Sanctum token expiry and revoke on password change | BE-18 | no | agent | done | 2026-10-08 (backend 917c4a4). AUTH_PENDING_LOGIN_TOKENS=false until T-106; admin web password reset fixed. SEC-07 |
| BE-26 | 1 | No exception details in API/admin responses; no withInput() of sensitive fields | BE-21 | no | agent | done | 2026-10-08 (backend 26315da). BE-21 security re-check findings 1-2 (RidesController:162 details, Admin Ride/Payment/Referral, Api PaymentsController:58); also: phpunit.xml LOG_CHANNEL=null (tests write to real laravel.log), guard throttle file fallback when cache store down, SESSION_ENCRYPT default true; DEPLOYMENT.md: check old seeded accounts for use before deleting (+ delete their tokens), "never pass --env on a server"; CreateAdminCommand secret(..., false); ProductionConfigGuard: critical warning when APP_URL is not https or is localhost in production; one-off command to remove data.driver_phone from existing notifications |
| BE-27 | 1 | Normalize users.phone to E.164 + unique index (dedupe plan); OTP lookups and limits by normalized phone; send-otp/forgot-password no account enumeration | BE-16 | no | agent | todo | SEC-08 part 3, SEC-13 |
| BE-28 | 1 | OTP abuse hardening: Pakistan-only SMS, per-IP and global daily caps, counter clamp, admin limit reset, retry_after on every 429 | BE-16, BE-27 | no | agent | todo | BE-16 security re-check findings 1-4 |
| BE-29 | 1 | Validation/contract fixes: vehicle_year max dynamic (now+1, 2026 drivers rejected today); profile endpoints return a resource not the raw user model; admin user store/update use validated(); remove dead legacy vehicle-image view block | BE-22 | no | agent | in-progress | BE-22 out-of-scope findings |
| BE-30 | 1 | Ride write lockdown (phase-1 stopgap for SEC-03): PUT /rides/{id} cannot set driver_id/status/fare except admin; assign-driver uses the token user and requires driver role; stop persisting driver_phone in notification data | BE-18 | no | agent | done | 2026-10-08 (backend bd76db1). Assigned driver may move status forward via PUT until BE-04. BE-20 security finding 1 (high): passenger can self-assign any driver and unlock phone/exact location; full fix in BE-03/BE-04 |
| BE-31 | 1 | Referral/reward money integrity: cancel voids pending rewards; conditional complete (no duplicate rewards); referrals only via signup code, server-set level, one per referred user; credit refuses non-active wallets and amount<=0; collision-free transaction ids; admin credit action checks result | BE-24 | no | agent | todo | BE-24 security re-check findings 1-5 (claim path now works, so these are monetary); Wallet addMoney/deductMoney transaction + row lock; admin adjust amount must be > 0 (BE-26 findings); contact form metadata stored raw in AnalyticsEvent (privacy) |
| BE-32 | 1 | users.status enum: add suspended, rejected (+ rejection_reason); driver rejection sets rejected; send-otp sends no SMS for blocked accounts; pending driver document re-upload route | BE-25 | no | agent | todo | BE-25 out-of-scope findings; also: password change/reset logs out other web sessions (AuthenticateSession or logoutOtherDevices); revoke tokens when status leaves active; phone change requires re-verification (BE-25 security findings 3,5,6) |
| B-12 | – | Production: change admin password, delete seeded test users/fake data, confirm APP_ENV=production + APP_DEBUG=false, purge laravel.log | | | owner | todo | SEC-02, SEC-04, SEC-06 (see docs/audit/SECURITY.md); before deleting old seeded accounts (admin@test.com, *@raah-e-haq.com) check login_attempts/audit_logs/personal_access_tokens for outside use; create real admin with `php artisan raahehaq:create-admin`; after deploying BE-22 run `php artisan raahehaq:privatize-documents` (dry-run first, backup first) and review web access logs for past /storage/uploads/ requests (CNIC images were public; decide on breach notification) |
| B-13 | – | Firebase console: Firestore + Storage rules to deny-all | | | owner | todo | SEC-12 |

---

## Phase 0: Foundation

### T-001 · Fix release-bundle blockers + add bundle check to gate
- **Findings:** INF-01, INF-02, INF-29 (NotificationScreen import paths)
- **Files:** the 7 `require('../../assets/images/logo.png')` sites, `src/assets/images/Logo.png`, `src/hooks/useErrorHandler.ts`, `src/screens/NotificationScreen.tsx`, `scripts/quality-gate.js`
- **Acceptance:**
  - [ ] `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/rh.android.js` succeeds; the same for `--platform ios`.
  - [ ] The image is renamed with `git mv` (case-only rename done in two steps on macOS) so that git tracks `logo.png`.
  - [ ] `useErrorHandler` imports an existing module.
  - [ ] `NotificationScreen.tsx` imports resolve (or the file is deleted if grep proves it unused; INF-34 says it is unused).
  - [ ] `scripts/quality-gate.js` gains a `bundle` check (both platforms; output to a temp dir) recorded in the baseline as `bundleOk`; once true it must stay true.
- **QA:** SMOKE-01

### T-002 · Make Jest work
- **Findings:** INF-28
- **Files:** `jest.config.js`, new `jest.setup.js`, `__tests__/App.test.tsx`, `package.json` (devDeps: `@testing-library/react-native`)
- **Acceptance:**
  - [ ] `transformIgnorePatterns` covers `react-native|@react-native|@react-navigation|@react-native-firebase|react-native-.*`.
  - [ ] Mocks exist for: reanimated/worklets, AsyncStorage (official mock), RNFirebase (app, auth, firestore, messaging, storage), react-native-maps, geolocation, google-signin, vector-icons, image-picker, linear-gradient, gesture-handler, safe-area-context, toast-message.
  - [ ] The App smoke test renders without throwing.
  - [ ] One real unit test on a reducer (e.g. `apiAuthSlice`) proves the infra works for logic tests.
  - [ ] `yarn test` passes; the baseline `jestPassing` becomes true.

### T-003 · Babel: worklets plugin + strip console in release
- **Findings:** INF-30, INF-33 (release part), AUTH-03 (release part)
- **Acceptance:**
  - [ ] `react-native-worklets/plugin` is last in plugins; no Reanimated deprecation warning on bundle.
  - [ ] `babel-plugin-transform-remove-console` is enabled only for production builds (keep `console.error`).
  - [ ] The app still launches in debug (QA SMOKE-01) and animations work.

### T-004 · Repo hygiene
- **Findings:** INF-27, INF-31 (lockfile), INF-32
- **Acceptance:**
  - [ ] `android/app/src/main/assets/index.android.bundle` is removed from git and ignored.
  - [ ] `package-lock.json` is removed; the README/CLAUDE says yarn only.
  - [ ] Podfile no longer hardcodes `NODE_BINARY`; `ios/.xcode.env` handles it; `pod install` still works.
  - [ ] An Android debug build still runs with Metro (QA, if an Android emulator is available; otherwise note it).

### T-005 · Env config
- **Findings:** INF-16
- **Acceptance:**
  - [ ] Add `react-native-config`; `.env.example` is committed; `.env*` are git-ignored except the example; `.env.production` holds today's production URLs (the owner's choice: QA runs on production).
  - [ ] `src/config/env.ts` exports a typed `env` (API_URL, WS_URL, MAPS_KEY) and throws a clear error if a value is missing.
  - [ ] `grep -rn "raahehaq.com" src` returns only `src/config`.
  - [ ] The app launches and hits the same backend as before (QA SMOKE-01/02).

### T-006 · Redacting logger
- **Findings:** AUTH-03, INF-04, INF-33, PAX-18 (logs), DRV-22
- **Acceptance:**
  - [ ] `src/core/logging/logger.ts` provides `debug/info/warn/error` and redacts keys matching password, token, otp, otp_code, cnic, phone, account, authorization, fcm. It logs only in `__DEV__`, except `error`.
  - [ ] Unit tests prove the redaction (nested objects, arrays).
  - [ ] Every log that prints credentials, tokens, OTP, CNIC, bank data, FCM tokens or whole user objects is removed or converted (grep evidence in the report).
  - [ ] No new `console.log` is introduced.

### T-007 · Typed API layer
- **Findings:** DRV-02, DRV-06, INF-11, INF-18, PAX-19, DRV-24 (record only)
- **Acceptance:**
  - [ ] `ApiResponse<T>` and `ApiError` types exist, plus one `unwrap()` helper. `rideService` methods return the ride object, not `undefined` (unit test with axios-mock-adapter using the documented envelope).
  - [ ] Duplicate `updateDriverLocation` and `DriverLocation` are removed; one correct version remains.
  - [ ] `webSocketService`, `locationTrackingService` and `notificationService` use the axios client; there are no raw `fetch` calls to the backend and no placeholder tokens.
  - [ ] Errors are normalised to `ApiError` in one interceptor; thunks reject with a string message plus `fieldErrors`.
  - [ ] `docs/api/CONTRACT_NOTES.md` is created, listing every endpoint the app calls, whether it is documented, and open questions (DRV-24).

### T-008 · One working toast system
- **Findings:** INF-15, INF-22, PAX-16 (foundation)
- **Acceptance:**
  - [ ] One toast API (`useToast()` and a non-hook `toast.show()`) backed by the mounted NotificationManager/ModernToast.
  - [ ] Every `showToast` caller (13 files) uses it; `ToastProvider.tsx`, `Toast.tsx` and the local PhoneAuth toast are removed.
  - [ ] QA: submitting the empty Login form shows visible feedback (SMOKE-04).

## Phase 1: Security & single auth

### T-101 · Stop displaying/persisting OTP
- **Findings:** AUTH-02 (app part), INF-05 (app part)
- **Acceptance:**
  - [ ] There is no OTP value, "Use This OTP" button or "Test Code" text anywhere in the UI.
  - [ ] `otpData` (or the code inside it) is not persisted and not logged.
  - [ ] The OTP flow still works when the user types the SMS code.
  - [ ] The report reminds the owner about B-01.

### T-102 · Single logout
- **Findings:** AUTH-09, DRV-13 (sign-out part), INF-10 (logout part)
- **Acceptance:**
  - [ ] There is one `logout` thunk: API logout (best effort), clear the token and user storage, Firebase signOut if still present, dispatch the root `RESET` (every slice back to initial), and `persistor.purge()`.
  - [ ] Every Sign Out / Logout button in the app (grep) uses it.
  - [ ] Unit test: after logout every slice equals its initial state.
  - [ ] QA AUTH-E2E-02: logging out from passenger and driver settings lands on Login, and reopening the app stays logged out.

### T-103 · Auth bootstrap
- **Findings:** AUTH-04, INF-08, INF-23 (isInitialized), AUTH-14 (splash)
- **Acceptance:**
  - [ ] A splash shows until rehydration and `initializeAuth` finish; there is no Login flash.
  - [ ] A network error or timeout keeps the session (no token wipe); only a 401 clears it.
  - [ ] A null result resets to the initial state with `isInitialized: true`.
  - [ ] Unit tests cover offline, 401 and success.

### T-104 · Token in Keychain + 401 handling
- **Findings:** AUTH-05, INF-07, INF-20
- **Acceptance:**
  - [ ] The token is stored with `react-native-keychain`; it is gone from redux-persist and the AsyncStorage `auth_token` (with a one-time migration from the old key).
  - [ ] There is one in-memory token cache for the interceptor.
  - [ ] On 401: single-flight `/auth/refresh` (Bearer, per the docs); queued requests replay; if that fails, `logout()`.
  - [ ] Unit tests: 3 parallel 401s cause exactly one refresh call; a failed refresh dispatches logout.

### T-105 · normalizeUser + routing
- **Findings:** AUTH-08
- **Acceptance:**
  - [ ] `normalizeUser()` derives `role` (`role ?? user_type ?? roles[0]`) and `status`; it is used by every thunk that stores a user.
  - [ ] Routing reads only the normalised fields.
  - [ ] Unit tests cover each response shape.

### T-106 · Account-status screen
- **Findings:** AUTH-01, DRV-12
- **Acceptance:**
  - [ ] It reads `apiAuth.user` (not Firebase) and shows role-specific text for pending, suspended and rejected.
  - [ ] "Check status" calls the profile endpoint and routes in when the user becomes active.
  - [ ] Logout uses T-102.
  - [ ] QA: if the owner has a pending test account, exercise it; otherwise mark the QA step N/A with the reason.

### T-107 · Remove Firebase auth; fix slices
- **Findings:** AUTH-15, AUTH-16, INF-09, INF-10, INF-19
- **Acceptance:**
  - [ ] The Firebase auth screens, thunks, slices and services are deleted only after grep proves they are unused (keep RNFirebase app and messaging for FCM).
  - [ ] No action-type collisions; the slice name matches its key.
  - [ ] The persist config whitelists only what should persist; transient status and error are not persisted.
  - [ ] DriverMap and DriverHome no longer read `state.auth`.
  - [ ] QA: SMOKE-01..03 still pass.

### T-108 · Release hardening (code part)
- **Findings:** INF-03 (code), INF-21, INF-26
- **Acceptance:**
  - [ ] The release signingConfig reads from `gradle.properties`/env (`RH_UPLOAD_STORE_FILE`, …) and falls back to failing with a clear message, never to the debug key.
  - [ ] Cleartext is disabled in the release network config; debug allows localhost only.
  - [ ] iOS `UIBackgroundModes` and usage strings are trimmed to what the code uses (keep `location` only if T-407 is approved), and orientation is portrait.
  - [ ] Notes for the owner on B-05.

### T-109 · Maps keys from config
- **Findings:** PAX-01 (code part), INF-06 (code part)
- **Acceptance:**
  - [ ] The key comes from env into the AndroidManifest (manifestPlaceholders), Info.plist (build setting) and JS (`env.MAPS_KEY`).
  - [ ] No key literal remains in the repo outside `.env.*` (grep).
  - [ ] There is no URL logging containing `key=`.
  - [ ] The map and search still work (QA PAX-E2E-01).

## Phase 2: Registration & onboarding

### T-201 · Per-step schema validation
- **Findings:** AUTH-11, AUTH-12
- **Acceptance:**
  - [ ] Each step validates against `registrationSchema` (yup, already installed) before Next; errors show inline.
  - [ ] Phone is required and correctly formatted (+92…); the password rules apply at step 1.
  - [ ] The vehicle year max is dynamic.
  - [ ] Unit tests cover the schema per step.

### T-202 · Server field errors on every input
- **Findings:** AUTH-10, AUTH-17
- **Acceptance:**
  - [ ] A 422 `fieldErrors` maps to every input of every step; the form jumps to the first step that has an error.
  - [ ] The toast shows one summary, not duplicates.
  - [ ] The registration thunk has reducer cases for loading and error.

### T-203 · Driver documents + license number
- **Findings:** AUTH-06, AUTH-07
- **Depends on owner:** B-03 (field names)
- **Acceptance:**
  - [ ] A license-number input exists, mapped to `license_number`.
  - [ ] All driver images are appended to the FormData with the confirmed field names and correct MIME types and names.
  - [ ] Unit test of the FormData builder.

### T-204 · Auth screens UX
- **Findings:** AUTH-13, AUTH-14 (rest)
- **Acceptance:**
  - [ ] `KeyboardAvoidingView` + `keyboardShouldPersistTaps` on long forms; `SafeAreaView` from safe-area-context.
  - [ ] No nested vertical ScrollViews.
  - [ ] The password is not trimmed.
  - [ ] The Google button is removed (and its config call removed) unless Google sign-in is actually supported by the backend.
  - [ ] QA visual check on iPhone SE and iPhone 15 Pro Max simulators.

## Phase 3: Passenger ride flow

### T-301 · Active ride in Redux; single booking route; restore
- **Findings:** PAX-10
- **Acceptance:**
  - [ ] An `activeRide` slice with API-aligned statuses; `rideSlice` and `tripSlice` are replaced.
  - [ ] `PassengerMapScreen` is mounted once (tab or stack, not both).
  - [ ] On launch, an existing active ride is fetched and the user is taken to it.

### T-302 · Correct ride payload
- **Findings:** PAX-02, PAX-04, PAX-15
- **Acceptance:**
  - [ ] No hardcoded user ID anywhere (grep `11`).
  - [ ] The addresses are the real selected text; the vehicle type is mapped to backend values; stops are included with `stop_order` and addresses; passenger count and instructions are included if the UI provides them.
  - [ ] Unit test of the payload builder.
  - [ ] QA PAX-E2E-02 (creates a ride → must cancel).

### T-303 · Location search
- **Findings:** PAX-13, PAX-18 (Nominatim)
- **Acceptance:**
  - [ ] 300 ms debounce, session token, `components=country:pk`, location bias.
  - [ ] Selecting a result fills the field and passes the address with the coordinates.
  - [ ] Empty, error and loading states.
  - [ ] The Nominatim fallback is removed.

### T-304 · Ride status state machine
- **Findings:** PAX-05, PAX-14
- **Acceptance:**
  - [ ] A pure, unit-tested reducer or state machine maps the server status to the UI stage.
  - [ ] Polling uses an interval keyed on the ride id; it stops on terminal states and when the screen is unfocused.
  - [ ] Map taps only change locations in an explicit choose-on-map mode.

### T-305 · Request safety
- **Findings:** PAX-08, PAX-09, INF-17
- **Acceptance:**
  - [ ] The confirm button is disabled while submitting.
  - [ ] Cancel during create cancels on the server once the id arrives.
  - [ ] `cancelAllRequests` is removed; per-request AbortController.

### T-306 · Fare from server
- **Findings:** PAX-07
- **Depends on owner:** B-04
- **Acceptance:**
  - [ ] The estimate comes from the backend, or, if none exists, it is shown clearly as "estimated" using route distance; the final price shown is the backend `total_fare`.
  - [ ] The breakdown adds up.

### T-307 · Driver-assigned card + tracking
- **Findings:** PAX-06, PAX-12
- **Acceptance:**
  - [ ] The tracking screen is rebuilt on the REST API and routed when the status becomes accepted.
  - [ ] A driver marker updates from the driver location endpoint or socket.
  - [ ] Call opens `tel:`; Message is hidden until chat exists.
  - [ ] Vehicle details come from the API.

### T-308 · Location permission UX + watcher
- **Findings:** PAX-11, DRV-10 (shared hook)
- **Acceptance:**
  - [ ] Denied permission shows an explanation, a Retry button and an Open Settings button; the map falls back to the default region with manual search.
  - [ ] One `useLocationWatcher` (watchPosition + distanceFilter + cleanup) is used by both roles.

### T-309 · Remove the Advanced panel + dead duplicates
- **Findings:** PAX-03, PAX-20, the duplicates table in audit/PASSENGER.md
- **Acceptance:**
  - [ ] The "+" Advanced entry and its components are removed, or the needed features (passenger count, instructions) are moved into the main flow.
  - [ ] Unused duplicates are deleted only after grep proves they are unused.

## Phase 4: Driver ride flow

### T-401 · Driver online/offline
- **Findings:** DRV-01, DRV-13
- **Depends on owner:** B-04 (status endpoint)
- **Acceptance:**
  - [ ] A `driverStatus` slice backed by the API; Home and Map share it.
  - [ ] Undefined function calls are removed.
  - [ ] Going online starts tracking and request polling; going offline stops both.

### T-402 · Location tracker rewrite
- **Findings:** DRV-03, DRV-09, DRV-10, DRV-18
- **Acceptance:**
  - [ ] Uses the shared watcher; sends the correct body to `/tracking/update-location` on movement or on a minimum interval; no duplicate timers; everything is cleaned up when going offline or on unmount.
  - [ ] Unit test of the throttling logic.

### T-403 · Incoming ride requests
- **Findings:** DRV-04, DRV-08
- **Acceptance:**
  - [ ] While online, poll `/rides/pending` with the driver location (documented params), plus socket events when T-406 is done.
  - [ ] Requests go into `incomingRequests` state; the card shows real fields; requests expire.

### T-404 · Accept + reject
- **Findings:** DRV-05, DRV-16
- **Depends on owner:** B-06
- **Acceptance:**
  - [ ] Accept uses `POST /rides/{id}/assign-driver`; a 409 shows "already taken"; there is an in-flight guard.
  - [ ] Reject dismisses the request locally (and calls the API if one exists).

### T-405 · Driver ride screen
- **Findings:** DRV-14, DRV-15, DRV-05 (fare)
- **Acceptance:**
  - [ ] `DriverRideScreen` is registered and navigated to after accept.
  - [ ] It uses the correct `RideResource` fields.
  - [ ] Navigate to pickup → start → stops → complete; complete does not send a client fare.
  - [ ] QA E2E-01.

### T-406 · WebSocket manager
- **Findings:** DRV-07, INF-12, INF-13 (client part)
- **Acceptance:**
  - [ ] A single manager with token auth, subscribe frames, capped backoff with jitter, an intentional-close flag, and AppState/NetInfo handling.
  - [ ] Unit tests with a fake WebSocket: no reconnect after `dispose()`; backoff capped.

### T-407 · Background driver location
- **Findings:** DRV-11
- **Depends on owner:** B-08
- **Acceptance:** defined after the product decision.

## Phase 5: Real data

### T-501 · Ride history from API
- **Acceptance:**
  - [ ] Passenger and driver history come from the API, with pagination, pull to refresh, and empty and error states.
  - [ ] `SAMPLE_RIDES` and the hardcoded lists are removed.

### T-502 · Notifications + FCM
- **Findings:** INF-14, PAX-17, DRV-17
- **Acceptance:**
  - [ ] The notifications screen uses `/notifications` (list, mark read, unread badge).
  - [ ] The FCM token is registered with the backend (endpoint confirmed in CONTRACT_NOTES) and refreshed.
  - [ ] Foreground and background handlers exist.
  - [ ] Permission is asked in context; Android 13 `POST_NOTIFICATIONS` is handled.
  - [ ] The no-op senders are deleted.

### T-503 · Remove fake data
- **Findings:** the mock tables in audit/PASSENGER.md and audit/DRIVER.md, DRV-19
- **Acceptance:**
  - [ ] No invented numbers: weather, stats, offers, the wallet balance and "Add Funds", earnings, the fake vehicle and license, dummy chats.
  - [ ] Features without a backend are hidden or shown as "coming soon".
  - [ ] Dead controls are removed or wired.

### T-504 · Profile
- **Acceptance:**
  - [ ] Real fields are edited through the API; the photo upload works, or is hidden if no endpoint exists.

### T-505 · Rating
- **Depends on owner:** B-04
- **Acceptance:**
  - [ ] The rating modal appears after completion and is submitted to the confirmed endpoint.

## Phase 6: UI / design system

Source of truth: [design/DESIGN_SYSTEM.md](design/DESIGN_SYSTEM.md) and the per-screen specs in [design/screens/](design/screens/README.md). Current-state audit with screenshots: [design/audit/README.md](design/audit/README.md) (rh-design-director, 2026-10-08).

**Rules for every Phase 6 task (Builder: rh-designer; Design review: rh-design-director, `review <task ID>`):**
- Build order: T-601 → T-602 → T-608 → T-609 → T-610, then the screen groups. Screen groups come after the Phase 3-5 task that wires their real data (listed in Depends), so the redesign is done once, on real data.
- No behaviour or data-flow change beyond what the spec states; existing tests pass; RNTL tests for every new `src/components/ui` component.
- UI primitives come only from `src/components/ui`; colours, type, spacing, radii, elevation and motion only from `src/theme` tokens. No hex/rgba literals, raw `fontSize`/`fontWeight`/`fontFamily`, magic spacing numbers, `ImageBackground`, emoji, or `react-native-vector-icons/*` imports outside `src/components/ui/Icon.tsx` in touched files (DESIGN_SYSTEM §11 greps).
- **Every screen task: matches its spec in light and dark on iPhone 17 and iPhone SE**, in every state the spec lists that can be triggered on the local backend (loading, empty, error, offline, permission denied, long text at 1.3× font scale). Screenshots in `docs/qa-reports/<date>-<task>/design-*.png`. If no iPhone SE simulator exists, create "iPhone SE (3rd generation)" with `xcrun simctl create`.
- Strings go through `src/i18n/en.ts`; layouts use start/end for RTL readiness (DESIGN_SYSTEM §7).

### T-601 · Theme tokens + ThemeProvider
- **Findings:** INF-24, audit G-01, G-03, G-04
- **Spec:** DESIGN_SYSTEM §1 (palette, semantic tokens light/dark, contrast table), §2 (type scale), §3 (spacing, radii, borders, elevation), §6 (motion tokens), §9 (map style JSON), §1.6 (dark rules)
- **Acceptance:**
  - [ ] `src/theme/palette.ts`, `tokens.ts` (semantic light/dark), `typography.ts`, `spacing.ts`, `radii.ts`, `elevation.ts` (iOS + Android, zero shadow in dark), `motion.ts`, `mapStyles.ts` hold exactly the values in the spec; `BrandColors` and the old `AppTheme` shape are replaced (TS2339 errors for missing keys gone).
  - [ ] ThemeProvider follows `useColorScheme` live (switching the simulator appearance while the app runs re-renders every mounted screen), with a persisted Light/Dark/System override.
  - [ ] Status bar style comes from the theme only.
  - [ ] A token preview screen (Debug only) shows every colour token with its contrast pair and every text style; screenshots light + dark on iPhone 17 and iPhone SE match the spec values.

### T-602 · UI kit core
- **Findings:** audit G-06, G-09, G-14
- **Spec:** DESIGN_SYSTEM §4 (icons), §5.1-5.13
- **Acceptance:**
  - [ ] `src/components/ui` exports Text (variants = type styles, `maxFontSizeMultiplier` 1.3), Icon (MaterialCommunityIcons only, typed semantic name map), Screen, Header (incl. large-title variant), Button (sizes lg/md/sm × variants primary/secondary/outline/ghost/destructive/destructiveSoft, pressed/disabled/loading), IconButton, TextField (default/phone/password/search/otp; focus, error, disabled), Card, ListItem, Switch, SegmentedControl, Chip, Badge (count/dot/status pill), Avatar (initials fallback).
  - [ ] Each matches its spec measurements in light and dark on iPhone 17 and iPhone SE (Debug kit gallery screen; screenshots of every variant and state).
  - [ ] RNTL tests: rendering, disabled/loading blocks presses, accessibility labels/roles.
  - [ ] `react-native/no-color-literals` and a custom no-raw-fontSize rule run as warnings in ESLint.

### T-608 · UI kit feedback + overlays
- **Spec:** DESIGN_SYSTEM §5.14-5.20, §6 (sheet spring, toast, skeleton shimmer, reduced motion)
- **Acceptance:**
  - [ ] BottomSheet (snap points peek/half/full, map and modal modes, keyboard handling), Dialog, Toast (single system; replaces the three toast systems with T-008), Banner (incl. offline banner wired to NetInfo), Skeleton, EmptyState, ErrorState.
  - [ ] Dependency decision recorded in the report (Reanimated-based sheet vs `@gorhom/bottom-sheet` v5).
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE, including reduced-motion behaviour (Settings → Accessibility → Reduce Motion).

### T-609 · UI kit ride components
- **Spec:** DESIGN_SYSTEM §5.21-5.31, §9
- **Acceptance:**
  - [ ] Map pins (pickup/dropoff/stop/driver/center pin), route line with casing and draw-on, light/dark map styles, address pair (Raah line), vehicle option card, fare breakdown, driver card, passenger card, ride status timeline + status pill mapping, rating stars (input + display), stat tile, promo card pager, slide-to-confirm (with accessibility action).
  - [ ] Searching pulse and marker interpolation per §6, with reduced-motion fallbacks.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (gallery screenshots with real-shaped fixture data from API resources, no invented copy in production code).

### T-610 · Navigation shell
- **Findings:** PAX-10, audit G-07, G-09
- **Spec:** [design/screens/shared-navigation-shell.md](design/screens/shared-navigation-shell.md), DESIGN_SYSTEM §8
- **Acceptance:**
  - [ ] Passenger tabs Home · Activity · Inbox · Account; driver tabs Drive · Earnings · Inbox · Account; booking and trip stacks hide the tab bar; removed routes listed in the spec are gone and every `navigate()` call site is updated.
  - [ ] Inbox badge = unread notifications + unread chats.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE.

### T-603 · Auth screens: login, phone code, forgot password
- **Findings:** audit Login 1-10, Phone 1-4, G-10
- **Spec:** [auth-login](design/screens/auth-login.md), [auth-phone-otp](design/screens/auth-phone-otp.md), [auth-forgot-password](design/screens/auth-forgot-password.md)
- **Acceptance:**
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE, including validation errors, submitting, wrong code, resend countdown and keyboard-up states (focused field and primary button visible above the keyboard).
  - [ ] No OTP value on screen (AUTH-OTP-01).

### T-611 · Auth: registration wizard
- **Findings:** audit Registration 1-9
- **Spec:** [auth-registration](design/screens/auth-registration.md)
- **Acceptance:**
  - [ ] Role-specific step sets (passenger 3, driver 5); date pickers; upload tiles; review with edit links; payment preference hidden (always `cash`).
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE, including field errors, server errors mapped to the right step, upload progress and upload failure.

### T-612 · Splash, account status, permission prompts
- **Spec:** [auth-splash](design/screens/auth-splash.md), [auth-account-status](design/screens/auth-account-status.md), [shared-permissions](design/screens/shared-permissions.md)
- **Acceptance:**
  - [ ] Native launch screen and JS splash are identical (no jump); account status for pending/rejected/suspended; location and notification pre-prompts and denied states.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (pending state with the local `pending@` account; denied state via `xcrun simctl privacy … revoke location`).

### T-604 · Passenger home + destination search
- **Findings:** PAX-21, PAX-22, audit Home 1-12, Map 1-4
- **Spec:** [passenger-home](design/screens/passenger-home.md), [passenger-destination-search](design/screens/passenger-destination-search.md)
- **Acceptance:**
  - [ ] Map-backed Home with "Where to?" sheet (peek/full), shortcuts, offers, stats and recent rides from the API; search with saved/recent, autocomplete, choose-on-map; no file over ~400 lines.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE, including loading, empty (fresh account), error, offline and location-denied states.

### T-613 · Passenger choose ride + finding driver
- **Findings:** audit Map 5-8
- **Spec:** [passenger-vehicle-fare](design/screens/passenger-vehicle-fare.md), [passenger-finding-driver](design/screens/passenger-finding-driver.md)
- **Acceptance:**
  - [ ] Route visible above the half sheet; vehicle cards and fare from BE-05; discard dialog copy; searching pulse; no-driver and cancel states.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (finding-driver captured during PAX-E2E-02 request + cancel on the local backend).

### T-614 · Passenger trip: assigned, on trip, complete + rating
- **Spec:** [passenger-driver-assigned](design/screens/passenger-driver-assigned.md), [passenger-trip-in-progress](design/screens/passenger-trip-in-progress.md), [passenger-trip-complete](design/screens/passenger-trip-complete.md)
- **Acceptance:**
  - [ ] Driver card, timeline, safety sheet, arrived state, on-trip stops, receipt and rating.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (captured during E2E-01 on two local simulators).

### T-605 · Driver Drive home + incoming request
- **Findings:** DRV-20, DRV-21, audit Driver Home 1-6, Drive map 1-4
- **Spec:** [driver-drive-home](design/screens/driver-drive-home.md), [driver-incoming-request](design/screens/driver-incoming-request.md)
- **Acceptance:**
  - [ ] Map-first Drive tab with offline/online sheet, earnings pill, request sheet with countdown ring, 409 "taken" state; no file over ~400 lines.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (online/offline per DRV-E2E-01; request per DRV-E2E-02).

### T-615 · Driver trip: to pickup, on trip, complete
- **Spec:** [driver-to-pickup](design/screens/driver-to-pickup.md), [driver-trip-in-progress](design/screens/driver-trip-in-progress.md), [driver-trip-complete](design/screens/driver-trip-complete.md)
- **Acceptance:**
  - [ ] Navigation card with external Navigate, arrived/waiting timer, slide to start/complete, stops, cancel reasons, collect-cash summary and rider rating.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (captured during E2E-01).

### T-616 · Driver earnings + vehicle & documents
- **Spec:** [driver-earnings](design/screens/driver-earnings.md), [driver-vehicle-documents](design/screens/driver-vehicle-documents.md)
- **Acceptance:**
  - [ ] Period switch, hero total, bar chart, trips list; vehicle, licence expiry banners and document statuses from BE-15 (no invented vehicle/licence).
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE, including empty period and missing-data states.

### T-607 · Inbox: notifications, messages, chat thread
- **Spec:** [shared-notifications](design/screens/shared-notifications.md), [shared-chat-list](design/screens/shared-chat-list.md), [shared-chat-thread](design/screens/shared-chat-thread.md)
- **Acceptance:**
  - [ ] One Inbox for both roles; one chat thread component for both roles; closed-chat state; quick replies.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE, including loading, empty, error, offline and send-failure states (NOTIF-01, CHAT-01).

### T-617 · Activity: ride history, ride details, wallet
- **Spec:** [shared-ride-history](design/screens/shared-ride-history.md), [shared-ride-details](design/screens/shared-ride-details.md), [passenger-wallet](design/screens/passenger-wallet.md)
- **Acceptance:**
  - [ ] Ride cards open details (no dead "Details" button); cancelled rides show "No charge"; wallet without top-up or payment methods.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE, including empty (fresh account), error and pagination states (PAX-DATA-01).

### T-618 · Account: settings, profile, saved places
- **Spec:** [shared-settings](design/screens/shared-settings.md), [shared-profile](design/screens/shared-profile.md), [passenger-saved-places](design/screens/passenger-saved-places.md)
- **Acceptance:**
  - [ ] Account list per role, persisted preferences (or the OS-settings row before BE-11), appearance picker (T-601 override), logout dialog; profile view/edit with photo upload; saved places with Home/Work slots.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (PROFILE-01, SETTINGS-01 steps 1-4, PAX-DATA-02).

### T-619 · Help & support, invite, delete account
- **Spec:** [shared-support-invite](design/screens/shared-support-invite.md)
- **Acceptance:**
  - [ ] Support contact from `/settings/public`, tickets list/new/thread, invite code share, delete-account flow with password confirmation and active-ride block.
  - [ ] Matches spec in light and dark on iPhone 17 and iPhone SE (SETTINGS-01 steps 2, 3, 5 on a throwaway local account).

### T-606 · Root ErrorBoundary + crash reporting
- **Findings:** INF-23
- **Acceptance:**
  - [ ] A root boundary with a friendly fallback and restart (fallback layout = ErrorState, DESIGN_SYSTEM §5.20, once T-608 lands).
  - [ ] Crashlytics in release (RNFirebase), with no PII.

## Phase 7: Release readiness

### T-701 · Dead code + unused deps
- **Findings:** INF-31, INF-34, DRV-23
- **Acceptance:**
  - [ ] Every removed file is proven unused (grep in the report).
  - [ ] Unused packages are removed.
  - [ ] Pods are reinstalled; the app launches.

### T-702 · Zero TS/ESLint errors
- **Acceptance:**
  - [ ] `tsc` 0, ESLint errors 0.
  - [ ] The gate is changed to require 0 (not just a ratchet).

### T-703 · Maestro flows
- **Acceptance:**
  - [ ] `.maestro/` flows exist for SMOKE-01..04, PAX-E2E-01, and AUTH-E2E-02.
  - [ ] Run instructions are documented. Flows never enter credentials (they start from a signed-in state).

### T-704 · CI
- **Acceptance:**
  - [ ] A GitHub Actions workflow runs `yarn verify` and both bundles on each PR.
  - [ ] A gitleaks secret scan runs.

### T-705 · Android R8 + versioning; iOS final
- **Findings:** INF-25
- **Acceptance:**
  - [ ] R8 is on, with keep rules for RN, Firebase and Maps.
  - [ ] The release build launches.
  - [ ] versionCode and versionName come from a single source.

### T-706 · README + docs
- **Findings:** INF-35
- **Acceptance:**
  - [ ] The README covers real setup, env, scripts and architecture.
  - [ ] The stale root docs are moved to `docs/archive/` or rewritten; the API docs go in `docs/api/`.

## Feature-completeness tasks (rh-auditor, 2026-10-08)

Source: [audit/FEATURES.md](audit/FEATURES.md) (findings `FEAT-01`..`FEAT-19`).

**Rules that apply to every task below:**
- Owner product defaults: cash only, in-ride chat, foreground-only location, realtime on Laravel Reverb.
- No screen may show a number, list or text that doesn't come from the API or a documented config/i18n file.
- Every async view has loading, error (with Retry) and empty states.

**BE tasks** run in `~/My-Projects/Raah-e-Haq-backend`, on branch `fix/production-hardening` cut from `main` (it doesn't exist yet).
- Each one adds feature tests (`php artisan test` green).
- Responses use the existing `{success, data, error:{code,message,details}}` envelope.
- Each one updates `docs/api/CONTRACT_NOTES.md` in the app repo with the request and response shape.

**App tasks** depend on their BE task.

### BE-00 · Backend test harness works (SQLite-safe migrations, factories)
- **Findings:** FEAT-19
- **Acceptance:**
  - [ ] `php artisan test` runs green on the in-memory SQLite DB from `phpunit.xml`. The MySQL-only `ALTER TABLE … MODIFY ENUM` migrations (`2025_09_17_115753_update_rides_status_enum.php`, `2025_09_27_093000_add_motorcycle_to_rides_vehicle_type_enum.php`) are guarded by driver, or rewritten so they work on both MySQL and SQLite.
  - [ ] `migrate:fresh --seed` still works on local MySQL.
  - [ ] Factories exist for User (with role passenger/driver/admin), Vehicle, Ride and DriverLocation, plus a `actingAsPassenger()/actingAsDriver()` test helper.
  - [ ] The existing `RideModuleApiTest` runs (fix or mark the tests that encode wrong behaviour as `todo` with the BE task that fixes them).
- **QA:** none (backend tests only)

### BE-01 · Rides scoped to the caller; passenger from token
- **Findings:** FEAT-02 · supersedes B-06 (passenger-from-token part)
- **Acceptance:**
  - [ ] `POST /rides` ignores or rejects `passenger_id`; the passenger is `auth()->user()`, who must have the `passenger` role and be `active`.
  - [ ] `vehicle_type` is validated against the catalogue from BE-05 (until then: `car,bike,rickshaw,van`).
  - [ ] `GET /rides` filters by role through the `roles` pivot (passenger → own rides; driver → rides assigned to them; admin → all).
    - It supports `status` as a comma list (e.g. `requested,accepted,arrived,ongoing` for active-ride restore), plus `per_page` and `page`.
    - Every status in the list is passed through `getStatusForApi`.
  - [ ] `GET /rides/{id}`, `POST /rides/{id}/cancel` and `DELETE /rides/{id}`: only the ride's passenger, its assigned driver or an admin; otherwise 403.
  - [ ] Cancel records `cancelled_by`, a `cancellation_reason` (passenger/driver) and an optional note.
  - [ ] Feature tests: user A can't list, show or cancel user B's ride; a passenger can't create a ride as someone else.
- **QA:** PAX-E2E-02

### BE-02 · Pending-ride feed and nearby drivers reachable and token-based
- **Findings:** FEAT-01 · supersedes B-04 (pending-rides contract)
- **Acceptance:**
  - [ ] `rides/pending` and `rides/nearby-drivers` are registered before `apiResource('rides')` (or `{ride}` is constrained to digits). A test proves `GET /api/rides/pending` hits `getPendingRides`.
  - [ ] `GET /rides/pending?latitude&longitude[&radius]`:
    - The driver comes from the token (driver role, `active`, approved vehicle); `driver_id` is no longer required.
    - It filters by the driver's own vehicle type, returns only `requested` rides newer than a configurable age (default 10 min), sorted by distance, with `estimated_distance`.
  - [ ] `GET /rides/nearby-drivers` returns only drivers whose latest location is `available` and seen within 5 min.
    - It includes `estimated_arrival_min`.
    - It never returns driver phone numbers to passengers.
  - [ ] Feature tests for both, including the route-order regression.
- **QA:** DRV-E2E-02

### BE-03 · Atomic accept (assign-driver) with 409
- **Findings:** FEAT-03 · supersedes B-06 (atomic assign-driver)
- **Acceptance:**
  - [ ] `POST /rides/{id}/assign-driver` takes the driver from the token (the body `driver_id` is ignored). The driver must have the driver role, be `active` and have an approved vehicle.
  - [ ] Accept is a single conditional update (`where status='requested' and driver_id is null`) or runs inside a transaction with `lockForUpdate`. The loser gets **409** `RIDE_ALREADY_ACCEPTED`.
  - [ ] It stores `vehicle_id`, sets `accepted_at`, sets the driver's location status to `busy`, and fires the `RideAccepted` event (broadcast once BE-12 exists).
  - [ ] Feature test: two drivers accept the same ride → exactly one 200 and one 409.
- **QA:** E2E-01

### BE-04 · Ride lifecycle endpoints; server-computed fare and earnings
- **Findings:** FEAT-04
- **Acceptance:**
  - [ ] New driver-only endpoints (assigned driver only; 403 otherwise; 409 on an invalid transition):
    - `POST /rides/{id}/arrived` (accepted → arrived)
    - `POST /rides/{id}/start` (arrived|accepted → ongoing)
    - `POST /rides/{id}/complete` (ongoing → completed)
  - [ ] `POST /rides/{id}/cancel` by the driver works before start, with a reason; the ride goes back to `requested`, or is cancelled per config.
  - [ ] `arrived` is exposed in `RideResource.status` (no longer collapsed into `accepted`). The app status machine (T-304) gets the full list.
  - [ ] Complete computes everything server-side and creates a cash `Transaction` for the ride (`payment_method=cash`, `payment_status=paid`):
    - `distance_km` and `duration_minutes`, from tracking points (BE-06) or the route estimate
    - `total_fare`, with the same formula as BE-05
    - `driver_earnings` and `platform_commission` (commission % from `app_settings`)
    - increments `total_rides` for both users
    - sets the driver back to `available`
  - [ ] `PUT /rides/{id}` no longer accepts `status`, `driver_id`, `fare`, `distance_km` or `duration_min` from clients (admin-only, or removed).
  - [ ] Each transition fires a `RideStatusChanged` event and creates a DB notification for the other party.
  - [ ] Feature tests for every transition, including the forbidden ones.
- **QA:** E2E-01

### BE-05 · Vehicle catalogue + fare estimate endpoint
- **Findings:** FEAT-05 · supersedes B-04 (fare estimate)
- **Acceptance:**
  - [ ] `GET /vehicle-types` (public or authenticated) returns the active vehicle types: key, display name, capacity, icon key, `base_fare`, `per_km`, `per_min`, `min_fare`, `per_stop`.
    - Seeded with car, bike, rickshaw (and van if the owner keeps it). Values come from `app_settings` category `fare`, or a `vehicle_types` table editable in the admin panel.
  - [ ] `POST /rides/estimate` {pickup, dropoff, stops[], vehicle_type?} returns, per vehicle type, `{distance_km, duration_min, fare, breakdown:{base, distance, time, stops}}`. The distance is the server-side road distance (Google Directions with the server key, if configured) or haversine × a configurable road factor, with a `source` field.
  - [ ] `POST /rides` stores the fare from the same calculator; the breakdown always adds up to `total_fare`.
  - [ ] Unit tests of the calculator and feature tests of both endpoints.
- **QA:** PAX-E2E-01

### BE-06 · Driver availability status + location endpoints the app needs
- **Findings:** FEAT-06 · supersedes B-04 (driver status)
- **Acceptance:**
  - [ ] `POST /driver/status` {status: online|offline} and `GET /driver/status` (driver role only).
    - Going online requires `active` + an approved vehicle.
    - Offline clears availability.
    - It refuses `offline` while a ride is in progress (409).
  - [ ] `POST /tracking/update-location` is driver-only, keeps the driver's current status (doesn't silently reset to `available`), and validates lat/lng ranges, speed, heading and accuracy.
    - It upserts a `driver_current_locations` row (or prunes history), so the table doesn't grow unbounded.
    - It fires `DriverLocationUpdated` on the active ride's channel (BE-12).
  - [ ] `GET /rides/{id}/driver-location` (participants only) returns the assigned driver's latest position for passenger tracking. `GET /tracking/driver/{id}/latest` is restricted to admins and that ride's passenger.
  - [ ] Feature tests. The app-side route names are recorded in CONTRACT_NOTES; the app calls to the missing `/tracking/update-status` and `/tracking/driver/{id}/location` are replaced in T-401/T-402.
- **QA:** DRV-E2E-01

### BE-07 · Ride rating
- **Findings:** FEAT-07 · supersedes B-04 (rating)
- **Acceptance:**
  - [ ] Migration: `ride_ratings` (ride_id, rater_id, ratee_id, stars 1-5, comment ≤500, created_at; unique on ride_id + rater_id).
  - [ ] `POST /rides/{id}/rate` {stars, comment?}: only a participant of a `completed` ride, once (409 on repeat).
  - [ ] It recomputes the ratee's `users.rating` (average).
  - [ ] `RideResource` exposes `my_rating` and `can_rate`.
  - [ ] Feature tests.
- **QA:** E2E-01 step 7

### BE-08 · Personal stats and driver earnings
- **Findings:** FEAT-08 · supersedes B-04 (history, earnings)
- **Acceptance:**
  - [ ] `GET /me/stats`, computed from completed rides (cached ≤5 min):
    - **Passenger:** `total_rides`, `total_distance_km`, `total_spent`, `rating`, `member_since`.
    - **Driver:** `total_rides`, `rating`, `earnings_today`, `earnings_week`, `earnings_month`, `online_minutes_today`, `acceptance_rate` (if derivable).
  - [ ] `GET /driver/earnings?period=day|week|month` returns totals plus a per-day series and the list of completed rides with `driver_earnings`.
  - [ ] Feature tests with seeded completed rides; zero-state returns zeros, not nulls.
- **QA:** PAX-DATA-01, DRV-DATA-01

### BE-09 · My wallet (cash only: balance + history)
- **Findings:** FEAT-09
- **Acceptance:**
  - [ ] `GET /wallet` returns the caller's wallet: balance, currency, total_spent/total_earnings. It is auto-created (zero) on first access and on register.
  - [ ] `GET /wallet/transactions?page` returns the caller's transactions only, newest first, with the ride reference.
  - [ ] There is no top-up endpoint (cash only).
  - [ ] The existing `payments/*` routes are restricted to admins (coordinate with rh-security).
  - [ ] Completed cash rides from BE-04 show up as transactions.
  - [ ] Feature tests: user A can't see user B's wallet or transactions.
- **QA:** PAX-DATA-01

### BE-10 · Banners/offers endpoint fixed and filtered
- **Findings:** FEAT-10
- **Acceptance:**
  - [ ] `GET /public/banners` (or authenticated `GET /banners`) selects the real columns (`description`, `image_url`, `action_url`, `action_text`, `type`, `position`, `display_order`).
    - It filters `is_active`, the `start_date`/`end_date` window, `target_audience` (from the token, if present) and an optional `position`.
    - It orders by `display_order`.
    - `image_url` is an absolute URL.
  - [ ] Feature tests: expired banners are excluded; there is no 500 with an empty table.
  - [ ] The seeder adds 2 local demo banners (local DB only), so QA can see the Home offers.
- **QA:** PAX-DATA-01

### BE-11 · Push notifications: device tokens, FCM send, preferences, broadcasts
- **Findings:** FEAT-11
- **Acceptance:**
  - [ ] Migration `user_devices` (user_id, fcm_token unique, platform, last_seen_at). `POST /devices` registers or refreshes; `DELETE /devices/{token}` on logout.
  - [ ] `sendPushNotification` sends through the FCM HTTP v1 API using a service-account path from env (`FIREBASE_CREDENTIALS`).
    - With no credentials it logs a single warning and skips (no crash).
    - It sends on a queue.
    - Invalid tokens are pruned.
  - [ ] Notification preferences (`push_enabled`, `ride_updates`, `promotions`, driver `sound_alerts`) are stored per user. `GET/PUT /profile/preferences`; sending respects them.
  - [ ] Admin broadcasts (`target_audience` all/passengers/drivers) appear in `GET /notifications` and in the unread count for the matching users (fan-out rows or a union query).
  - [ ] The list items expose a `category` (ride, promo, system, wallet) for the app filters.
  - [ ] Feature tests (FCM mocked with `Http::fake`).
  - [ ] Owner item: the Firebase service-account JSON for production is B-11.
- **QA:** NOTIF-01

### BE-12 · Realtime with Laravel Reverb
- **Findings:** FEAT-12 · supersedes B-06 (WebSocket auth)
- **Acceptance:**
  - [ ] `laravel/reverb` is installed; `BROADCAST_CONNECTION=reverb` in `.env.example` with `REVERB_*` keys; `php artisan reverb:start` works locally (documented in the backend README).
  - [ ] Broadcast auth is `POST /broadcasting/auth` with a Sanctum bearer token (`Broadcast::routes(['middleware' => ['auth:sanctum']])`).
  - [ ] Private channels:
    - `private-ride.{id}` (passenger + assigned driver)
    - `private-driver.{id}` (that driver)
    - `private-user.{id}` (that user)
  - [ ] Events on `ShouldBroadcast` (queued):
    - `RideRequested` (to nearby available drivers' channels)
    - `RideAccepted`
    - `RideStatusChanged`
    - `DriverLocationUpdated` (throttled)
    - `RideMessageSent` (BE-13)
    - `NotificationCreated`
  - [ ] `WebSocketController` stub endpoints are removed or return the real Reverb connection config (host, port, key, scheme), not a hardcoded URL.
  - [ ] Feature tests use `Event::fake`/`Broadcast` assertions plus the channel-authorisation tests.
  - [ ] Owner item: running Reverb plus a queue worker on the production host is B-10.
- **QA:** E2E-01 (with realtime), CHAT-01

### BE-13 · In-ride chat (passenger ↔ driver)
- **Findings:** FEAT-13
- **Acceptance:**
  - [ ] Migration `ride_messages` (ride_id, sender_id, body ≤1000, read_at, created_at).
  - [ ] `GET /rides/{id}/messages?after_id`, `POST /rides/{id}/messages` and `POST /rides/{id}/messages/read`:
    - Participants only (403 otherwise).
    - Posting is allowed only while the ride is accepted/arrived/ongoing (409 otherwise); reading stays allowed for 24 h after the end.
    - Rate limited (e.g. 30/min).
  - [ ] `GET /chats` lists the caller's rides that have messages or are active, with the other party's name and photo, the last message and the unread count.
  - [ ] Each new message broadcasts `RideMessageSent` on `private-ride.{id}` (BE-12) and pushes to the other party (BE-11).
  - [ ] Phone numbers are never exposed in chat payloads.
  - [ ] Feature tests.
- **QA:** CHAT-01

### BE-14 · Saved places (favourites)
- **Findings:** FEAT-14
- **Acceptance:**
  - [ ] Migration `saved_places` (user_id, label, type home|work|other, address, latitude, longitude). `GET/POST/PUT/DELETE /saved-places`, own rows only, with at most one home and one work.
  - [ ] Feature tests.
- **QA:** PAX-DATA-02

### BE-15 · Profile completeness, driver vehicle/licence, account deletion
- **Findings:** FEAT-15
- **Acceptance:**
  - [ ] `GET /auth/profile` and `GET /profile` return one normalised user:
    - `role`, `status`, `rating`, `total_rides`, `created_at`, `profile_image` as an absolute URL
    - for drivers: `license_number`, `license_expiry_date`, `vehicle` {make, model, year, color, license_plate, vehicle_type, verification_status} and the document statuses
    - never `password`, bank or CNIC image paths
  - [ ] `PUT /profile` validates as today. The app is switched to it (T-504); no `/auth/profile` PUT alias.
  - [ ] `DELETE /profile` {password or OTP confirmation}:
    - Anonymises the PII, revokes the tokens and deletes the avatar.
    - Keeps rides for accounting, with names replaced.
    - Refuses while a ride is active.
  - [ ] Feature tests.
- **QA:** PROFILE-01

### BE-16 · OTP hardening (code part of B-01)
- **Findings:** FEAT-16, AUTH-02 · supersedes B-01 (code part)
- **Acceptance:**
  - [ ] `otp_code` is returned only when `app()->environment('local','testing')`, never when the env is production, even with `APP_DEBUG=true`.
  - [ ] `SmsService` never logs the OTP or the full phone number (mask it).
  - [ ] `SmsService` gets a driver interface (`log` for local, one real gateway adapter configured from env). The gateway account and credentials remain an owner item (B-11).
  - [ ] Remove the `sleep(1)` in `SmsService::send`.
  - [ ] Feature tests for both environments.
- **QA:** AUTH-OTP-01 (local)

### BE-17 · Referral code fix + support/app-info contract
- **Findings:** FEAT-17
- **Acceptance:**
  - [ ] Migration adds `users.referral_code` (unique, nullable) and makes it fillable. `GET /referrals/code/mine` returns a stable code and a share text/link.
  - [ ] Confirm and test that `GET/POST /support/tickets` and `POST /support/tickets/{id}/reply` are scoped to the caller for non-admins, and that `assign`/`status` are admin-only.
  - [ ] `GET /settings/public` includes `support_email`, `support_phone`, `privacy_url` and `terms_url` (seeded).
  - [ ] Feature tests.
- **QA:** SETTINGS-01

### T-310 · Vehicle options and ETAs from the server
- **Findings:** FEAT-05
- **Depends:** BE-05, BE-02, T-306
- **Acceptance:**
  - [ ] The vehicle list on the booking sheet comes from `GET /vehicle-types`. The price per option comes from `POST /rides/estimate`, and the ETA from `GET /rides/nearby-drivers` (nearest driver per type).
    - If no driver is near, the option shows "No drivers nearby" instead of an ETA.
    - The hardcoded array at `PassengerMapScreen.tsx:753-756` and the multipliers are gone.
  - [ ] The selected vehicle key is sent unchanged as `vehicle_type` (no client-side mapping, no `service_level`).
  - [ ] Loading, error (Retry) and empty states on the vehicle sheet. Unit test of the options view-model.
- **QA:** PAX-E2E-01

### T-506 · Passenger Home on real data
- **Findings:** FEAT-08, FEAT-10, FEAT-18
- **Depends:** BE-08, BE-10, BE-01, T-501, T-502
- **Acceptance:**
  - [ ] Stats cards come from `GET /me/stats` (rides, rating, distance, spent). The fake "+12%" change chips are removed (no backend source).
  - [ ] The Special Offers carousel comes from banners (BE-10). "View All" opens a list or is removed; tapping an offer opens `action_url` or shows its description. With no offers, the section is hidden.
  - [ ] Recent rides = `GET /rides?per_page=3` (completed/cancelled); "View All" → RideHistory.
    - The fake "Recent Activity" block is removed or derived from the same data.
    - The weather widget is removed.
    - The notification badge = `GET /notifications/unread-count`.
  - [ ] "Schedule Ride" is hidden (no backend; owner hasn't asked for it).
  - [ ] "Support" uses `support_email`/`support_phone` from `GET /settings/public` (shared with T-511).
  - [ ] The Account rows navigate: Edit Profile → profile, Settings → Settings tab.
  - [ ] Pull to refresh refetches the profile, stats, rides, banners and unread count (no Firebase `refreshSessionThunk`).
  - [ ] The screen is split under ~400 lines (hooks `usePassengerStats`, `useBanners`, `useRecentRides`).
  - [ ] Loading, error and empty states. RNTL test: the stats render from a mocked API, and there is no literal "24"/"4.8" in the file (grep).
- **QA:** PAX-DATA-01

### T-507 · Driver Home, Profile and Earnings on real data
- **Findings:** FEAT-08, FEAT-15, DRV-19
- **Depends:** BE-08, BE-15, BE-01, T-401, T-501
- **Acceptance:**
  - [ ] Driver Home stats (rides, rating, earnings this month, online time today) come from `GET /me/stats`. The recent rides come from `GET /rides?per_page=3`. Currency is PKR everywhere (no `$`).
  - [ ] A new **Earnings** screen (stack route) uses `GET /driver/earnings` (day/week/month tabs, totals, list of rides). The Home "Earnings" action opens it; "Ride History" opens the driver history from T-501.
  - [ ] Driver Profile: the stats, vehicle (make, model, year, plate, colour) and licence number/expiry come from the profile (BE-15). "Toyota Corolla 2020", "DL-123456789", "4.9/156/$2.4k" are gone (grep).
  - [ ] The vehicle label on Home uses `profile.vehicle`.
  - [ ] Loading, error and empty states. RNTL tests for Home stats and the Earnings screen.
- **QA:** DRV-DATA-01

### T-508 · Wallet: cash-only balance and history
- **Findings:** FEAT-09
- **Depends:** BE-09
- **Acceptance:**
  - [ ] The balance and transactions come from `GET /wallet` and `GET /wallet/transactions` (paginated, pull to refresh).
  - [ ] "Add Funds" and "Payment Methods" are removed. A short note says "Rides are paid in cash to the driver" (copy in i18n/config).
  - [ ] "View all" loads more, or is removed when everything is shown.
  - [ ] `src/services/paymentService.ts` (mock, unused) is deleted after a grep proves it unused.
  - [ ] The Settings/Profile rows still navigate here; the Home quick-action subtitle no longer says "Payment methods".
  - [ ] Loading, error and empty states. RNTL test.
- **QA:** PAX-DATA-01

### T-509 · Favourite (saved) places from the API
- **Findings:** FEAT-14
- **Depends:** BE-14, T-303
- **Acceptance:**
  - [ ] The list, add, edit and delete use `/saved-places`. Adding uses the Places search from T-303 (address + coordinates), not free text. Home/Work have dedicated slots.
  - [ ] "Set Pickup" opens the booking map with the pickup prefilled; the booking search shows saved places first.
  - [ ] Loading, error and empty states; the delete has a confirmation. RNTL test.
- **QA:** PAX-DATA-02

### T-510 · In-ride chat (passenger ↔ driver), replacing the demo chats
- **Findings:** FEAT-13
- **Depends:** BE-13, BE-12, T-406, T-307, T-405
- **Acceptance:**
  - [ ] The Chat tab (both roles) lists conversations from `GET /chats`. `dummyChats` (`PassengerChatScreen.tsx`, `DriverChatScreen.tsx`), `dummyMessages` (`DriverMessagesScreen.tsx`) and the seeded GiftedChat bot (`MessagesScreen.tsx`) are deleted.
  - [ ] One shared thread screen for both roles:
    - Loads `GET /rides/{id}/messages`.
    - Sends with `POST` (optimistic, with failure and retry).
    - Receives live through the Reverb `private-ride.{id}` channel, with a polling fallback (≥5 s, only while focused).
    - Marks messages read.
  - [ ] The input is disabled with an explanation once the ride has ended.
  - [ ] The header shows the other party's name and photo. The call button opens `tel:` with the number from the ride (masked in logs).
  - [ ] "Message" on the driver-assigned card (T-307) and on the driver ride screen (T-405) opens the thread.
  - [ ] Empty state "Chats appear here during a ride". Unit tests for the message reducer; RNTL test for the thread.
- **QA:** CHAT-01

### T-511 · Settings, support, invite and account deletion (both roles)
- **Findings:** FEAT-11 (preferences), FEAT-15 (deletion), FEAT-17
- **Depends:** BE-11, BE-15, BE-17, T-102
- **Acceptance:**
  - [ ] Notification toggles (passenger: push, ride updates, promotions; driver: ride notifications, sound alerts) read and write `/profile/preferences`; the static Views in `DriverProfile.tsx:339-373` become real switches. "Auto Accept Rides" is removed.
  - [ ] Help & Support opens a Support screen: the contact email/phone from `GET /settings/public`, the user's tickets list (`GET /support/tickets`), a create-ticket form, and the ticket thread with reply. `src/config/support.ts` is removed or becomes a fallback only.
  - [ ] Invite Friends / Share App opens the native share sheet with the code from `GET /referrals/code/mine`.
  - [ ] Privacy and Terms rows open the URLs from public settings.
  - [ ] Delete Account (passenger settings and driver profile) has a confirmation plus a password re-entry, calls `DELETE /profile`, then the unified logout.
  - [ ] Every `console.log` row handler in `DriverSettingsScreen.tsx:106-148` and `PassengerHomeScreen.tsx:621,645` is wired or removed.
  - [ ] Pull to refresh on Settings refetches the profile.
  - [ ] RNTL tests for the toggles (optimistic + revert on error) and the delete-confirmation flow.
- **QA:** SETTINGS-01

## Backend security tasks (rh-security audit, 2026-10-08)

Findings: [audit/SECURITY.md](audit/SECURITY.md). Repo: `~/My-Projects/Raah-e-Haq-backend`, done by rh-backend. Every task adds feature tests.

### BE-18 · Role authorization (admin API + admin panel)
- **Findings:** SEC-01
- **Acceptance:**
  - [ ] Admin-only API endpoints are in a `role:admin` group:
    - `users` CRUD (a user may only read or update themselves through `/profile`)
    - `payments/*` (except a future "my wallet")
    - `settings` writes and `settings/banners*`
    - `security/*`
    - `analytics/dashboard|events|export`
    - `referrals/settings` POST and `referrals/{id}/complete`
  - [ ] `routes/web.php` `admin.*` is wrapped in `role:admin`. `RoleMiddleware` returns a JSON 403 for API requests.
  - [ ] Public web `/register` can no longer lead to panel access (disabled, or admin-only).
  - [ ] Feature tests: a passenger and a driver get 403 on every admin route; an admin gets 200; an unauthenticated caller gets 401.

### BE-19 · Production-safe seeding
- **Findings:** SEC-02
- **Acceptance:**
  - [ ] `DatabaseSeeder` runs only `RoleSeeder` and `AppSettingsSeeder` outside `local`/`testing`. Demo seeders return early in other environments.
  - [ ] No hardcoded admin password. A `php artisan raahehaq:create-admin` command prompts for email and password.
  - [ ] The `DEPLOYMENT.md` seeding step is updated.
  - [ ] Local `migrate:fresh --seed` still produces the QA accounts listed in `docs/QA_SCENARIOS.md`.

### BE-20 · Driver identity and location privacy
- **Findings:** SEC-03 (BE-06 covers the update-location role check and `latest`)
- **Acceptance:**
  - [ ] `rides/nearby-drivers` returns no name or phone, a coarse or jittered position, and caps the radius at 10 km or less.
  - [ ] `tracking/drivers-in-radius` is admin-only and validates `radius_km` with a max.
  - [ ] A driver's phone and exact location are returned only to the passenger of that driver's active accepted ride.
  - [ ] Feature tests for each rule.

### BE-21 · No PII in logs
- **Findings:** SEC-04
- **Acceptance:**
  - [ ] No `Log::` call receives `$request->all()` or any password, CNIC, bank, phone or OTP value (grep evidence in the report).
  - [ ] The registration logs only the user id and the failed field names.

### BE-22 · Private identity documents
- **Findings:** SEC-05
- **Acceptance:**
  - [ ] CNIC, licence and vehicle document uploads go to the private `local` disk.
  - [ ] An authorised route (owner or admin) returns a temporary signed URL; the admin panel views use it.
  - [ ] A migration command moves the existing files out of `storage/app/public/uploads`.
  - [ ] Feature test: an unauthenticated request can't fetch a document.

### BE-23 · Production config guard
- **Findings:** SEC-06
- **Acceptance:**
  - [ ] Add `.env.production.example` with `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=warning` and `SESSION_SECURE_COOKIE=true`. `DEPLOYMENT.md` uses it.
  - [ ] `AppServiceProvider` logs critical and refuses to serve (503) when `APP_ENV=production` and `APP_DEBUG=true`. Unit test.

**Medium and low findings with no task yet (fold into related BE work):**
- SEC-07: token expiry, an active-status middleware, token revocation on password change
- SEC-08: per-phone OTP limits, unique phone. Do it with BE-16.
- SEC-09: atomic wallet. Do it with BE-09.
- SEC-10: composer update
- SEC-11: axios upgrade, remove the firebase JS SDK
- SEC-13: account enumeration
- SEC-14, SEC-15: remove the dump, `composer.phar`, `test_ride_api.php` and `reh`
- SEC-16: input bounds
- SEC-17: https/wss enforced in release (`env.ts`)
- SEC-18: notification cache

### BE-24 · Ownership checks on remaining cross-user routes
- **Findings:** BE-18 security review (2026-10-08) findings 1, 2, 3, 9, 10
- **Acceptance:**
  - [ ] `GET /api/tracking/ride/{ride}/path` only for the ride's passenger, its assigned driver or an admin; others 403.
  - [ ] `POST/DELETE/PUT /api/rides/{ride}/stops*` only for the ride's passenger (or admin).
  - [ ] `GET /api/referrals/{referral}` only for the referrer, the referred user or an admin; response doesn't expose DOB/gender of the other party.
  - [ ] Static `referrals/tree|stats|rewards|settings` routes reachable (registered before `{referral}` or `{referral}` constrained to digits).
  - [ ] `admin/debug-referrals` removed.
  - [ ] Feature tests: owner 200, other user 403, admin 200 for each.

### BE-25 · Active-user enforcement and token lifetime
- **Findings:** SEC-07
- **Acceptance:**
  - [ ] Middleware `EnsureUserIsActive` on all `auth:sanctum` and web `auth` routes: suspended/inactive users get 403 `{success:false,message}` (pending drivers keep access to the routes they need for onboarding/status).
  - [ ] API login and OTP login refuse suspended/inactive accounts with a clear message.
  - [ ] Sanctum `expiration` configured (e.g. 30 days) with refresh via `/auth/refresh`; password change/reset revokes all other tokens.
  - [ ] Feature tests for each case; the app's 401/403 handling (T-104) documented in API CONTRACT CHANGES.

### BE-26 · No exception details in responses
- **Findings:** BE-21 security re-check (2026-10-08) findings 1, 2
- **Acceptance:**
  - [ ] No response returns `$e->getMessage()` or exception details outside `config('app.debug')` local mode: RidesController (`details`), Admin Ride/Payment/Referral controllers, Api PaymentsController. Use a generic message plus an error code; log through `SafeExceptionContext`.
  - [ ] `back()->withInput()` in admin controllers excludes password, CNIC, phone, bank and emergency fields.
  - [ ] Tests: a forced exception returns a generic body with no SQL or values.

### BE-27 · Phone normalization and enumeration
- **Findings:** SEC-08 (part 3), SEC-13
- **Acceptance:**
  - [ ] A migration normalizes existing `users.phone` to E.164 (+92…) with a documented dedupe report for collisions (no silent merges; collisions listed for the owner), then adds a unique index.
  - [ ] Registration, profile update, send-otp and verify-otp normalize input before lookups and rate-limit keys.
  - [ ] send-otp and forgot-password return the same generic 200 response whether or not the account exists (no 404 enumeration); no SMS/email is sent for unknown accounts.
  - [ ] Feature tests for formats `0300…`, `+92300…`, `92300…`, with spaces/dashes.

### BE-28 · OTP abuse hardening
- **Findings:** BE-16 security re-check (2026-10-08) findings 1–4; reviewer suggestions 1, 2, 5
- **Acceptance:**
  - [ ] SmsService refuses any number that doesn't normalise to +92 (no SMS to foreign/premium numbers); registration validates Pakistani mobile numbers.
  - [ ] Per-IP daily caps on send-otp and failed verifies, plus a global daily SMS budget (config), with a critical log when the budget is hit.
  - [ ] OtpLimiter give-back clamps counters at zero (never negative).
  - [ ] Admin action (panel or artisan `raahehaq:otp-reset {phone}`) clears a phone's OTP limits; documented support flow for victims of targeted lockout.
  - [ ] Every 429 from send-otp/verify-otp carries `retry_after` (or a documented `code: "code_exhausted"` for the per-code limit); API docs updated.
  - [ ] Issue-lock timeout returns 429/503, not a generic 500.
  - [ ] Feature tests for each.

### BE-29 · Validation and response contract fixes
- **Findings:** BE-22 implementer out-of-scope list (2026-10-08)
- **Acceptance:**
  - [ ] `vehicle_year` rule is `integer|min:1980|max:{current year + 1}` (computed) in every register/user controller; test with the current and next year.
  - [ ] `ProfileController::show` and `updateAvatar` return `UserResource` (no raw document paths, no password/remember token/PII columns beyond what the owner needs).
  - [ ] Admin `UserController` store/update map only `validated()` data for all fields.
  - [ ] Dead "Vehicle Images (Legacy Data)" block removed from admin show view.
  - [ ] Feature tests.

### T-110 · Nearby drivers on the BE-20 contract
- **Findings:** BE-20 API contract change (2026-10-08)
- **Acceptance:**
  - [ ] `rideService.getDriversInRadius` (or its replacement) calls `GET /rides/nearby-drivers` with `{latitude, longitude, radius<=10, vehicle_type?}`; `DriverInRadius.id` is `string`; `name`/`phone` removed from the type and UI; map marker keys use the opaque id.
  - [ ] `getDriverLocation(driverId)` is only called during an active ride; 403 is handled as "not available" without an error toast.
  - [ ] `driverPhone` comes from `ride.driver.phone` when present (active ride), otherwise the call button is hidden.
  - [ ] Unit tests with axios-mock-adapter for the new shapes; QA on the local backend shows nearby drivers on the passenger map.

### BE-30 · Ride write lockdown (stopgap)
- **Findings:** BE-20 security review finding 1 (high), SEC-03
- **Acceptance:**
  - [ ] `PUT /rides/{id}`: non-admins can't change `driver_id`, `status`, `fare`, `passenger_id`; only the ride's passenger may edit allowed fields (pickup/dropoff notes etc.) while `requested`.
  - [ ] `POST /rides/{ride}/assign-driver`: driver is the authenticated user (body `driver_id` ignored), must have the driver role and be active; passengers get 403.
  - [ ] `driver_phone` no longer stored in notification `data`.
  - [ ] Feature tests: passenger self-assign attempt → 403/ignored and no phone/location unlocked; driver assign works.

### BE-31 · Referral and reward money integrity
- **Findings:** BE-24 security re-check (2026-10-08) findings 1–5
- **Acceptance:**
  - [ ] Cancelling a referral (admin) voids its pending rewards in the same transaction.
  - [ ] `Referral::complete()` is a conditional pending→completed update; `processRewards()` runs only when a row changed (no duplicate rewards under concurrency).
  - [ ] `POST /referrals` no longer accepts free-form `referred_id`/`level`: referrals are created from a referral code at registration, level set by the server, unique `referred_id` (migration with dedupe report).
  - [ ] `ReferralReward::credit()` refuses non-active wallets and non-positive amounts.
  - [ ] `Transaction::generateTransactionId()` and `Ride::generateRideId()` are collision-free (ULID/UUID or DB sequence).
  - [ ] Admin `creditReward` reports failure when `credit()` returns false.
  - [ ] Feature tests for each.

