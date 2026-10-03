# Audit: Driver Experience

Audited on 2026-10-03 by reading the code, at commit `9047c5d`. Severity:
- **P0**: crash, data loss or security
- **P1**: broken feature
- **P2**: incorrect behaviour or poor UX
- **P3**: code quality

**Bottom line:** no part of the driver flow works end to end. A driver cannot receive a ride request:
- nothing calls `GET /rides/pending`
- the WebSocket is never opened from a screen that can be reached
- the Map screen's request listener calls a function that doesn't exist

Every later step (accept, start, stops, complete, earnings) is unreachable, mock data, or breaks on response parsing.

## Root causes that cut across the flow

- **Responses are unwrapped twice.** `apiService.get/post/put` already return `response.data`, the body (`api.ts:561-582`). `rideService` then reads `response.data.data` (`rideService.ts:335, 348, 375, 388, 462, 641…`). With the documented `{success, data:{…}}` body, `getRide`, `updateRide`, `acceptRide`, `startRide`, `completeRide`, `addStop` and `markStopCompleted` return `undefined`. *Confirmed in code. Check one live response before fixing, in case the backend nests `data` twice.*
- **`updateDriverLocation` is defined twice (lines 445 and 718).** In a JS class the later one wins, so line 718 runs. TypeScript reports TS2393; Babel doesn't type-check, so the app still runs.
- **`DriverLocation` is declared twice (lines 142 and 166).** The declarations merge, with conflicting `status` types (TS2717), and the merged type now requires `driver_id` and `last_seen_at`. This hides the call-site bug in DRV-03.
- **Two auth slices.** The driver code reads the legacy Firebase slice (`state.auth`) in the Map, pending-approval and `useDriverRequests` code. It never sees the real REST user in `state.apiAuth`.

## Findings

### DRV-01 · P0 · bug: going online throws a ReferenceError
`DriverMapScreen.tsx:148-149, 196, 213`
- `listenToRideRequests`, `setIncomingRide` and `setDriverStatus` are never imported or declared.
- When `auth.uid` is set, tapping Online is a fatal crash in a release build.
- With a normal REST login (`uid` null), the button only flips local state.
- **Fix:** implement go-online with a real driver-status endpoint plus a ride-request subscription, and delete the undefined calls.

### DRV-02 · P0 · bug: ride methods return `undefined` (double unwrap)
`rideService.ts:335-375` and every other `.data.data`
- Accept can succeed on the server, then `ride.passenger_id` throws (`useRide.ts:216`) and the driver sees "Failed to Accept Ride". Start and complete fail the same way.
- **Fix:** return the body's `data`, typed with an `ApiResponse<T>` wrapper.

### DRV-03 · P1 · bug: location upload sends the wrong body
`DriverMapScreen.tsx:136-143` → `useRide.ts:399` → `rideService.ts:718`
- `updateDriverLocation(uid, currentLocation)` passes two arguments to a hook that takes one, so the POST body is the uid string.
- **Impact:** a 422 every 5 s, raised as an unhandled rejection. The backend never sees the driver.
- **Fix:** send `{latitude, longitude, status:'online', speed, heading, accuracy}`, and delete the line-445 method and the line-166 interface.

### DRV-04 · P1 · bug: drivers never see ride requests
`rideService.ts:567-570`, `DriverMapScreen.tsx:333`
- Nobody calls `getPendingRides`, and it hits `GET /rides?status=requested` instead of the documented `GET /rides/pending?driver_id&latitude&longitude`.
- The request card only renders when `currentRide.status==='requested'`.
- **Fix:** while online, poll `/rides/pending` (or use the WebSocket) into a dedicated `incomingRequests` state.

### DRV-05 · P0 · security: client-controlled accept and fare
`rideService.ts:396-402, 427-435`, `DriverMapScreen.tsx:231-236`
- Accept is a generic `PUT /rides/{id} {status:'accepted', driver_id}` instead of `POST /rides/{id}/assign-driver`.
- Complete sends a hardcoded fare of 150, 5.2 km and 15 min.
- There is no 409 handling and no in-flight guard.
- **Impact:** if the backend trusts these fields, every ride is billed PKR 150, and two drivers can both "accept" the same ride.
- **Fix:** use assign-driver, let the server compute the fare, handle 409 "already taken", and disable the button while the request is in flight.

