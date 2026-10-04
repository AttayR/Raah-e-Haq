# Backend Handoff: Raah-e-Haq Laravel API

**For:** the backend (PHP/Laravel) developer · **From:** mobile app team · **Date:** 2026-10-04
**Context:** the mobile app is being hardened for production. These items are on the backend side, and the app can't be finished or tested without them. They are ordered by urgency.

Each item has: **Problem → What we need → How we'll verify.**

---

## 🔴 P0: Urgent (the app is completely down / security)

### 1. Production API is unreachable (SSL + Laravel not served)
**Problem** (checked 2026-10-03, still failing):
- `https://raahehaq.com` fails the TLS handshake with `tlsv1 alert internal error (alert 80)` for SNI `raahehaq.com` and `www.raahehaq.com`. The server only presents the Hostinger default cert `CN=*.hstgr.io`, so there is no certificate for our domain.
- Over plain HTTP, `http://raahehaq.com/api/user` returns a **Hostinger 404 HTML page**, not Laravel JSON. `http://raahehaq.com/` returns a Hostinger `403 Forbidden`.
- The server IP is `45.152.46.127` (LiteSpeed, hPanel).

**What we need:**
1. hPanel → raahehaq.com → Security → SSL: install or renew the Let's Encrypt cert, and enable Force HTTPS.
2. Make sure the domain's document root points to Laravel's `public/` directory and the app is deployed (`.env`, `php artisan config:cache`, `route:cache`).
3. Check `storage/logs/laravel.log` for boot errors.

**Verify:**
```bash
curl -i https://raahehaq.com/api/user -H "Accept: application/json"
# expected: HTTP/2 401 with a JSON body (not HTML, not a TLS error)
```
The app repo also has `yarn api:health`, which runs 19 read-only checks.

### 2. `POST /auth/send-otp` returns the OTP in the response
**Problem:** the response contains `otp_code` (documented in API_DOCUMENTATION.md, and the app used to display it). Anyone can log in as any phone number without owning the SIM.

**What we need:**
- Never return `otp_code` in production. Send it only by SMS.
- Rate-limit `send-otp`, `verify-otp` and `login` per phone and IP, and limit OTP attempts (e.g. 5 attempts, 5-minute expiry).
- If you need a test bypass, allow it only in a non-production environment, or for a whitelisted test number.

**Verify:** the `send-otp` response has no code field; repeated calls get `429`.

### 3. Rides must belong to the authenticated user, not to a client-sent ID
**Problem:** the app has been sending a hardcoded `passenger_id: 11` on `POST /rides` and `GET /rides?passenger_id=11`. If the backend trusts this field, every ride is created as user 11, and any user can list another user's rides.

**What we need:**
- `POST /rides`: take the passenger from the token (`auth()->id()`) and ignore any `passenger_id` in the body.
- `GET /rides`, `GET /rides/{id}`: return only rides where the caller is the passenger or the assigned driver (admin excepted). Use Laravel Policies.
- Same rule for `/tracking/ride/{ride}/path` and notifications.

**Verify:** user A requests user B's ride and gets `403`/`404`.

### 4. Ride acceptance and fare must be server-controlled
**Problem:** the app accepted rides through a generic `PUT /rides/{id} {status:'accepted', driver_id}` and completed them by sending `fare: 150, distance_km: 5.2, duration_min: 15` from the client.

**What we need:**
- `POST /rides/{id}/assign-driver`: **atomic** (DB transaction or row lock). If the ride is already taken, return **`409 Conflict`**. The driver comes from the token.
- Block status transitions through generic `PUT /rides/{id}`, or validate them with a state machine (`requested → accepted → ongoing → completed`, `cancelled` from allowed states only, and only by the right party).
- On complete: the **server calculates the fare** from distance, time and tariff, and ignores any client `fare`.

**Verify:** two drivers accept the same ride at the same time; one gets 200 and the other gets 409.

---

## 🟠 P1: Needed for the app to work end to end

### 5. Consistent user object in every auth response
`login`, `verify-otp`, `GET /user` and `GET /auth/profile` must all return the same user shape, including:
- `role`: `"passenger" | "driver"` (today we see `user_type` in some responses, `roles[]` in others, or nothing)
- `status`: `"pending" | "active" | "suspended" | "rejected"`, plus a `status_reason` for rejected or suspended

