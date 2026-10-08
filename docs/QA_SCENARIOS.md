# QA Scenarios

QA runs against the **production** backend (the owner's choice, 2026-10-03). Read the safety rules in `CLAUDE.md` first.

## Local test accounts (default for all agent QA; owner approved 2026-10-08)

Local backend only (`http://localhost:8000`, Debug build). Fake seeded data from `~/My-Projects/Raah-e-Haq-backend/database/seeders/UserSeeder.php`. Password: the Laravel factory default in `database/factories/UserFactory.php` (agents read it there; never copy it into docs or reports).

| Role | Email | Simulator |
|---|---|---|
| Passenger | passenger@raah-e-haq.com | iPhone 17 (iOS 26.5) |
| Driver | driver@raah-e-haq.com | second simulator (e.g. iPhone 17 Pro) |
| Pending user | pending@raah-e-haq.com | for T-106 |
| Pending driver (rejected items) | pending-driver@raah-e-haq.com | driver role, status `pending`. One `driver_documents` row (driving_license) rejected with reason "Photo is blurry, please re-upload" and one vehicle (plate QA-REJ-001) rejected with a reason. For the pending/onboarding screen and the re-upload flow (BE-32, `POST /api/profile/documents/{id}`, `POST /api/profile/vehicles/{id}/documents`). A successful re-upload moves the item to `pending`; reseed to get the rejected state back. Needs `AUTH_PENDING_LOGIN_TOKENS=true` in the local backend .env to get a token (BE-25). |
| Rejected user | rejected@raah-e-haq.com | passenger, status `rejected`, reason "QA: documents did not match". Login and every authed request return 403 `ACCOUNT_REJECTED` with `data.rejection_reason` (account-status screen). |
| Suspended user | suspended@raah-e-haq.com | passenger, status `suspended`. Login and every authed request return 403 `ACCOUNT_SUSPENDED` (account-status screen). |
| Admin (web panel) | admin@raah-e-haq.com | browser, http://localhost:8000 |

Every seeded account has a verified phone (`phone_verified_at` set, BE-37), so booking, accepting and referral flows are not blocked by phone verification. The pending driver and its rejected vehicle are kept out of the demo rides and driver locations.

Safe test location (local): Gulberg III, Lahore (31.5204, 74.3587). After `migrate:fresh --seed` these accounts are recreated (BE-41), each time in the same state.

## Production test accounts (owner only; agents never sign in to production)

### Test accounts (owner fills this in; task B-07)

> Agents must stop if this table is empty. Don't write passwords here. The owner signs in on the simulator manually.

| Role | Account identifier (email or phone, masked ok) | Simulator | Notes |
|---|---|---|---|
| Passenger | naveed…lar@gmail.com | iPhone 17 (iOS 26.5) | Added 2026-10-03 |
| Driver | attayk@…gmail.com | second simulator (e.g. iPhone 17 Pro) | Added 2026-10-03; confirm approved/active |
| Pending user (optional) | _TBD_ | | For T-106 |

**Safe test location:** _TBD_. These are the pickup and dropoff coordinates where real users won't match. Set them on the simulator via Features → Location → Custom Location.

## Rules
- **Data creation.** On the local backend, scenarios marked **Creates data** run without asking (owner approved 2026-10-08) and must finish with their cleanup step. On production they need the owner's go-ahead per run.
- **Two simulators.** Two-device scenarios run the passenger and driver apps on two different simulators, each with its own signed-in test account.
- **Credentials.** On the local backend, agents sign in with the local test accounts above. Agents never type production passwords or OTPs; a production login screen means `BLOCKED` until the owner signs in. OTP on local: the code is stored hashed and never logged (BE-16); read it from the `send-otp` response, which echoes `otp_code` only when the local backend runs with APP_ENV=local and APP_DEBUG=true. A resend within 60 s returns 429 (set `OTP_RESEND_COOLDOWN_SECONDS=0` in the local backend .env if a scenario needs rapid resends). Never from production.

## Smoke (read-only)

### SMOKE-01 · App launches · `smoke`
1. Build and launch on the simulator.
2. **Expected:** no red screen and no crash. The Splash (after T-103) leads to Login or Home, depending on the session.

### SMOKE-02 · Passenger home loads · `smoke`
Precondition: passenger test account signed in.
1. Launch.
2. **Expected:** the Home tab renders, the bottom tabs work, and no error toast appears.
3. Open each tab and screenshot it. **Expected:** none crash.

### SMOKE-03 · Driver home loads · `smoke`
Precondition: driver test account signed in, on the driver simulator.
1. Launch.
2. **Expected:** Driver Home renders, and the driver is **offline** by default.
3. Open each tab. **Expected:** none crash.

### SMOKE-04 · Error feedback visible · `smoke`
Precondition: signed out (only run this right after AUTH-E2E-02, before the owner signs back in). Agents type **nothing** into the email or password fields.
1. On Login, leave every field empty and tap Login.
2. **Expected:** visible validation feedback (inline message or toast), the app stays on Login, and nothing crashes.
3. Turn the simulator's network off, type nothing, and tap "Send OTP" or whichever action needs the network and accepts an empty or invalid input. **Expected:** a visible error, not a silent failure.

## Authentication

### AUTH-E2E-01 · Session survives restart
1. Signed in as the passenger. Kill the app and relaunch it.
2. **Expected:** still signed in, with no Login flash (after T-103).
3. Turn on the simulator's network link conditioner set to 100% loss (or turn Wi-Fi off), then relaunch.
4. **Expected:** still signed in, and an offline message is shown. Not logged out.

### AUTH-E2E-02 · Logout everywhere
1. Passenger: Settings → Logout. **Expected:** Login screen.
2. Relaunch. **Expected:** still on Login.
3. **STOP:** the owner signs the passenger back in.
4. Repeat steps 1–3 for the driver, from Driver Home and from Driver Settings.

## Passenger

### PAX-E2E-01 · Search and route (no ride created)
1. Map tab. Allow location.
2. Search for a pickup by typing a known landmark. **Expected:** suggestions appear after typing stops (debounced), and the selection fills the field with the address.
3. Search for a destination. **Expected:** a route polyline appears and a fare estimate is shown.
4. Add one stop. **Expected:** the stop shows an address, not raw coordinates.
5. Go back or reset **without** requesting.

### PAX-E2E-02 · Request and cancel · **Creates data**
1. At the safe test location, set pickup and destination and choose a vehicle.
2. Tap Confirm **once**. **Expected:** the button disables, then the "Looking for driver" state appears.
3. Record the ride ID from the UI or the Metro log.
4. Cancel. **Expected:** the ride shows as cancelled, and the UI returns to idle.
5. **Cleanup check:** the ride's status is `cancelled` (in history, after T-501).

### PAX-E2E-03 · Permission denied
1. Reset the location permission for the app (Simulator: Settings → Privacy, or `xcrun simctl privacy <device> revoke location <bundle>`).
2. Open the Map and deny. **Expected:** an explanation with Retry and Open Settings buttons, plus manual search. Not a dead screen.

## Driver

### DRV-E2E-01 · Online / offline · **Creates data** (driver status, location)
1. Driver simulator, with the custom location set to the safe test location.
2. Go Online. **Expected:** the status changes on both Home and Map, and location updates are sent (Metro log shows success, with no 4xx).
3. Wait 30 s and move the simulator location slightly. **Expected:** an update is sent.
4. Go Offline. **Expected:** updates stop.
5. **Cleanup:** the driver ends offline.

## End to end (two simulators)

### E2E-01 · Full ride · **Creates data**
Preconditions: passenger and driver simulators are both signed in with test accounts, both at the safe test location, and the driver is offline at the start.
1. Driver: go Online.
2. Passenger: request a ride from the safe pickup to the safe dropoff. Note the ride ID.
3. Driver: **Expected:** an incoming request for **that** ride ID appears. If a request with a different ID appears, **do not touch it**. Go offline and report.
4. Driver: Accept. Passenger: **Expected:** driver-assigned details and the driver marker appear.
5. Driver: navigate → Start ride. Passenger: **Expected:** status changes to on trip.
6. Driver: Complete. **Expected:** both sides show completed with the server fare.
7. Passenger: rate (after T-505).
8. **Cleanup:** the driver goes offline. Record the ride ID as completed.

## Real data (feature-completeness audit, 2026-10-08)

These run on the **local backend** only, with the seeded local accounts. "Real" means the value on screen matches the API response for the same account. Check this with a single `curl` GET to `http://127.0.0.1:8000/api/...`, using the token from the Metro log in Debug (never print it in the report), or against the local DB.

### PAX-DATA-01 · Passenger Home, Wallet and Profile show server data · `regression`
Precondition: local passenger signed in; at least one completed and one cancelled ride exist for this passenger (complete E2E-01 first, or seed them); 2 active local banners (BE-10 seeder).
1. Open Home. **Expected:**
   - The stats cards equal `GET /me/stats`.
   - There is no weather widget and no "+12%" chips.
   - The Special Offers show the local banners; with none active, the section is hidden.
   - The recent rides equal the newest rides from `GET /rides`.
   - The notification badge equals `GET /notifications/unread-count`.
2. Pull to refresh. **Expected:** a spinner, then the same or updated values, and no error toast.
3. Turn off the simulator network and pull to refresh. **Expected:** an error state or toast with Retry; the old values are kept, not replaced by fake ones.
4. Open Wallet. **Expected:**
   - The balance and transactions equal `GET /wallet` and `GET /wallet/transactions`.
   - There is no "Add Funds" or "Payment Methods".
   - A new account shows the empty state.
5. Open Profile. **Expected:** the rating, total rides and member-since values equal the profile API; "4.8 / 24 / 2y" never appears.

### PAX-DATA-02 · Saved places persist · **Creates data**
1. Favourites → add Home through the search. **Expected:** it appears with the full address.
2. Kill and relaunch the app. **Expected:** Home is still there (it comes from `GET /saved-places`).
3. Tap Set Pickup. **Expected:** the booking map opens with the pickup filled in.
4. **Cleanup:** delete the place. **Expected:** the empty state.

### DRV-DATA-01 · Driver Home, Profile and Earnings show server data · `regression`
Precondition: local driver signed in, with at least one completed ride.
1. Driver Home. **Expected:** the stats equal `GET /me/stats`, the amounts show `PKR` (never `$`), and the recent rides equal `GET /rides`.
2. Tap Earnings. **Expected:** the Earnings screen; the day/week/month totals equal `GET /driver/earnings`.
3. Driver Profile. **Expected:** the vehicle and licence come from the profile API; "Toyota Corolla 2020" and "DL-123456789" never appear.

### DRV-E2E-02 · Incoming request reaches the driver · **Creates data**
Precondition: two simulators, both at the local safe location; the driver has an approved car.
1. Driver: go Online.
2. Passenger: request a car ride. Note the ride ID.
3. **Expected:** within one poll interval (or instantly with realtime), the driver sees a request card with **that** ride ID, the real pickup address and the server fare.
4. Driver: Reject. **Expected:** the card disappears and the ride stays `requested` for the passenger.
5. **Cleanup:** the passenger cancels; the driver goes offline.

### NOTIF-01 · Notifications from the API (both roles) · `regression`
1. Passenger: complete PAX-E2E-02 (request + cancel). Open Notifications. **Expected:** a "ride cancelled" item from `GET /notifications`; no demo items ("Driver Arriving Soon", "WEEKEND20").
2. Tap the item. **Expected:** it is marked read, and the badge on Home drops by one.
3. Mark all read. **Expected:** the badge is 0 after a relaunch.
4. Driver: open the Notifications tab. **Expected:** a real list or the empty state, not "Driver notifications will be displayed here".
5. FCM (only if the local backend has Firebase credentials configured): the device token appears in `user_devices` after login and is removed after logout.

### CHAT-01 · In-ride chat · **Creates data**
Precondition: an accepted ride between the local passenger and the local driver (E2E-01 up to step 4).
1. Passenger: on the driver-assigned card, tap Message. **Expected:** a thread with the driver's name and no demo messages.
2. Send "test 1". Driver: open the Chat tab. **Expected:**
   - The conversation for that ride shows an unread badge.
   - "test 1" arrives (live with Reverb running, or within the polling fallback).
3. The driver replies. **Expected:** the passenger sees it without leaving the screen.
4. Complete or cancel the ride, then reopen the thread. **Expected:** the history is visible, and the input is disabled with an explanation.
5. With no active or recent rides, the Chat tab shows the empty state, and none of the demo names (Ahmed Khan, Sarah Ahmed…).

### PROFILE-01 · Edit profile and photo · **Creates data** (local only)
1. Profile → edit the name (append " QA") and save. **Expected:** a success toast; after a relaunch the new name shows (it is persisted with `PUT /profile`).
2. Change the photo from the simulator gallery. **Expected:** an upload spinner; after a relaunch the new photo loads from `profile_image`.
3. **Cleanup:** restore the original name.

### SETTINGS-01 · Settings, support and invite (both roles) · **Creates data** (local only)
1. Toggle "Promotional Alerts" off. Relaunch. **Expected:** still off (it comes from `/profile/preferences`).
2. Help & Support. **Expected:** the support email and phone equal `GET /settings/public`; creating a ticket "QA test" shows it in the list.
3. Invite Friends. **Expected:** the share sheet with the referral code; opening it twice shows the same code.
4. Privacy and Terms open the configured URLs.
5. Delete Account: run this only on a throwaway local account that QA registered itself, never on the seeded accounts. **Expected:** a confirmation plus a password prompt, then the Login screen; signing in again fails. Then `migrate:fresh --seed` restores the local DB if needed.
6. **Cleanup:** set the promotions toggle back on; close the QA ticket from the admin panel or with a reseed.

### AUTH-OTP-01 · OTP never shown in the UI (local) · `smoke`
1. Phone login on the local backend. Send the code.
2. **Expected:**
   - There is no OTP value, "Use This OTP" button or "Test Code" text on screen.
   - The code is read from the local DB/log for entry.
   - Verify succeeds.
3. Backend check (BE-16): with `APP_ENV=production` in a feature test, the send-otp response has no `otp_code`.
