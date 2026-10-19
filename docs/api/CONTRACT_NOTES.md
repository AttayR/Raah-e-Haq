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
| POST `/profile/phone` | yes | yes (T-504b) | `requestPhoneChange` (ChangePhoneScreen) | BE-35. Bearer; `{phone}` sets `pending_phone` and texts a code (also resends). PUT `/profile` no longer changes the phone |
| POST `/profile/phone/verify` | yes | yes (T-504b) | `verifyPhoneChange` | BE-35. Bearer; `{otp_code}` → 200 phone switched; wrong code 422 (never 401) |
| DELETE `/profile/phone/pending` | yes | yes (T-504b) | `cancelPhoneChange` | BE-35. Bearer; clears `pending_phone` and its live code; also cleared by re-sending the current number to PUT /profile or POST /profile/phone |
| POST `/auth/send-otp` | yes | yes | `sendOtp` | BE-27: same generic 200 whether or not the phone is registered (no 404). BE-28: 429 `otp_cooldown`/`otp_send_limit`/`otp_ip_limit` + `retry_after`; 503 `sms_unavailable` (daily SMS budget) or `busy` + `retry_after`; non-PK numbers 422. `otp_code` null outside local |
| POST `/auth/verify-otp` | yes | yes | `verifyOtp` | 401 `Invalid or expired OTP` (never a session expiry). BE-28: 429 `code_exhausted` (+ `retry_after` until a new code can be sent) or `otp_verify_limit`. `data: {user, token, token_type, expires_at}` |
| POST `/auth/forgot-password` | yes | yes | `forgotPassword` | |
| POST `/auth/reset-password` | yes | yes | `resetPassword` | |
| POST `/auth/logout` | yes | yes | `logout` | BE-43: 200 for any authenticated token, including blocked (suspended/rejected/inactive/pending) accounts; deletes the presented token. `logout-all` deletes all of the user's tokens. 401 only for a missing/invalid token. The app still clears local state whatever the result |
| POST `/auth/logout-all` | yes | yes | `logoutAll` | BE-68: both logouts also set a driver offline (see BE-68 section) |
| POST `/auth/refresh` | yes | yes | not called | Bearer, no body; rotates the token (the old one is revoked; a racing second refresh gets 401) and returns `{token, token_type, expires_at}`. T-104 removed the dead `refresh_token` interceptor branch and the unused thunk; see "Session and 401" |
| GET `/auth/profile` | yes | yes | `getProfile`, `initializeAuth` (cold-start check, T-103) | `data: {user}` (normalised: `role`, `roles[]`) |
| PUT `/profile` | yes | yes | `updateProfile` | **Path fixed in T-007** (the app called `PUT /auth/profile`, which does not exist). `data` is the raw user model with a `roles` relation, not `{user}`. Resource shape is BE-29; normalizeUser is T-105. T-504b: ProfileEditScreen sends only the changed fields, never `phone`; the email only when the user changed it (+ `current_password` for a new address); AccountChecks' "Cancel change" sends the current email. BE-101 / T-550: `address` and `country` are `nullable|string` (max 500 / 100); the app sends `address: null` when the user empties a saved address (no more "can't be removed" block); name, email and date of birth still cannot be cleared. No global auth status/error |
| POST `/profile/email/resend-confirmation` | yes | yes (T-504b) | `resendEmailConfirmation` (AccountChecks, after the BE-44 warning) | BE-40. Same answer whether or not a mail went out; 429 after 3 in 10 min |
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
- **Push payload** (FCM `data`, all strings): `category`, `type`, `notification_id` (the list item id; mark it read on open), `ride_id` (ride events), and since BE-93 `ride_status` (ride events) and `requeued` (`"true"`/`"false"`, `ride_cancelled` only; see "BE-91 / BE-93" below). `notification.title/body` match the list item, except for stop events (`stop_added`, `arrived_at_stop`, `stop_completed`, `navigate_next_stop`): their push body is generic text with no address (e.g. "A stop was added to your ride"), while the list item keeps the full text. Silent (no sound) when `sound_alerts` is false.
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
| `goodwill_refund` | any | + | BE-91: an admin's goodwill refund, not cash-backed (label "Refund"; the app shows it as a refund) |
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
- `online_minutes_today` is tracked from BE-124 (driver online sessions): whole minutes online today (Asia/Karachi), `null` only for a driver with no session yet (hide the tile then); `0` is a real value. `/me/stats` is cached up to 5 minutes. `acceptance_rate` is still always `null` (hide it).

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

## BE-75: top-up late-success hardening (2026-10-13)

No app-facing change. Server rules only:

- A failed or expired top-up (within `TOPUP_LATE_RECHECK_HOURS`, default 24 h, and not `AMOUNT_MISMATCH`) is re-asked from the provider at most once per `TOPUP_LATE_RECHECK_MIN_SECONDS` (60 s) when an Easypaisa return / IPN arrives, and at most `TOPUP_LATE_RECHECK_MAX` (10) times per top-up (`meta.late_inquiries`). Open top-ups keep the old 5 s floor.
- A signed success (JazzCash return / IPN, or any verified success) for a failed/expired top-up follows the same rule: inside it, credited (`meta.late_success`); outside it, **not credited**, the top-up keeps its status and gets `meta.needs_review` (+ `review_reason`: `success_after_late_window` or `success_after_amount_mismatch`). The provider still gets its normal signed acknowledgement; the browser return goes to the app with the unchanged status (`failed` / `expired`).
- Admin: `GET /payments/topups?needs_review=1` and a "Needs review" filter and badge on the admin top-ups page. The owner settles these by hand (manual credit or provider refund).

## BE-76: heading on nearby drivers (2026-10-13, for T-517)

`GET /rides/nearby-drivers` items gain `heading`: integer degrees `0..345` in 15° steps (0 = north, clockwise), from the same bucketed ping as `location`. `null` when the driver's device sent no heading, the speed is unknown or below 1 m/s (standing still), or the ping is older than 5 min. Speed itself is never sent. App: rotate the vehicle marker by `heading`; when `null`, keep the marker's last rotation (or 0 for a new marker).

## BE-77: driver first name only (2026-10-13, found in T-519)

The ride `driver` card (`GET /rides`, `GET /rides/{id}`, lifecycle responses) now carries `name` = the driver's **first name** and a new `first_name` (same value), like the `passenger` card. The `driver_assigned` notification reads "Your ride has been accepted by <first name>" and its `data.driver_name` is the first name and `data.driver_rating` is the public rating (one decimal, `null` below `ratings.min_public_count`, as in the ride resources; it was the raw rating, `0` when unrated). The same applies to admin-panel assignments. Chat `other_party.first_name` was already first-name only. Admin API callers still get the full driver record. App: no change needed if it already shows `driver.name`; prefer `driver.first_name`.

## BE-78: no phone numbers between rider and driver; masked call or chat only (2026-10-14, for T-520)

