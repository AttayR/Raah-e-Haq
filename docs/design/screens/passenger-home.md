# Passenger · Home

- **Task:** T-604 (visual) after T-506 (real data) and T-610 (navigation shell).
- **Route:** `PassengerTabs/Home` (tab 1 of 4). Booking is pushed from here (`PassengerBooking` stack); the old `Map` tab is removed.
- **Audit:** `audit/passenger-home-*`, `passenger-home-scroll1-*`, `passenger-home-scroll2-*` (Home defects 1-12).
- **Data:**
  - user: stored profile (`name`, `profile_image`).
  - current address: `placesService.reverseGeocode` of the device location (street-level `formatted_address`; never show a Plus Code: if the result starts with a Plus Code pattern `^[23456789CFGHJMPQRVWX]{4}\+`, use the next address component set).
  - saved places: `GET /saved-places` [BE-14] → `label`, `type` (home|work|other), `address`, `latitude`, `longitude`.
  - recent destinations and recent rides: `GET /rides` [BE-01 scoping] newest first → `dropoff_address`, `dropoff_latitude/longitude`, `pickup_address`, `status`, `total_fare`, `completed_at`/`created_at`.
  - stats: `GET /me/stats` [BE-08] → `total_rides`, `total_distance_km`, `total_spent`.
  - offers: `GET /public/banners` [BE-10] → `title`, `description`, `image_url`, `action_url`, `action_text`.
  - active ride restore: T-301 (if a ride is active, Home opens straight into its trip screen).

## Layout
Full-screen map (5.21, map style §9) behind a **BottomSheet** with snap points `peek` (content-defined, see below), `full`. Tab bar visible.

**On the map (above the sheet):**
1. **Top bar**, y = `insets.top + 8`, x 16..386, height 48:
   - left: Avatar 40 inside a 48 floating circle (`surface`, `elevation.2`) → opens Account tab.
   - right: IconButton `floating` `crosshairs-gps` (recenter on user).
   - No greeting, weather or badge on the map.
2. User location dot; nearby drivers (coarse, from BE-20 `nearby-drivers` when available) as 24×24 simplified car glyphs, `driverMarker` at 60 % opacity, no labels.
3. Camera: user location, zoom 15; padding bottom = sheet height.

**Sheet content, peek state** (peek height = content through block 5 + 16):
1. Handle; 24 from top.
2. **Greeting:** "Good {morning|afternoon|evening}, {first name}" (`title`, `textPrimary`; rules §7; "Hello, {first name}" between 22:00 and 05:00), x = 16.
3. 12 gap. **"Where to?" bar:** full width − 32, height 56, radius `md`, fill `surfaceAlt`; leading 24 `magnify` `textSecondary` at x+16; text "Where to?" `title` `textPrimary` at x+52; trailing divider (1pt `border`, 24 high) + 16 + "Now" chip (`label`, `clock-outline` 16) only if scheduled rides exist later (hidden today). Tap → passenger-destination-search (pickup = current location).
4. 16 gap. **Shortcuts row** (horizontal ScrollView, 8 gap, inset 16): up to 2 saved places first (Home `home-outline`, Work `briefcase-outline`, then `star-outline` for others), then up to 3 recent destinations (`history`). Each shortcut is a ListItem-style row **stacked vertically** (not chips) when the sheet is at peek: rows 56 high, leading 40×40 `surfaceAlt` circle icon, title `title` = label or first part of address (before first comma), subtitle `bodySmall` `textSecondary` = rest of the address, 1 line ellipsis. Show max 3 rows at peek; dividers inset 72.
5. If no saved places: a row "Add Home" (`home-plus-outline`, `primaryText` title) → passenger-saved-places add flow.

**Sheet content, full state** (scroll inside the sheet; blocks below appear when dragged up):
6. 24 gap. **Offers** (only if `banners.length > 0`): section header `overline` "Offers" x=16 → 8 → Promo card pager (5.30). Section hidden when empty or on error.
7. 24 gap. **Your rides** stats (only if `total_rides > 0`): 3 Stat tiles in a row (width `(window − 32 − 16)/3`, min height 88): `car-outline` `{total_rides}` "Rides" · `map-marker-distance` `{total_distance_km} km` "Distance" · `cash` `{total_spent}` "Spent". No trend chips.
8. 24 gap. **Recent rides:** header row: `overline` "Recent rides" + trailing ghost Button `sm` "See all" → Activity tab. Then a Card with up to 3 ride rows (shared-ride-history row variant compact: Raah line pickup/dropoff 1 line each, trailing `numeric` fare and status pill below). Tap → shared-ride-details.
9. Bottom padding: tab bar height + 16.

Removed from Home: weather, "Active User" pill, quick-action tiles, "Recent Activity", "Account" rows (they live in Account), emoji.

## States
| State | Spec |
|---|---|
| Loading (first) | Map loads with a `surfaceAlt` placeholder; sheet shows greeting (from stored user) + "Where to?" bar immediately; shortcuts: 3 skeleton rows (40 circle + 2 lines 120/200 wide); offers: one skeleton card 120 high; stats: 3 skeleton tiles; rides: 2 skeleton rows. |
| No location permission | Banner (shared-permissions denied) above the "Where to?" bar; map centred on Lahore default; "Where to?" still works (pickup must be searched). |
| Location loading | Recenter button shows a 20pt spinner. |
| Empty (new account) | No offers/stats/recent sections; shortcuts show "Add Home" and "Add Work" rows; under them `bodySmall` `textSecondary` "Your recent places will appear here." |
| Error (any section) | Section-level: keep cached data and show a Toast "Couldn't refresh. Pull down to try again." If no cache: rides section shows ErrorState compact (icon 48 circle, one line, "Try again" `sm` button). Offers fail silently (hidden). |
| Offline | Offline banner at the top of the sheet; cached sections shown; "Where to?" opens search which shows its own offline state. |
| Pull to refresh | In full state only (sheet scroll at top, pull down beyond 64): refetch rides, stats, banners, saved places, profile (`GET /auth/profile`, not the Firebase refresh). |
| Active ride exists | Home is replaced by the trip screen for that ride (T-301); on return to Home after completion, sheet resets to peek. |
| Long text | Greeting truncates name to 1 line; shortcut titles 1 line. |

## Interactions
- Drag sheet between peek and full (spring §6.2); tapping the map collapses to peek.
- "Where to?" tap: shared-element feel: the bar animates (250 ms) to the top of the search screen.
- Shortcut tap: opens destination search with that place prefilled as dropoff and jumps straight to passenger-vehicle-fare.
- Long-press a recent destination → action sheet "Save as Home / Save as Work / Save place / Remove from recents" (remove = local hide only).

## Accessibility
- Sheet handle: `accessibilityRole="button"`, label "Expand" / "Collapse" by state. "Where to?" bar: role button, label "Where to? Search destination". Map: `accessibilityElementsHidden` except the recenter button.

## Small device (iPhone SE)
- Peek shows greeting, "Where to?" and 2 shortcut rows (max 50 % of height).

## Dark
- Dark map style, sheet `surface` #141A2A, bar `surfaceAlt`.