### DRV-06 · P1 · bug: placeholder auth token in the realtime and tracking services
`webSocketService.ts:281-285`, `locationTrackingService.ts:316-319`
- Both return the literal `'your_auth_token_here'` and use raw `fetch`.
- Every subscribe and tracking call gets a 401, and then `result.data.websocket_url` throws.
- **Fix:** use the shared axios client.

### DRV-07 · P1 · bug: WebSocket lifecycle
`webSocketService.ts:83-88, 221-229`
- `unsubscribe()` closes the socket without detaching `onclose`, so it reconnects about 1 s later.
- `onopen` resets the attempt counter, so a socket that opens and then drops reconnects forever.
- There is no documented `{type:'subscribe', channel}` frame, no heartbeat, and no AppState handling.
- **Fix:** keep a "closed by me" flag, use capped backoff with jitter, send the subscribe frame, and reconnect when the app returns to the foreground.

### DRV-08 · P1 · bug: WebSocket event parsing doesn't match the docs
`useRide.ts:341, 363`, `RIDE_MODULE_API_FLOW.md:670-728`
- The handlers read `event.data.ride_id`, but the docs put `ride_id` and `ride` at the top level.
- On `new_ride_request`, the handler calls the passenger function `findNearbyDrivers`.

### DRV-09 · P1 · bug: `navigator.geolocation` is undefined in RN 0.80
`locationTrackingService.ts:54, 271`
- `startTracking` always throws "permission denied".
- **Fix:** use `@react-native-community/geolocation`, which is already installed.

### DRV-10 · P1 · bug: no `watchPosition`
`useNativeLocation.ts:36, 212`
- The same stale coordinate is sent every 5 s.
- **Fix:** add a watcher with `distanceFilter`, and clear it when going offline or on unmount.

### DRV-11 · P1 · architecture: no background location
`AndroidManifest.xml:5-6`, `ios Info.plist:54-57`
- Android lacks `ACCESS_BACKGROUND_LOCATION` and `FOREGROUND_SERVICE(_LOCATION)`.
- iOS declares the `location` background mode, but no code uses it, which is an App Store rejection risk.
- **Fix:** add a foreground-service approach, or remove the iOS mode until it is implemented.

### DRV-12 · P1 · bug: the pending-approval screen (same root cause as AUTH-01)
`AuthFlow.tsx:35-37`, `DriverPendingApprovalScreen.tsx:26-60`
- The status always shows "pending", refresh is a no-op, Sign Out doesn't sign out, and passengers land here too.

### DRV-13 · P1 · bug: the Online toggle is fake and not shared
`DriverHomeScreen.tsx:52, 387`
- Home and Map each keep their own local `isOnline`, and neither calls the API.
- Sign Out on Home uses Firebase, not the API.
- **Fix:** keep driver status in Redux, backed by the API, and use the unified logout.

### DRV-14 · P1 · bug: wrong ride field names
`DriverMapScreen.tsx:285-292, 349-351`
- The code uses `pickup`, `destination`, `fare` and `duration_min`, but `RideResource` has `pickup_latitude`, `total_fare` and `duration_minutes`.
- **Impact:** Markers get undefined coordinates (likely a crash), and the UI falls back to mock values.

### DRV-15 · P1 · dead-code: `DriverRideScreen` is not routed
- It is the only screen with stops and navigation, and it isn't registered in any navigator.
- Its effect lists `connectionId` as a dependency, which opens a duplicate socket.
- **Fix:** register it, navigate to it after accept, and fix the effect.

### DRV-16 · P1 · ui: no reject or cancel
`DriverMapScreen.tsx:337`
- The Reject button's handler is `{/* TODO */}`, and there is no driver cancel UI.

### DRV-17 · P2 · bug: going offline clears every notification; the senders only log
`DriverMapScreen.tsx:158-163`, `useDriverNotifications.ts:45-55`

