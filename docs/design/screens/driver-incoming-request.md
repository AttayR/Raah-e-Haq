# Driver · Incoming ride request

- **Task:** T-605 (visual) after T-403 (poll `/rides/pending`), T-404 (accept via assign-driver, 409, reject), BE-02, BE-03, BE-12 (`RideRequested`).
- **Route:** state of `DriverTabs/Drive` while online.
- **Current source:** `components/driver/IncomingRequestCard.tsx` ("New Ride", "From:", "To:", "Fare: PKR", Accept, Bid). Not captured live.
- **Data:** pending ride (`RideResource`): `id`, `pickup_address`, `pickup_latitude/longitude`, `dropoff_address`, `dropoff_latitude/longitude`, `stops[]`, `vehicle_type`, `passenger_count`, `total_fare`, `distance_km`, `duration_minutes`, `payment_method`, `passenger` (`name` first name only, `rating` [BE-15]; no phone, BE-20). Driver-to-pickup distance/time: computed client-side from the driver location (Directions) or returned by BE-02 if added. Expiry: server `expires_in` if provided, else 15 s client window.

## Layout
Map: camera fits driver → pickup → dropoff; route preview pickup→dropoff `routeLine`, driver→pickup dashed `routeLineTraveled` (dash 6/6). Tab bar hidden while the request is shown.

**Request sheet** (fixed, content height, `elevation.3`; not dismissible by swipe):
1. 20 from top: **Header row:** Badge status pill info with vehicle glyph 16 + vehicle display name; trailing `numericSmall` countdown "{s}s" in `textSecondary`.
2. 12 gap: **Fare** `numericXL` `{total_fare}` + 8 + Badge neutral `cash` "Cash" (vertically centred).
3. 4 gap: `bodySmall` `textSecondary` "{distance_km} km trip · about {duration_minutes} min".
4. 16 gap: **Pickup ETA line** `title` `textPrimary`: "{eta_to_pickup} min · {distance_to_pickup} km away" (hidden until computed; skeleton 160×20).
5. 12 gap: **Raah line** (5.23, driving size: text `body` 1 line each, row min 52): Pickup `{pickup_address}`, stops (if any: "+{n} stops" collapsed row, `caption`), Drop-off `{dropoff_address}`.
6. 12 gap: **Passenger row** `caption` `textSecondary`: Avatar 32 initials + "{first name}" + rating star 16 `{rating}` (or "New") + " · {passenger_count} passengers" when > 1.
7. 20 gap: **Actions** row, 12 gap: Button `lg secondary` "Decline" (flex 1) and Button `lg primary` "Accept" (flex 2) with the **countdown ring**: a 3pt ring drawn on the Accept button border depleting clockwise (`onPrimary` at 100 % on `primary`); at ≤5 s the ring and countdown turn `warning`.
8. Bottom `insets.bottom + 8`.

No "Bid" button (no product decision or API on record; T-404 scope is accept/reject).

## States
| State | Spec |
|---|---|
| Arrives | Sheet springs up (§6.2); haptic `notificationWarning`; sound if "Sound alerts" preference is on (BE-11 prefs); screen kept awake. |
| Multiple pending | Show one at a time, nearest first; a `caption` "+{n} more" chip in the header row. |
| Accepting | Accept button loading; Decline disabled; countdown paused. |
| Accepted | Haptic `notificationSuccess`; crossfade to driver-to-pickup. |
| Taken by another driver (409) | Sheet content: icon circle 64 `surfaceAlt` `car-clock` → `h3` "Ride taken by another driver" → auto-dismiss after 2 s back to online state. |
| Expired | Sheet slides down (200 ms); online state resumes; no toast. |
| Decline | Immediate dismiss (reject call in background); no confirmation. |
| Network error on accept | Toast error "Couldn't accept. Check your connection."; sheet stays if not expired. |
| Long addresses | 1 line each with ellipsis; tapping the Raah line expands to 3 lines each (sheet grows). |

## Accessibility
- Announce "New ride request, {fare}, pickup {eta} minutes away" on arrival. Countdown announced at 10 s and 5 s only. Accept/Decline min 56 high.

## Small device
- Fare `numericL`; passenger row merged into the header row.

---

## Request sheet v2 (UI-R11, 2026-10-20): fare first, countdown Accept

**Supersedes** the Layout, States and Small device sections above where they conflict. **Keeps what ships:** the feed and its polling (T-403), accept with the 409 handling (T-404), one request at a time, the T-552 stops listing (first two stops, then "+N more stops") with the address block scrolling when the sheet hits its cap, the BE-83 offer badge and app-fare comparison, the AC badge (BE-86), the parcel block (BE-88 `ParcelRequestInfo`), offer-viewed after 1 s on screen and offer-declined on decline (T-587 §7.4), and the auto-accepted takeover (T-587 §7.3, restyled in R12).

