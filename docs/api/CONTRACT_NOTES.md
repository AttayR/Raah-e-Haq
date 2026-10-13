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
| `{ success: false, message, code, errors:{field:[msg]}, retry_after }` | BE-28 OTP refusals (429 `otp_cooldown`, `otp_send_limit`, `otp_ip_limit`, `otp_verify_limit`, `code_exhausted`; 503 `sms_unavailable`) | `Retry-After` header too. `ApiError.code`/`retryAfter` carry them; PhoneAuth branches on them via `features/auth/otpRefusal` (T-111) |
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
- **BE-20** `GET /rides/nearby-drivers`: `id` is an **opaque string** (it rotates hourly per viewer). It has no name or phone. `rating` is in 0.5 steps, the position is grid-snapped (and only moves once per 2-minute bucket), and `radius` is at most 10 km (default 5). Since BE-65, who is listed follows each driver's latest ping (fresh within 5 min, status available, no active ride), not the bucket: a driver freed by a finished ride shows on their next ping, and one who goes busy or offline disappears at once. It is throttled (`throttle:nearby-drivers`). `GET /tracking/drivers-in-radius` is **admin-only**. `GET /tracking/driver/{id}/latest` returns **403** unless the caller is that driver, an admin, or the passenger of an accepted, still-active ride with that driver. Non-admins get only `driver_id, latitude, longitude, heading, status, last_seen_at`. `RideResource.driver` is a minimal card, with the phone only while the ride is active. The app follow-up is T-110.
- **BE-22** `GET /profile/documents`: returns the caller's identity documents as short-lived signed URLs (`Cache-Control: private, no-store`). It is not called by the app yet (T-203/T-504).
- **BE-66** per-item review of driver registration uploads (app follow-up T-203). Registration (API and web) now creates one `driver_documents` item per uploaded image, status `pending`. Item types: `profile`, `cnic_front`, `cnic_back`, `license`, `vehicle_front`, `vehicle_back`, `vehicle_left`, `vehicle_right` (they map to the register fields `profile_image`, `cnic_front_image`, `cnic_back_image`, `license_image`, `vehicle_*_image`). An admin can approve the driver's account only when every **required** type (server config `DRIVER_REQUIRED_DOCUMENTS`, default `profile,cnic_front,cnic_back,license`) has an approved item.
  - `GET /driver/documents` (role driver, pending or active): `data: { documents: [{ id|null, type, required, status: pending|approved|rejected|missing, rejection_reason|null, can_upload, url|null, updated_at|null }] (always all 8 types, in that order), required_types: [...], all_required_approved, expires_in }`. `url` is a short-lived signed link (the profile photo's is its public URL); never cache it past `expires_in`. `rejection_reason` is set only when `status` is `rejected`. `Cache-Control: private, no-store`.
  - `POST /driver/documents/{type}` multipart field `document` (image jpeg/png/jpg/gif, at most 5 MB, same as registration). Allowed only when the item is `missing` or `rejected`; it goes back to `pending` and the response is the same body as the GET. Errors: 404 `NOT_FOUND` unknown type; 409 `DOCUMENT_NOT_REPLACEABLE` (item pending or approved: refresh the list); 409 `NO_VEHICLE` (vehicle photo without a vehicle); 422 `errors.document`; 429 (10/min, shared with the BE-32 re-upload routes); 403 for non-drivers.
  - `POST /profile/documents/{id}` (BE-32) still works; for a registration item it now also updates the user's/vehicle's image. `POST /profile/avatar` by a driver sends the `profile` item back to `pending`.
  - Admin API (role admin): `GET /admin/drivers/{driver}/documents` (same list + `driver_id`, `status`), `POST /admin/drivers/{driver}/documents/{id}/approve`, `POST /admin/drivers/{driver}/documents/{id}/reject` `{ rejection_reason }` (required, at most 500 chars), `POST /admin/drivers/{driver}/approve` (409 `DOCUMENTS_NOT_APPROVED` with `data.missing: [types]` until the required items are approved). 404 when `{driver}` is not a driver or the item is not theirs.
- **BE-67** BE-66 security follow-ups (admin-side; no driver-app request or response changes). New 409 codes, all in the usual envelope `{ success:false, message, error:{ code } }`:
  - `DOCUMENT_NOT_PENDING`: `POST /admin/drivers/{driver}/documents/{id}/approve|reject` on an item that is not `pending` (already decided, or changed since the admin loaded it). Reload the list.
  - `ACCOUNT_NOT_PENDING`: `POST /admin/drivers/{driver}/approve` when the driver's status is not `pending` (active, rejected, suspended, inactive).
  - `DOCUMENTS_NOT_APPROVED` (same body as BE-66, with `data.missing: [types]`) is now also returned by admin `POST /users` and `PUT /users/{id}` when the write would make the account an active driver (status moved to `active`, or the driver role added to an active account) while a required item is not approved. An image uploaded in that same request counts as not approved. A new driver can therefore only be created as `pending`. Nothing is written or kept on a 409.
  - Admin image uploads through `POST /users` / `PUT /users/{id}` now create or reset the matching item to `pending` with the new file; `POST /profile/vehicles/{vehicle}/documents` (BE-32) does the same for the `vehicle_*` items it replaces.

## Endpoints the app calls

Paths are relative to `env.API_URL` (`…/api`). "Code" means `src/…` unless stated. "Exists" means the route is in `route:list`.

### Auth and profile (`src/services/api.ts`, thunks in `src/store/thunks/apiThunks.ts`)

| Method + path | Exists | Documented | App code | Notes |
|---|---|---|---|---|
| POST `/auth/login` | yes | yes | `apiService.login` | 401 `Invalid credentials`, 403 `ACCOUNT_*` (BE-25). `data: {user, token, token_type, expires_at}`. A 401 here is a wrong password, never a session expiry (T-104) |
| POST `/auth/register` | yes | yes | `register`, `registerWithImages` (multipart) | **BE-38 (supersedes the token-at-register contract):** 201 `data: {user:{name,email,user_type,role,roles,status,phone:null,pending_phone}, phone_verification:{phone,code_sent,expires_in,verification_token,verification_token_expires_in}}` — no `token`, no `user.id`, no timestamps; identical for a free and a taken email (taken → nothing created, owner gets a notice mail, decoy token whose codes are always invalid). The session token comes from `POST /auth/phone/verify`. Until the phone (or the emailed link / a password reset) proves the account, `POST /auth/login` answers 401 like a wrong password. Never 422 for a taken email or phone (format/country 422 only). Keep `verification_token` in memory only |
| POST `/auth/phone/verify` | yes | api only (T-111; screen T-201) | `verifyPhone` (thunk merges the user, stores the token when present) | BE-35/38. `{verification_token, otp_code}` → 200 `data:{token, token_type, expires_at, user:{id, name, email, role, roles, phone, phone_verified_at, status}}` (`token` null for a pending driver unless pending-login tokens are on); 422 `invalid_code` / `verification_token_invalid` (copy points to the email link or password reset); 429 `code_exhausted` / `otp_verify_limit` / `otp_ip_limit`; 409 `phone_needs_review`; 403 ACCOUNT_* |
| POST `/auth/phone/resend` | yes | api only (T-111; screen T-201) | `resendPhoneCode` | BE-35. `{verification_token}` → 200, or the send-otp refusals (429/503 with `retry_after`) |
| POST `/profile/phone` | yes | no (T-504) | — | BE-35. Bearer; `{phone}` sets `pending_phone` and texts a code (also resends). PUT `/profile` no longer changes the phone |
| POST `/profile/phone/verify` | yes | no (T-504) | — | BE-35. Bearer; `{otp_code}` → 200 phone switched; wrong code 422 (never 401) |
| DELETE `/profile/phone/pending` | yes | no (T-504) | — | BE-35. Bearer; clears `pending_phone` and its live code; also cleared by re-sending the current number to PUT /profile or POST /profile/phone |
| POST `/auth/send-otp` | yes | yes | `sendOtp` | BE-27: same generic 200 whether or not the phone is registered (no 404). BE-28: 429 `otp_cooldown`/`otp_send_limit`/`otp_ip_limit` + `retry_after`; 503 `sms_unavailable` (daily SMS budget) or `busy` + `retry_after`; non-PK numbers 422. `otp_code` null outside local |
| POST `/auth/verify-otp` | yes | yes | `verifyOtp` | 401 `Invalid or expired OTP` (never a session expiry). BE-28: 429 `code_exhausted` (+ `retry_after` until a new code can be sent) or `otp_verify_limit`. `data: {user, token, token_type, expires_at}` |
| POST `/auth/forgot-password` | yes | yes | `forgotPassword` | |
| POST `/auth/reset-password` | yes | yes | `resetPassword` | |
| POST `/auth/logout` | yes | yes | `logout` | BE-43: 200 for any authenticated token, including blocked (suspended/rejected/inactive/pending) accounts; deletes the presented token. `logout-all` deletes all of the user's tokens. 401 only for a missing/invalid token. The app still clears local state whatever the result |
| POST `/auth/logout-all` | yes | yes | `logoutAll` | BE-68: both logouts also set a driver offline (see BE-68 section) |
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
| POST `/rides/{id}/arrived` (also PUT `/rides/{id}` `{status:'arrived'}`) | yes | yes | T-405 driver ride screen | `data: RideResource`. **BE-64 (2026-10-10):** refused with **422** `{ success:false, message, error:{ code:'not_near_pickup', message, distance_m, radius_m } }` when the driver's latest location ping (POST `/tracking/update-location`) is newer than `RIDES_ARRIVAL_LOCATION_MAX_AGE_S` (120 s) and farther than `RIDES_ARRIVAL_RADIUS_M` (300 m) from pickup; the ride stays `accepted`. No ping, or only a stale one, is allowed on purpose (GPS gaps with foreground-only location must not block a driver). Admin moves are not checked. 403/409 codes unchanged and checked first. On `not_near_pickup` the app should show the message (optionally "about {distance_m} m away") and keep the Arrived button |
| DELETE `/rides/{id}` | yes | yes | `deleteRide` (unused) | 400 unless the ride can be deleted; admin-only once BE-24 lands (403 `FORBIDDEN`) |
| POST `/rides/{id}/assign-driver` | yes | yes | `assignDriver` (unused) | BE-30: **driver comes from the token**, the body (`driver_id`) is ignored, and the accept is atomic. 403 `FORBIDDEN` (not a driver, or own ride), 403 `DRIVER_NOT_ACTIVE`, 400 `RIDE_ALREADY_ACCEPTED` / `DRIVER_NOT_AVAILABLE` (no `available` location). 409 for a lost race comes later in BE-03. **BE-37:** a driver without a verified phone gets 403 `PHONE_NOT_VERIFIED` here and on PUT `{status:'accepted'}` |
| POST `/rides/{id}/cancel` | yes | yes | `cancelRide` | `data: RideResource` |
| GET `/rides/pending` | yes (BE-02) | yes | not called yet (`getPendingRides` still uses `GET /rides?status=requested`; switch in T-403) | Driver role, driver from token (no `driver_id`). Query: optional `latitude`/`longitude` (fallback when no ping in 5 min), `radius` km ≤ 20. 200 `data: RideResource[] + estimated_distance, estimated_pickup_min, estimated_fare`, `meta:{radius_km, vehicle_types, location_source, max_age_minutes}`; minimal passenger card, no phone. 409 `error.code` DRIVER_NOT_AVAILABLE / DRIVER_ON_RIDE / NO_APPROVED_VEHICLE; 422 (`code: LOCATION_REQUIRED` when no location); 429 `rate_limited` (30/min). Note: 409 code is in `error.code`, 422/429 in top-level `code` |
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
| POST `/tracking/update-location` | yes | yes | `rideService.updateDriverLocation` (the one remaining version), `locationTrackingService` periodic upload | **BE-06:** driver role only. Body `{latitude, longitude, heading?, speed? (m/s), accuracy? (m), address?}` as numbers; body `status` is ignored, negative speed/heading/accuracy are treated as null. 201 `data:{driver_id, latitude, longitude, heading, status: available\|busy, last_seen_at, driver_status}`. 409 `DRIVER_OFFLINE` when offline (nothing stored). 60/min. `DriverMapScreen` still passes two args (DRV-03, T-402) |
| GET `/tracking/driver/{id}/latest` | yes | yes (API_DOCUMENTATION) | `rideService.getDriverLocation`, `locationTrackingService.getDriverLocation` | BE-20: 403 unless there is an active ride. `data` may be `null` when the driver has no location yet |
| GET `/tracking/driver/{id}/location` | **no** | yes (COMPLETE_API_DOCUMENTATION, RIDE_MODULE_API_FLOW) | was `locationTrackingService.getDriverLocation` and `rideService.getDriverLocationById` | **Fixed in T-007:** both now use `/latest`, and the duplicate `getDriverLocationById` was removed. The docs are wrong |
| GET `/tracking/drivers-in-radius` | yes, **admin-only** | yes | `rideService.getDriversInRadius` via `useRide.findNearbyDrivers` | Passengers get 403 since BE-20. TODO(T-110) in code: move to `/rides/nearby-drivers` (string ids, no name/phone) |
| GET `/tracking/ride/{ride}/path` | yes | yes | `getRidePath` (unused) | Ownership check is BE-24 |
| POST `/tracking/update-status` | **no** | no | `locationTrackingService.setDriverStatus` (no callers) | **Never existed.** Use BE-06 `GET /driver/status` and `PUT\|POST /driver/status {status: online\|available\|offline}` → `data:{status: offline\|available\|on_ride, is_online, can_accept_rides, active_ride_id, changed_at, last_location_at}`; 403 `NO_APPROVED_VEHICLE`/`DRIVER_NOT_ACTIVE`, 409 `RIDE_IN_PROGRESS`, 422 unknown status; 30/min (T-401) |

### Notifications (`notificationService.ts`, through `rideService`)

| Method + path | Exists | Documented | App code | Notes |
|---|---|---|---|---|
| GET `/notifications` | yes | yes | `notificationService.getNotifications` | `data: Notification[]` plus `pagination`; BE-11 changes the item shape and adds `per_page`/`category`/`unread` (see "BE-11" below) |
| POST `/notifications/{id}/read` | yes | yes | `markAsRead` | BE-11: 404 `NOT_FOUND` (flat envelope) if it is not the caller's; was 403 |
| POST `/notifications/read-all` | yes | yes | `markAllAsRead` | BE-11: `data: {unread_count: 0}` |
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

`/profile` (GET), `/profile/avatar`, `/profile/change-password`, `/profile/documents` (BE-22), `/driver/documents*` (BE-66, T-203), `/public/banners`, `/public/landing-stats`, `/public/contact`, `/settings/public`, `/referrals*`, `/support/tickets*`, `/support/categories` (GET), `/analytics/track`, `/health`. Admin-only routes are listed under BE-18 above.

## Open questions (DRV-24 and others)

1. **Earnings, ride history detail, chat, ratings, driver status, fare estimate, vehicle catalogue:** none of these exist on the backend. They are planned as BE-08 (stats/earnings), BE-01 (history), BE-13 (chat), BE-07 (rating), BE-06 (driver status), BE-05 (estimate + catalogue).
2. **`/tracking/driver/{id}/latest` vs `/rides/nearby-drivers`:** settled by BE-20. Passengers use nearby-drivers before a ride and `/latest` only during an active ride.
3. **`/tracking/update-status`:** it never existed. Settled and built (BE-06): `/driver/status`; `online` is accepted as `available`; `on_ride` is derived from active rides. Accept (`POST /rides/{id}/assign-driver`) returns 400 `DRIVER_NOT_AVAILABLE` when offline and 409 `DRIVER_ON_RIDE` during a ride. Passenger tracking: `GET /rides/{id}/driver-location` (participants only, data null when not active).
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

## BE-13: in-ride chat (2026-10-11, for T-510)

Backend worktree `rh-backend-be-13`, branch `be-13-chat` (not merged into `fix/production-hardening` yet). All routes: `auth:sanctum` + `active`. Participants are the ride's passenger and its **current** assigned driver; anyone else (other users, admins) gets 403. No realtime yet: poll `GET /rides/{id}/messages?after_id=<last_id>` (every 3–5 s while the thread is open, slower or stopped in the background). BE-12 will push the same message shape (without `is_mine` and `client_id`) on `private-ride.{id}` as event `chat.message` (and `chat.read`).

Message object (`M`):

```json
{ "id": 41, "ride_id": 7, "client_id": "uuid-or-null", "sender_id": 12, "sender_role": "passenger|driver",
  "is_mine": true, "body": "plain text", "created_at": "2026-10-11T12:00:00+00:00", "read_at": null }
```

`client_id` is returned only on your own messages (null on the other party's). `body` is plain text: render it as text, never HTML. The server removes control characters (except newline and tab), bidi marks (incl. U+061C), zero-width space, word joiner and BOM (ZWNJ/ZWJ stay), turns CRLF into LF, keeps at most one blank line in a row and trims. A body with nothing visible left is a 422. `read_at` is when the recipient read it.

Other-party card (`P`), never a phone number: `{ "id": 5, "role": "driver|passenger", "first_name": "Bilal"|null, "profile_image_url": "https://…"|null }`. Calling the other party is outside this API (the phone stays on `RideResource` for the active ride, BE-20).

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET `/chats` | — | 200 `data.chats: [ { ride_id, ride_status, can_send, read_only_until, other_party: P, last_message: M\|null, unread_count } ]`, newest activity first, at most 50 | 401 |
| GET `/rides/{id}/messages` | query `after_id` (int ≥0) **or** `before_id` (int ≥1), `limit` (1–100, default 50) | 200 `data: { ride_id, ride_status, can_send, read_only_until, other_party: P\|null, messages: [M], has_more, last_id, other_party_read_up_to_id }` | 403 `not_ride_participant`, 404, 410 `chat_expired`, 422 (both cursors, bad numbers) |
| POST `/rides/{id}/messages` | `{ body: string (1–1000 chars after cleaning), client_id?: string ≤64 [A-Za-z0-9._:-] }` | 201 `data.message: M` (new); 200 same body with the **first** message when `client_id` repeats (safe retry) | 403 `not_ride_participant`, 409 `chat_not_open` (no driver yet), 409 `chat_closed` (ride ended), 422 `errors.body` / `errors.client_id`, 429 `rate_limited` (20 sends/min per user, `Retry-After`) |
| POST `/rides/{id}/messages/read` | `{ up_to_id: int ≥1 }` | 200 `data: { ride_id, marked, unread_count }` | 403, 410 `chat_expired`, 422 `errors.up_to_id` |

Errors use the BE-26 envelope: `{ success:false, message, error:{ code } }` (validation adds `errors`).

Rules the UI should follow:

- **Which rides list:** rides with an assigned driver that are `accepted`/`arrived`/`started` (even with no messages: `last_message` null), plus `completed`/`cancelled` rides with messages that ended less than 24 h ago. `read_only_until` is null for an active ride, else the ISO time the chat disappears. A requested ride (no driver) is not listed; its messages endpoint returns 200 with `other_party: null`, `can_send: false`, no messages.
- **Composer:** show it only when `can_send` is true; after the ride ends show "read-only". A 409 `chat_closed` on send means the ride ended meanwhile: refresh and switch to read-only.
- **Paging:** first load without a cursor returns the latest page, oldest first (`has_more` = older messages exist; load them with `before_id=<first id shown>`). Polling with `after_id=<last_id>` returns newer messages oldest first (`has_more` = call again at once). Keep `last_id` from each response as the next cursor (it stays the same when nothing is new).
- **Sending:** generate a `client_id` (UUID) per message, show it optimistically, and resend with the same `client_id` on timeout or network error; match the POST response to the pending bubble by `client_id` (realtime events carry no `client_id`; de-duplicate them by `id`).
- **Read receipts:** when the thread is visible, POST `/read` with the highest received message id. `other_party_read_up_to_id` = the highest id of **your** messages the other party has read (show "Seen" up to it). Reading also clears the ride's `chat_message` notification once nothing is unread.
- **Requeue:** if a driver's cancel puts the ride back to `requested`, that driver loses access (403) and the next driver starts with an empty thread.
- **Notifications:** each new message keeps one unread notification per ride for the recipient in `GET /notifications`: `type: "chat_message"`, `title` and `message` both `"New message from <first name>"` (no preview of the text), `data: { ride_id, message_id, sender_first_name, unread_count }`. Tapping it opens the ride's thread. Push delivery comes with BE-11.

## BE-11: notifications list, push devices, preferences (2026-10-11, for T-502 / T-511)

Backend `fix/production-hardening` (uncommitted at time of writing). All routes: `auth:sanctum` + `active:active,pending` (pending drivers can register a device and read notifications). Envelope `{ success, message, data }`; validation 422 `{ success:false, message, errors }`; 404 `{ success:false, message, code: "NOT_FOUND" }`; 429 `{ success:false, message, code:"rate_limited", retry_after }`.

Notification item (`N`), the only shape `/notifications*` returns (no `created_by`, `target_user_ids`, `user_id`, `message` or `status`):

```json
{ "id": 12, "type": "driver_assigned", "category": "ride|promo|wallet|chat|system",
  "title": "Driver Assigned", "body": "Your ride has been accepted by Ali",
  "data": { "ride_id": 7 }, "image_url": null, "action_url": null, "action_text": null,
  "is_broadcast": false, "read_at": null, "created_at": "2026-10-11T12:00:00+00:00" }
```

- `type`: ride types `driver_assigned`, `driver_arrived`, `ride_started`, `ride_completed`, `ride_cancelled`, `new_ride_request`, `stop_added`, `stop_removed`, `stop_order_updated`, `arrived_at_stop`, `stop_completed`, `navigate_next_stop`; admin types `info`, `success`, `warning`, `error`, `promotion`, `announcement`; `payment_received`; `chat_message` (BE-13); wallet types (BE-73) `settlement_approved`, `settlement_rejected`, `wallet_adjusted`. Treat unknown types as `system`.
- **Driver notifications (BE-73):** `ride_completed` now also reaches the driver: title "Trip Completed", body "Trip completed. Collect Rs 1,500 in cash", `data: { ride_id, fare, payment_method, driver_earning, commission }` (strings, rupees; the passenger's row has only `fare`, `payment_method`). `settlement_approved`: "Commission Payment Approved" / "Your commission payment of Rs 500 was approved" (payout: "Payout Approved" / "Your payout of Rs 500 was approved"). `settlement_rejected`: "Commission Payment Rejected" / "Your commission payment of Rs 500 was rejected. Reason: <admin note>" (payout: "Payout Rejected" / "Your payout request of Rs 500 was rejected…"); the push body stops before ". Reason:". Settlement `data: { settlement_id, settlement_kind (commission_payment|payout), amount, review_note (rejected only) }`. `wallet_adjusted` (to any wallet owner): "Wallet Updated" / "Rs 1,500 was added to your wallet by Raah-e-Haq" (debit: "…was deducted from your wallet…"; refund: title "Refund Received", "…was refunded to your wallet by Raah-e-Haq"), `data: { direction (credit|debit|refund), amount }`; the admin's reason is never shown. Wallet pushes carry `settlement_id` when present. Open the wallet screen for `category: wallet`.
- `category`: `ride` (ride/stop types), `promo` (`promotion`), `wallet` (`payment_received`, `settlement_approved`, `settlement_rejected`, `wallet_adjusted`; push gated by `push_enabled` only), `chat` (`chat_message`), `system` (everything else). Use it for the filter tabs and the icon.
- `data` is always an object, a whitelist of ids/enums only: `ride_id`, `stop_id`, `message_id`, `unread_count`, `fare` (string PKR), `payment_method`, `requeued` (bool), `reason`, `cancelled_by` (`passenger|driver|admin`), and (BE-73) `driver_earning`, `commission`, `settlement_id`, `settlement_kind`, `amount`, `review_note`, `direction`. No names, phones or addresses (the BE-13 `sender_first_name` is not passed through; the name is in `title`). Navigate with `data.ride_id`.
- `is_broadcast`: true for an admin broadcast (to all users or the user's role). `created_at` is when it was sent. Broadcasts sent before the account was created are not listed.
- `body` is plain text (render as text).

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET `/notifications` | query `page` (≥1), `per_page` (1–50, default 20), `category` (`ride\|promo\|wallet\|chat\|system`), `unread` (`1`/`0`) | 200 `data: [N]` newest first, `pagination: {current_page, last_page, per_page, total}` | 401, 422 (bad per_page/category) |
| GET `/notifications/unread-count` | — | 200 `data: {unread_count}` (own rows + broadcasts not read by this user) | 401 |
| POST `/notifications/{id}/read` | — (id digits) | 200 `data: N` with `read_at` set (idempotent) | 404 `NOT_FOUND` for someone else's row or an unaddressed broadcast (no 403) |
| POST `/notifications/read-all` | — | 200 `data: {unread_count: 0}` | 401 |
| GET `/notifications/preferences` | — | 200 `data: {push_enabled, ride_updates, promotions, chat, sound_alerts}` (all `true` until saved) | 401 |
| PUT `/notifications/preferences` | any subset of the five booleans, e.g. `{promotions:false}` | 200 `data`: all five flags | 422 non-boolean or empty body; 429 (30/min) |
| POST `/devices` | `{ token: FCM token (20–512 chars, [A-Za-z0-9:_.-]), platform: "ios"\|"android" }` | 200 `data: {platform, last_seen_at}` | 422 `errors.token` / `errors.platform`; 429 (20/min, shared with DELETE) |
| DELETE `/devices/{token}` | — | 200 `data: null` (same answer if the token was not yours or unknown) | 401, 429 |
| POST `/auth/logout` | optional `{ device_token }` | unchanged; also removes that device | — |
| POST `/auth/logout-all` | — | unchanged; also removes all the user's devices | — |

Rules the app should follow:

- **Device token:** after sign-in (and on FCM `onTokenRefresh`, and on cold start while signed in) call POST `/devices`. It is an upsert: calling again just refreshes `last_seen_at`; a token registered by another account moves to the current one. The server keeps the newest 10 per user. On logout send `device_token` in POST `/auth/logout` (preferred: works even for a blocked account) or call DELETE `/devices/{token}` before logging out.
- **Push payload** (FCM `data`, all strings): `category`, `type`, `notification_id` (the list item id; mark it read on open), `ride_id` (ride events). `notification.title/body` match the list item, except for stop events (`stop_added`, `arrived_at_stop`, `stop_completed`, `navigate_next_stop`): their push body is generic text with no address (e.g. "A stop was added to your ride"), while the list item keeps the full text. Silent (no sound) when `sound_alerts` is false.
- **Preferences gate push only:** in-app rows are always written. `push_enabled:false` stops every push; `ride_updates` gates `ride`, `promotions` gates `promo`, `chat` gates `chat`; `wallet`/`system` only follow `push_enabled`. `sound_alerts` = sound on/off for pushes (and the driver app's local alert sound).
- **Who gets ride notifications:** the other party only. Driver accepts → passenger (`driver_assigned`); arrived/started/completed → passenger; driver cancels → passenger; passenger cancels → the assigned driver (nothing if no driver yet); admin assign/cancel → both.
- **Locally there are no FCM credentials:** registration works, pushes are skipped server-side (log warning). Production needs B-11 (service-account JSON) and a queue worker.

## BE-68: driver logout goes offline, drivers 18+, licence required (2026-10-11, for T-207)

Owner decisions 2026-10-11. Passengers are unaffected by all three.

**Logout sets a driver offline.** POST `/auth/logout`, POST `/auth/logout-all` and the web `POST /logout` set the driver's stored status to `offline` (response unchanged). A signed-out driver gets no ride requests (`GET /rides/pending` → 409 `DRIVER_NOT_AVAILABLE`, accept refused) until the app calls POST `/driver/status {status: online}` again after the next sign-in. The app should not rely on the driver's previous online state surviving a sign-out.
- **During an active ride** (accepted/arrived/started) logout is never refused and the ride is not touched: GET `/driver/status` still reports `on_ride` with `active_ride_id`, location posting and POST `/rides/{id}/arrived|start|complete` keep working after signing in again, and when the ride ends the driver is `offline` (not `available`). The app may still warn the driver before signing out mid-ride.
- Logout on one device takes the driver offline for every device (status is per account).

**Drivers must be 18+.** For `user_type=driver`, `date_of_birth` must be on or before today − 18 years (server date; the 18th birthday passes). Otherwise 422 with `errors.date_of_birth[0] = "Drivers must be at least 18 years old."`. Applies to POST `/auth/register` (and the web register form), admin create/edit (web admin and `POST/PUT /api/users`, also when the driver role is added to an account whose stored date is under 18), and PUT `/profile` for a driver changing their own `date_of_birth`. Passengers: only the existing `before:today` rule.

**Driving licence required.** POST `/auth/register` for a driver now requires `license_image` (image, jpeg/png/jpg/gif, ≤ 5 MB) in addition to `license_number`: missing either → 422 `errors.license_image` / `errors.license_number` (the request must be multipart, `registerWithImages`). The other driver images stay optional on the API. `license` is in the default `DRIVER_REQUIRED_DOCUMENTS` (`profile,cnic_front,cnic_back,license`), so an account is approved only once its licence item is approved; already-approved drivers are not affected.

## BE-09 / BE-08: wallet ledger, settlements, personal stats, driver earnings (2026-10-11, for T-508 / T-506 / T-507)

Backend `fix/production-hardening` (uncommitted at time of writing). All routes: `auth:sanctum` + `active`. Everything is scoped to the token user: no id in a path or body selects someone else's wallet; another user's entry or request is a **404 `NOT_FOUND`** (never 403). Envelope `{ success, message, data, pagination? }`; errors `{ success:false, message, error:{ code }, errors? }` (validation: 422 `VALIDATION_ERROR` with `errors`). Money is **PKR as JSON numbers** (at most 2 decimals; `58` and `58.5` both occur, never strings). Throttles: wallet reads 60/min, settlement create 10/min, cancel 10/min, stats 30/min (429 `rate_limited`).

**Cash only (B-08).** *Updated by BE-74 (2026-10-13): rides stay cash, but wallet top-up through JazzCash / Easypaisa now exists; see "BE-74: wallet top-up" below. `can_top_up` is true when a provider is enabled.* There is no top-up, no card and no gateway route; `can_top_up` is always `false` and `payment_methods` is `["cash"]`. Show "Rides are paid in cash to the driver". A passenger's balance only moves with referral rewards and admin credits/refunds; it is shown, it cannot pay for a ride.

**Driver commission.** Each completed cash ride writes three ledger entries: the passenger's `ride_payment` (no balance change), the driver's `driver_earning` (no balance change: the driver already holds the cash) and the driver's `commission_due` (the platform commission, **taken off the balance**). So a driver's `balance` goes negative; `commission_owed = max(0, -balance)`. The driver settles by paying the platform (cash at the office or bank transfer) and reporting it with POST `/wallet/settlements`; an admin approves it and a `commission_payment` entry brings the balance back up.

### GET `/wallet`

200 `data`:

```json
{ "balance": -116, "currency": "PKR", "status": "active|suspended|blocked",
  "commission_owed": 116, "available_balance": 0,
  "total_spent": 0, "total_earnings": 464,
  "pending_settlements": [S],
  "payment_methods": ["cash"], "can_top_up": false,
  "can_request_payout": false, "can_settle_commission": true,
  "updated_at": "2026-10-11T09:00:00+00:00" }
```

- Created (zero) on first call if missing; also created at registration.
- `total_spent` = cash ride payments (passenger), `total_earnings` = driver's share of completed cash rides; both exclude reversed entries.
- `available_balance` = `max(0, balance)` minus pending payout requests (what a payout request may ask for).
- `can_request_payout`: driver, payouts enabled, wallet active. `can_settle_commission`: driver with `commission_owed > 0`. Passengers: both false.

### GET `/wallet/transactions`

Query (all optional): `page` (≥1), `per_page` (1–50, default 20), `type` (one type or a comma list from the table below), `direction` (`credit|debit|none`), `from` / `to` (`YYYY-MM-DD`, UTC dates, `to` ≥ `from`), `ride_id`. Newest first. 200 `data: [T]`, `pagination: {current_page, last_page, per_page, total}`. 422 for an unknown type, bad date or per_page.

Entry (`T`):

```json
{ "id": 812, "reference": "TXN-01JA…", "type": "commission_due", "label": "Platform Commission",
  "direction": "debit", "amount": 58, "gross_amount": 58, "fee": 0, "net_amount": 58,
  "balance_change": -58, "balance_after": -116, "currency": "PKR", "status": "completed",
  "payment_method": "cash|wallet|bank_transfer", "description": "Platform commission for ride RH…",
  "ride": { "id": 7, "ride_id": "RH…", "status": "completed", "vehicle_type": "car", "completed_at": "…" } | null,
  "settlement_id": null, "reverses_id": null, "reversed": false, "created_at": "2026-10-11T09:00:00+00:00" }
```

- Show `amount` on the row. `direction` `credit` (green, +), `debit` (red, −), `none` (informational, neutral: a cash payment or cash earning that did not change the balance). `balance_change` is signed. `balance_after` is null on entries written before BE-09.
- `driver_earning`: `gross_amount` = fare, `fee` = platform commission, `net_amount` = `amount` = the driver's share.
- `reversed: true` means a later `reversal` entry cancelled this one (strike it through); a `reversal` carries `reverses_id` and the original's `ride`.
- No names, phones, admin ids or admin notes are ever returned; `description` is display text.

| `type` | Who | Balance | Meaning |
|---|---|---|---|
| `ride_payment` | passenger | none | Cash paid for a ride |
| `driver_earning` | driver | none | Cash collected; `amount` = driver share |
| `commission_due` | driver | − | Platform commission of a ride |
| `commission_payment` | driver | + | Admin-approved "I paid the commission" |
| `payout` | driver | − | Admin-approved payout of a positive balance |
| `referral_reward` | any | + | Referral reward credited |
| `refund` | any | + | Refund by support |
| `adjustment_credit` / `adjustment_debit` | any | + / − | Balance adjustment by support |
| `reversal` | any | ∓ | Cancels the entry `reverses_id` |
| `opening_balance` | any | + / − | BE-70: the balance the wallet had before the ledger (at most one per wallet, dated before its first entry). Label "Opening Balance" |
| `wallet_topup`, `wallet_withdrawal`, `bonus`, `commission`, `penalty` | legacy | +/− | Written before BE-09; show with `label` |

Treat an unknown `type` as generic and use `label`.

### GET `/wallet/transactions/{id}`

200 `data: T`. 404 `NOT_FOUND` when it is not the caller's (or not numeric).

### Driver settlements (role driver; passengers 403)

Settlement (`S`):

```json
{ "id": 3, "kind": "commission_payment|payout", "amount": 116, "currency": "PKR",
  "method": "cash|bank_transfer", "reference": "IBFT-123"|null, "note": "…"|null,
  "status": "pending|approved|rejected|cancelled|reversed", "review_note": "…"|null,
  "reviewed_at": "…"|null, "transaction_id": 901|null, "reversed_at": "…"|null, "created_at": "…" }
```

- BE-70: `reversed` = an approved settlement whose ledger entry support later reversed (`reversed_at` set; the matching `reversal` entry is in the history and the balance is back where it was). Show it like `rejected` ("Reversed by support"). Treat any other unknown status as generic.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET `/wallet/settlements` | `status?`, `page`, `per_page` (1–50) | 200 `data: [S]` + `pagination` | 403 |
| POST `/wallet/settlements` | `{ kind?: "commission_payment" (default) \| "payout", amount: number (1–500000, ≤2 decimals), method: "cash"\|"bank_transfer", reference?: string ≤100 [A-Za-z0-9 ._:/#-] (required for bank_transfer), note?: string ≤500 }` | 201 `data: S` (status `pending`, nothing posted yet) | 409 `NOTHING_OWED`, 422 `AMOUNT_EXCEEDS_OWED` (commission > owed now), 422 `AMOUNT_EXCEEDS_BALANCE` (payout > balance), 409 `SETTLEMENT_ALREADY_PENDING` (one pending per kind), 403 `PAYOUTS_DISABLED`, 409 `WALLET_INACTIVE` (payout from a suspended wallet), 422 `VALIDATION_ERROR`, 429 |
| DELETE `/wallet/settlements/{id}` | — | 200 `data: S` (status `cancelled`) | 404 (not yours), 409 `SETTLEMENT_NOT_PENDING` |

- Pre-fill the amount with `commission_owed`. After 201 show "waiting for review"; `GET /wallet` lists it under `pending_settlements`. On approval the balance changes and a `commission_payment` / `payout` entry appears (`settlement_id` = S.id). On rejection `review_note` holds the admin's reason (show it).
- Approval is re-checked against the balance at that moment; an admin cannot approve more than is owed.

### GET `/me/stats` (BE-08)

Role-aware, from completed rides, cached up to 5 min per user (cleared when the user's ride completes or their wallet changes). Zeros, never nulls, for counts and money. `rating` is `null` until the user has been rated (show "New").

Passenger:

```json
{ "role": "passenger", "currency": "PKR", "total_rides": 48, "total_distance_km": 312.4,
  "total_spent": 15230, "rating": null, "member_since": "2025-01-02T08:00:00+00:00" }
```

Driver:

```json
{ "role": "driver", "currency": "PKR", "total_rides": 33, "total_earnings": 9800, "total_distance_km": 410.2,
  "rating": 4.75, "member_since": "…",
  "earnings_today": 400, "trips_today": 2, "earnings_week": 480, "trips_week": 3,
  "earnings_month": 2468, "trips_month": 12,
  "commission_owed": 116, "online_minutes_today": null, "acceptance_rate": null }
```

- Day / week (Monday–Sunday) / month are calendar periods in **Asia/Karachi**.
- `online_minutes_today` and `acceptance_rate` are always `null` for now (not tracked server-side): hide those tiles rather than showing 0.

### GET `/driver/earnings?period=day|week|month` (role driver; passengers 403)

Query: `period` (default `day`), `page`, `per_page` (1–50, default 20; pages the `rides` list only). 422 for any other period.

```json
{ "period": "week", "timezone": "Asia/Karachi",
  "from": "2026-10-12T00:00:00+05:00", "to": "2026-10-18T23:59:59+05:00", "currency": "PKR",
  "totals": { "trips": 2, "gross_fares": 400, "commission": 80, "earnings": 320, "distance_km": 5, "duration_minutes": 30 },
  "series": [ { "date": "2026-10-12", "trips": 0, "gross_fares": 0, "earnings": 0 }, … ],
  "rides": [ { "id": 7, "ride_id": "RH…", "vehicle_type": "car", "completed_at": "…", "distance_km": 3,
               "duration_minutes": 15, "total_fare": 300, "platform_commission": 60, "driver_earnings": 240,
               "payment_method": "cash" } ],
  "pagination": { "current_page": 1, "last_page": 1, "per_page": 20, "total": 2 } }
```

- `series` has one item per local day of the period (1, 7 or 28–31), zero-filled: chart it directly.
- `rides` has no passenger data.

### Admin API (role admin; for the panel and tooling, not the app)

`GET /payments/settlements?status=&kind=&user_id=`, `POST /payments/settlements/{id}/approve {note?}`, `POST /payments/settlements/{id}/reject {note}` (required), `POST /payments/transactions/{id}/reverse {reason}` (required; 409 `ALREADY_REVERSED`, `CANNOT_REVERSE_REVERSAL`, BE-70: 409 `NOT_REVERSIBLE` for `opening_balance`, 422 `REVERSAL_NEGATIVE_BALANCE` when it would take a non-driver below zero), `POST /payments/wallets/{id}/adjust {amount, direction: credit|debit|refund, reason}` (reason now **required**; 422 `INSUFFICIENT_BALANCE` for a debit below zero; BE-70: optional header `Idempotency-Key` (8–100 of `A-Za-z0-9._:-`), a retry with the same key returns the first entry with header `Idempotent-Replayed: true`, same key with another amount/direction 409 `IDEMPOTENCY_KEY_REUSED`). BE-70: `DELETE /users/{id}` answers 409 `USER_HAS_WALLET_HISTORY` (wallet entries, settlements or a non-zero balance) or `USER_HAS_LINKED_RECORDS`; deactivate such accounts instead. Every one writes an `audit_logs` row. The old panel action that edited a transaction's status is removed (ledger entries are immutable).

## BE-14: saved places / favourites (2026-10-13, for T-509)

Backend worktree `rh-backend-be-14`, branch `be-14-saved-places` (not merged into `fix/production-hardening` yet). All routes: `auth:sanctum` + `active`. Own rows only: another user's id (or a missing one) answers **404** `{success:false, message:"Not found.", code:"not_found"}`, never 403. `user_id` in a body is ignored.

Place object (`SP`), no owner or user fields:

```json
{ "id": 3, "label": "home|work|other", "name": "Gym"|null, "address": "House 12, DHA Phase 5, Lahore",
  "lat": 31.4627, "lng": 74.4085, "place_id": "ChIJ…"|null, "sort_order": 0, "updated_at": "2026-10-13T12:00:00+00:00" }
```

- `name` is **null for home and work** (show the localised "Home"/"Work"); required for `other`.
- At most **one home and one work** per user. `POST` with `label: home|work` when one exists **replaces** it in place (same `id`, 200, `data.replaced: true`, `place_id` reset unless sent). Changing another place's label to a taken home/work with `PUT` is a 422 on `label`.
- At most `max_other` (10) `other` places; the 11th is a 422 on `label`.
- List order: home, work, then others by `sort_order`, `id`. New others go to the end.
- `outside_service_area: true` when lat/lng is outside a rough Pakistan box (23.5–37.1 N, 60.8–77.9 E). The place is still saved: show a soft warning if you like.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET `/saved-places` | — | 200 `data: { places: [SP], max_other: 10 }` | 401, 429 (60/min) |
| POST `/saved-places` | `{ label, name? (required for other, ≤40), address (≤255), lat (−90..90), lng (−180..180), place_id? (≤255, [A-Za-z0-9_-]), sort_order? (0..1000) }` | 201 new / 200 replaced home-work: `data: { place: SP, replaced, outside_service_area }` | 401, 422 `errors.<field>` (control characters in name/address are refused), 429 (30 writes/min) |
| PUT `/saved-places/{id}` | any subset of the POST fields | 200 `data: { place: SP, replaced: false, outside_service_area }`. Changing `address`/`lat`/`lng` without sending `place_id` clears the stored `place_id` | 401, 404, 422 (`label` taken or cap, `name` null for other), 429 |
| DELETE `/saved-places/{id}` | — | 200 `data: null` | 401, 404, 429 |

"Set as pickup / destination" is app-side: use `lat`, `lng`, `address` (and `place_id` if present) as the ride point. Local seed: `passenger@raah-e-haq.com` has a Home (DHA Phase 5) and a Work (MM Alam Road, Gulberg III) in Lahore.

## BE-74: wallet top-up via JazzCash / Easypaisa (2026-10-13, for T-515)

Backend `fix/production-hardening` (uncommitted at time of writing). Owner decision 2026-10-13: users add money to their wallet like inDrive. **Rides stay cash-paid** (`payment_methods` stays `["cash"]`); a top-up only credits the wallet. For a driver it lowers `commission_owed` (= `max(0, -balance)`), so a driver with Rs 300 owed who tops up Rs 500 ends at balance 200, owed 0. Passengers and drivers can both top up. Envelope and error shape as BE-09. Amounts in requests are **whole rupees**; in responses PKR JSON numbers.

Providers: `jazzcash`, `easypaisa` (real; off until the owner sets merchant credentials, B-18) and `fake` (a test gateway that exists **only on a local/testing backend**: use it for QA on the simulator). Always build the provider list from GET `/wallet` `data.top_up.providers`; never hardcode it.

Methods:
- `mwallet`: the customer types their JazzCash / Easypaisa mobile account number; the provider pushes an approval prompt to their phone. No browser. Poll for the result.
- `card`: the provider's hosted checkout page (card, and on Easypay the wallet too) opened in an **in-app browser**; the backend ends the flow by redirecting the browser to `raahehaq://wallet/topup?id=<id>&status=<status>` (config `PAYMENTS_APP_RETURN_URL`). The app must register the `raahehaq` URL scheme (iOS `CFBundleURLSchemes`, Android intent filter): **there is none today**. With `react-native-inappbrowser-reborn` use `openAuth(url, return_url)`; with a WebView, intercept navigation to `return_url`. Whatever the browser reports, **the status comes from GET `/wallet/topups/{id}`** (the redirect is only a "come back" signal).

### GET `/wallet` additions

```json
"can_top_up": true,
"top_up": { "providers": [ { "id": "jazzcash", "name": "JazzCash", "methods": ["mwallet", "card"] } ],
            "min_amount": 100, "max_amount": 25000, "daily_cap": 50000, "daily_remaining": 49500, "currency": "PKR" }
```

`can_top_up` = wallet active and at least one provider enabled. `daily_remaining` = cap minus today's (Pakistan day) succeeded + still-open top-ups. Hide "Add money" when `can_top_up` is false. Local backend shows `[{ "id": "fake", "name": "Test gateway", "methods": ["mwallet","card"] }]`.

### Top-up object (`TU`)

```json
{ "id": "top_01k7…" , "provider": "jazzcash|easypaisa|fake", "method": "mwallet|card",
  "amount": 500, "currency": "PKR",
  "status": "created|pending|succeeded|failed|expired|cancelled",
  "mobile_number": "0300*****67" | null,
  "failure": null | { "code": "EXPIRED|AMOUNT_MISMATCH|<provider code>", "message": "The payment did not go through. No money was taken from your wallet." },
  "transaction_id": "TXN-01K7…" | null,
  "created_at": "…", "expires_at": "…", "completed_at": "…" | null }
```

- `id` is an opaque string (`top_` + 26 chars). Treat as opaque.
- Terminal: `succeeded`, `failed`, `expired`, `cancelled` (reserved, not set today). Open: `created`, `pending`. Show `failure.message` as is.
- A top-up expires 15 minutes after creation (+10 minutes grace before it is marked `expired`). Until then it still counts as open (3 at once) and toward `daily_remaining`.
- An unknown provider answer keeps it `pending` (only an explicit failure makes it `failed`). A provider "paid" without a confirmed amount is never credited; it stays `pending` until confirmed or expired.
- Rarely a `failed`/`expired` top-up turns `succeeded` later (the customer paid late; the server re-checks for up to 24 h). The wallet history and a `topup_succeeded` notification show it.
- `succeeded` means the wallet was credited exactly once; the ledger entry is `transaction_id` and appears in `/wallet/transactions` with `type: "topup"`, `label: "Wallet Top-up"`, `direction: "credit"`, `payment_method: "jazzcash|easypaisa|wallet"` (fake books as wallet) and new field **`topup_id`** (the `TU.id`; null on other entries).

### POST `/wallet/topups`

Request: `{ "amount": 500, "provider": "jazzcash", "method": "mwallet", "mobile_number": "03001234567", "cnic_last6": "123456" }`

- `amount`: integer rupees, `min_amount`..`max_amount` (100..25,000).
- `mobile_number`: required for `mwallet`; Pakistani mobile in any usual form (`03XX…`, `+92 3XX…`). Never shown back in full.
- `cnic_last6`: **required for JazzCash `mwallet`** (6 digits; JazzCash API v2.0 needs it). Not stored.
- Header `Idempotency-Key` (8–100 of `A-Z a-z 0-9 . _ : -`), **recommended**: generate one per "Pay" tap and resend it on retry/timeout. Same key + same body → 200 with the first top-up and header `Idempotent-Replayed: true`; same key, different body → 409 `IDEMPOTENCY_KEY_REUSED`.

201 `data: TU + next_action`:

| `next_action.type` | When | App does |
|---|---|---|
| `redirect` | `card`, status `created` | open `next_action.url` (a signed `https` link to our checkout page, valid until `expires_at`) in the in-app browser; close it when it navigates to `next_action.return_url`; then poll |
| `poll` | `mwallet` (status `pending`), or a card top-up already opened | show `next_action.message` ("Approve the payment in your JazzCash app or the prompt on your phone."), poll GET `/wallet/topups/{id}` every `poll_interval_seconds` (3) until terminal or `expires_at` passes |
| `none` | terminal | show result |

The MWALLET push is sent **after** the 201 is returned, so POST answers fast; the result arrives by polling (typically 10–60 s while the customer approves).

Errors: 422 `VALIDATION_ERROR` (`errors.amount|provider|method|mobile_number|cnic_last6|idempotency_key`); 422 `PROVIDER_UNAVAILABLE` (provider not enabled); 422 `METHOD_UNAVAILABLE`; 422 `DAILY_LIMIT_REACHED`; 409 `TOO_MANY_OPEN_TOPUPS` (3 open at once); 409 `WALLET_INACTIVE`; 409 `IDEMPOTENCY_KEY_REUSED`; 401; 429 (10 creates/min).

### GET `/wallet/topups/{id}`

200 `data: TU + next_action`. Own top-ups only: anyone else's (or an unknown id) is **404 `NOT_FOUND`**. While open, the server asks the provider at most every 20 s per top-up, so polling every 3 s is fine. 429 above 60/min.

### GET `/wallet/topups`

Query `status?`, `page?`, `per_page?` (1–50, default 20). Newest first. 200 `data: [TU]` (no `next_action`), `pagination`. 422 on a bad status.

### Notifications (category `wallet`)

- `topup_succeeded`: title "Money Added", message "Rs 500 added to your wallet"; `data: { topup_id, provider, amount: "500" }`; push data `{ notification_id, type, topup_id }`.
- `topup_failed`: title "Top-up Failed", message "Your top-up of Rs 500 did not go through. No money was added."; same data. Not sent for expiry.
Route both to the wallet screen (T-514 routing of category `wallet`).

### Local QA with the fake gateway (local backend only)

- `card`: the checkout page shows **Pay** / **Decline**; Pay credits the wallet and redirects to `raahehaq://wallet/topup?id=…&status=succeeded`.
- `mwallet`: the number decides: ending `0000` → declined, ending `9999` → stays pending until it expires, anything else → paid on the first poll.

### Not in this release

Refunds (an admin reverses the ledger entry; the money goes back through the provider's portal); paying rides from the wallet; saved cards.

## BE-07: ride rating (2026-10-13, for T-505)

Two-way rating after a completed ride: the passenger rates the driver, the driver rates the passenger. Backend branch `be-07-rating` (merges into `fix/production-hardening`). Rules and tags live in `config/ratings.php`.

### GET `/rating-tags`

Auth (any active user). 200:

```json
{ "success": true, "message": "Rating tags", "data": {
  "window_days": 7, "max_tags": 5, "max_comment_length": 500,
  "positive_min_stars": 4, "negative_max_stars": 4,
  "tags": {
    "passenger": { "positive": [{ "key": "clean_car", "label": "Clean car" }, ...], "negative": [{ "key": "rude", "label": "Rude" }, ...] },
    "driver":    { "positive": [...], "negative": [...] }
  } } }
```

`tags` is keyed by the **rater's** role: `tags.passenger` = what a passenger can say about the driver, `tags.driver` = what a driver can say about the passenger. Show `positive` tags when `stars >= positive_min_stars` and `negative` tags when `stars <= negative_max_stars` (4 stars shows both). Send `key`s, display `label`s. Don't hardcode the lists; fetch once per session. 429 above 60/min.

### POST `/rides/{id}/rate`

Body (JSON only); the rater and ratee come from the token and the ride, nothing else in the body is read:
- `stars`: required, a JSON integer 1..5 (`integer:strict`). `5.0`, `"5"`, `"+5"` and `" 5"` get 422.
- `tags`: optional list of keys, at most `max_tags`, distinct, each at most 64 chars, from the band allowed for this role and star count. When `stars` is invalid, every tag is refused too.
- `comment`: optional, at most 500 chars, line breaks allowed (`\r\n` is stored as `\n` and counts as one character), blank becomes `null`.

201:
```json
{ "success": true, "message": "Thanks for your rating",
  "data": { "my_rating": { "stars": 5, "tags": ["clean_car"], "comment": "Great ride", "created_at": "2026-10-13T12:00:00.000000Z" }, "can_rate": false } }
```

Errors (`{ success:false, message, error:{code} }`), checked in this order:
- 401 no token; 404 unknown ride id.
- 403 `NOT_RIDE_PARTICIPANT`: not the ride's passenger or assigned driver (admins too). Checked before validation.
- 422 `RIDE_NOT_COMPLETED`: status is not `completed`.
- 422 `RATING_WINDOW_CLOSED`: more than `window_days` (7) after `completed_at`.
- 409 `ALREADY_RATED`: this side already rated this ride (one rating per side, no edits).
- 422 validation (`{ success:false, message, errors }`, no `error.code`; tell it apart from the two coded 422s above by the missing code) with `errors.stars | tags | tags.N | comment` (tag not allowed for this role/star band, duplicate, too many, control characters in comment, ...).
- 429 above 10/min.

On success the ratee's `users.rating` becomes the mean of their last 500 received ratings (2 decimals) and `users.rating_count` the number received. The aggregate is shown **only once the user has received 3 ratings** (`config ratings.min_public_count`); below that it is `null` on the ride cards (`driver.rating`, `passenger.rating`, 1 decimal), on `GET /profile` (`rating` is now a number or `null`, it was a `"0.00"` string) and in `/me/stats`. Nearby drivers (`rides/nearby-drivers`) show `0` in that case (0.5 steps as before). The app shows "New" for `null` or `0`. `/me/stats` is refreshed right after a new rating (cache dropped).

### Ride resources: `my_rating`, `can_rate`

Every ride object (`GET /rides`, `GET /rides/{id}` which is the status poll, lifecycle responses such as `POST /rides/{id}/complete`, pending feed) now has:

- `my_rating`: the caller's own rating of this ride `{ stars, tags, comment, created_at }` or `null`.
- `can_rate`: `true` when the caller is the passenger or assigned driver, the ride is `completed`, it is within the window, and the caller hasn't rated it yet.

The other side's rating of the caller is never returned per ride (only the aggregate `rating` on the user). Admin API callers always get `my_rating: null`, `can_rate: false`.

App use (T-505): after the ride turns `completed` (poll or the driver's complete response), show the rating sheet when `can_rate` is true; in ride details / history show `my_rating` or a "Rate this trip" action while `can_rate` is true. Treat 409 `ALREADY_RATED` and 422 `RATING_WINDOW_CLOSED` as "close the sheet and refresh the ride", not as an error toast.

Admin web: the ride detail page lists both ratings (stars, tags, comment). No notification is sent; no tip.
