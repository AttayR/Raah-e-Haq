# Audit: Passenger Experience

Audited on 2026-10-03 by reading the code, at commit `9047c5d`. Severity:
- **P0**: crash, data loss or security
- **P1**: broken feature
- **P2**: incorrect behaviour or poor UX
- **P3**: code quality

**Bottom line:** a passenger can pick two points, see a route and a made-up fare, and send `POST /rides`. But the request uses a hardcoded passenger ID (11), placeholder addresses and an unmapped vehicle type, and it drops the stops. After that the flow dead-ends:
- the waiting state never changes
- the tracking screen is unreachable, and crashes on mount if reached
- rating is unreachable
- history, wallet, favourites, notifications and chat are all fake

## Lifecycle trace

| Step | Code path | Verdict |
|---|---|---|
| Pickup / dropoff | `PassengerMapScreen` → `DualLocationPicker`/`LocationSearch` → Google Places called directly | Partial |
| Stops | `StopsEditor` + "Add via map" | Drawn on the map only, never sent |
| Vehicle / passenger count | `VehicleOptions` (main); `VehicleSelector`/`PassengerCountSelector` (Advanced panel) | Main: wrong `vehicle_type`. Advanced: crashes first |
| Fare | `useFare` → `rideService.calculateFare` (client-side mock) | Mock |
| Create ride | `useRide.requestRide` → `POST /rides` | Partial (bad payload) |
| Waiting for driver | `useRide` polls `GET /rides/{id}` every 10 s | Partial |
| Driver assigned | `DriverAssignedCard` when status is `accepted` | Partial |
| Tracking / completion / rating | `PassengerRideTrackingScreen` + `RatingModal` | Broken (unreachable, crashes) |
| History | `RideHistoryScreen` | Mock |

## Findings

### PAX-01 · P0 · security: Google Maps key in the client, logged in URLs
`src/config/mapsConfig.ts:4`, `useDirections.ts:61-62,111`, `placesService.ts:14,22,64-65`
- Directions, Places and Geocoding are called straight from the app.
- The full URL, including the key, is console-logged.
- **Impact:** the key can be extracted from the app and used to bill your quota.
- **Fix:**
  - **Owner:** restrict the key by package name, SHA-1 and iOS bundle ID, and rotate it.
  - **App:** remove the URL logging, and proxy these calls through Laravel when possible.

### PAX-02 · P0 · security / data integrity: hardcoded passenger ID 11
`PassengerMapScreen.tsx:52,327,457`, `useRide.ts:509-513`
- `useRide(11,'passenger')` and `passenger_id: 11` are hardcoded.
- On mount, the screen also loads `GET /rides?passenger_id=11`.
- **Impact:** every ride is created as user 11. If the backend doesn't filter by token, a passenger sees another user's rides.
- **Fix:** take the user ID from `state.apiAuth.user`. Better still, the backend derives it from the token.

### PAX-03 · P0 · crash: the Advanced ride panel crashes on "Pickup Location"
`AdvancedRideRequestPanel.tsx:406-420` → `LocationSearch.tsx:21`
- The panel passes `visible/onClose/onLocationSelect/placeholder`, but `LocationSearch` expects `mode/query/onChangeQuery/onSelect`.
- `query.length` therefore runs on undefined and throws a TypeError, and the ErrorBoundary replaces the map screen.
- **Fix:** delete the panel, or rewrite it on the real API.

### PAX-04 · P1 · bug: the ride payload is wrong
`PassengerMapScreen.tsx:456-465`
- `pickup_address` and `dropoff_address` are the placeholders "Pickup Location" and "Destination Location".
- `vehicle_type` is the raw ID (`economy`, `comfort`, `premium`). The docs use `car`, `bike` and so on.
- `stops`, `passenger_count` and `special_instructions` are not sent.
- **Fix:** write one payload builder that keeps the address text, maps the vehicle type and includes stops with `stop_order`.

### PAX-05 · P1 · bug: no ride status state machine
`PassengerMapScreen.tsx:825-847`, `useRide.ts:494-506`
- After the request, `stage='requesting'` never changes. `ongoing`, `completed` and `cancelled` are not handled.
- `DriverAssignedCard` renders under the "Requesting…" card.
- Polling never stops, and the interval is rebuilt on every poll because the effect depends on the `currentRide` object.
- The WebSocket subscription is never called.
- **Fix:** drive the UI from a ride status machine, stop polling on terminal states, and depend on `currentRide?.id`.

### PAX-06 · P1 · bug: the tracking screen crashes and is unreachable
`PassengerRideTrackingScreen.tsx:4,8,25,55`
- It imports `rateRide`, `listenToActiveRide` and `RideRequest`, which don't exist (`rideService` only has a default export), so it throws on mount.
- It uses a Firestore-style data shape, and nothing navigates to it.
- The docs have no rating endpoint.
- **Fix:** rebuild it on `GET /rides/{id}` plus driver location, navigate to it on `accepted`, and agree a rating endpoint with the backend.