**Before:** `docs/qa-reports/2026-10-16-t-551-t-552-qa/2-01-driver-request-card-stops.png` (light, stops), `docs/qa-reports/2026-10-19-uir14-t580-qa/15-drv-request-logbox-warning-toast.png` (dark), `docs/design/audit/2026-10-11-prod-audit/ref-driver-incoming-request-light.png`.

### R0. What is wrong today (pt, iPhone 17, `2-01`)

| # | Defect | Where |
|---|---|---|
| 1 | A floating card (x 24–436, 20 inset, radius 16) over the map, not a sheet: it floats 16 above the bottom, so the Accept button sits 60 pt above the home indicator and the map behind is dead space | card y 214–940 |
| 2 | Title "New Ride Request" (Title Case, `h3`) is the first thing; the fare is `numericL` 22 in a row with "0.4 km away / 1 min to pickup", all the same weight | y 245–350 |
| 3 | Decline is a 44 X icon in the corner, Accept is full width: the driver cannot decline with the same thumb, and the X reads as "close" | (391, 260) |
| 4 | No countdown at all: nothing says how long the offer stays | — |
| 5 | The driver's net and the commission (BE-84 `driver_net`, `commission_rate`, `commission_amount`, already in the pending payload) are not shown; owner rule: fare, commission and net per ride | — |
| 6 | Map behind is not framed on the pickup/drop-off; no pins | map |
| 7 | Rider row floats between the route and Accept with no rating star colour rule (dark shot: orange star, light: none) | y 775–830 |

### R1. Placement and map

- The **Drive BottomSheet itself** switches to `request` mode (D7 in `driver-drive-home.md`): no handle, not draggable, height = measured content + footer, capped at **70 % of the window** (iPhone 17: 612; SE: 467); top radius `xl`, `surface`, `elevation.3`. Tab bar hidden while shown (shipped `onRequestShownChange`). Android back = Decline (the same report), never leaves the tab.
- **Map:** pickup pin, numbered stop pins, drop-off pin (M1 orange) and the driver's own vehicle; camera fits all of them (padding top `insets.top + 24`, bottom = sheet height + 24, sides 48), 600 ms ease (Reduce Motion: jump). **No route line** (no Directions request per offer; never a straight line). Max-pickup circle, avatar and locate fade out (150). Status-bar scrim stays.

### R2. Content, top to bottom (iPhone 17, gutter 16)

| # | Block | Spec | Height | Gap after |
|---|---|---|---|---|
| 1 | Top padding | — | 20 | — |
| 2 | **Header row** | wraps; start: tier Badge `neutral` (vehicle glyph 16 from the tier icon key + tier display name from `GET /vehicle-types`, e.g. "Car", "Bike") — or `AcBadge` for `car_ac`, Badge `info` "Parcel" for a parcel; Badge `info` "Passenger offer" (BE-83, shipped `driverFare.offerBadge`); women-mode Badge when the ride says so. End: Badge `neutral` "+{n} more" / "+{n} aur" when more requests are pending | 24 (badge height) | 12 |
| 3 | **Fare** | `numericXL` (34/40, 700, tabular) `textPrimary` `{estimated_fare}` → 8 → Badge `neutral` with `cash` 16 "Cash" (payment from the API; other methods title-cased as shipped), vertically centred on the number. This is the sheet's header for screen readers | 40 | 4 |
| 4 | **Your share** (only when `driver_net` is sent) | `bodySmall` `textSecondary`: "You keep {driver_net} · {commission_rate} commission" ("You keep Rs 362 · 20% commission"); rate formatted as shipped `formatRate`; no rate → "You keep {driver_net}" | 20 | 2 (16 when no offer line follows) |
| 5 | Offer comparison (only for an offer with `serverFare`) | `caption` `textSecondary` "App fare {serverFare}" (shipped) | 16 | 16 |
| 6 | **Metric strip** | full width, `minHeight` 56, `surfaceAlt`, radius `md`; up to 3 equal cells with hairline `border` separators 24 high: value `numeric` (16/20) `textPrimary` 1 line, label `caption` `textSecondary`; cells: "{estimated_pickup_min} min" / "to pickup"; "{estimated_distance} km" / "away"; "{distance_km} km" / "trip" (or "{duration_minutes} min" / "trip" when no distance). A value the API did not send hides its cell; none → strip hidden. Distances via `formatDistance` (one formatter) | 56 | 16 |
| 7 | **Route** | kit `AddressPair` `size="lg"` with labels: pickup 2 lines, stops per T-552 (1 line each), drop-off 2 lines (M1 orange square with edge). This block alone scrolls when the sheet hits its cap; a hairline appears at its top edge while scrolled | ≈ 140 (2 rows) | 16 |
| 8 | **Rider row** | PersonCard `variant="plain"` compact: Avatar 40 (initials fallback) → 12 → name `title` (first name) and rating (star 16 `ratingStar` M2 + `numeric`) or "New rider" `caption` `textMuted`; " · {n} passengers" `caption` when `passenger_count` > 1. No actions (no contact before accepting). Parcel: `ParcelRequestInfo` 12 below | 40 | — |
| F | **Footer** (sticky) | 16 top; row, 12 gap: **Decline** `lg ghost` (flex 1, label "Decline", `primaryText`) and **Accept** `lg primary` (flex 2) with the countdown ring (R3); bottom `max(insets.bottom + 8, 16)` | 16 + 56 + 42 | — |

