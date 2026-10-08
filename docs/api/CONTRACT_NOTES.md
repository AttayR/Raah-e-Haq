# API contract notes (app ↔ Laravel backend)

Created in T-007 (2026-10-08). **Source of truth: the backend code**, not the old markdown docs.

- Routes: `php artisan route:list --path=api` in `~/My-Projects/Raah-e-Haq-backend`, branch `fix/production-hardening` at `bd76db1` (BE-30, ride write lockdown, on top of BE-20 `4eceaaf`). **BE-24 is in progress (uncommitted):** ownership checks on ride show/cancel/destroy/stops, the ride GPS path and referrals. Expect 403 `FORBIDDEN` for rides that are not the caller's, and DELETE becoming admin-only. Re-check those rows when it lands.
- Responses: read from the controllers (`app/Http/Controllers/Api/*`). Nothing was called against production.
- "Documented" means the endpoint appears in `API_DOCUMENTATION.md`, `COMPLETE_API_DOCUMENTATION.md` or `RIDE_MODULE_API_FLOW.md` in the app repo root. Those docs drift from the code. Where they disagree, the code wins.

## Envelope and errors

All app HTTP goes through the one axios client in `src/services/api.ts` (`apiClient`). Its response interceptor turns every failure into `ApiError` (`src/core/api/errors.ts`): `{ kind, status, message, code?, fieldErrors, retryAfter? }`. `unwrap()` returns `data` from a success body. Thunks reject with `ThunkRejection` (`{ message, kind, status, code, fieldErrors, retryAfter }`). Screens show it with `rejectionMessage()`.

The backend uses these body shapes. The normaliser reads all of them. `code` is read from the top level first, then from `error.code`; `retry_after` from the body, else the `Retry-After` header:

| Shape | Who sends it | Example |
|---|---|---|
| `{ success: true, message?, data, pagination? }` | every success | `GET /rides` adds `pagination: {current_page,last_page,per_page,total}` and `data` is the array |
| `{ success: false, message, errors? }` | AuthController, role middleware (BE-18), nearby-drivers | `errors` is `{ field: [msg] }` |
| `{ success: false, message, code, errors:{field:[msg]}, retry_after }` | BE-28 OTP refusals (429 `otp_cooldown`, `otp_send_limit`, `otp_ip_limit`, `otp_verify_limit`, `code_exhausted`; 503 `sms_unavailable`) | `Retry-After` header too. `ApiError.code`/`retryAfter` carry them; the PhoneAuth branches are T-111 |
| `{ success: false, message, code, retry_after }` | BE-28: every `throttle` 429 (`code: rate_limited`) and a cache-lock timeout 503 (`code: busy`, `retry_after: 5`) | `Retry-After` header too |
| `{ success: false, message, code, data:{status} }` | BE-25: 403 `ACCOUNT_PENDING`/`ACCOUNT_INACTIVE`/`ACCOUNT_SUSPENDED`/`ACCOUNT_REJECTED` | account-status routing is T-106 |
| `{ success: false, error: { code, message, details } }` | RidesController (older paths), WebSocketController, NotificationController | `details` is either a field map (422) or a string (400/403) |
| `{ success: false, message, error: { code, message } }` (hybrid) | RidesController `rideError()` (BE-30: PUT `/rides/{id}`, assign-driver) | `message` is at the top level and in `error`; `error.code` is e.g. `FORBIDDEN_FIELDS`, `INVALID_STATUS_TRANSITION` |
| `{ message, errors? }` | Laravel itself: `$request->validate()` 422, 401 `Unauthenticated.`, 404 model binding | |

Status → `ApiError.kind`: 400 `bad_request`, 401 `auth`, 403 `forbidden`, 404 `not_found`, 409 `conflict`, 422 `validation`, 429 `rate_limited`, 5xx `server`. No response gives `network` or `timeout`. A cancelled request gives `cancelled`. Anything else is `unknown`. 4xx kinds show the server's `message` (user-facing text). `server` and `unknown` show the app's generic copy, because 5xx bodies can contain exception text (SQL, PII). The one exception is a 503 whose `code` is `sms_unavailable` or `busy` (BE-28): its `message` is written for users and is shown.

