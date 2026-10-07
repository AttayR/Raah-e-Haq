# Passenger · Choose a ride (vehicle selection + fare)

- **Task:** T-613 (visual) after T-306 (fare from server), T-310 (vehicle catalogue), T-305 (request safety).
- **Route:** `PassengerBooking/ChooseRide` (map screen; tab bar hidden).
- **Audit:** `audit/passenger-route-vehicle-*`, `passenger-fare-*`, `passenger-discard-dialog-*` (Map defects 5-8).
- **Data:** `POST /rides/estimate` [BE-05] {pickup, dropoff, stops[]} → per vehicle type `{vehicle_type, distance_km, duration_min, fare, breakdown:{base, distance, time, stops}}`; `GET /vehicle-types` [BE-05] → `key`, `display name`, `capacity`, `icon key`. Route polyline from Directions (`useDirections`). Request: `POST /rides` (T-302 payload).

## Layout
Map full screen (edges none) with the route drawn (5.21: pickup pin, dropoff pin, stop pins, route line with casing, draw-on animation) and a BottomSheet with snaps `half` (default) and `full`.

**On the map:**
1. Back IconButton `floating` `arrow-left` at (16, `insets.top + 8`).
2. **Route summary pill** centred at the top, y = `insets.top + 8`, height 48, max width 260: `surface`, radius `pill`, `elevation.2`, padding 16: `numeric` "{duration_min} min · {distance_km} km" (from the selected estimate). Tap → back to search to edit.
3. Camera fits the route above the sheet (§5.21).

**Sheet (`half` = 50 % window; on SE 56 %):**
1. Handle; 24 from top.
2. **Title row:** "Choose a ride" `h2`, x = 16.
3. 4 gap: **Address summary** `bodySmall` `textSecondary`, 1 line: "{pickup short} → {dropoff short}" + " · {n} stops" when stops exist.
4. 16 gap: **Vehicle list** (FlatList inside the sheet, 8 gap, inset 16): Vehicle option cards (5.25) in the order the API returns. Default selection: the first available type or the last used type (AsyncStorage).
5. **Fare details link** under the list: ghost Button `sm` "Fare details" (`information-outline`) → opens a modal BottomSheet with the Fare breakdown (5.26) of the selected vehicle.
6. **Payment row** (ListItem 56, no chevron): leading `cash` 24 `success`, title `body` "Cash", subtitle `caption` `textMuted` "Pay your driver at the end of the trip". (Cash-only; no picker.)
7. **Sticky action bar** (padding 16, `insets.bottom + 8`, top hairline): Button `lg primary` "Request {vehicle name}" with trailing `numeric` fare inside the button right-aligned (label left, fare right, both `onPrimary`).

## States
| State | Spec |
|---|---|
| Estimating | Route draws; vehicle list shows 3 skeleton cards (72 high); action button disabled with label "Request". |
| Estimate error | ErrorState compact inside the sheet: "Couldn't get prices", "Try again" (refetch). Route still shown. |
| No vehicles available | EmptyState compact: icon `car-off`, title "No rides available here", body "Try a different pickup or try again in a few minutes." Action disabled. |
| Vehicle unavailable | Card at 0.4 opacity, `caption` "Unavailable", not selectable. |
| Route error | Pins only, no line; summary pill shows "—"; estimate still requested (server computes distance). |
| Requesting (T-305) | Button `loading`, sheet locked (no drag), back disabled; on success → passenger-finding-driver (sheet content crossfade, no navigation flash). |
| Request error | Toast error with server message or "Couldn't request your ride. Try again."; button re-enabled. |
| Offline | Offline banner; action disabled with label "You're offline". |
| Back with a draft | Dialog: title "Discard this trip?", body "Your pickup and drop-off will be cleared.", actions "Keep editing" (primary) / "Discard" (destructiveSoft). Never "Cancel ride" before a ride exists. |
| Font 1.3× | Vehicle card grows to 88 high; fare stays on one line (shrinks to 0.8 min scale). |

## Interactions
- Tap a vehicle card: selection moves (150 ms), the button label and fare update, the summary pill updates `duration_min`.
- Drag the sheet to `full` to see all vehicles; the map stays visible above at `half`.
- Haptic `impactLight` on Request.

## Removed
- Stage chips (Pickup/Destination/Vehicle/Fare/Request) with emoji; "Trip Details / Edit Pickup / Edit Dest / Swap" strip; "Add optional stops" block (stops are added on the search screen); client-invented rates; periwinkle colours.