- **iPhone 17 height** (no stops, one-line rider, with net line): 20 + 24 + 12 + 40 + 4 + 20 + 16 + 56 + 16 + 140 + 16 + 40 + 114 = **518** (59 %, under the 612 cap). With two stops + "more" row: ≈ 620 → capped at 612, the route scrolls.
- **Compact height (< 700, SE):** fare `numericL` (28) instead of `numericXL`; route addresses 1 line each (stops already 1); the rider row moves into the header row's end (Avatar 24 + first name `label` + star) so block 8 disappears; offer comparison joins the net line after " · ". ≈ 20 + 24 + 12 + 28 + 4 + 20 + 16 + 56 + 16 + 90 + footer (16 + 56 + 16) = **374** (56 %, under the 467 cap).
- 1.3× text: header row wraps; the strip's labels may wrap to 2 lines (min height grows), values stay 1 line; the cap holds and the route scrolls.

### R3. Countdown Accept

- Kit `Button` with the `countdown` prop → `CountdownRing` (`shared-trip-sheet.md` TS9): ring 32 at the end of the Accept button, seconds left in the centre, label "Accept" / "Accept karein" centred in the remaining width.
- **Duration:** the server's per-offer window when the pending feed sends one (`meta.offer_seconds`; contract ask, optional), else **20 s** (`REQUEST_DECISION_SECONDS` in `features/driver-requests`), and never past the request's `expiresAt`. The clock starts when the sheet is fully up **and** the app is active (the same moment the offer-viewed timer starts); it runs on wall-clock time (a backgrounded app comes back with the right remainder, or the offer gone).
- **At 0:** treated as a Decline (offer-declined report, hidden on this device as shipped), sheet content leaves per D7; no toast.
- **Accepting:** Accept shows its loading spinner (ring hidden, width kept), Decline disabled, the clock pauses; a late 409 still resolves to R5.
- Haptic: `impactLight` on Accept press (shipped).

### R4. Arrival

- Sheet rises per D7 (spring §6.2); haptic `notificationWarning` + the request sound when "Sound alerts" is on (shipped preference); screen kept awake while shown.
- Content enters as one block (fade + rise 8, 250); the fare is the first thing drawn; no stagger per row.
- Next request in the queue after a decline/timeout/409: content swap (§6.12) without dropping the sheet.

### R5. States

| State | Spec |
|---|---|
| Taken by another driver (409) / no longer available | Content swap: icon circle 64 `surfaceAlt` with `car-clock` 32 `textSecondary` → 16 → `h3` centred "Another driver took this ride" / "Ye ride kisi aur driver ne le li" (no longer available: "This ride is no longer available" / "Ye ride ab dastiyab nahi") → footer hidden; haptic `notificationError`; leaves after 2 s (D7) |
| Network error on accept | Toast error "Couldn't accept the ride. Try again." / "Ride accept nahi ho saki. Dobara koshish karein."; sheet stays, clock resumes if time is left |
| Accepted | haptic `notificationSuccess`; navigate to DriverRide (shipped); the request sheet does not animate out first (the push covers it) |
| Accept refused by the server (offline driver, no vehicle, phone not verified, on a ride) | shipped refusal copy as Toast error; sheet leaves |
| Long addresses | 2 lines each (1 on compact), tail ellipsis; the route block scrolls at the cap; tapping the route does nothing (no hidden expand) |
| Parcel | Header Badge "Parcel"; `ParcelRequestInfo` under the rider row; Accept label unchanged |
| Dark | sheet `surface` #141A2A, strip `surfaceAlt` #1D2438, Accept `primary` #3D5FD0 with `onPrimary` (5.61); ring track white 32 % |
| Roman Urdu | all copy in ur-Latn (R7); "Accept karein" + ring fits the flex-2 button on SE at 1.3× (button 223 pt − ring 56 = 167 for the label, estimated 110) |

### R6. Feed states (no floating card)

