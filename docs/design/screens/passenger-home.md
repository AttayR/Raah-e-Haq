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
4. 12 gap. **Shortcut chip row** **[UI-R9 review, 2026-10-19: supersedes the stacked rows; DESIGN_SYSTEM v1.1 §8.3 fixes peek at 170 with one 32 chip row]**. Kit `Chip` (§5.11), one line, horizontal ScrollView that bleeds to the sheet edges (content inset 16, 8 gap), so the peek height never changes with the count. Order:
   1. "Turn on location" (only while location is refused/off, T-580),
   2. "Send a parcel" (only while the parcel tier is on, T-561),
   3. saved places from `GET /saved-places`: Home (`home-outline`), Work (`briefcase-outline`), then others (`map-marker-outline`), **at most 2 place chips** (Home and Work first; an "other" fills a free slot); label = `label` title,
   4. up to 3 recent destinations (`history`), derived only from the passenger's own `completed` rides in `GET /rides` (newest first, one per normalised `dropoff_address`, minus any within ~75 m of a saved place); label = address up to the first comma. No rides, no recent chips. Never invented.
   5. Add chip, `tone="primary"`: **"Add home"** (`home-plus-outline`, opens the editor on the Home label) while no Home is saved, otherwise **"+ Add"** (`plus`). Shown only when the saved-places read has succeeded (status `ready`/`refreshing` or cached data); after a failed first read it is hidden, so a passenger whose Home exists is never offered "Add home".
   6. "Saved places" (`bookmark-outline`, default tone) → the full list. Always last.
   Loading (first read, nothing cached): 3 pill skeletons (72/88/64 wide, 32 high) in place of 3-5; chips 1, 2 and 6 stay real.
5. 16 bottom padding (end of peek).

**Sheet content, full state** (scroll inside the sheet; blocks below appear when dragged up):
6. 24 gap. **Offers** (only if `banners.length > 0`): section header `overline` "Offers" x=16 → 8 → Promo card pager (5.30). Section hidden when empty or on error.
7. 24 gap. **Your rides** stats (only if `total_rides > 0`): 3 Stat tiles in a row (width `(window − 32 − 16)/3`, min height 88): `car-outline` `{total_rides}` "Rides" · `map-marker-distance` `{total_distance_km} km` "Distance" · `cash` `{total_spent}` "Spent". No trend chips.
8. 24 gap. **Recent rides:** header row: `overline` "Recent rides" + trailing ghost Button `sm` "See all" → Activity tab. Then a Card with up to 3 ride rows (shared-ride-history row variant compact: Raah line pickup/dropoff 1 line each, trailing `numeric` fare and, below it, `caption` `textSecondary` relative date + time from `completed_at` (e.g. "Yesterday · 7:20 PM")). **[UI-R9 review]** The card lists finished rides only, so the status pill is replaced by the date; a cancelled ride never appears here. Tap → shared-ride-details.
9. Bottom padding: tab bar height + 16.

Removed from Home: weather, "Active User" pill, quick-action tiles, "Recent Activity", "Account" rows (they live in Account), emoji.

## States
| State | Spec |
|---|---|
| Loading (first) | Map loads with a `surfaceAlt` placeholder; sheet shows greeting (from stored user) + "Where to?" bar immediately; shortcuts: 3 skeleton rows (40 circle + 2 lines 120/200 wide); offers: one skeleton card 120 high; stats: 3 skeleton tiles; rides: 2 skeleton rows. |
| No location permission | Banner (shared-permissions denied) above the "Where to?" bar; map centred on Lahore default; "Where to?" still works (pickup must be searched). |
| Location loading | Recenter button shows a 20pt spinner. |
| Empty (new account) | **[UI-R9 review]** Chip row: "Add home" + "Saved places" (chip-row model; no separate "Add Work" chip). Body (visible from `half`): 16 below the chip row, `bodySmall` `textSecondary` start-aligned, "Your recent places and rides will appear here." (one line on iPhone 17, max 2 on SE; i18n key in `home.*`). Shown only when rides are `ready` with zero finished rides and there are no recents; no illustration. |
| Error (any section) | Section-level: keep cached data and show a Toast "Couldn't refresh. Pull down to try again." If no cache: rides section shows **ErrorState compact** **[UI-R9 review, exact]**: row-height block inside the body, start 16 below the chip row: 48 `dangerSoft` circle with 24 `cloud-off-outline` `danger` → 12 → `body` `textPrimary` "Couldn't load your recent rides" (1 line, ellipsis; max 2 at 1.3×) → 12 → Button `sm` `secondary` "Try again" (`fullWidth={false}`, loading while retrying), all centred, total ≤ 156 so the whole block is visible at `half` on iPhone SE (sheet visible 333). The full EmptyState-sized ErrorState (96 circle + `h3` + body + `md` button) is not used in the Home sheet. If the kit has no compact variant, add `size="compact"` to `ErrorState` (kit change, `src/components/ui`). Offers fail silently (hidden). Saved places failing shows no chips for places and hides the Add chip (block 4.5). |
| Offline | Offline banner at the top of the sheet; cached sections shown; "Where to?" opens search which shows its own offline state. |
| Pull to refresh | In full state only (sheet scroll at top, pull down beyond 64): refetch rides, stats, banners, saved places, profile (`GET /auth/profile`, not the Firebase refresh). |
| Active ride exists | Home is replaced by the trip screen for that ride (T-301); on return to Home after completion, sheet resets to peek. |
| Long text | Greeting truncates name to 1 line; shortcut titles 1 line. |

## Interactions
- Drag sheet between peek and full (spring §6.2); tapping the map collapses to peek.
- "Where to?" tap: shared-element feel: the bar animates (250 ms) to the top of the search screen.
- Shortcut tap: opens destination search with that place prefilled as dropoff and jumps straight to passenger-vehicle-fare.
- Long-press a recent destination → action sheet "Save as Home / Save as Work / Save place / Remove from recents" (remove = local hide only). **[UI-R9 review: deferred to UI-R9b]**
- **[UI-R9 review] Not built yet, by decision:** offers pager (waits for BE-10 `GET /public/banners`; section stays hidden), the 250 ms "Where to?" shared-element transition (UI-R9b), long-press actions (UI-R9b). A recent-destination chip tap opens Booking with that place as the destination, exactly like a saved-place chip.

## Accessibility
- Sheet handle: `accessibilityRole="button"`, label "Expand" / "Collapse" by state. "Where to?" bar: role button, label "Where to? Search destination". Map: `accessibilityElementsHidden` except the recenter button.

## Small device (iPhone SE)
- Peek is the same 170 (greeting, "Where to?", one chip row); `half` = 50 % of the window. The compact rides ErrorState must be fully visible at `half`.

## Dark
- Dark map style, sheet `surface` #141A2A, bar `surfaceAlt`.
