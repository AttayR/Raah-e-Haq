# Driver · Drive (home, offline and online)

- **Task:** T-605 (visual) after T-401 (online/offline backed by API), T-402 (location tracker), T-507 (real stats), T-610 (shell).
- **Route:** `DriverTabs/Drive` (tab 1 of 4). Replaces both `DriverHomeScreen` (dashboard) and the `Map` tab (`DriverMapScreen`); the incoming request and trip screens are states of this stack.
- **Audit:** `audit/driver-home-*`, `driver-home-scroll*-*`, `driver-map-offline-*`, `driver-map-online-dark` (Driver Home 1-6, Drive map 1-4).
- **Data:**
  - status: `GET/POST /driver/status` [BE-06] → `online|offline` (+ server refusal reasons: not active, no approved vehicle, ride in progress 409).
  - today: `GET /me/stats` [BE-08] → `earnings_today`, `total_rides`, `rating`, `online_minutes_today`, `acceptance_rate` (if present).
  - vehicle: profile `vehicle` {make, model, color, license_plate, vehicle_type} [BE-15].
  - location: device (foreground only, B-08); upload via `POST /tracking/update-location`.

## Layout
Map full screen (driver's own position as the driver marker, heading-up off), tab bar visible.

**Top overlay** (y = `insets.top + 8`, x 16..386):
1. Left: Avatar 40 in a 48 floating circle (→ Account tab).
2. Centre: **Earnings pill**, height 48, `surface`, radius `pill`, `elevation.2`, padding 20: `caption` `textSecondary` "Today" + 8 + `numeric` `{earnings_today}`. Tap → Earnings tab. Skeleton 96×20 while loading; hidden if the stat is unavailable.
3. Right: IconButton `floating` `crosshairs-gps`.

**Bottom sheet** (snap `peek` only, content height; drag up reveals `half` with today's summary):

*Offline state:*
1. Handle; 20 from top.
2. Row: status dot 10×10 `textMuted` + 8 + `h3` "You're offline" → 4 → `bodySmall` `textSecondary` "Go online to start getting ride requests."
3. 16 gap: **Go online** Button `lg primary` full width (56), leading icon `power` 24. Label "Go online".
4. 16 gap (half): **Today Card**: 3 Stat tiles in a row: `{total_rides}` "Rides" (today count if BE-08 exposes it, else hide), `{online_minutes_today}` formatted "3 h 20 min" "Online", `{rating}` "Rating" with star 16 `ratingStar`. Then a ListItem "Vehicle" with `vehicle_type` glyph, title "{make} {model}", subtitle "{color} · {license_plate}"; trailing chevron → driver-vehicle-documents.
5. Bottom: tab bar height + 8.

*Online state* (crossfade 250 ms; status dot pulses once):
1. Row: status dot 10×10 `success` with a 2pt `successSoft` ring + `h3` "You're online" → `bodySmall` "Looking for rides near you." with an inline 2pt indeterminate bar under the row (40 wide, `success` on `successSoft`; reduced motion: static).
2. 16 gap: Button `lg outline` "Go offline" (leading `power`), full width.
3. Map: a soft 300 m radius circle around the driver (`primary` at 8 % fill, 1pt `primary` at 24 % stroke) indicating the request area; no fake heatmaps.

## States
| State | Spec |
|---|---|
| Loading status | Sheet shows skeleton row + disabled button labelled "Go online". |
| Going online | Button loading ("Go online" with spinner); on success haptic `impactLight`, crossfade to online. |
| Server refuses (not approved / no vehicle) | Dialog "You can't go online yet" with server `message`; action "View documents" → driver-vehicle-documents; "OK". |
| Location permission missing | Online control replaced by the shared-permissions denied card. |
| Location services off / poor GPS | Banner warning in the sheet: "Weak GPS signal. Requests may be delayed." (when accuracy > 100 m for 30 s). |
| Going offline during a ride (409) | Toast warning "Finish your current trip before going offline." |
| Offline network | Offline banner at the top; status shows last known; button shows network toast. Location upload failures are retried silently; after 3 failures show Banner danger "Can't reach Raah-e-Haq. You may not get requests." |
| Incoming request | driver-incoming-request takes over (sheet replaced). |
| Active trip on launch | Restored into driver-to-pickup or driver-trip-in-progress. |
| Initial camera | Device location; if unknown, Lahore default (§9). Never Karachi. |

## Interactions
- Long-press "Go offline" is not required; single tap with no confirmation (going offline is safe). Going online needs no confirmation either.
- Android back on this tab root: standard (exit app); when online, show Toast "You're still online. Go offline to stop requests." once per session.

## Removed
- Dashboard with clipped translucent stat tiles, `$` amounts, demo recent rides, quick-action rows with coloured borders, the unlabeled play/pause FAB, the green-pin "Offline" banner, Sign out on Home.
