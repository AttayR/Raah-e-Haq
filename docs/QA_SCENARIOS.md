# QA Scenarios

QA runs against the **production** backend (the owner's choice, 2026-10-03). Read the safety rules in `CLAUDE.md` first.

## Test accounts (owner fills this in; task B-07)

> Agents must stop if this table is empty. Don't write passwords here. The owner signs in on the simulator manually.

| Role | Account identifier (email or phone, masked ok) | Simulator | Notes |
|---|---|---|---|
| Passenger | naveed…lar@gmail.com | iPhone 17 (iOS 26.5) | Added 2026-10-03 |
| Driver | attayk@…gmail.com | second simulator (e.g. iPhone 17 Pro) | Added 2026-10-03; confirm approved/active |
| Pending user (optional) | _TBD_ | | For T-106 |

**Safe test location:** _TBD_. These are the pickup and dropoff coordinates where real users won't match. Set them on the simulator via Features → Location → Custom Location.

## Rules
- **Data creation.** Scenarios marked **Creates data** need the owner's go-ahead per run, and must finish with their cleanup step.
- **Two simulators.** Two-device scenarios run the passenger and driver apps on two different simulators, each with its own signed-in test account.
- **Credentials.** Agents never type passwords or OTPs. If the app shows a login screen, QA is `BLOCKED` until the owner signs in.

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