**Session and 401 (T-104, BE-25).** Sanctum tokens have no refresh token. They carry an idle expiry (`SANCTUM_IDLE_EXPIRATION`, 30 days by default) that the server slides forward on use; the absolute cap (`SANCTUM_EXPIRATION`) is off. The app stores `data.expires_at` from login/verify-otp next to the token, and does not call `/auth/refresh` (not needed while the cap is off; revisit if the owner sets one). A 401 on a request that carried the current session's token dispatches the unified `logout()` once (single flight per session); there is no refresh-and-retry after a 401. A 401 from `/auth/login`, `/auth/verify-otp`, `/auth/send-otp`, `/auth/register`, the password routes or `/auth/logout(-all)` never triggers it, nor does a 401 of an earlier session or one during the cold-start check (initializeAuth handles that). The token is in the iOS Keychain / Android Keystore (`src/services/authStorage.ts`) and is sent only when `apiClient.getUri(config)` is on the API origin (SEC-21).

Recent contract changes the app must follow:

- **BE-16 / BE-28** `POST /auth/send-otp`, `POST /auth/verify-otp`: may return **429** `{ success:false, message, code, errors:{phone|otp_code:[…]}, retry_after }` plus a `Retry-After` header (codes listed in the envelope table), and send-otp may return **503** `sms_unavailable` with `retry_after`. `ApiError.retryAfter` carries it, and `sendOtp` rejects with it. `data.otp_code` is **`null` outside APP_ENV=local + debug**. `expires_in` is 60 s (server config). The UI part is T-101.
- **BE-18** admin-only routes (`users*`, `payments/*`, `settings` (non-public), `security/*`, `analytics` reads, `referrals/{id}/complete`, `referrals/settings` POST, `tracking/drivers-in-radius`) return **403** `{ success:false, message:'Forbidden. You do not have permission to access this resource.' }` to non-admins.
- **BE-20** `GET /rides/nearby-drivers`: `id` is an **opaque string** (it rotates hourly per viewer). It has no name or phone. `rating` is in 0.5 steps, the position is grid-snapped, and `radius` is at most 10 km (default 5). It is throttled (`throttle:nearby-drivers`). `GET /tracking/drivers-in-radius` is **admin-only**. `GET /tracking/driver/{id}/latest` returns **403** unless the caller is that driver, an admin, or the passenger of an accepted, still-active ride with that driver. Non-admins get only `driver_id, latitude, longitude, heading, status, last_seen_at`. `RideResource.driver` is a minimal card, with the phone only while the ride is active. The app follow-up is T-110.
- **BE-22** `GET /profile/documents`: returns the caller's identity documents as short-lived signed URLs (`Cache-Control: private, no-store`). It is not called by the app yet (T-203/T-504).

## Endpoints the app calls

Paths are relative to `env.API_URL` (`…/api`). "Code" means `src/…` unless stated. "Exists" means the route is in `route:list`.

### Auth and profile (`src/services/api.ts`, thunks in `src/store/thunks/apiThunks.ts`)