Without `role`, the app can't route after login.

### 6. Token refresh contract
Confirm whether `POST /auth/refresh` exists and works with the current Bearer token (Sanctum or JWT?). Also tell us the token lifetime. The app will refresh once, and log out on a second 401.

### 7. Driver registration: document field names
Drivers upload a profile photo, a CNIC picture, license front and back, and 4+ vehicle photos, plus a `license_number`. Please send the exact multipart field names and the validation rules for `POST /auth/register` when the user type is driver (e.g. `driver_picture`, `cnic_picture`, `license_front`, `license_back`, `vehicle_pictures[]`?). Include max file size and allowed MIME types.

Also: what is the allowed range for vehicle `year`? The app currently caps it at 2025.

### 8. Endpoints the app needs (please confirm, or tell us they don't exist)

| Need | Suggested endpoint | Notes |
|---|---|---|
| Fare estimate before booking | `POST /rides/estimate` {pickup, dropoff, stops[], vehicle_type} → {fare, distance_km, duration_min, breakdown} | So the price shown = the price charged |
| Driver online/offline | `POST /driver/status` {status: online/offline} | |
| Pending rides for a driver | `GET /rides/pending?latitude&longitude&radius&vehicle_type` | The driver comes from the token; confirm the params |
| Driver location update | `POST /tracking/update-location` {latitude, longitude, heading, speed, accuracy} | Confirm the body |
| Rating | `POST /rides/{id}/rate` {rating 1-5, comment} | |
| Ride history | `GET /rides?status=completed,cancelled&page=` for the caller | Paginated |
| Driver earnings | `GET /driver/earnings?period=` | Or tell us it doesn't exist; we'll hide it |
| Push token | `POST /devices` {fcm_token, platform} and `DELETE /devices/{token}` on logout | For FCM |
| Vehicle types | `GET /vehicle-types` | So app and backend use the same values (car, bike, …) |

**The app currently calls these, but they're not in the docs.** Do they exist?
- `GET /tracking/driver/{id}/latest`
- `GET /tracking/drivers-in-radius` (the docs say `/rides/nearby-drivers`)
- `POST /tracking/update-status`

### 9. WebSockets
The app connects to:
- `POST /websocket/subscribe-ride` and `POST /websocket/subscribe-driver`, which return a `websocket_url`
- `wss://raahehaq.com/ws/notifications/{userId}`

Please confirm:
- Which server is it (Laravel Reverb, Pusher, soketi, or custom)?
- Is it running in production?
- **Does it authenticate the connection?** `/ws/notifications/{userId}` has no token in the URL. If the server doesn't check auth, anyone can read another user's notifications by changing the ID.
- The exact event payload format (`ride_status_changed`, `new_ride_request`, …).

---

## 🟡 P2: Strongly recommended

10. **A staging environment** (e.g. `staging.raahehaq.com`) with its own database, so mobile QA never touches real users. Right now there is none: every branch and all testing hit production.
11. **Up-to-date API docs.** An OpenAPI/Swagger spec or a Postman collection, generated from the real routes (`php artisan route:list --path=api`). `API_DOCUMENTATION.md` in the app repo still says `http://localhost:8000/api`.
12. **A consistent JSON error format:** `{success:false, message, errors:{field:[...]}}` for 422; JSON (never HTML) for 401, 403, 404, 409, 429 and 500, even on unknown routes.
13. **A Google Maps proxy** (optional): `GET /maps/directions` and `GET /maps/places/autocomplete`, so the Maps REST key stays on the server instead of inside the app.

---

## Reply template (please fill in and send back)

```
1 SSL/API up:            done / ETA ___
2 OTP not returned:      done / ETA ___
3 Rides scoped to user:  done / already so / ETA ___
4 Atomic accept + fare:  done / already so / ETA ___
5 role/status in user:   field names = ___
6 Refresh:               Sanctum|JWT, lifetime ___, endpoint works yes/no
7 Driver doc fields:     ___
8 Endpoints:             (list which exist, with paths)
9 WebSocket:             server = ___, auth = yes/no, events doc = link
10 Staging:              URL ___ / not possible
11 API docs:             link ___
```