Loading, "no requests" and feed errors no longer draw a card: the Drive sheet's subtitle slot says it (`driver-drive-home.md` D2). The shipped first-poll grace (an error waits for a GPS fix or a second failure) stays.

### R7. Copy (i18n, en + ur-Latn ship together)

Keys live in `DRIVER_REQUESTS_COPY` (`features/driver-requests/copy.ts` + `i18n/copy-ur-Latn/rides.ts`); the `driverRequests.` prefix below is that object.

| Key | English | Roman Urdu |
|---|---|---|
| `driverRequests.title` | **delete** after grep (no title on the sheet) | — |
| `driverRequests.decline` (new; replaces `reject` in UI) | "Decline" | "Mana karein" |
| `driverRequests.declineA11y` | "Decline this ride request" | "Ye ride request mana karein" |
| `driverRequests.accept` | "Accept" | "Accept karein" |
| `driverRequests.acceptA11y` | "Accept ride, {s} seconds left" | "Ride accept karein, {s} second baqi" |
| `driverRequests.youKeep` | "You keep {net} · {rate} commission" | "Aap ko {net} milenge · {rate} commission" |
| `driverRequests.youKeepNoRate` | "You keep {net}" | "Aap ko {net} milenge" |
| `driverRequests.metricToPickup` / `metricAway` / `metricTrip` | "to pickup" / "away" / "trip" | "pickup tak" / "door" / "safar" |
| `driverRequests.more` | "+{n} more" | "+{n} aur" |
| `driverRequests.taken` | "Another driver took this ride" | "Ye ride kisi aur driver ne le li" |
| `driverRequests.gone` | "This ride is no longer available" | "Ye ride ab dastiyab nahi" |
| `driverRequests.acceptFailed` | "Couldn't accept the ride. Try again." | "Ride accept nahi ho saki. Dobara koshish karein." |
| `driverRequests.arrivalA11y` | "New ride request, {fare}, pickup {min} minutes away" | "Nayi ride request, {fare}, pickup {min} minute door" |

### R8. Accessibility

- On arrival announce `arrivalA11y`; focus moves to the fare. Countdown announced at 10 s and 5 s only ("10 seconds left" / "10 second baqi"); the Accept label carries the seconds at those points only (not every second).
- Focus order: fare → share line → strip (one element per cell: "3 minutes to pickup") → route → rider → Decline → Accept. Both footer buttons 56 high; the ring is decorative inside Accept.

### R9. Performance

One ring animation on the UI thread + a 1 Hz text; the card is `memo` keyed by request id; no Directions request; markers are the three pins + own vehicle; the feed poll cadence is unchanged; offer-viewed/declined reports unchanged (once per offer).

### R10. Builder notes

- `IncomingRequestCard` becomes `RequestSheetContent` (header row, fare, share, strip, route, rider) rendered inside the Drive sheet; `RideRequestHost` stops absolutely positioning a card and drives the sheet's mode instead. Keep files under ~400 lines (split `MetricStrip` into the kit as `MetricStrip`, also used by R12 and the driver trip).
- Map `driver_net`, `commission_rate`, `commission_amount` and the trip `distance_km`/`duration_minutes` in `PendingRideRequest` (typed, nullable; never computed on the device).
- Tests: countdown start/pause/expiry from wall-clock time, expiry = decline report, 409 swap, compact layout switch, share line hidden without `driver_net`.

### R11. Countdown ring on the takeover and gallery

The dev gallery shows the request sheet with API-shaped fixtures (no stops; 3 stops; offer; parcel; AC) in light/dark and the ring at 20 / 10 / 3 s.

### R12. Auto-accepted takeover (T-587 §7.3, restyled to this anatomy)

Same sheet mode: header row with `check-circle` 24 `success` + `h2` "Ride accepted for you" / "Ride aap ke liye accept ho gayi"; 12 → fare `numericL` + Cash badge; 16 → metric strip (to pickup, away); 16 → AddressPair `lg` pickup row only (2 lines); footer: one **Go to pickup** `lg primary` with the countdown ring counting `AUTO_ACCEPTED_ADVANCE_MS` (5 s), after which it continues to DriverRide by itself (shipped). Haptic `notificationSuccess` + sound (shipped).

### R13. Design review evidence (UI-R11, request)

On the local backend with a local test passenger booking near the online test driver (QA_SCENARIOS local accounts, `docs/QA_SCENARIOS.md`): iPhone 17 request light/dark (no stops), with stops (cap + scroll), offer request, parcel request; ring at ~15 s and ≤ 5 s; 409 taken state (two drivers, local bot per BE-117); auto-accepted takeover; Roman Urdu; 1.3×; iPhone SE light/dark (compact layout). Side-by-side with UI-R10's choose-ride sheet (same fare type, same AddressPair, same footer).