### PAX-07 · P1 · bug: the fare is a client-side guess
`rideService.ts:578-606`, `useFare.ts`, `PassengerMapScreen.tsx:197,753-756,808-819`
- The fare is calculated from straight-line distance (50 + 25/km), with 150 as the fallback.
- The breakdown shows 30/km + 2/min, which doesn't add up to the total.
- The vehicle multipliers are invented.
- The fare is never sent; the server sets its own.
- **Impact:** the price shown is not the price charged.
- **Fix:** use a server fare-estimate endpoint, or at least the route distance. Show the backend's `total_fare`.

### PAX-08 · P1 · bug: double-tap creates two rides
`FareDetails.tsx:33`, `PassengerMapScreen.tsx:820`
- **Fix:** disable the button while loading, and send an idempotency key.

### PAX-09 · P1 · bug: rides orphaned on the server
`PassengerMapScreen.tsx:369-395,140-148`
- Pressing Cancel during an in-flight create only resets the UI.
- Leaving the screen calls the global `cancelAllRequests()`, which aborts every request in the app, including `createRide`.
- **Fix:** use per-request cancel tokens, and cancel on the server once the ride ID is known.

### PAX-10 · P1 · architecture: the active ride is not in global state
`PassengerBottomTabs.tsx:56`, `PassengerStack.tsx:33`, `rideSlice.ts`, `tripSlice.ts`
- `PassengerMapScreen` is mounted twice (as a tab and as a stack screen), each instance with its own local `useRide`.
- `rideSlice` and `tripSlice` are never dispatched, and their statuses don't match the API.
- **Impact:** the active ride is lost when switching screens or restarting, and can't be resumed.
- **Fix:** keep the active ride in Redux, restore it on launch from `GET /rides?status=requested,accepted,ongoing`, and keep a single map route.

### PAX-11 · P1 · bug: permission denied leaves a dead screen
`PassengerMapScreen.tsx:496-520`
- The screen shows "Initializing Map…", and its Retry button only renders in a state that can't happen.
- **Fix:** show a permission prompt with retry and an open-settings option, or fall back to the default region with manual search.

### PAX-12 · P1 · ui: the driver-assigned card is static
`DriverAssignedCard.tsx:21-22`, `PassengerMapScreen.tsx:846`
- Call and Message aren't wired.
- The ETA is the literal "5 min".
- It shows `vehicle_type` instead of the plate or model.
- There is no driver marker on the map.
- **Fix:** wire Call to `Linking` (tel:) and Message to chat, poll the driver location, and show the vehicle fields.

### PAX-13 · P2 · bug/perf: location search
`LocationSearch.tsx:18-38`
- It calls Places on every keystroke, with no debounce, no `sessiontoken` and no `components=country:pk`.
- Picking a result doesn't replace the typed text. The address is discarded; only the coordinates are passed on (`DualLocationPicker.tsx:39,45`).
- There is no error state.
- **Fix:** debounce about 300 ms, add a session token, return the address too, and add empty and error states.

### PAX-14 · P2 · ui: any map tap resets the trip, even during `requesting`
`PassengerMapScreen.tsx:234-240`
- **Fix:** only accept map taps in an explicit "choose on map" mode.

### PAX-15 · P2 · ui: stops shown as raw coordinates; changing pickup doesn't refetch the route
`StopsEditor.tsx:22`, `PassengerMapScreen.tsx:707`

### PAX-16 · P2 · ui: triple feedback for every outcome
`useRide.ts:92,137,179`, `PassengerMapScreen.tsx:332,336-337,470`
- Success shows a toast, then a modal, then an Alert.
- Failure shows a modal, then `handleError`, then an inline banner.
- "Try Again" only logs to the console.
- **Fix:** one feedback path per outcome.

### PAX-17 · P2 · architecture: notification hooks run twice, and the senders do nothing
`useRide.ts:84-85,108-134`, `usePassengerNotifications.ts:58-126`
- The passenger hook also starts `useDriverNotifications`, and the screen starts `usePassengerNotifications` again with the literal string `'passenger_id'`.
- The `send*Notification` functions only log.
- `fcmToken` and `hasPermission` are never returned.
- When Home unmounts, every notification is cleared.
- **Fix:** let the backend fan out notifications, remove the no-op senders, and split `useRide` into passenger and driver hooks.

### PAX-18 · P2 · privacy: Nominatim fallback and PII logs
`placesService.ts:31-60`, `PassengerHomeScreen.tsx:94-101,143-145`
- Coordinates are sent to OpenStreetMap Nominatim, whose policy forbids app-scale use.
- The user object and FCM token are logged on every render.