**Breaking for the app:** the ride `driver` and `passenger` cards (`GET /rides`, `GET /rides/{id}`, `POST /rides/{id}/assign-driver`, lifecycle responses, the pending feed) **no longer carry `phone`**, in any status and for either side (the passenger's own card too; the own number is in `GET /profile`). Chat, `GET /chats`, notifications and push data never carried one. Admin API callers still get the full user record. Remove every `tel:` link built from `driver.phone` / `passenger.phone`.

New on every ride object for its passenger and assigned driver (`null` for anyone else, admins included):

```json
"contact": { "can_chat": true, "can_call": false, "call_mode": "chat_only", "closes_at": null }
```

- `can_chat`: chat send is open. `can_call`: show a Call button (`call_mode` is `proxy`). `call_mode`: `proxy` when a telephony provider is configured, else `chat_only`.
- `closes_at`: ISO time contact closes for the caller, `null` while the ride is active. Contact (chat send and call) is open while the ride is `accepted` / `arrived` / `started`, then for **30 min** (`RIDES_CONTACT_WINDOW_MINUTES`):
  - after `completed`: both sides;
  - after `cancelled`: **only the passenger**, and only when the driver had reached the pickup (`arrived`/`started`). The driver can never start a chat or call after a cancel. A cancel before arrival closes contact for both at once (`closes_at` = the cancel time).

`POST /rides/{id}/call` (no body; throttle 6/min per user):
- 200 `{ data: { mode: "proxy", number: "+9221xxxxxxx", expires_at, contact_closes_at } }`: dial `number` with `tel:`. It bridges to the other party; neither side sees the other's real number. Valid until `expires_at` (30 min, never past `contact_closes_at`). Repeat taps return the same number while valid. Sessions are revoked with the provider at once on any cancel, a driver requeue, an admin reassignment, and when the window closes (scheduler `raahehaq:calls-revoke-closed` every 5 min, and on the next refused call). After a revoke the number stops bridging: on a failed call, ask `POST /call` again.
- 200 `{ data: { mode: "chat_only", contact_closes_at } }`: no provider (the default until owner item B-19); open the chat instead. A provider error also answers `chat_only`.
- 403 `NOT_RIDE_PARTICIPANT`; 409 `CONTACT_NOT_OPEN` (no driver yet); 403 `CONTACT_CLOSED` (more than 30 min after the end); 429.

Chat send change (BE-13): `POST /rides/{id}/messages` now **works for 30 min after the ride ends** (per the rules above; after a cancel only the passenger, and only past arrival) (it used to close at the end with 409 `chat_closed`). After the window: **403 `CONTACT_CLOSED`** (was 409 `chat_closed`). `GET /rides/{id}/messages` and `GET /chats` rows gain `contact_closes_at`; `can_send` follows the window. Reading stays open for 24 h as before (then 410 `chat_expired`).

Locally `TELEPHONY_DRIVER=fake` hands out made-up `+9221…` numbers (local/testing only, never dials).

## BE-79: SOS and emergency contacts (2026-10-14, for T-520)

Emergency contacts (own rows only; another user's id is 404; max 3):
- `GET /me/emergency-contacts` → `{ contacts: [{ id, name, phone, created_at, updated_at }], max: 3 }`
- `POST /me/emergency-contacts {name, phone}` → 201 `{ contact }`. Two parallel saves of the same number: the second gets 422 `errors.phone` (never a 500). `phone`: a Pakistani mobile in any common form (`0300 1234567`, `+923001234567`), stored and returned as E.164. 422 field errors for a bad name (letters only, 2-60), a non-PK-mobile, a duplicate or the user's own number; 422 `EMERGENCY_CONTACTS_LIMIT` at 3.
- `PUT /me/emergency-contacts/{id} {name?, phone?}` → `{ contact }`; `DELETE /me/emergency-contacts/{id}`.
- Throttle 20/min for writes.

`POST /rides/{id}/sos {latitude?, longitude?, accuracy?, note?}` by the ride's passenger or assigned driver, while the ride is active or ended less than 30 min ago (throttle 5/min per user). Send the phone's current position when you have it.
- 201 (new) or 200 (same reporter, same ride, within 2 min: the same incident, no second alert), `data`:
  - `created` (bool), `incident: { id, status: "open"|"acknowledged"|"resolved", created_at }`
  - `emergency_numbers: [{ key: "police", label, number: "15" }, { key: "rescue", label, number: "1122" }]` (from config; show in this order)
  - `emergency_contacts`: the caller's contacts (same shape as above)
  - `share_url`: for the passenger of an active ride, the live-trip link (BE-80, made or reused); `null` for the driver or after the ride
  - `share_message`: plain text for the native share sheet / SMS to the contacts (driver first name, vehicle colour + make, plate, a Google Maps link to the sent position, the live link). Contains no phone numbers.
- 403 `NOT_RIDE_PARTICIPANT`; 409 `SOS_WINDOW_CLOSED`; 422 validation; 429.
- The other party is never notified. The admin panel shows an "open incidents" badge (polls every 30 s) and a list/detail with acknowledge / resolve.

App flow (T-520): SOS button on the trip screen → POST sos → sheet with "Call 15", "Call 1122", "Alert my contacts" (share `share_message` to `emergency_contacts`), "Share live trip". Keep the call buttons usable even if the request fails (offline).

## BE-80: share live trip (2026-10-14, for T-520)

- `POST /rides/{id}/share` (the ride's passenger; ride not completed/cancelled) → 201 new / 200 the live one: `{ url, token, expires_at, ends_minutes_after_ride: 15 }`. One live link per ride; share `url` with the native share sheet. 403 `NOT_RIDE_PASSENGER` (driver, others, admins); 409 `RIDE_NOT_ACTIVE`; throttle 20/min.
- `DELETE /rides/{id}/share` → `{ revoked: n }`; the link stops at once. A new POST makes a new link.
- `expires_at`: the 12 h hard cap while the ride is active; once it ends, end + 15 min.
- Public page `GET https://raahehaq.com/t/{token}` (no login, no cookies, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, no referrer, no framing; CSP allows only our own files and the pinned Leaflet 1.9.4 build with SRI). It polls `GET /t/{token}/status` every 10 s: `{ status, status_text, driver: {first_name}|null, vehicle: {make, color, plate}|null, position: {latitude, longitude, heading, updated_at}|null, eta_minutes, expires_at, poll_seconds }`. Nothing else is exposed (no passenger data, addresses, ids or phones). Unknown, revoked or expired tokens: 404. Rate limits per IP: page 30/min, status 20/min.

## BE-81: ride PIN (2026-10-14, for T-520)

- A 4-digit PIN is made each time a driver is assigned (a reassigned or requeued ride gets a new one). Ride objects gain:
  - `pin` (string, e.g. `"0427"`): **passenger only**, while the ride is `accepted` / `arrived` and the PIN is required (`pin_required`). The key is absent for the driver, admins, when the PIN is switched off and once the trip started.
  - `pin_required` (bool, everyone): the driver's start needs the PIN now.
- `POST /rides/{id}/start {pin: "0427"}` (send as a **string** of 4 digits; the legacy `PUT /rides/{id} {status: "started", pin}` too):
  - 422 `PIN_REQUIRED` (missing); 422 `PIN_INVALID` with `error.attempts_left`; 423 `PIN_LOCKED` with `error.retry_after` seconds and a `Retry-After` header; 423 `PIN_BLOCKED` (below). 5 wrong PINs lock the start for 2 min and flag the ride for the admin (security event `ride_pin_locked`). A malformed pin is a plain 422 validation error (`errors.pin`) and does not use an attempt.
- 423 `PIN_BLOCKED` (no `retry_after`): 3 locks on the same ride, or 5 locks by the same driver within 24 h, block the start until an admin clears it (admin ride page, "Clear PIN block"; security event `ride_pin_blocked`, high). Ride objects gain `pin_blocked` (bool). Driver app: show "Contact support"; don't offer the PIN entry while `pin_blocked` is true.
- Switches: env `RIDES_PIN_ENABLED` (default on) and `RIDES_PIN_DISABLED_VEHICLE_TYPES` (csv), and on the admin settings page (App tab; rows added by migration) `ride_pin_enabled` and `ride_pin_disabled_vehicle_types`. They combine: the PIN is on only when **both** switches are on, and the disabled types are the **union** of both lists. So env is the deploy-level kill switch and the admin can only narrow it. When off, `pin_required` is false, the passenger gets no `pin`, and start works without it. Settings are read once per request (no per-ride queries in lists). **Per-city switching is out of scope**: there is no city model; revisit when cities exist. Rides assigned before this change have no PIN and start as before. Admin status moves never need it.
- Local QA note: `.env.example` keeps `RIDES_PIN_ENABLED=true`. Until the app sends the PIN (T-520), the local `.env` may set it to `false` (owner/coordinator). Demo seed rides in `accepted`/`arrived` now carry a PIN.
- App: passenger trip screen shows the PIN large ("Tell your driver this PIN") while `pin` is present; driver app shows a 4-digit PIN entry when `pin_required` is true before calling start, and handles the three codes.

## BE-60 / BE-84: admin rate card, fuel adjustment, transparent commission, weekly statements (2026-10-14, for T-521)

All changes are additive; existing keys keep their meaning. Money is PKR; fares and splits are whole rupees (JSON numbers).

### Rates

- Rates now come from the admin rate card (table `vehicle_types`, admin panel "Fares & Commission"), seeded from `config/fares.php` with the same prices, so nothing changes on deploy. A **fuel adjustment** (percent, start time, short public note) is applied on top of `base_fare`, `per_km`, `per_min` and `min_fare` of every type (not on `per_stop` or `booking_fee`).
- New fare part **`booking_fee`** (default 0; the platform keeps it in full): `total = max(trip, min_fare) + per_stop * stops + booking_fee`.
- **Snapshot:** each ride stores the rates it was booked with (incl. `per_stop`, `booking_fee`, the fuel percent and the commission percent). Stop changes and completion price from that snapshot, so an admin edit never reprices a ride already booked. Rides booked before this release use the current rates.

### GET `/public/vehicle-types` (no auth)

- Only **bookable (active)** types are listed, in the admin's order. `?include_inactive=1` lists every type (use it for driver registration). `include_inactive` must be a boolean (422 otherwise).
- Items gain `name` (same as `label`, the admin-editable display name), `active` (bool), `sort_order`, `fare.booking_fee` and `fare_note` (the fuel note in force, or null). `fare.*` are the rates **after** the fuel adjustment.
- New sibling `meta.fare_notice`: `{ percent, note, effective_from }` or `null`. Show `note` (e.g. "Fares updated for fuel prices") on the booking sheet when it is not null.

```json
{ "success": true, "message": "Vehicle types",
  "data": [ { "key": "car", "label": "Car", "name": "Car", "capacity": 4, "icon": "car", "active": true, "sort_order": 10,
              "fare": { "currency": "PKR", "base_fare": 110, "per_km": 16.5, "per_min": 2.2, "min_fare": 165, "per_stop": 25, "booking_fee": 0 },
              "fare_note": "Fares updated for fuel prices" } ],
  "meta": { "fare_notice": { "percent": 10, "note": "Fares updated for fuel prices", "effective_from": "2026-10-14T12:00:00+00:00" } } }
```

### POST `/rides/estimate`, POST `/rides`

- Without `vehicle_type`, the estimate lists active types only. A switched-off type: estimate 422 `errors.vehicle_type` ("This vehicle type is not available right now."); ride create 422 `error.code VALIDATION_ERROR`, `error.details.vehicle_type[0]` with the same text.
- Each `breakdown` gains `booking_fee` (it still adds up to `fare`). The estimate's `data` gains `fare_notice` (same shape as above, or null).

### Ride objects (RideResource)

- Everyone: `booking_fee`; `fare_breakdown.booking_fee` (the parts still add up to `total`; `stops` no longer includes the booking fee).
- **Driver of the ride and admins only** (and drivers looking at an unassigned request in the feed): `driver_earnings`, `platform_commission`, and new `fare`, `commission_rate` (percent, e.g. 12.5), `commission_amount`, `driver_net`, `commission_final` (bool). Completed rides: the stored numbers (`commission_final: true`). Before completion: the split of the current total at the ride's snapshot rate (`commission_final: false`).
- **Passengers never get** `driver_earnings`, `platform_commission`, `fare`, `commission_rate`, `commission_amount`, `driver_net` or `commission_final` (the keys are absent; before this release passengers got `driver_earnings`/`platform_commission`).
- Split: `driver_net = round((fare - booking_fee) * (100 - rate) / 100)` (half up, in the driver's favour); `commission_amount = fare - booking_fee - driver_net`; `platform_commission = commission_amount + booking_fee` (= the ledger's `commission_due`). `driver_net + platform_commission = fare`.

### GET `/driver/earnings` rows

Each item of `rides` gains `pickup_address`, `dropoff_address`, `fare`, `booking_fee`, `commission_rate`, `commission_amount`, `driver_net` (existing `total_fare`, `platform_commission`, `driver_earnings` unchanged). Rides completed before this release have no stored rate; `commission_rate` is derived from their stored amounts.

### GET `/driver/statements?week=2026-W42` (role driver; passengers 403; 401 without token)

- `week`: ISO week (`2026-W42`) or any date in it (`2026-10-14`); default this week. Weeks run Monday 00:00 to Sunday 23:59:59 Asia/Karachi. A malformed week, a week after this one, or before 2020: 422 `VALIDATION_ERROR`, `errors.week`. Throttle 30/min. Always the token driver's own data.

```json
{ "success": true, "message": "Weekly statement",
  "data": { "week": "2026-W42", "timezone": "Asia/Karachi", "from": "2026-10-12T00:00:00+05:00", "to": "2026-10-18T23:59:59+05:00", "currency": "PKR",
    "rides": { "count": 2, "gross_fares": 400, "cash_collected": 400, "booking_fees": 0, "commission": 50, "platform_total": 50, "driver_net": 350 },
    "by_vehicle_type": [ { "vehicle_type": "car", "commission_rate": 12.5, "rides": 2, "gross_fares": 400, "commission": 50, "driver_net": 350 } ],
    "ledger": { "commission_due": 50, "commission_paid": 10, "topups": 0, "payouts": 0, "other": 0, "net_change": -40 },
    "balance": { "opening": -24, "closing": -64 },
    "commission_owed": { "start_of_week": 24, "end_of_week": 64, "now": 64 },
    "reconciled": true } }
```

- `rides.*`: completed rides in the week, from the split stored on each ride. `cash_collected` = `gross_fares` (cash only).
- `ledger.*`: the driver's wallet entries posted in the week (positive numbers; `net_change` is signed). `commission_paid` = approved commission payments; `topups` = JazzCash/Easypaisa top-ups (they reduce what is owed).
- `commission_owed` is the wallet balance below zero at the start, the end, and right now. `reconciled` is true when the ledger's `commission_due` for the week's rides equals their `platform_total`.

### Admin panel (not the app)

`/admin/fares` (rate card: name, active, seats, base, per km, per min, min fare, per stop, booking fee, commission % 0–50, order; fuel adjustment −50..100 % with start time in Pakistan time and a public note, scheduled ones can be withdrawn, ones in force stay as history; every write audited), `/admin/payments/statements?week=&driver_id=` (weekly statement per driver). `driver_commission_percentage` is no longer on the App Settings page: commission is per vehicle type now (that setting is only the fallback for a type off the rate card).

## BE-82 / BE-83 / BE-85: fare lock, offer your fare, cancellation fairness (2026-10-15, for T-521)

All additive except two behaviour changes, marked **Changed**. Money is PKR; fares are whole rupees. Ride money fields are strings like `"152.00"` (as before); the new estimate fields are JSON numbers.

### BE-82: fare lock

- **Changed:** when a driver accepts, the fare is locked (`fare_locked`, `accepted_fare`, `fare_locked_at` on every ride object). Completion charges the locked fare plus the per-stop fee of stops added or removed afterwards (booked `per_stop`) plus billed waiting (BE-85). It no longer re-prices from GPS / duration. The trip distance and duration are still recorded. Rides accepted before this release have no lock and complete with the meter as before. Kill switch: `FARE_LOCK_ENABLED=false`.
- Nobody can change the fare from the app: a passenger `PUT /rides/{id}` with `total_fare` or `offered_fare` is 403 `FORBIDDEN_FIELDS`; a driver's `fare` in the body is ignored (as before).
- `POST /rides/{id}/report-overcharge` `{ asked_amount?: integer 1..999999, note?: string <= 500 }`, the ride's passenger, once per ride **and driver** (the driver assigned at report time; a re-matched ride's next driver can be reported separately), while the ride is accepted / arrived / started, or up to **24 h** after it completed or was cancelled (`RIDES_DISPUTE_WINDOW_HOURS`). Throttle 10/min.
  - 201 `{ success, message: "Thank you. ... Pay only Rs 152, the fare in the app.", data: { report: { id, kind: "asked_for_more", status: "open", asked_amount|null, fare, refund_amount, created_at, resolved_at }, pay_only: 152 } }`
  - 404 `not_found` for a ride the caller is not part of (BE-102; same body as a missing ride, even with an invalid body); 403 `NOT_RIDE_PASSENGER` (the ride's driver, admins); 409 `NO_DRIVER` (no driver on the ride); 409 `REPORT_WINDOW_CLOSED`; 409 `ALREADY_REPORTED`; 422 validation (`errors.asked_amount`, `errors.note`); 401 without a token.
  - Every report is a **pending** strike on the driver: it does not count and is not shown to the driver until an admin upholds it, and an upheld overcharge strike is shown only once the ride has ended, as **date and kind only** (no id, ride or reason). A rejected report's strike is voided and not listed. The driver is never told who reported.
- Ride objects, **passenger only**: `overcharge_report: { can_report: bool, report: <latest report>|null }`. `can_report` is false once the current driver was reported. Show the "Driver asked for more?" button while `can_report` is true; show the report status after (`open` / `upheld` / `rejected`, with `refund_amount`).
- An upheld report may refund the passenger's wallet (ledger type `refund`, notification "Refund Received"), at most the fare; on a **cancelled** ride at most the `cancellation_fee`, and the driver's share of that fee is reversed in proportion (the held part first, then a `fare_dispute_charge` debit). On other rides the admin may recover the refund from the driver (`fare_dispute_charge`, a debit that adds to what they owe). The cap is for **all reports of the ride together** (a re-matched ride can have one per driver). The proportional reversal applies only when the report is about the driver who got the fee; otherwise the admin's normal choice applies, and the refunded part of the fee is never paid to the other driver. Refund entries carry no `ride` link in the wallet history (the ride is in the report).
- `GET /driver/strikes` (role driver; passengers 403; throttle 30/min), always the token driver's own record:

```json
{ "success": true, "message": "Strikes",
  "data": { "active_count": 1, "review_threshold": 3, "window_days": 30, "under_review": false,
    "strikes": [ { "id": 7, "kind": "overcharge_report", "reason": "Passenger reported being asked for more than the fare (asked Rs 400, fare Rs 152)",
                   "status": "active", "ride": { "id": 12, "ride_id": "RIDE-01J..." }, "counts": true,
                   "counts_until": "2026-11-14T12:00:00+00:00", "created_at": "...", "voided_at": null } ] } }
```

  - `kind`: `overcharge_report` | `driver_cancel`. `status`: `active` | `voided` (an admin voided it, or the report was rejected). Pending (unreviewed) overcharge strikes are not listed and not in `active_count`. `counts`: still counts towards the threshold (active and younger than `window_days`). `under_review`: the driver reached `review_threshold` active strikes in `window_days` and an admin will review the account. The account is **not** suspended automatically. Config: `DRIVER_STRIKE_WINDOW_DAYS` (30), `DRIVER_STRIKE_REVIEW_THRESHOLD` (3).
- Admin panel (not the app): `/admin/fare-disputes` (open count badge in the sidebar; resolve as upheld with an optional refund up to the fare and "recover from the driver", or rejected, which voids the strike; once only; audited), `/admin/driver-strikes` (flagged drivers first, void a strike with a note, clear the review flag). A high security event `driver_strike_review` is raised when a driver is flagged.

### BE-83: offer your fare

- `POST /rides/estimate`: each item of `estimates` gains

```json
"offer_band": { "min": 130, "max": 180, "step": 10, "server_fare": 152, "down_percent": 20, "up_percent": 20 },
"fare_policy": { "fees_enabled": true, "free_wait_min": 3, "wait_per_min": 3, "max_wait_billed_minutes": 15, "cancel_fee": 50, "free_cancel_minutes": 5, "no_show_wait_minutes": 5 }
```

  - `min` = server fare less `down_percent`, rounded **up** to `step`; `max` = server fare plus `up_percent`, rounded **down** to `step`. The server fare is always inside. `step` is how far the app's - / + buttons move the offer; any whole rupee from `min` to `max` is accepted. The percentages and step are per vehicle type on the admin rate card (default -20 % / +20 %, step Rs 10). `offer_band` is `null` when offers are switched off (`FARE_OFFERS_ENABLED=false`).
- `POST /rides` gains `offered_fare` (optional integer). Inside the band: `total_fare` = the offer. Outside the band, or offers off: 422 `{ error: { code: "VALIDATION_ERROR", details: { offered_fare: ["Offer a fare between Rs 130 and Rs 180."] }, offer_band: {...}|null } }`. A non-integer is a plain 422 `details.offered_fare`. The band is computed on the server from the same route, so send the same stops as the estimate.
- Ride objects (everyone, drivers in `GET /rides/pending` too): `server_fare` (the server fare at booking, `null` for rides booked before this release), `offered_fare` (`null` without an offer), `is_offer` (bool). `fare_breakdown` gains `offer_adjustment` (`offered_fare - server_fare`, signed) and `waiting` (BE-85); the parts still add up to `total`. In the pending feed `estimated_fare` = `total_fare` = the offer, and the driver's `driver_net` / `commission_amount` are on the offer.
- No counter-offers: there is no endpoint for the driver to propose a fare, and the passenger cannot change the offer after booking (403). A driver who does not want the offer leaves it. A re-matched ride (BE-85) keeps the same offer.
- When stops are added or removed, the offer keeps the same ratio to the server fare it had at booking (`offered_fare / server_fare`), applied to the new server fare, clamped to the new band (min / max) and never below the type's `min_fare`; `fare_breakdown.offer_adjustment` is recomputed (`offered_fare` and `server_fare` keep the booking values). Completion charges that (plus waiting), and the commission is split on the total (`Commission::split`, BE-84).

### BE-85: cancellation fairness

Terms per vehicle type on the admin rate card, copied into the ride at booking (an admin edit never changes a booked ride's terms; rides booked before this release are never charged waiting or cancel fees). Ride objects gain `fare_policy` (same shape as the estimate's, plus `fees_enabled`) while the ride is requested or active.

**Fees are OFF by default** (`FARE_FEES_ENABLED=false`) until T-521 shows them: then `fare_policy.fees_enabled` is false, `wait_per_min` and `cancel_fee` are 0, and no waiting, late-cancel or no-show fee is ever charged. The no-show strike exemption still applies. Switch it on only after the app shows the terms.

**Verified arrival.** Ride objects gain `arrival_verified` (bool): when the driver marked arrived, their latest GPS ping was at most 120 s old and inside the 300 m pickup radius. Waiting is billed and a no-show fee charged only after a verified arrival (or, for a no-show, a fresh in-radius ping at the moment of the cancel). Driver app: keep sending location while driving to the pickup, so the arrival is verified.

- **Waiting fee.** After a verified arrival, `free_wait_min` free minutes, then `wait_per_min` for each further whole minute (rounded down), counted up to the driver's **first start / PIN attempt**, at most `max_wait_billed_minutes` (15). Billed when the trip starts: ride objects gain `waiting_minutes` and `waiting_fee` (also `fare_breakdown.waiting`), and `total_fare` includes it from then on. Show a waiting timer on both sides from `arrived_at`.
- **Passenger late-cancel fee.** `POST /rides/{id}/cancel` by the passenger is free before a driver accepts and within `free_cancel_minutes` (5) after the accept. After that, or once the driver arrived, the type's `cancel_fee` is charged.
  - Ledger: the passenger's wallet gets a `cancellation_fee` entry (debit). A passenger's balance may go **below zero**; `GET /wallet` gains `amount_owed` (= max(0, -balance), for everyone), and a JazzCash / Easypaisa top-up clears it. The driver's share is the fee less the ride's commission rate (Rs 40 of Rs 50 at 20 %), but the driver is credited at once (`cancellation_compensation`) only the part the passenger's **cash-backed** balance (top-ups and refunds, less every debit; promo, referral and admin credits never count) covered before the charge; the rest is **held**. After each top-up or refund, held shares are paid (`cancellation_compensation_release`, one entry per fee) oldest fee first, as far as real money covers the fees; the part of a fee refunded to the passenger is never paid to the driver. We chose this over "add it to the next fare" because it stays in the one ledger, is idempotent per ride, and never pays out money nobody paid.
  - **Booking block:** a passenger owing more than `RIDES_MAX_OWED_TO_BOOK` (Rs 150) gets `POST /rides` 403 `{ error: { code: "PASSENGER_BALANCE_OWED", message, amount_owed: 200, limit: 150 } }`. Show "You owe Rs X. Top up to book" with a top-up button. *BE-91: `amount_owed` here is the passenger-side debt only (see below); use it, not `GET /wallet` `amount_owed`.*
  - **Caps:** at most 2 fees per passenger and 1 per driver-passenger pair per day (`RIDES_MAX_FEES_PER_PASSENGER_DAY`, `RIDES_MAX_FEES_PER_PAIR_DAY`; *BE-91: a Pakistan calendar day, not a rolling 24 h, see below*). A cancel over a cap is free (`cancellation_preview.fee_now` is 0); a pair over its cap is flagged for an admin (security event `repeated_pair_cancel_fee`).
  - Response: `message` "Ride cancelled. A late cancellation fee of Rs 50 was added to your wallet"; ride objects gain `cancellation_fee` and `cancellation_charge_reason` (`late_cancel` | `no_show` | null). The driver's notification reads "The passenger cancelled this ride. You get Rs 40 for your time", or "... Rs 40 for your time is credited when the passenger pays" when the share is held (data `compensation`, `compensation_held`).
  - "The driver arrived" makes a cancel late only when the arrival is verified (or the driver's fresh ping is at the pickup at cancel time); after an unverified arrival the free minutes after accept still apply.
  - Ride objects, **passenger only**, while it can still be cancelled: `cancellation_preview: { fee_now: 0|50, free_until: ISO|null, reason: "late_cancel"|null }`. Show "Free to cancel until hh:mm" or "Cancelling now costs Rs 50" on the cancel sheet.
- **Driver no-show cancel.** After waiting `no_show_wait_minutes` (5) at the pickup, the driver's cancel (with the note, as before) ends the ride as cancelled (never re-matched) and records **no strike**. With a verified arrival (or a fresh ping at the pickup now) the passenger pays the same `cancel_fee` (driver's share credited or held as above, caps apply); without one the cancel is free and flagged for an admin (security event `unverified_no_show`). Message "Ride cancelled as a passenger no-show. No strike was recorded"; the passenger's notification "Your driver waited at the pickup and cancelled. A no-show fee of Rs 50 was added to your wallet". Ride objects, **driver only**: `no_show_cancel_at` (ISO, `null` until arrived). Offer "Passenger didn't come" once it is past.
- **Driver cancel strikes.** Any other driver cancel after accept is a `driver_cancel` strike (`GET /driver/strikes`). Tell the driver before they confirm.
- **Changed: automatic re-matching.** `RIDES_DRIVER_CANCEL_MODE` now defaults to `requeue`: a driver's cancel puts the ride back to `requested` without a driver, at the same `total_fare` / `offered_fare`, top of the drivers' feed, and the passenger is notified ("Your driver cancelled. Your ride is back in the queue for another driver"). The fare lock is taken again by the next driver; the cancelling driver cannot take it again. Ride objects gain `requeue_count`. After `RIDES_MAX_REQUEUES` (3) re-matches, the next driver cancel ends the ride as `cancelled`. Passenger app: on `ride_cancelled` with `requeued: true` (or the ride back in `requested`), go back to the "finding a driver" state, not to Home. *BE-93: the push carries this too, see below.*

### BE-91 / BE-93: fare accounting lows and push routing hints (2026-10-16, app follow-up T-546)

- **Push routing hints (BE-93).** Ride pushes (FCM `data`, all strings) gain `ride_status` (the ride's API status when the push was sent: `requested`, `accepted`, `arrived`, `started`, `completed`, `cancelled`). `ride_cancelled` pushes also carry `requeued`: `"true"` when a driver's cancel put the ride back in the queue, `"false"` otherwise (never a bool, never another value). The app (T-546) reads them in `toPushPayload`: a passenger's tapped `ride_cancelled` with `requeued: "true"` or `ride_status: "requested"` opens the live ride (Booking, "finding a driver") and still re-reads the ride from the server (GET `/rides/{id}` for the ride held, else the in-progress ride restore); the push alone is never trusted for the state. Pushes sent before BE-93 have neither key and keep the old routing (`ride_cancelled` opens the ride history). The notification list item keeps `data.requeued` as a bool (BE-85) and has no `ride_status`.
- **Goodwill refunds (BE-91).** An admin's goodwill "refund" adjustment (`POST /payments/wallets/{id}/adjust` with `direction: refund`) is now its own ledger type `goodwill_refund` (credit, label "Refund"). It is **not cash-backed**: unlike `refund` (money the user paid coming back, e.g. an upheld fare report), it never releases a driver's held cancel-fee share. The app shows it like `refund` (label "Refund", refund icon); it is a credit, so the wallet's "Money in" filter (`direction=credit`) lists both.
- **Retype migration needs staging.** `2026_10_16_120000_retype_admin_goodwill_refunds` retypes old admin goodwill refunds (`refund` with `processed_by` or reference `admin_request`, never `fare_dispute`) to `goodwill_refund`. It is a data migration: run it on a staging copy of the production database first and compare the `refund` / `goodwill_refund` counts and sums before and after (backend `DEPLOYMENT.md`, owner item with B-17). Rolling it back turns every `goodwill_refund` into a cash-backed `refund`; avoid that in production.
- **Fee caps per Pakistan calendar day (BE-91).** The cancel-fee caps (2 per passenger, 1 per driver-passenger pair) count per calendar day in `RIDES_FEE_CAP_TIMEZONE` (default `Asia/Karachi`; an unknown zone falls back to it), not a rolling 24 h. No app change: the server still reports a capped cancel as `cancellation_preview.fee_now: 0`.
- **Dual-role booking block (BE-91).** For a user who is both passenger and driver, the `POST /rides` block counts only passenger-side debt: commission owed as a driver, and top-ups (a driver tops up to pay commission), are left out; the result is capped at the wallet's own debt. So `PASSENGER_BALANCE_OWED` `amount_owed` can be lower than `GET /wallet` `amount_owed` (which is max(0, -balance) for the whole wallet). The booking screen's "You owe Rs X" and the Add money prefill use the error's `amount_owed` (T-546 test). *BE-100: `GET /wallet` now has the passenger-side figure too, see below.*
- Driver-side text: a fare-dispute recovery entry from the driver now has a neutral description ("Fare dispute adjustment"); type `fare_dispute_charge` is unchanged.

### BE-100: passenger-side debt on GET /wallet (2026-10-16, app T-547)

- `GET /wallet` `data` adds three fields; everything else, including `amount_owed` (max(0, -balance) for the whole wallet, commission included) and `commission_owed`, is unchanged:
  - `passenger_amount_owed` (number, PKR major units): the passenger-side debt only, the same rule as the `PASSENGER_BALANCE_OWED` booking block (BE-91: a driver's commission and top-ups left out, capped at the wallet's own debt).
  - `max_owed_to_book` (int, whole PKR): the most a passenger may owe and still book (`RIDES_MAX_OWED_TO_BOOK`, default 150).
  - `booking_blocked` (bool): `passenger_amount_owed > max_owed_to_book`, so the next `POST /rides` would be refused; always `false` for admins.
- **App (T-547).** `toWallet` maps them to `passengerAmountOwed`, `maxOwedToBook`, `bookingBlocked` (each `null` when the field is absent). The passenger Wallet's "You owe Rs X" banner (`wallet-amount-owed`) shows only while `booking_blocked` is true, with `passenger_amount_owed` as the amount and as the "Top up" prefill (`passengerOwedBannerAmount` in `src/features/wallet/navigation.ts`). A dual-role user's driver commission is never in it. If `booking_blocked` is true but `passenger_amount_owed` is missing, the banner stays hidden rather than show the whole-wallet `amount_owed`; `POST /rides` still reports the correct figure. Fees under the limit (`booking_blocked: false`, `passenger_amount_owed` > 0, `max_owed_to_book` known) show an info note (`wallet-owed-note`, i18n `fare.owedUnderLimitNote`: "Rs X in fees will be settled from your next top-up. You can owe up to Rs Y and still book.") with no top-up action. The driver wallet never shows it; the commission card and "Pay commission" keep using `commission_owed`.
- **Older backends** without `booking_blocked` keep the BE-85 rule: the banner shows for any `amount_owed` above zero, with that amount.

### BE-103: quoted minutes and km on locked rides (2026-10-16, app T-557)

- Ride objects (every RideResource: passenger and driver, live and history) add `quoted_distance_km` (decimal string like `"5.24"`, or `null`) and `quoted_duration_minutes` (int or `null`): the booking route estimate, kept after completion. A locked fare (BE-82 `fare_locked: true`) charged these, not the recorded `distance_km` / `duration_minutes` (the trip as driven). `null` on rides completed before BE-103. Unlocked (metered) rides may also carry them; the app ignores them there.
- `GET /driver/earnings` `rides[]` add `quoted_distance_km` (float or `null`), `quoted_duration_minutes` (int or `null`) and `fare_locked` (bool).
- **App (T-557).** Read nullable: `RideResource.quoted_distance_km` / `quoted_duration_minutes`, ride history `quotedDistanceKm` / `quotedDurationMinutes`, `EarningsRide.quotedDistanceKm` / `quotedDurationMinutes` / `fareLocked` (false when absent). A locked receipt (passenger live panel, ride details for both sides, driver trip complete) labels the lines "Time (quoted 18 min)" and "Distance (quoted 5.2 km)" (`lockedTimeLabel` / `lockedDistanceLabel` in `src/components/ui/ride/FareBreakdown.tsx`), else "(quoted at booking)" as before. A locked Earnings row reads "Quoted 5.2 km · Locked fare Rs 300 · commission …".

### Admin rate card

`/admin/fares/{id}/edit` gains: offer band lowest / highest % (0-50), offer step (Rs 1-500), free waiting minutes (0-60), waiting per minute, late cancel / no-show fee (whole rupees). They are optional in the form request, so older forms keep working.

### Accepted risk (owner, 2026-10-15): client GPS spoofing

Arrival verification, no-show fees, the BE-64 arrival check and the trip distance all trust the GPS position the driver app sends (`POST /tracking/update-location`). A driver with a location-spoofing app can fake being at the pickup. This is accepted for launch: fees are off by default (`FARE_FEES_ENABLED`), each pair can be charged at most once a day, unverified no-shows and repeated pair fees raise security events, and an admin can refund through a fare report. Revisit with mock-location detection in the driver app (Android `isFromMockProvider` / `isMock`) and server-side plausibility checks (speed, jumps, ping cadence) before enabling fees widely.

## BE-92: AI for admins: risk signals and AI case reviews (2026-10-15, admin panel only)

**No app API change.** Everything is in the admin panel (web routes, `auth` + `role:admin`). The mobile app never calls a model and never holds a key. One server-side side effect of existing endpoints: `POST /devices` now also records an HMAC of the push token per account (`device_sightings`, never the token; key `RISK_DEVICE_HMAC_KEY`, else `APP_KEY`) for the "several accounts on one device" rule; its request and response are unchanged. The push token comes from the app, so a modified app can fake it: the admin page says so.

### Risk signals (rule-based, advisory)

`risk_signals` rows (kind, subject user or ride, score 0-100, evidence without PII: counts, flags, internal ids, chat categories; status `open` | `dismissed` | `actioned`, reviewed_by, note). Raised by a queued full scan when a ride is completed or cancelled, by a chat-only job when a message is stored (debounced per ride), both on the low-priority `RISK_QUEUE` (default `low`; the worker must run `queue:work --queue=default,low`), and by the hourly `raahehaq:risk-sweep` (rides changed or with chat in the last 3 h, plus recently active users). Nothing is applied to the account; an admin decides.

| kind | rule (defaults in `config/risk.php`) |
|---|---|
| `unverified_no_show` | a driver's no-show cancels without a verified arrival (security event `unverified_no_show`), 2+ in 30 days |
| `gps_spoofing` (ride) | between accept and the ride's end: implied speed > 200 km/h over 500 m+ (pings with accuracy worse than 100 m ignored), a ping exactly on the pickup point (~0.5 m), or 5+ minutes of silence then a ping within 25 m of the pickup with the previous one 1 km+ away |
| `gps_exact_pickup_pattern` | 3+ rides in 30 days with an exact-pickup ping (dismissed ride signals do not count) |
| `pair_cancel_fees` | 2+ cancel fees within one driver-passenger pair in 30 days |
| `cancel_fee_cluster` | 4+ fees from 3+ passengers to one driver in 7 days |
| `overcharge_pattern` | 2+ upheld "asked for more" reports against a driver in 90 days |
| `false_overcharge_reports` | a passenger with 3+ rejected reports (75 %+ of their decided ones) |
| `chat_money_request` (ride) | categories `wallet_app` (JazzCash / Easypaisa / SadaPay / NayaPay / Raast / bank transfer), `account_number` (IBAN, or 10+ digits that are not a PK mobile; a mobile counts only next to a wallet name), `money_request` (a send verb such as bhejo / bhej do / send / transfer / بھیج WITH a money word, amount or wallet in the message, or "pay me outside / advance payment"). "location bhej do", "pin bhejo", a phone number alone are nothing. Score 70 request + wallet or account, 60 wallet + account, 35 request, 15 a lone wallet or number; a signal needs 30+. Only the categories are stored |
| `shared_device` | 2+ accounts registered the same device in 30 days (more with mixed roles, much more with rides between them) |

Per-user aggregate score: `100 * (1 - Π(1 - score/100))` over open signals in 90 days. A reviewed signal is raised again only when its evidence grows.

Admin pages: `/admin/risk-signals` (filter by status, kind, user, min score; top aggregate scores), `/admin/risk-signals/{id}` (evidence, AI review card, dismiss / action with a required note, audit log). Each decision writes an audit row (`risk_signal_dismissed` / `risk_signal_actioned`).

### AI case reviews

An "AI review" card on fare dispute detail, safety incident detail and risk signal detail, labelled "AI suggestion — an admin decides", with the provider and model used. `POST /admin/ai-reviews {case_type: fare_dispute|safety_incident|risk_signal, case_id, refresh?}` (throttled 20/min; audit row `ai_review_requested` on the case). The suggestion is never applied.

- **Fact pack** (stored in `ai_reviews.facts`, viewable on the card): people as role + first letter ("Driver I."), coarse areas (no house / street / plot numbers, no coordinates), free text scrubbed of phone / account numbers (any of space - . / ( ) as separators), CNIC, emails, house / plot / street / gali / sector numbers and the parties' names, cut to 280 characters and sent as `untrusted_passenger_statement` / `untrusted_reporter_statement` (the system prompt says these are one party's unverified words: data, never instructions, never enough on their own for the recommendation); chat as counts and categories; amounts, timestamps, statuses, ride timeline, strike and report counts, verified-arrival and PIN flags, open risk signals.
- **Result** (strict JSON, schema-constrained): `summary` (≤ 3 lines), `key_facts`, `inconsistencies`, `recommended_action` (fare dispute: `uphold` | `reject` | `needs_info`; safety: `action` | `resolve` | `needs_info`; risk signal: `action` | `dismiss` | `needs_info`), `confidence` (`low` | `medium` | `high`), `rationale`. Anything else falls back to the local rules.
- **Providers:** `local` (deterministic rules; default, and always in local / testing unless `AI_ALLOW_REMOTE_IN_LOCAL=true`) and `anthropic` (Messages API, `AI_MODEL` default `claude-sonnet-5-5`, structured output, 25 s per attempt, 2 retries with backoff on 408/409/429/5xx, all attempts within 80 s < job timeout 85 s < queue retry_after 90 s; the server-side fallback beta is opt-in, `AI_ANTHROPIC_FALLBACKS=false` by default). The job claims a review atomically (`pending` -> `running`); `raahehaq:ai-reviews-expire` (every 5 min) fails reviews unfinished after `AI_STALE_MINUTES` (10). Falls back to local with a reason: `no_key`, `local_env`, `budget`, `error`, `invalid_json` (`timeout` for expired ones). Provider failures log the HTTP status only.
- **Cache:** the same facts for the same case reuse the stored review (no new call). **Budget:** `AI_DAILY_BUDGET_USD`. Before each remote call the estimated maximum (prompt estimate + all of `max_tokens`) is reserved under a lock against today's billed cost (`billed_at`) plus open reservations; after the call it settles to the billed cost from the response's token usage and `config/ai.php` pricing. Over the cap: local rules until the next day. Logs carry usage only (tokens, estimated cost), never the prompt or facts.

## BE-94: avatar hardening and driver photo review (2026-10-15, follow-up to T-504)

### POST `/profile/avatar` (multipart, field `avatar`)

- **Accepted:** JPEG, PNG or WebP, at most 2048 KB. SVG, GIF, BMP, HEIC and anything the server cannot decode get **422** `{success:false, message, errors:{avatar:[...]}}`. Images over 8000 px on a side or 12.5 MP are refused before decoding (422).
- **Re-encoded on the server:** decoded, turned upright from its EXIF orientation, scaled so the longest side is at most 1024 px, transparent areas flattened onto white, saved as a new JPEG (quality 85) under a random name (`avatars/<40 chars>.jpg`). No EXIF, GPS, XMP or ICC data survives. The app's own resize (1024 px, 0.8) can stay; the server no longer relies on it.
- **Throttle:** 10 requests per hour per user, shared with DELETE. Over it: **429** `{success:false, code:"rate_limited", retry_after}`.
- **Passenger (any account without the driver role):** the new photo is live at once; the old file is deleted. `message: "Avatar updated"`.
- **Driver:** the photo goes to review (BE-66 `profile` item) and `profile_image_url` keeps the approved photo until an admin approves the new one. `message` is `"Photo submitted for review. Your current photo stays until it is approved."`, or `"Photo uploaded. It will be reviewed."` for a driver still onboarding (account `pending`) who has no approved photo yet: then the new photo replaces the current one directly, as before, and stays `pending`.
- Response `data` is the ProfileResource (below).

### DELETE `/profile/avatar` (new)

- Passenger: **200** `{success:true, message:"Avatar removed", data: ProfileResource}` with `profile_image_url: null`. Also 200 when there was no photo.
- Driver: **422** `{success:false, message:"Drivers must keep a profile photo. Upload a new one instead; it will be reviewed.", error:{code:"PROFILE_PHOTO_REQUIRED"}}`. Nothing changes. The app should not show a "Remove photo" action to drivers.
- 401 without a token.

### ProfileResource (GET `/profile`, `/user`, `/auth/profile`, PUT `/profile`, POST/DELETE `/profile/avatar`): new fields

| field | value |
|---|---|
| `profile_image_url` | unchanged meaning: always the **approved** (served) photo, the one passengers see |
| `profile_image_review` | drivers: `pending` \| `approved` \| `rejected` (the newest `profile` item); `null` for passengers or when there is no item |
| `pending_profile_image_url` | drivers only: public URL of the new photo waiting for review, when it differs from the served one; otherwise `null`. Only in the owner's own profile, never in ride, chat, user cards or the share page |
| `profile_image_rejection_reason` | the admin's reason when `profile_image_review` is `rejected`, else `null` |

### Review (admin, existing BE-66 per-item routes)

`POST /admin/drivers/{driver}/documents/{id}/approve` on a pending photo change swaps it in as `profile_image` and deletes the old file. `.../reject` deletes the new file and the approved photo stays (`profile_image_review: rejected` with the reason). The driver can upload again with POST `/profile/avatar` or POST `/driver/documents/profile`; both are re-encoded the same way and wait for review. RideResource, UserResource and chat cards keep reading `users.profile_image`, so they only ever show an approved photo once a driver is active (the trip share page shows no photo).

### Registration and admin uploads

`profile_image` / `passenger_profile_image` at registration (API and web), the admin user forms and POST `/driver/documents/profile` go through the same re-encoder (upright, metadata stripped, at most 1024 px JPEG). Their mimes rule is unchanged (jpeg, png, jpg, gif; GIF is stored as JPEG). An undecodable photo is a 422 on that field and no file from the request is kept. Identity and vehicle documents are not re-encoded.

### Admin decisions are bound to the file shown (BE-94 security follow-up)

`GET /admin/drivers/{driver}/documents` items now carry `version` (an opaque fingerprint of that item's file; the driver's own GET `/driver/documents` shows it too, harmlessly). `POST /admin/drivers/{driver}/documents/{id}/approve` and `.../reject` **require** `document_version` (the `version` the admin was shown): missing → 422 on `document_version`; a different value (the driver re-uploaded since) → **409** `error.code: "DOCUMENT_CHANGED"` and nothing is decided, so the admin must reload. The web panel forms send it as a hidden field and show a flash error on a mismatch. No passenger/driver app change.

## BE-89: anti-fraud in chat and personal names (2026-10-16, app T-555)

### Chat `safety_warning` (money-transfer requests)

Every chat message object carries `safety_warning`: `null`, or `{ "code": "money_transfer_request", "message": "<text>" }`. It is on messages in GET `/rides/{id}/messages`, the POST `/rides/{id}/messages` answer, GET `/chats` `last_message`, and the `chat.message` socket event (BE-12). It is computed from the text each time (nothing stored); a lone wallet name or phone number does not trigger it.

- **Wording is per viewer on REST** (the caller: the sender is told asking is not allowed, the recipient never to send money) but **always the recipient's on the socket** (both parties receive the event). So the app ignores `message` for a known code and shows its own copy keyed by `code` + `sender_id` vs. the signed-in user's id (`src/features/chat/safety.ts`, strings `en.chatSafety`; Urdu later). Without a user id it falls back to REST `is_mine`. An unknown code shows the server `message` when non-empty.
- **App UI (T-555):** a small warning-tone note under that bubble (`warningSoft` fill, `warning` border, alert icon, `accessibilityLabel` "Safety warning: …"), not a modal; the message itself is still shown and sendable. Recipient: never send money by JazzCash, Easypaisa or bank transfer, Raah-e-Haq never asks for transfers, report it in Help. Sender: asking for money transfers isn't allowed.

### Names: no rank, title or staff look-alike (`App\Rules\PersonalName`)

POST `/auth/register` and PUT `/profile` answer **422** with `errors.name` when the name carries a rank or official title ("Please use your own name without a rank or title (such as Captain, Major or Colonel).") or looks like Raah-e-Haq staff/support ("Please use your own name. Names that look like Raah-e-Haq staff or support are not allowed."). An unchanged name passes on PUT `/profile`, so an older account can still save other fields. The app shows the server text under the name field: registration via `mapRegistrationServerErrors` (`name` → `fullName`, back to step 1), Edit profile via `profileSaveErrors` (`name` → the name field). Admin edits are not checked.

## BE-86 / BE-87: AC tier and women mode (2026-10-16, app T-522; parcel delivery: see BE-88 below)

### BE-86: AC tier (`car_ac`)

- **Catalogue and estimate.** Every GET `/public/vehicle-types` entry and every POST `/rides/estimate` quote carries `ac` (bool) and `base_vehicle_type` (`car` for `car_ac`). `car_ac` is listed only while an admin has it active (seeded off). The app accepts `car_ac` as a ride type (`VEHICLE_TYPE_KEYS`), keeps `ac: true` on the type/quote (absent otherwise) and draws the **AC badge** (snowflake + "AC", `AcBadge`) on the option card, the passenger's live ride title and the driver's request card. Registration keeps its own list of vehicle kinds: a vehicle is never `car_ac`.
- **Booking.** POST `/rides` with `vehicle_type: car_ac`. GET `/rides/nearby-drivers?vehicle_type=car_ac` already narrows to AC-approved cars.
- **RideResource.** `is_ac` (bool, both sides). Passenger only, AC rides only: `ac_report {can_report, report}`; `report` is `{id, kind: ac_not_working, status: open|upheld|rejected, refund_amount, suggested_refund, created_at, resolved_at}` (decimals as strings; the app rounds to rupees).
- **POST `/rides/{id}/report-ac` `{note?}`** (note ≤ 500). 201 `data.report` with a display-safe `message` (it names the refund). 409 `NOT_AC_RIDE` / `NO_DRIVER` / `REPORT_WINDOW_CLOSED` / `ALREADY_REPORTED` (the app toasts its own copy and drops the button), 403 `NOT_RIDE_PASSENGER`, **404 for a ride the caller is not part of** (handled like a closed window). App: `features/ac` — "AC not working?" on the live ride and the passenger receipt while `can_report`, then the report's status: "Rs X refunded to your wallet", "Under review. Up to Rs X comes back when it is upheld" (`suggested_refund`), or "Reviewed. No refund this time".
- **Driver: GET / POST `/driver/vehicle/ac` `{has_ac}`** (role driver; always the primary vehicle). `data`: `{vehicle: {id, vehicle_type, year, has_ac, ac_status: none|pending|approved|rejected|suspended, ac_reason, ac_declared_at, ac_reviewed_at} | null, min_vehicle_year, serves_ac_rides, problems: [{code, message}]}`. Refusals: 422 `NOT_A_CAR` / `VEHICLE_TOO_OLD`, 409 `NO_VEHICLE` (server messages are shown). App: Account → **Vehicle AC** (`VehicleAcScreen`): switch, status pill, admin reason for a rejection/suspension, "Still needed" (only once AC is declared; `AC_NOT_DECLARED` is not a to-do), min-year hint. The row shows for cars (or an unknown type).
- **Registration.** Optional `vehicle_has_ac` (multipart `'1'`), sent only for `vehicle_type: car` with the switch on. A 422 `errors.vehicle_has_ac` (not a car / older than the AC minimum year) maps to `vehicleHasAc` on the vehicle step.
- **Accept.** POST `/rides/{id}/assign-driver` 409 `AC_VEHICLE_REQUIRED` → "This is an AC ride. Only a car with an approved AC can take it."
- **Strikes.** GET `/driver/strikes` kind `ac_not_working` ("AC not working (confirmed)"). Automatic ones stay `pending` until an admin confirms them, so they are not listed.

### BE-87: women mode

- **Profile (own).** Passengers: `female_driver_request {available, reason: WOMEN_MODE_OFF | FEMALE_DRIVER_NOT_ALLOWED | GENDER_RECENTLY_CHANGED | null, available_from}`. Drivers: `women_mode {gender_verified, eligible, suspended}`. Both are kept in Redux memory only (never in device storage). The app shows "Female driver" on the fare step only when `available`, or switched off with "You can ask for a female driver from {date}" for `GENDER_RECENTLY_CHANGED`; otherwise it is hidden. The driver's Account shows a "Women mode" row only when `eligible` ("Verified: you can get women-mode requests") or `suspended` ("Paused while our team reviews a report"); every other driver sees nothing.
- **Booking.** POST `/rides` `female_driver_only: true` (sent only when on). A 422 (`error.details.female_driver_only`, `error.reason`) shows the server field message.
- **Availability.** GET `/rides/nearby-drivers?latitude&longitude&female_driver_only=1[&vehicle_type]` → `data: {female_drivers_available}` only; own throttle 4/min, 30/h and 3 grid cells (~2 km) an hour; 429 `rate_limited` + `retry_after`; 422 when the passenger may not ask. The app asks **only while the option is on, only for the chosen pickup, once per cell and ride type**, and sends the **cell's centre**, never the exact pickup. Cells match `WomenMode::womenCell` (latitude step 2 km / 111, longitude step 2 km / (111·cos lat) at the cell's centre latitude, rounded to 5 decimals). Answers are reused for 2 minutes and shared across mounts; a 429 pauses checks for `retry_after`; both are cleared when the session changes (logout / another account); 404/422 show no hint. The **map always keeps the plain nearby list**; this check never narrows it.
- **RideResource (passenger and admins only; drivers never get it).** `female_driver_only` and `women_mode {female_driver_only, state: searching | no_female_drivers_nearby | ask_fallback | released | matched, female_drivers_nearby, ask_fallback_at, can_allow_any_driver, released_at}` (null when the ride never asked). App (`WomenModeSearching`, while searching): "Looking for a female driver" with "Allow any driver", and the **"Keep waiting / Allow any driver"** sheet on `no_female_drivers_nearby` / `ask_fallback` while `can_allow_any_driver`. "Keep waiting" holds the sheet back until `ask_fallback_at` (the server keeps saying `no_female_drivers_nearby` while none is near); closing it without an answer holds it back for a minute. Nothing changes without an answer (no silent fallback). After "Allow any driver" the app keeps the answer's block until the server's block shows the release, so a poll sent before the answer cannot re-open the sheet; a failed inline answer shows its error under the status line.
- **Driver accept.** 409 `FEMALE_DRIVER_REQUIRED` is shown as the generic "ride no longer available" (the passenger's preference is never told to the driver).
- **POST `/rides/{id}/women-mode` `{action: keep_waiting | allow_any_driver}`** → `data: RideResource`. 409 `RIDE_NOT_SEARCHING` ("Your ride is no longer looking for a driver.") / `NOT_WOMEN_MODE_RIDE` (already released: "Any nearby driver can already take your ride."), 403 `NOT_RIDE_PASSENGER`, 404 for an outsider.
- **SOS.** POST `/rides/{id}/sos` `category: women_safety` (high priority, fast-tracked). A women's-safety SOS within 2 minutes of a general one upgrades that alert (the app sends it again; a second women's-safety tap sends nothing). SOS sheet row: "Women's safety alert" (confirm first).
- **POST `/rides/{id}/safety-report` `{category: women_safety, note}`** (note 3..2000, required) while the ride is active or up to 7 days after it ended (`safety.reports.window_days`). 201 new, 200 `created: false` when this user already reported the ride. 409 `REPORT_WINDOW_CLOSED` / `NO_DRIVER`, 403 not a participant, 404 outsider, throttle 10/min. App: the passenger receipt shows "Report a women's-safety issue" while the ride's `safety_report.can_report` says so (BE-105 below); the other party is never told.
- **Privacy.** The app never reads or shows a driver's gender (not in requests, ride cards, chat or the map).

### BE-105: follow-ups (2026-10-16, app T-558)

- **Strikes (GET `/driver/strikes`).** A passenger-report strike (`overcharge_report`, `ac_not_working`) is `{kind, status, counts, counts_until, created_at}` only, with **both dates `YYYY-MM-DD`** (no `id`, `ride`, `reason`, `voided_at` or time of day). Other kinds (`driver_cancel`) keep `{id, kind, reason, status, ride, counts, counts_until, created_at, voided_at}` with ISO times. App (`toDriverStrike`): for both passenger-report kinds the id and reason are never kept even if sent; the list key is `kind-date-index` (unique for two strikes on the same day); dates-only show as "15 Oct 2026" / "Counts until 14 Nov 2026" (read as that calendar date, never shifted by the device timezone, no time).
- **RideResource `safety_report`** (passenger only; drivers never get it): `{can_report, report: {category, status: open|acknowledged|resolved, created_at} | null}`. `can_report` is false once a women's-safety report or SOS exists, when the ride had no driver, or outside the window (active, or up to `safety.reports.window_days` after it ended). App (`SafetyReportSection` on the passenger receipt): "Report a women's-safety issue" only while `can_report`; with a `report` it shows "Women's-safety report sent · Received / Our safety team is on it / Reviewed" (also after reopening the ride). After sending, the receipt reloads the ride. The app no longer keeps its own 7-day window; absent block (older server) shows nothing.
- **GET `/public/vehicle-types` `meta`** adds `ac {vehicle_type: car, min_vehicle_year}` and `vehicle_year {min, max}`. App (driver registration, vehicle step): the year list is the newest 20 years inside `vehicle_year` (local 1980..next year until loaded or on an older server); the AC switch shows for `ac.vehicle_type` and, for a year older than `min_vehicle_year`, is off and disabled with "AC rides need a car from {year} or newer." (a chosen AC declaration is turned off). The 422 `errors.vehicle_has_ac` stays the fallback check. Read once per hour (in-memory cache).
- **SOS `category: women_safety`**: when a general SOS is still open after the 2-minute dedupe, the server upgrades that incident instead of making a second one and answers **200 `created: false`** with `incident.category: women_safety`. App: the SOS sheet's women's-safety row then says "Alert already sent. It is now a women's-safety case and our safety team is on it." (`SosResult.incidentCategory` is read too).

## BE-88: parcel delivery by bike (2026-10-16, app T-522)

- **Tier.** `parcel` is a catalogue key (`VEHICLE_TYPE_KEYS`); GET `/public/vehicle-types` and POST `/rides/estimate` entries carry `parcel: true` (and `base_vehicle_type: bike`). It is listed only while an admin has it active (seeded off). The app keeps `parcel: true` on the type/quote, **leaves it out of the ride vehicle list** (`rideVehicleTypes`), and shows **"Send a parcel"** on passenger Home only while the cached catalogue lists it (and no ride is in progress). The parcel marker and option glyph are the bike.
- **GET `/parcels/options`** (any signed-in user, throttle 60/min): `{tier_active, vehicle_type, base_vehicle_type, currency, max_declared_value, cash_on_delivery: false, categories [{key,label}], sizes [{key,label,max_weight_kg}], prohibited_items [string], declaration, rules_version, code_digits (4-6), return_reasons [{key,label}], refusal_reasons [{key,label}]}`. The form, the declaration, the driver's reason sheets and the code length all come from it (cached 10 min in memory; a 422 `parcel.rules_version` reloads it). `tier_active: false` shows "Parcel delivery is not available".
- **Booking: POST `/rides`** with `vehicle_type: parcel` and `parcel {receiver_name (2-60, letters), receiver_phone (+923XXXXXXXXX; the app sends E.164 from the kit phone field), item_category, size_class, declared_value (whole PKR ≤ max_declared_value), declaration_accepted: true, item_description? (≤ 200), rules_version}`. **No `stops`, no `offered_fare`, no `female_driver_only`, no cash on delivery.** 422 `error.details['parcel.*']` messages are shown under their fields (`parcelFieldErrorsOf`); `vehicle_type` / other keys as the form message; `parcel.rules_version` unticks the declaration and reloads the options. 403 PHONE_NOT_VERIFIED / PASSENGER_BALANCE_OWED are handled as for rides. On 201 the parcel is the active ride and the Booking screen replaces the form.
- **RideResource.** `is_parcel` (bool) and `parcel` for this viewer (`ParcelDelivery::present`): everyone gets `{status, item_category(_label), size_class, size_label, max_weight_kg, cash_on_delivery: false, payment {method: cash, paid_by: sender, collect_at: pickup}}`; the sender and the assigned driver also `item_description, declared_value, rules_version, receiver {name, phone (sender only; null for the driver), phone_masked}, pickup_photo_url (short-lived signed URL; null before pickup or after the 90-day scrub), pickup_photo_at, picked_up_at, delivered_at, return_started_at, return_reason, returned_at, refusal_reason, code {digits, purpose: delivery|return|null, sent, send_count, sends_left, sms_failed, can_resend, resend_available_at, attempts_left, locked_until, blocked, delivery_blocked}, can_call_receiver`; the sender gets `return_code` **only while `status: returning`**. `parcel.status`: requested, accepted, arrived, picked_up, returning, delivered, returned, cancelled. The app shows only `phone_masked` (the full number is never mapped) and the return code only while returning; no other code is ever received or stored.
- **Sender (live ride panel).** Title from `parcel.status`, a Parcel badge, the status timeline (forward or with the return branch; cancelled after the steps reached), receiver (name · masked number), item, the pickup photo, the code state (sent / SMS failed / blocked) and **POST `/rides/{id}/parcel/resend-code`** (sender or driver; answers with the ride). The button shows while `code.can_resend` and counts down to `resend_available_at`. Refusals: 429 `PARCEL_CODE_COOLDOWN` (`error.retry_after`), 429 `PARCEL_CODE_SEND_LIMIT`, 503 `PARCEL_CODE_SMS_FAILED` (the ride is re-read), 423 `PARCEL_CODE_BLOCKED`, 409 `PARCEL_CODE_NOT_SENT` / `PARCEL_WRONG_STEP`.
- **Driver request card.** "New parcel request", the Parcel badge, category · size (weight cap) and "Cash collected at the pickup". The feed never carries the receiver or the declared value.
- **Driver steps (assigned driver only; the sender gets 403, an outsider 404).** These replace `/start` and `/complete` on a parcel; those answer **409 `PARCEL_STEP_REQUIRED`** (the app toasts "This is a parcel…" and re-reads the ride).
  - **POST `/rides/{id}/parcel/pickup`** multipart `photo` (camera only, JPEG/PNG/WebP ≤ 5 MB; the app scales to 1600 px at 0.7) and `pin` (4 digits, when `pin_required`) → `started` (`parcel.status: picked_up`); the receiver gets the code by SMS. PIN refusals as BE-81 (`PIN_INVALID` attempts_left, `PIN_LOCKED` retry_after, `PIN_BLOCKED`); 422 `errors.photo`.
  - The panel tells the driver to **collect the fare in cash from the sender** at the pickup (the driver's `fare`, else `accepted_fare` / `total_fare`).
  - **POST `/rides/{id}/parcel/deliver` `{code}`** → completed. 422 `PARCEL_CODE_INVALID` + `error.attempts_left` / `PARCEL_CODE_REQUIRED` / malformed `errors.code`, 423 `PARCEL_CODE_LOCKED` + `retry_after` (and `code.locked_until` on the ride), 423 `PARCEL_CODE_BLOCKED` (entry hidden; "Return to the sender" becomes the main action), 409 `PARCEL_CODE_NOT_SENT` / `PARCEL_WRONG_STEP` (`error.parcel_status`; the ride is re-read).
  - **POST `/rides/{id}/parcel/return` `{reason, note?}`** (reasons from the options, note ≤ 200) → `returning`; **POST `/rides/{id}/parcel/returned` `{code}`** (the sender's return code) → completed, same code refusals.
  - **POST `/rides/{id}/parcel/refuse` `{reason, note?}`** at the pickup → cancelled with no strike; the app re-reads the driver status.
  - **POST `/rides/{id}/parcel/call-receiver`** while picked up → `{mode: proxy, number, expires_at}` (dialled via `tel:`, never shown) or `{mode: chat_only}` (the app opens the ride chat to ask the sender); 409 `PARCEL_WRONG_STEP` before pickup.
- **Driver opt-in: GET / POST `/driver/parcels/opt-in` `{enabled, accept_rules}`** (`accept_rules: true` required to enable) → `{parcel_opt_in, opted_in_at, has_approved_bike, tier_active, gets_parcel_requests, prohibited_items, rules_version}` (no-store). 409 `NO_APPROVED_BIKE`, 422 `accept_rules`. App: Account → **Parcel deliveries** (bike drivers, or an unknown type): switch, the rules checkbox before the first opt-in, and banners for no approved bike / tier off / getting requests.
- **Stops.** POST/PUT/DELETE stops on a parcel answer 409 `PARCEL_NO_STOPS`; the parcel form has no stops UI.

## BE-106: emergency contact name rule, no overcharge report on unpaid cancelled parcels (2026-10-18, app T-564 / T-563)

- **Registration (POST `/api/auth/register` and the web `/register`).** `passenger_emergency_contact_name` (passengers, still required, ≤ 100) and `emergency_contact_name` (optional, ≤ 100; empty is fine) must be a person name: start with a letter, then Unicode letters, combining marks, spaces, `.`, `'` and `-` (the app's `PERSON_NAME`). Server pattern `^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'-]*$` (`App\Rules\PersonNameFormat`); unlike the app's `\s` it does not accept tabs or newlines. A bad value answers 422 `errors.<field>: ["Use letters only (spaces, dots, apostrophes and hyphens are fine)."]` (the app already maps both keys to `emergencyContactName`). Profile edits are unchanged.
- **RideResource `overcharge_report.can_report`** is now **false on a cancelled parcel with no cancellation fee** (refused at the pickup, or cancelled before it for free: nothing was paid). `report` still shows an earlier report. POST `/rides/{id}/report-overcharge` on such a parcel answers 409 `REPORT_WINDOW_CLOSED`. **Every other ride is unchanged:** a free-cancelled normal ride ("the driver asked for more, so I cancelled") stays reportable for 24 h, as does any ride cancelled with a fee. The app (T-563) can rely on `can_report` and drop its own refused-parcel check.

## BE-107: parcel rating tags (2026-10-18, app T-569)

`GET /rating-tags` keeps `data.tags` exactly as before and adds **`data.parcel_tags`** with the same shape (`{passenger:{positive,negative}, driver:{positive,negative}}`, items `{key,label}`, same star bands). Keyed by the rater's role, as for rides: `parcel_tags.passenger` = the **sender** rating the rider, `parcel_tags.driver` = the **rider** rating the sender. One fetch serves both; no query parameter.

- Sender → rider. Positive: `careful_handling` Handled with care, `on_time` On time, `polite` Polite, `kept_updated` Kept me updated, `delivered_safely` Delivered safely. Negative: `rough_handling` Rough handling, `late` Late, `rude` Rude, `item_damaged` Item damaged, `no_updates` No updates.
- Rider → sender. Positive: `ready_at_pickup` Ready at pickup, `packed_well` Packed well, `correct_details` Correct details, `polite` Polite. Negative: `kept_waiting` Kept me waiting, `poorly_packed` Poorly packed, `wrong_details` Wrong address or details, `receiver_unreachable` Receiver unreachable, `rude` Rude.

The lists live in `config/ratings.php` (`parcel_tags`) like the ride tags; the app must not hardcode them.

`POST /rides/{id}/rate` (body and errors unchanged): on a ride with `vehicle_type: "parcel"` the tags are checked against `parcel_tags.<role>` for the star band; on any other ride against `tags.<role>` only, so a parcel-only key there is 422 `errors.tags.N`. For app builds before T-569, a parcel ride **also** accepts the ride tag keys while `RATING_PARCEL_ACCEPTS_RIDE_TAGS=true` (default); the server will turn this off once every build sends parcel tags, so T-569 should send only parcel keys on parcel rides. Some keys (`polite`, `on_time`, `late`, `rude`) exist in both sets with the same meaning. The admin ride page labels parcel tags on parcel rides.

### BE-108: vehicle makes per vehicle type (2026-10-18, app follow-up of T-570)

GET `/public/vehicle-types` (no auth, backward compatible: nothing removed or renamed) gains:

- **`meta.vehicle_makes`**: an object keyed by vehicle kind (`car`, `bike`, `rickshaw`, `van`), each a list of make names. Same shape as the app's static `VEHICLE_MAKES_BY_TYPE`. Every vehicle kind is present **whether or not it is active** (with or without `include_inactive`), so registration can always use it. Ride tiers (`car_ac`, `parcel`) are never keys here.
- **`data[].makes`**: the same list on each item (`[]` for `car_ac` and `parcel`).
- `"Other"` is always present exactly once and **last** in every list (the server enforces it, whatever the admin enters).
- Seeded with the exact lists the app shipped with (`config/vehicle_makes.php`, copied into the rate card by migration `2026_10_18_120000_add_makes_to_vehicle_types_table`). Admins edit them on Admin → Fares and commission → Edit (car, bike, rickshaw, van): one make per line, up to 60 makes, 40 characters each, letters/digits/space and `. & ' - /`, no duplicates (case ignored). Audited like other rate-card edits.

```json
{ "success": true, "message": "Vehicle types",
  "data": [ { "key": "bike", "label": "Bike", "...": "...", "makes": ["Honda", "Yamaha", "Suzuki", "United", "Road Prince", "Super Power", "Unique", "Super Star", "Hi-Speed", "Metro", "Crown", "Benelli", "Other"] } ],
  "meta": { "fare_notice": null, "ac": { "vehicle_type": "car", "min_vehicle_year": 2012 }, "vehicle_year": { "min": 1980, "max": 2027 },
            "vehicle_makes": { "car": ["Toyota", "...", "Other"], "bike": ["Honda", "...", "Other"], "rickshaw": ["Sazgar", "...", "Other"], "van": ["Suzuki", "...", "Other"] } } }
```

Registration is unchanged: `vehicle_make` stays free text (`required|string|max:100`), so a make not (or no longer) in the list is still accepted.

App follow-up: the driver wizard's Make list reads `meta.vehicle_makes[vehicleType]` (from the catalogue the registration flow already loads with `include_inactive=1`); fall back to the static `VEHICLE_MAKES_BY_TYPE` when the key is missing (older server) or the request failed. Keep clearing a chosen make that is not in the new type's list.

## BE-109: the no-show fee the server will really charge (2026-10-19, app T-577)

Ride objects (every RideResource response, e.g. GET `/rides/{id}` and the active ride) gain **`no_show_preview`**, for **the ride's driver only** (missing for the passenger, admins and other drivers). Backward compatible: nothing removed or renamed; `fare_policy.cancel_fee` stays the quoted term (what the rate card says), **not** a promise.

- `null` unless the ride is `arrived` (before arrival, once started, cancelled or completed).
- While arrived:

```json
"no_show_preview": { "fee": 50, "fee_applies": true, "capped": false, "verified": true, "cancel_at": "2026-10-19T12:05:00+00:00" }
```

| key | meaning |
|---|---|
| `fee` | Rupees the passenger would be charged by a no-show cancel now. **0 whenever no fee would be charged** (capped, unverified, fees off, no fee on the snapshot). |
| `fee_applies` | `fee > 0`. |
| `capped` | A BE-91 daily cap (per pair or per passenger, Pakistan calendar day) would make it free. It never says which cap and carries no counts. A driver who has not charged this passenger today can infer that the passenger already paid fees to other drivers today; this is accepted, because the cancel result (`cancellation_fee` 0) already reveals it. |
| `verified` | The arrival was verified, or the driver's latest ping is fresh and inside the arrival radius right now (a fresh ping later can still turn this true). |
| `cancel_at` | Same as `no_show_cancel_at`: when "Passenger didn't come" is allowed. |

Computed with the same rules as POST `/rides/{id}/cancel` for the driver (`RideFairness::noShowPreview`: snapshot `cancel_fee`, verified arrival or fresh ping, `capCheck`). The cancel response's `data.cancellation_fee` stays the final word (`"0.00"` when capped).

The passenger side is unchanged: `cancellation_preview.fee_now` already applies the caps (0 when capped).

App (T-577): the driver no-show sheet shows "The passenger pays Rs {fee}" only when `no_show_preview.fee_applies` is true; otherwise "No fee will be charged" (no amount; do not explain caps or other rides). Re-read the ride when the sheet opens (the value can change between arrival and `cancel_at`). Older servers (key missing): don't promise an amount, fall back to the neutral wording. After the cancel, show `data.cancellation_fee` from the response.

## BE-110: server-sent text in the app's language (2026-10-19, app T-523 / T-575)

Every `/api/*` request runs in the language its **`Accept-Language`** header asks for. Two languages are served: **`en`** (default and fallback) and **`ur-Latn`** (Roman Urdu). Backward compatible: no field is added, removed or renamed, and English output is byte-identical to before.

Header parsing (`App\Support\ApiLocale::fromHeader`):

- Ranges are ordered by `q` (then by position); `q=0` ranges are skipped. `en`, `en-US`, `en-PK` → `en`; `ur-Latn`, `ur-latn-PK` → `ur-Latn` (case ignored).
- **Anything else is English**: no header, empty, `*`, plain `ur` (Urdu script) or `ur-PK`, other languages, junk, a malformed `q`, a header over 512 characters. It never errors.
- The app's `ur-Latn, en;q=0.8` → Roman Urdu; `en` → English.
- Responses carry **`Content-Language: en | ur-Latn`** (the language actually used) and **`Vary: Accept-Language`** (caches must key on it). Storing `users.locale` never fails a request: a failed write is logged (user id and exception class only) and the response goes out unchanged.

What is translated:

| Where | What |
|---|---|
| Envelope | `message`, `error.message` and each string in `errors.{field}[]`, on success and error responses, including 401/403/404/405/413/419/429/5xx fixed copy and validation errors. |
| Validation | Laravel's rule messages (`lang/ur-Latn/validation.php`) and the app's own rules (phone, lat/lng, vehicle type, UTF-8). The summary `message` keeps Laravel's shape: first error + "(aur N mazeed ghalti/ghaltiyan)". |
| `GET /rating-tags` | `label` of `tags` and `parcel_tags` (keys unchanged). |
| `GET /public/vehicle-types`, fare estimates | `name` / `label` of a tier while the rate card still has its stock name (`car_ac` → "AC Car"). A name an admin typed is shown as typed. |
| Wallet | `label` of wallet transactions (`type` unchanged). Stored `description` text is not translated. |
| Other labels | ride stop `status_label`; parcel options `categories`, `sizes`, `return_reasons`, `refusal_reasons` (+ a parcel's `item_category_label`, `size_label`); SOS `emergency_numbers[].label`; chat `safety_warning.message`; top-up `failure.message` and poll `message`. |

Never translated: machine values (`code`, `error.code`, enum keys, `status`, `type`, `key`), user-entered text, admin-typed text (broadcasts, banners, rate-card names, review notes), stored descriptions, the parcel `declaration` and `prohibited_items`, SMS to third parties, the SOS `share_message`, the public trip page, and the web admin panel (always English).

Notifications follow the **recipient**, not the request:

- `users.locale` (new nullable column; null = English) is set from the `Accept-Language` of the user's **own authenticated** requests. It is written only when the header names a supported language that differs from the stored one; no header, junk or an unsupported language leaves it as it is.
- Ride and stop notifications (passenger and driver copy, parcel copy), chat (`New message from …`, and the chat `safety_warning` in the WebSocket event), and wallet notifications (settlements, adjustments, top-ups) are written in the recipient's stored language: the in-app row (`GET /notifications` `title` / `body`) and the FCM push alike. A row keeps the language it was written in. Admin broadcasts stay as the admin wrote them. There are no user-facing safety pushes today.

Copy lives in `lang/ur-Latn.json` (sentences keyed by their English text, with `:placeholders` for names, amounts and addresses) and `lang/ur-Latn/*.php` (validation and labels keyed by stable API keys). Loanwords stay in English (Ride, Driver, Wallet, OTP, PIN, SMS, Rs).

App follow-up:

- Send `Accept-Language` on **every** request, authenticated or not (T-523 / T-575 already do this). Send it right after a language switch (any authenticated call does), so the next push arrives in the new language.
- Show the server's `message` / `errors` / labels as they come; keep matching on `code` / `error.code` and `key`, never on message text.
- Messages that already arrived (in-app notification rows) keep their language after a switch; that is expected.

## BE-111: fee wording and parcel notification copy (2026-10-19)

Text only; no field, type or enum changed. Notification `type`, `data` and push data are as before.

- A fee the passenger pays reads **charged to your wallet**, never "added" (which read as a credit): the no-show `ride_cancelled` notification ("… A no-show fee of Rs 50 was charged to your wallet") and the passenger's late-cancel `POST /rides/{ride}/cancel` `message` ("Ride cancelled. A late cancellation fee of Rs 50 was charged to your wallet"). Roman Urdu: "… aap ke wallet se kaat li gayi". Real credits (admin credit, top-up, refund) keep their wording.
- On a **parcel** ride (`vehicle_type` parcel) ride notifications use delivery words. Sender: titles Rider Assigned / Rider Arrived / Parcel Picked Up / Delivery Completed / Delivery Cancelled / Delivery Update; bodies "Your delivery has been accepted by :name", "Your rider is at the pickup", "Your rider cancelled this delivery", "Your rider cancelled. Your delivery is back in the queue for another rider", "Your rider waited at the pickup and cancelled. A no-show fee of :fee was charged to your wallet", "Your delivery was cancelled by Raah-e-Haq support". Driver: New Delivery Assigned / Delivery Completed / Delivery Cancelled / New Delivery Request; "The sender cancelled this delivery" (+ the time-compensation lines with "sender"), "This delivery was cancelled by Raah-e-Haq support". The BE-88 parcel lines (picked up, delivered, returning, returned, refused) are unchanged and still win. Every line has a Roman Urdu translation.

App follow-up: none required (the app shows `title` / `body` as sent). Do not match on notification text.

## BE-112: parcel rules and tier names in Roman Urdu (2026-10-19)

No field added, removed or renamed; English output is byte-identical (anything but `ur-Latn` in `Accept-Language` is English, as in BE-110).

- `GET /parcels/options` `prohibited_items` and `declaration`, and `GET|POST /driver/parcels/opt-in` `prohibited_items`, are served in Roman Urdu for `ur-Latn` (`lang/ur-Latn/parcels.php`, same order as `config/parcels.php`). The translation records the `rules_version` it was written for: when the English rules change and the version is bumped, the English text is served until the translation is updated (never a stale translation of old rules). `rules_version` itself never changes with the language, so the booking `parcel.rules_version` check is unaffected.
- Tier names (`GET /public/vehicle-types` `name`/`label`, fare estimate `label`) in Roman Urdu now match the app's `VEHICLE_LABEL`: car → "Gaari", car_ac → "AC gaari" (was "AC Car"); bike, rickshaw, van, parcel unchanged. English stays "Car" / "Car AC". A name an admin typed on the rate card is still shown as typed in every language.

The BE-110 "never translated" list no longer includes the parcel `declaration` and `prohibited_items`.

App follow-up: none required; show these strings as sent (T-579 keeps local tier fallbacks in the same words).

## BE-113: no duplicate bookings from POST /rides (2026-10-19)

**One active booking per passenger, of any kind.** A ride or a parcel in status `pending`, `requested`, `searching`, `accepted`, `arrived`, `started` or `ongoing` (API status `requested`/`accepted`/`arrived`/`started`) blocks a new `POST /rides` for that passenger, rides and parcels alike. A sender cannot have a parcel and a ride open at once (the conservative rule; relax it later only if product asks). `completed` and `cancelled` rides do not block. An admin booking for a passenger (`passenger_id`) is refused the same way. The check runs inside the booking transaction after a `SELECT … FOR UPDATE` on the passenger's `users` row, so two concurrent requests cannot both pass.

```
409 {
  "success": false,
  "message": "You already have a booking in progress. Open it, or cancel it before booking again.",
  "error": {
    "code": "RIDE_ALREADY_ACTIVE",
    "message": "<same>",
    "ride_id": 202,                       // numeric id: GET /rides/{ride_id}
    "ride_ref": "RIDE-01M59Z…",           // the display ride_id
    "status": "requested",               // API status of the open booking
    "vehicle_type": "car"                // "parcel" when the open booking is a parcel
  }
}
```
Roman Urdu (`Accept-Language: ur-Latn`): "Aap ki ek booking pehle se jari hai. Use kholein, ya nayi booking se pehle use cancel karein." Match on `error.code`, never the text. Order of checks: auth/role/phone (401/403) → Idempotency-Key format and replay → balance owed (403 `PASSENGER_BALANCE_OWED`) → validation (422) → fare checks (422) → **active booking (409)**.

**Optional `Idempotency-Key` header** (8-100 chars of `A-Z a-z 0-9 . _ : -`, same rule as BE-74 top-ups). Send one fresh key (e.g. a UUID) per booking attempt, and the **same key on every retry** of that attempt (timeout, dropped connection, app restart mid-request).
- Same key + same body from the same user within `RIDES_IDEMPOTENCY_TTL_MINUTES` (default 10): `200` with header `Idempotent-Replayed: true` and the same body as the original `201` (`{success:true, message:"Ride request created successfully", data: <ride>}`), showing the ride's **current** state (it may be accepted or cancelled by now). No new ride.
- Same key + different body: `422 { success:false, message:"This request key was already used for a different ride request.", errors:{idempotency_key:[…]}, error:{code:"IDEMPOTENCY_KEY_REUSED"} }`. Body key order does not matter. (Note: BE-74 top-ups answer 409 for this; rides use 422.)
- Malformed key: `422 VALIDATION_ERROR`, `errors.idempotency_key`.
- Keys are per user (another user's identical key is unrelated); after the TTL the key is forgotten. Only SHA-256 hashes of the key and body are stored (`ride_idempotency_keys`), pruned daily.
- Without the header, a retry that reaches the server after the first request committed gets the 409 above with the first ride's `ride_id`.
- The admin web panel (Admin → Rides → Create) applies the same rule under the same lock: it goes back with a `passenger_id` error and the flash "This passenger already has an open booking. Finish or cancel it before creating another. (RIDE-…)"; JSON callers get `409 RIDE_ALREADY_ACTIVE` with `error.ride_id`.

App follow-up (T-…): (1) generate an Idempotency-Key per "Confirm ride/parcel" press and reuse it for automatic retries; (2) treat `200` + `Idempotent-Replayed` like `201`; (3) on `409 RIDE_ALREADY_ACTIVE` open the active-ride screen for `error.ride_id` (GET /rides/{id}) instead of showing an error, offering cancel there; (4) disable the confirm button while the request is in flight.

## BE-114: unanswered ride requests expire (2026-10-19)

**Rule.** A ride or parcel request still without a driver `N` minutes after its latest `requested_at` is cancelled by the server. `N` = admin setting `ride_request_expiry_minutes` (admin settings page, "app" tab; empty = `RIDES_REQUEST_EXPIRY_MINUTES`, default **10**), always between 1 and `RIDES_PENDING_MAX_AGE_MINUTES` (the driver feed age, 10), so a request drivers can no longer see never keeps waiting. The clock restarts when a driver cancel re-queues the ride (BE-85) and when the passenger picks women-mode **"allow any driver"** (BE-87, `requested_at` is set again). Women-mode **"keep waiting"** does not restart it: a women-mode request also ends 10 minutes after booking.

Admin panel: the ride shows "No driver found (expired)"; saving the ride's edit page keeps `no_driver`, and an admin cannot set `no_driver` on any other ride. AI fact packs do not count expired requests as passenger cancels.

**What the app sees** (no new field; `GET /rides/{id}`, `GET /rides?status=…`, the 201 of a later `POST /rides`):
- `status: "cancelled"`, `cancellation_reason: "no_driver"` (new enum value), `cancellation_fee: "0.00"`, `cancellation_charge_reason: null`, `cancelled_at` set, `driver: null`. No fee, no strike, no re-queue.
- It is applied **on read** as well as by the every-minute scheduler: `GET /rides/{id}` (the ride's own viewers only; a 403 changes nothing), the passenger's `GET /rides` (so the active-ride restore `status=requested,accepted,arrived,started` never returns an over-age request) and `POST /rides` (an over-age request never blocks a new booking under BE-113). `POST /rides/{id}/women-mode` on an over-age request answers 409 `RIDE_NOT_SEARCHING` (the ride is cancelled, not revived).
- A driver who accepts at the same moment wins (both are conditional updates on the same row); an accept after the expiry gets the usual 409.

**Notification** (passenger only): type `ride_cancelled`, category `ride`, data `{cancelled_by: "system", reason: "no_driver", requeued: false}`. When the expiry happens inside a new booking (`POST /rides`, or an admin booking for the passenger) only the in-app row is stored, with **no push**, so the passenger does not get "No driver found" while booking again. Push data adds `reason: "no_driver"` next to `requeued: "false"` and `ride_status: "cancelled"`, so the existing routing (`src/features/notifications/routing.ts`) opens ride history / details. In the recipient's stored language (BE-110):
- Ride: "No Driver Found" / "No driver accepted your ride in time, so we cancelled the request. You were not charged. Please try again" — ur-Latn "Koi Driver Nahi Mila" / "Waqt par kisi driver ne aap ki ride accept nahi ki, is liye request cancel kar di gayi. Aap se koi paisay nahi liye gaye. Dobara koshish karein".
- Parcel (BE-111): "No Rider Found" / "No rider accepted your delivery in time, so we cancelled the request. You were not charged. Please try again" — ur-Latn "Koi Rider Nahi Mila" / "Waqt par kisi rider ne aap ki delivery accept nahi ki, …".

App follow-up: while searching, a poll or focus read returning `cancelled` + `no_driver` shows a "No driver found" state (parcel: "No rider found") with **Try again** (re-book the same trip, new Idempotency-Key) and Close; not the "You cancelled / driver cancelled" copy, and no fee line. History/receipt label for `no_driver`: "No driver found · No charge". Optional: a client-side countdown is not needed; the server decides.

### Dispatch visibility, request reach and driver auto-accept (BE-116, BE-120)

**Nearby drivers.** `GET /rides/nearby-drivers` lists every driver with `tiers[]`, the ride tiers that driver can serve under the dispatch rules: an approved vehicle of the kind, `car_ac` only for a car with admin-approved AC, `parcel` only for an approved bike whose driver opted in. `meta.counts.by_tier` and `meta.counts.online_total` count drivers in the radius from the same coarse grid / 2-minute-bucket positions as the map, never split by gender. Optional `vehicle_type` narrows `data` to drivers whose `tiers` include it; counts always cover everyone. Positions, ids and the women-mode availability path are unchanged. Behaviour change: the type filter now requires an approved vehicle of that kind.

**Request reach.** The pending feed records which drivers were shown a request. The driver app reports `POST /rides/{id}/offer-viewed` once per offer card and `POST /rides/{id}/offer-declined` when the driver turns it down (role driver, 30/min); both return the same 404 `OFFER_NOT_FOUND` body unless the feed served that ride to that driver and it is still requested. A declined offer can no longer be accepted by that driver. While a ride is `requested`, its passenger sees `reach: {sent, viewing}` inside `GET /rides/{id}` (and `GET /rides/{id}/reach`; 404 `RIDE_NOT_SEARCHING` otherwise). Women-mode requests show null counts; after "allow any driver" or a requeue only later offers count. No declined count and no driver identity. Offer records are deleted with the ride and after 30 days.

**Driver auto-accept.** `GET`/`PUT /driver/auto-accept` (10 writes/min): on/off, a minimum fare checked against the server's fare, pickup distance 0.5–3 km, tiers from `eligible_tiers` (never parcels) and, for women-mode-eligible drivers, "women passengers only" (on by default). The response carries `limits` for steppers and `unavailable_code`/`unavailable_message`. Eligibility: ≥5 completed rides, <3 cancel strikes in 7 days, no open safety report, not admin-disabled, not auto-turned-off after 2 cancels of auto-accepted rides in 24 h, no simulated-location ping this online session (`AUTO_ACCEPT_LOCATION_CHECK`). A request nobody accepts within the window (admin `auto_accept_window_seconds`, 10–60, default 15) may go to an auto-accept driver who is online with a ping ≤30 s old and accuracy ≤100 m, no implausible jump in 30 min, and the pickup within their distance; picked at random among matches within 0.5 km of the nearest, through the same locked accept as a manual tap. A pair is auto-matched at most once a day and never after a safety incident between them; a passenger who cancels two auto-assigned rides within an hour is not auto-assigned for 24 h. Only the driver's `driver_assigned` notice carries `auto_accepted: true`. Runs on the passenger's ride poll and every minute on the server (`rides:auto-accept`). `POST /tracking/update-location` takes optional `is_mocked` and `accuracy`; send both on every ping. Admin: `POST /admin/drivers/{driver}/auto-accept {disabled, note?}`.


### Driver push flag, earnings commission split, online time (BE-122, BE-123, BE-124)

**Auto-accept flag in the driver push (BE-122).** The driver's `driver_assigned` push (FCM `data`, all strings) carries `auto_accepted: "true"` when the ride was assigned by auto-accept (BE-120). The key is absent for an admin assignment and every other push, and never appears on the passenger's push or the passenger's stored rows. Driver app: with `auto_accepted === "true"` show "Ride accepted for you", otherwise the ordinary assigned copy; pushes sent before BE-122 have no key. Still re-read the ride from the server.

**Earnings commission split (BE-123).** GET `/driver/earnings` `totals` adds `commission_rate` (percent, e.g. `20`; the shared rate when every ride in the period has the same one, otherwise `null`; `null` for an empty period), `commission_amount` (sum of each ride's BE-84 commission) and `booking_fees`. `commission` is unchanged and equals `commission_amount + booking_fees`. Each `series[]` day also gains `commission_amount` and `booking_fees`. The app shows "Commission {rate}%" only when `commission_rate` is not null and never derives a rate itself.

**Driver online time (BE-124).** The server records online sessions: a session starts when the driver goes available/online and is kept alive by location pings; it ends on offline, logout, account suspension, or when no ping arrives for 5 minutes (`RIDES_ONLINE_SESSION_STALE_MINUTES`), in which case it ends at the last ping, so a killed app is never credited time it did not ping. GET `/driver/earnings` `totals.online_minutes` and GET `/me/stats` `online_minutes_today` are whole minutes inside the period (Asia/Karachi days), `null` when the driver has no session yet (hide the stat; never show 0 for null). Time on a ride counts as online; only foreground pings count (B-08). In the first period after deploy only time since the release is counted. Sessions are deleted 400 days after they end (`RETENTION_DRIVER_ONLINE_SESSION_DAYS`).