| Method + path | Exists | Documented | App code | Notes |
|---|---|---|---|---|
| POST `/auth/login` | yes | yes | `apiService.login` | 401 `Invalid credentials`, 403 `ACCOUNT_*` (BE-25). `data: {user, token, token_type, expires_at}`. A 401 here is a wrong password, never a session expiry (T-104) |
| POST `/auth/register` | yes | yes | `register`, `registerWithImages` (multipart) | 201 `data: {user, token, token_type, phone_verification}`. **Drivers get `token: null`** until approved. BE-35: never 422 for a taken phone (format/country 422 only); `user.phone` is null and `user.pending_phone` set until verified; `phone_verification: {phone, code_sent, expires_in, verification_token, verification_token_expires_in}` (+ `code, message, retry_after` when `code_sent` is false). Keep `verification_token` in memory only |
| POST `/auth/phone/verify` | yes | no (T-201) | — | BE-35. `{verification_token, otp_code}` → 200 `data.user{id, phone, phone_verified_at, status}`; 422 `invalid_code` / `verification_token_invalid`; 429 `code_exhausted` / `otp_verify_limit` / `otp_ip_limit`; 409 `phone_needs_review`; 403 ACCOUNT_* |
| POST `/auth/phone/resend` | yes | no (T-201) | — | BE-35. `{verification_token}` → 200, or the send-otp refusals (429/503 with `retry_after`) |
| POST `/profile/phone` | yes | no (T-504) | — | BE-35. Bearer; `{phone}` sets `pending_phone` and texts a code (also resends). PUT `/profile` no longer changes the phone |
| POST `/profile/phone/verify` | yes | no (T-504) | — | BE-35. Bearer; `{otp_code}` → 200 phone switched; wrong code 422 (never 401) |
| DELETE `/profile/phone/pending` | yes | no (T-504) | — | BE-35. Bearer; clears `pending_phone` and its live code; also cleared by re-sending the current number to PUT /profile or POST /profile/phone |
| POST `/auth/send-otp` | yes | yes | `sendOtp` | BE-27: same generic 200 whether or not the phone is registered (no 404). BE-28: 429 `otp_cooldown`/`otp_send_limit`/`otp_ip_limit` + `retry_after`; 503 `sms_unavailable` (daily SMS budget) or `busy` + `retry_after`; non-PK numbers 422. `otp_code` null outside local |
| POST `/auth/verify-otp` | yes | yes | `verifyOtp` | 401 `Invalid or expired OTP` (never a session expiry). BE-28: 429 `code_exhausted` (+ `retry_after` until a new code can be sent) or `otp_verify_limit`. `data: {user, token, token_type, expires_at}` |
| POST `/auth/forgot-password` | yes | yes | `forgotPassword` | |
| POST `/auth/reset-password` | yes | yes | `resetPassword` | |
| POST `/auth/logout` | yes | yes | `logout` | BE-43: 200 for any authenticated token, including blocked (suspended/rejected/inactive/pending) accounts; deletes the presented token. `logout-all` deletes all of the user's tokens. 401 only for a missing/invalid token. The app still clears local state whatever the result |
| POST `/auth/logout-all` | yes | yes | `logoutAll` | |
| POST `/auth/refresh` | yes | yes | not called | Bearer, no body; rotates the token (the old one is revoked; a racing second refresh gets 401) and returns `{token, token_type, expires_at}`. T-104 removed the dead `refresh_token` interceptor branch and the unused thunk; see "Session and 401" |
| GET `/auth/profile` | yes | yes | `getProfile`, `initializeAuth` (cold-start check, T-103) | `data: {user}` (normalised: `role`, `roles[]`) |
| PUT `/profile` | yes | yes | `updateProfile` | **Path fixed in T-007** (the app called `PUT /auth/profile`, which does not exist). `data` is the raw user model with a `roles` relation, not `{user}`. Resource shape is BE-29; normalizeUser is T-105; no screen calls it yet (T-504) |
| GET `/user` | yes | yes | `testAuth` (unused since T-103) | `data: {user}` (BE-29 ProfileResource) |
| GET `/` | **no** | no | `testNetworkConnectivity` | Any HTTP status counts as reachable, so a 404 is fine. `GET /health` exists and would be the better probe |

### Rides (`src/services/rideService.ts`)