### PAX-19 · P3 · dead-code: rideService duplicates
`rideService.ts:1-15,142/166,398,682`
- Unused Firestore imports.
- `DriverLocation` is declared twice with conflicting types.
- `updateDriverLocation` is implemented twice; the second wins.

### PAX-20 · P3 · dead-code: PassengerMapScreen leftovers
`PassengerMapScreen.tsx:114-170,550-559,83-90`
- Two AppState effects, one of which is a no-op.
- Two nested `MapErrorBoundary`s.
- An artificial 1 s map delay.
- Unused state.

### PAX-21 · P3 · ui: theme ignored
`PassengerMapScreen.tsx:731-843`, most of `components/passenger/*`
- Hardcoded colours (`#667eea` isn't even the brand primary), large inline styles, and no dark mode.

### PAX-22 · P3 · architecture: oversized files
- `PassengerHomeScreen` is 1191 lines, `PassengerMapScreen` is 1042, and `useRide` is 828 (mixing driver and passenger logic).
- **Fix:** split into a booking-flow container with one component per stage.

### PAX-23 · P1 · bug: car ride requests always fail (422)
`src/screens/Passenger/PassengerMapScreen.tsx` ~471 (`onRequestRide`)
- Sends `vehicle_type: selectedVehicle` ('economy', 'comfort', 'premium') without the `vehicleTypeMapping` the other path uses. The server accepts only car, bike, rickshaw or van, so only Bike can be booked.
- Also hardcodes `passenger_id: 11` and the addresses 'Pickup Location' and 'Destination Location'.
- The expected 422 goes to logger.error, which shows a red LogBox.
- Found in QA run 2026-10-08-T-110.

### PAX-24 · P2 · bug: tapping a driver marker sets the destination
- The map `onPress` handler doesn't ignore `nativeEvent.action === 'marker-press'`, so tapping a nearby-driver marker sets the destination and opens the Vehicle sheet. The callout (vehicle · ~ETA) is never shown.
- Found in QA run 2026-10-08-T-110.

## Duplicates: which one is used

| Pair | Used | Notes |
|---|---|---|
| RideRequestPanel vs AdvancedRideRequestPanel | Advanced only (and it crashes) | RideRequestPanel is imported nowhere |
| StopsEditor vs StopManager | StopsEditor | StopManager only via the crashing Advanced panel |
| VehicleOptions vs VehicleSelector | VehicleOptions | VehicleSelector is Advanced only; the vehicle lists differ |
| LocationSearch vs DualLocationPicker | Both | Composition, not duplication |
| `PassengerMap.tsx` | Unused | Dead, and it also references `Text` without importing it |
| `paymentService.ts` | Unused | Mock |
| `rideSlice` / `tripSlice` | Never dispatched | |

## Mock or hardcoded data shown as real

- **Home:** weather "28°C Sunny", notification badge fixed at 2, fake stats, offers that expired in Dec 2024, fixed recent rides (`PassengerHomeScreen.tsx:36-37,230-273`).
- **RideHistory:** `SAMPLE_RIDES`; the Details button does nothing.
- **Wallet:** balance 1200, and "Add Funds" adds 500 to local state only. Users will believe money was added.
- **Favourites:** local state only, lost when the screen closes.
- **Notifications:** hardcoded, even though the `/notifications` API and the `useNotifications` hook exist.
- **Chat:** dummy chats and local-only messages.
- **Settings:** local toggles only.

## Leaks and cleanup

- `useNativeLocation` only takes single readings and never calls `watchPosition`, so the passenger's own position doesn't update.
- The ride poll keeps running after the ride ends, and keeps running while the tab is unfocused, because the Map tab stays mounted.

## Feature status

| Feature | Status | Notes |
|---|---|---|
| Map / current location | Partial | Single reading only; dead screen if permission is denied |
| Pickup / dropoff search | Partial | Key in the client, no debounce, address lost |
| Choose on map | Partial | Accidental taps reset the trip |
| Route polyline | Works | Directions called from the client |
| Stops | Broken | Never sent |
| Vehicle selection | Partial | Wrong `vehicle_type` values |
| Passenger count / instructions | Broken | Only in the crashing panel |
| Fare estimate | Mock | |
| Create ride | Partial | ID 11, placeholder addresses, no double-tap guard |
| Waiting for driver | Partial | No timeout, no status transitions |
| Driver assigned | Partial | No driver location; Call/Message dead |
| Live tracking | Broken | |
| Ride start / complete | Broken | Statuses not handled |
| Cancel ride | Partial | Only works once the ride ID is known |
| Rating | Broken | No function, no endpoint |
| Ride history | Mock | |
| Wallet / payments | Mock | |
| Favourites | Mock | |
| Notifications | Mock | |
| Chat | Mock | |
| Active-ride restore | Broken | |