### DRV-18 · P2 · performance: intervals rebuilt constantly, duplicate trackers
`DriverMapScreen.tsx:135-143`, `useRide.ts:493-505`, `locationTrackingService.ts:162-168`
- The 5 s interval is rebuilt on every location change, and the ride-refresh interval after every refresh.
- The tracker runs both a watch and a 10 s resend.
- Both notification hooks are mounted.
- **Fix:** distance-filtered watcher, and refs for intervals.

### DRV-19 · P2 · ui: fake data and dead controls
`DriverHomeScreen.tsx:81-162`, `DriverProfile.tsx:190-212, 295, 316, 340-378`
- Hardcoded stats, recent rides, vehicle "Toyota Corolla 2020", license "DL-123456789", rating and earnings.
- `$` mixed with PKR.
- The preference "switches" are static Views.
- Profile rows, including Delete Account, have no `onPress`.
- The picked photo is never uploaded.

### DRV-20 · P2 · ui: duplicate `statusText` style key
`DriverHomeScreen.tsx:549 vs 878`
- The later key wins, so the badge text is brown on green or red.

### DRV-21 · P2 · ui: safe area and theme
`DriverHomeScreen.tsx:449`, `DriverMapScreen.tsx:409-412`, most driver screens
- `paddingTop:50` inside SafeAreaView, and absolute `top:50` with no insets.
- Hardcoded hex colours; only the tabs and Notifications use the theme.
- The status bar style flickers between tabs.
- **Fix:** `useSafeAreaInsets`, theme tokens, and one shared header component.

### DRV-22 · P2 · security: FCM token, email and phone logged on every render
`DriverMapScreen.tsx:40, 168-178`, `DriverSettingsScreen.tsx:28-31`, `DriverProfile.tsx:29-33`

### DRV-23 · P3 · dead-code: Firestore bidding leftovers
`useDriverRequests.ts:2-3`, `bidService.ts`, `IncomingRequestCard.tsx`
- The hook imports exports that don't exist and is unused.
- `bidService` is Firestore-based and unreachable.
- `IncomingRequestCard` is never rendered.
- `rideService:1-15` has unused Firestore imports.

### DRV-24 · P3 · architecture: undocumented endpoints
`rideService.ts:460, 477`, `locationTrackingService.ts:345`
- `/tracking/driver/{id}/latest`, `/tracking/drivers-in-radius` (the docs say `/rides/nearby-drivers`) and `/tracking/update-status`.
- The docs have no earnings, history or chat endpoints.
- **Fix:** confirm with the backend team.

## Lifecycle trace

| Step | Status | Findings |
|---|---|---|
| Approval pending | Broken | DRV-12 / AUTH-01 |
| Online / offline | Broken | DRV-01, DRV-13 |
| Location updates | Broken | DRV-03, 06, 09, 10, 11 |
| Receive requests | Broken | DRV-04, 07, 08 |
| Accept / reject | Broken | DRV-02, 05, 16 |
| Pickup → start → stops → complete | Broken or unreachable | DRV-02, 14, 15; fare is mock (DRV-05) |
| Earnings / history | Mock | The buttons only log; the fetched history is never shown |
| Chat | Mock | |

## Feature status

| Feature | Status | Notes |
|---|---|---|
| Pending approval screen | Broken | Wrong slice; can't sign out; refresh is a no-op |
| Go online / offline | Broken | Local only; crash path |
| Location upload | Broken | Wrong argument, placeholder token, one-shot GPS |
| Background location | Broken | |
| Receive ride requests | Broken | |
| WebSocket | Broken | Placeholder token, zombie reconnects |
| Accept ride | Broken | Response parsing; race; wrong endpoint |
| Reject / cancel | Broken | |
| Navigate to pickup / stops | Broken | Screen not routed |
| Start / complete ride | Partial | Responses unparsed; fare hardcoded |
| Earnings | Mock | |
| Ride history | Mock | |
| Notifications tab | Mock | |
| Chat | Mock | |
| Profile | Partial | Name, email and phone are real; the rest is fake |
| Settings | Partial | Logout works; the other rows only log |
| Bidding | Dead | Firestore |
| Theme / dark mode | Partial | |
