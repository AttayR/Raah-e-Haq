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
3. 4 gap: **Address summary** `bodySmall` `textSecondary`, 1 line, row min height 44 (tap → edit trip) with a trailing `pencil` 16: "{pickup short} → {dropoff short}" + " · {n} stops" when stops exist. **[UI-R10]** *Short* = the place's `name` when the place has one, else the address up to its first comma ("Liberty Market", not "Liberty Market, Gulberg III, Lahore"). The stop count is never ellipsized away: if the line overflows, the dropoff truncates (middle of the line), the " · n stops" suffix stays.
4. 16 gap: **Vehicle list** (FlatList inside the sheet, 8 gap, inset 16): Vehicle option cards (5.25) in the order the API returns. Default selection: the first available type or the last used type (AsyncStorage).
5. **Selected fare block** under the list (8 gap inside): "Offer your fare" stepper only when the estimate returns a band (T-521); fare-lock note `caption` `textSecondary` with a 16 lock glyph; ghost Button `sm` "Fare details" (`information-outline`, trailing chevron) that **expands the Fare breakdown (5.26) of the selected vehicle in place** (§12.5) plus the waiting/cancel policy note; label becomes "Hide fare details". **[UI-R9b review ruling, 2026-10-21]** With the M4 FareTag on the fare row, the lock note shows only inside the open details, once, as the breakdown footnote (`fare.lockTerms`): en "Your fare is fixed once a driver accepts. Pay your driver in cash. Extra stops or waiting time can raise it." / ur-Latn "Driver ke accept karte hi fare fix ho jata hai. Driver ko cash dein. Mazeed stops ya intezar se fare barh sakta hai." **[UI-R10]** Inline, not a modal sheet (§12.5 wins over the earlier modal wording).
6. **Payment row** (ListItem 56, no chevron): leading `cash` 24 `success`, title `body` "Cash", subtitle `caption` `textMuted` "Pay your driver at the end of the trip". (Cash-only; no picker.)
7. **Sticky action bar** (BottomSheet footer, §5.14: 16 top padding, `max(insets.bottom + 8, 16)` bottom): Button `lg primary` **"Request {vehicle name} · {fare}"** as one centred label (§12.5 [UI-R5]; the fare is the passenger's offer when one is set, else the quote). **[UI-R10]** Top hairline (`borderWidth.thin`, `border`) shown **whenever sheet content extends beneath the footer** (not scrolled to the end), hidden when the content ends above it, mirroring the handle-area hairline that appears on scroll. Content must never be cut mid-row against the footer without that line.

## States
| State | Spec |
|---|---|
| Estimating | Route draws; vehicle list shows 3 skeleton cards (72 high); action button disabled with label "Request". **[UI-R10]** Route summary pill hidden until the estimate returns (its numbers come from the estimate). |
| Estimate error | ErrorState compact inside the sheet: "Couldn't get prices", "Try again" (refetch). Route still shown. |
| No vehicles available | EmptyState compact: icon `car-off`, title "No rides available here", body "Try a different pickup or try again in a few minutes." Action disabled. |
| Vehicle unavailable | Card at 0.4 opacity, `caption` "Unavailable", not selectable. |
| Route error | Pins only, no line; summary pill from the estimate's `duration_min`/`distance_km` (server computes them), hidden if the estimate also fails; estimate still requested. |
| Requesting (T-305) | Button `loading`, sheet locked (no drag), back disabled; on success → passenger-finding-driver (sheet content crossfade, no navigation flash). |
| Request error | Toast error with server message or "Couldn't request your ride. Try again."; button re-enabled. |
| Offline | **[UI-R10]** Kit `OfflineBanner` (§5.17, reads `useNetInfo`) at the top of the sheet content; action disabled with label "You're offline". `null` (unknown) connectivity counts as online. |
| Back with a draft | Dialog: title "Discard this trip?", body "Your pickup and drop-off will be cleared.", actions per §5.15 [UI-R3]: "Keep editing" (`ghost`, start; also scrim/Android back) / "Discard" (`destructive`, end). **[UI-R10]** corrected from primary/destructiveSoft to the kit Dialog rule. Never "Cancel ride" before a ride exists. |
| Font 1.3× | Vehicle card grows to 88 high; fare stays on one line (shrinks to 0.8 min scale). |

## Interactions
- Tap a vehicle card: selection moves (150 ms), the button label and fare update, the summary pill updates `duration_min`.
- Drag the sheet to `full` to see all vehicles; the map stays visible above at `half`.
- Haptic `impactLight` on Request.

## Removed
- Stage chips (Pickup/Destination/Vehicle/Fare/Request) with emoji; "Trip Details / Edit Pickup / Edit Dest / Swap" strip; "Add optional stops" block (stops are added on the search screen); client-invented rates; periwinkle colours.