| Method + path | Exists | Documented | App code | Notes |
|---|---|---|---|---|
| POST `/rides` | yes | yes | `createRide` | 201 `data: RideResource`. **BE-37 (closes the BE-01 store part):** the passenger is the token user; any `passenger_id` in the body is ignored (not validated, not looked up), so the app can stop sending it. Only an admin names the passenger (`passenger_id` required for admins). A caller (or, for an admin, the named passenger) without a verified phone gets **403** `{ success:false, message, error:{ code:'PHONE_NOT_VERIFIED', message } }` (for a non-admin caller this comes before validation; for an admin's named passenger it comes after validation); legacy accounts created before `SMS_UNVERIFIED_EXEMPT_BEFORE` are exempt until a phone edit without OTP. On this code the app sends the user to phone verification. Fare is computed server-side, simplified |
| GET `/rides` | yes | yes | `getRides`, `getPassengerRides`, `getDriverRides`, `getActiveDriverRides`, `getPendingRides` | `data: RideResource[]` plus top-level `pagination` (fixed in T-007: the app used to return an empty page). The server scopes by the caller's role and **ignores `passenger_id`/`driver_id`**. `status` is an exact match, so `status=accepted,ongoing` (`getActiveDriverRides`) matches nothing |
| GET `/rides/{id}` | yes | yes | `getRide` | `data: RideResource` |
| PUT `/rides/{id}` | yes | yes | `updateRide`, `acceptRide`, `startRide`, `completeRide` | `data: RideResource`. **BE-30 contract (committed).** **Drivers:** `driver_id` and fare/metrics in the body are ignored. `status:'accepted'` on a `requested` ride is a token-based accept (same as assign-driver). After that, only the assigned active driver may move forward: accepted→arrived/started/ongoing, arrived→started/ongoing, started/ongoing→completed. Anything else is 409 `INVALID_STATUS_TRANSITION`, also returned when the status changed concurrently. Sending `passenger_id`/`special_instructions`/`passenger_count` gives 403 `FORBIDDEN_FIELDS`. An inactive driver gets 403 `DRIVER_NOT_ACTIVE`; not the assigned driver gets 403 `FORBIDDEN`. **Passengers:** `status`/`driver_id`/fare/metrics give 403 `FORBIDDEN_FIELDS`. `special_instructions`/`passenger_count` are editable while `requested`; otherwise 409 `RIDE_NOT_EDITABLE`. Other users get 403 `FORBIDDEN`. The app's `acceptRide` sends `{status:'accepted', driver_id}` (driver_id ignored), and `completeRide` sends fare/distance/duration (ignored). The move to assign-driver is T-404; the BE-04 endpoints are T-405 |
| DELETE `/rides/{id}` | yes | yes | `deleteRide` (unused) | 400 unless the ride can be deleted; admin-only once BE-24 lands (403 `FORBIDDEN`) |
| POST `/rides/{id}/assign-driver` | yes | yes | `assignDriver` (unused) | BE-30: **driver comes from the token**, the body (`driver_id`) is ignored, and the accept is atomic. 403 `FORBIDDEN` (not a driver, or own ride), 403 `DRIVER_NOT_ACTIVE`, 400 `RIDE_ALREADY_ACCEPTED` / `DRIVER_NOT_AVAILABLE` (no `available` location). 409 for a lost race comes later in BE-03. **BE-37:** a driver without a verified phone gets 403 `PHONE_NOT_VERIFIED` here and on PUT `{status:'accepted'}` |
| POST `/rides/{id}/cancel` | yes | yes | `cancelRide` | `data: RideResource` |
| GET `/rides/pending` | **shadowed** | yes | not called (`getPendingRides` uses `GET /rides?status=requested`) | Registered after `apiResource`, so `rides/{ride}` swallows it (404). Fix is BE-02; the app switch is T-403 (TODO in code) |
| GET `/rides/nearby-drivers` | yes | yes | not called yet | BE-20 contract above; the app switch is T-110 |
| POST `/rides/{id}/stops` | yes | yes | `addStop` | `data` is **not** a ride: `{id, stops, updated_fare, updated_distance, updated_duration}` (`RideStopsUpdate`). `useRide` now merges it into the current ride |
| DELETE `/rides/{id}/stops/{stop}` | yes | yes | `removeStop` | same `RideStopsUpdate` shape |
| PUT `/rides/{id}/stops/reorder` | yes | yes | `updateStopOrder` | same `RideStopsUpdate` shape |
| POST `/rides/{id}/navigate-next-stop` | yes | yes | `navigateToNextStop` | `data: {id, current_stop_index, next_stop, remaining_stops, route_updated}` (typed `any` for now) |
| POST `/rides/{id}/stops/{stop}/complete` | yes | yes | `markStopCompleted` | `data: {id, current_stop_index, completed_stops, remaining_stops, next_stop}` |
| GET `/rides/{id}/navigation-instructions` | yes | yes | `getNavigationInstructions` | |

### Tracking (`rideService.ts`, `locationTrackingService.ts`)

| Method + path | Exists | Documented | App code | Notes |
|---|---|---|---|---|
| POST `/tracking/update-location` | yes | yes | `rideService.updateDriverLocation` (the one remaining version), `locationTrackingService` periodic upload | Body `{latitude, longitude, status?: online\|available\|busy\|offline, address?, speed?, heading?, accuracy?}`. 201 `data: DriverLocation`. `DriverMapScreen` still passes two args (DRV-03, T-402) |
| GET `/tracking/driver/{id}/latest` | yes | yes (API_DOCUMENTATION) | `rideService.getDriverLocation`, `locationTrackingService.getDriverLocation` | BE-20: 403 unless there is an active ride. `data` may be `null` when the driver has no location yet |
| GET `/tracking/driver/{id}/location` | **no** | yes (COMPLETE_API_DOCUMENTATION, RIDE_MODULE_API_FLOW) | was `locationTrackingService.getDriverLocation` and `rideService.getDriverLocationById` | **Fixed in T-007:** both now use `/latest`, and the duplicate `getDriverLocationById` was removed. The docs are wrong |
| GET `/tracking/drivers-in-radius` | yes, **admin-only** | yes | `rideService.getDriversInRadius` via `useRide.findNearbyDrivers` | Passengers get 403 since BE-20. TODO(T-110) in code: move to `/rides/nearby-drivers` (string ids, no name/phone) |
| GET `/tracking/ride/{ride}/path` | yes | yes | `getRidePath` (unused) | Ownership check is BE-24 |
| POST `/tracking/update-status` | **no** | no | `locationTrackingService.setDriverStatus` (no callers) | **Broken (404).** TODO(BE-06/T-401) in code: driver online/offline becomes `POST/GET /driver/status` |

### Notifications (`notificationService.ts`, through `rideService`)

| Method + path | Exists | Documented | App code | Notes |
|---|---|---|---|---|
| GET `/notifications` | yes | yes | `notificationService.getNotifications` | `data: Notification[]` plus `pagination`; 20 per page fixed (the server ignores `per_page`) |
| POST `/notifications/{id}/read` | yes | yes | `markAsRead` | 403 nested envelope if it is not the caller's |
| POST `/notifications/read-all` | yes | yes | `markAllAsRead` | no `data` |
| GET `/notifications/unread-count` | yes | yes | `getUnreadCount` | `data: {unread_count}` |

`notificationService` still swallows errors and returns empty results (unchanged behaviour; real error states are T-502).

### Realtime (`webSocketService.ts`, through `rideService`)

| Method + path | Exists | Documented | App code | Notes |
|---|---|---|---|---|
| POST `/websocket/subscribe-ride` | yes | yes | `webSocketService.subscribeToRideUpdates` | Now axios with the real token (the placeholder token is gone). `data.websocket_url` is hardcoded `wss://raahehaq.com/ws/ride/{id}` on the server, and **no socket server exists** behind it. Reverb is BE-12 / T-406 |
| POST `/websocket/subscribe-driver` | yes | yes | `subscribeToDriverRequests` | Also writes the driver location as `available`. Same socket caveat |
| GET `/websocket/events` | yes | yes | `getWebSocketEvents` (unused) | |
| `wss://…/ws/notifications/{userId}` | **no** | no | `subscribeToNotifications` | No auth (INF-13) and no server. TODO(T-406/BE-12) in code |

### Not backend

`placesService.ts` and `useDirections.ts` call Google Maps REST with raw `fetch`. That is outside the backend contract. The proxy is an owner task (ARCHITECTURE: Maps REST).

## Backend routes the app does not use yet

`/profile` (GET), `/profile/avatar`, `/profile/change-password`, `/profile/documents` (BE-22), `/public/banners`, `/public/landing-stats`, `/public/contact`, `/settings/public`, `/referrals*`, `/support/tickets*`, `/support/categories` (GET), `/analytics/track`, `/health`. Admin-only routes are listed under BE-18 above.

## Open questions (DRV-24 and others)

1. **Earnings, ride history detail, chat, ratings, driver status, fare estimate, vehicle catalogue:** none of these exist on the backend. They are planned as BE-08 (stats/earnings), BE-01 (history), BE-13 (chat), BE-07 (rating), BE-06 (driver status), BE-05 (estimate + catalogue).
2. **`/tracking/driver/{id}/latest` vs `/rides/nearby-drivers`:** settled by BE-20. Passengers use nearby-drivers before a ride and `/latest` only during an active ride.
3. **`/tracking/update-status`:** it never existed. Settled: BE-06 adds `/driver/status`. Should it also normalise `online` vs `available`? BE-06 notes say yes.
4. **Refresh tokens:** settled in T-104 with BE-25: no refresh token; 401 → logout; no proactive `/auth/refresh` while the idle expiry slides and the absolute cap is off.
5. **Error envelope:** the backend mixes shapes A and B. The app handles both. Unifying them on the server would simplify things (candidate for BE-26/BE-29).
6. **`RideResource.driver`/`passenger`:** relation shapes differ by viewer (BE-20). The app's `RideResource.driver.phone` must be treated as optional (T-110).
7. **PUT `/rides/{id}` for driver transitions:** BE-30 allows forward driver transitions on PUT; after BE-04, which of them stay on PUT? The app should move to the explicit endpoints (T-404/T-405).

## BE-37: verified phone required (2026-10-08)

`User::hasVerifiedPhone()`: `phone_verified_at` is set, or the account was created before `SMS_UNVERIFIED_EXEMPT_BEFORE`, still holds a valid E.164 number, and that number was not changed without an OTP after the cutoff (`phone_changed_at`).

| Endpoint | Refusal |
|---|---|
| POST `/rides` | 403 `PHONE_NOT_VERIFIED` (caller; for an admin, the named passenger) |
| POST `/rides/{id}/assign-driver`, PUT `/rides/{id}` `{status:'accepted'}` (driver) | 403 `PHONE_NOT_VERIFIED` |
| PUT `/rides/{id}` with `driver_id` (admin) | 422 `PHONE_NOT_VERIFIED`, `errors.driver_id` |
| POST `/referrals/rewards/{id}/claim` | 403 `PHONE_NOT_VERIFIED` (claimant), 409 `REFERRED_PHONE_NOT_VERIFIED` (the referred friend has not verified; the reward stays pending) |
| POST `/referrals/{id}/complete` (admin) | 409 `REFERRED_PHONE_NOT_VERIFIED` (referral stays pending) |
