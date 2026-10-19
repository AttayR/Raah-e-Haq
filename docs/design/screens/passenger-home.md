# Passenger · Home

- **Task:** T-604 (visual) after T-506 (real data) and T-610 (navigation shell). **[UI-R20, 2026-10-19]** service choice: two service tiles (Ride, Parcel) replace the greeting at the top of the sheet; see **§ Services (UI-R20)** below, which supersedes any older line here that conflicts with it.
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
  - **[UI-R20]** parcel availability: `useParcelAvailable(focused)` (BE-88/T-561/T-581): the parcel tier is in the bookable catalogue `GET /public/vehicle-types` (already read and cached for Booking; no new request). Last known value kept on the device (see § Services, S7).

## Layout
Full-screen map (5.21, map style §9) behind a **BottomSheet** with snap points `peek` (content-defined, see below), `full`. Tab bar visible.

**On the map (above the sheet):**
1. **Top bar**, y = `insets.top + 8`, x 16..386, height 48:
   - left: Avatar 40 inside a 48 floating circle (`surface`, `elevation.2`) → opens Account tab.
   - right: IconButton `floating` `crosshairs-gps` (recenter on user).
   - No greeting, weather or badge on the map.
2. User location dot; nearby drivers (coarse, from BE-20 `nearby-drivers` when available) as 24×24 simplified car glyphs, `driverMarker` at 60 % opacity, no labels. **[T-586] Superseded:** every tier's own top-down glyph at 40 pt, full opacity, smooth motion, plus the map count chip "{online} drivers online near you" bottom-start above the sheet: `map-vehicles.md` §1–§4.
3. Camera: user location, zoom 15; padding bottom = sheet height.

**Sheet content, peek state** **[UI-R20: replaces the greeting with the service row; peek is content-defined, see § Services S5]**:
1. Handle; 24 from top (drag area).
2. **Sheet header (drag area), one of three, by state (§ Services S1):** the **service row** (Ride + Parcel tiles, 96) while the parcel tier is on; the **ride-only heading** "Rides within the city" (22) while it is off; the **greeting** (22, rules §7) only while a ride or parcel is in progress (T-577). No greeting otherwise.
3. 12 gap. **"Where to?" bar:** full width − 32, height 52 (`WHERE_TO_HEIGHT`), radius `md`, fill `surfaceAlt`; leading 24 `magnify` `textSecondary` at x+16; text "Where to?" `title` `textPrimary` at x+52; trailing divider (1pt `border`, 24 high) + 16 + "Now" chip (`label`, `clock-outline` 16) only if scheduled rides exist later (hidden today). Tap → passenger-destination-search (pickup = current location). **[UI-R20]** It books a **ride** only: its accessibility label becomes "Where to? Book a ride within the city". Visible text unchanged.
4. 12 gap. **Shortcut chip row** **[UI-R9 review, 2026-10-19: supersedes the stacked rows; DESIGN_SYSTEM v1.1 §8.3]**. Kit `Chip` (§5.11), one line, height 32, horizontal ScrollView that bleeds to the sheet edges (content inset 16, 8 gap), so the peek height never changes with the count. **[UI-R20] Place shortcuts only; "Send a parcel" is removed from this row** (it is the Parcel tile now). Order:
   1. "Turn on location" (only while location is refused/off, T-580). Kept: it fixes the pickup place, it is not a service,
   2. ~~"Send a parcel"~~ **[UI-R20] removed** (testID `home-send-parcel` moves to the Parcel tile),
   3. saved places from `GET /saved-places`: Home (`home-outline`), Work (`briefcase-outline`), then others (`map-marker-outline`), **at most 2 place chips** (Home and Work first; an "other" fills a free slot); label = `label` title,
   4. up to 3 recent destinations (`history`), derived only from the passenger's own `completed` rides in `GET /rides` (newest first, one per normalised `dropoff_address`, minus any within ~75 m of a saved place); label = address up to the first comma. No rides, no recent chips. Never invented.
   5. Add chip, `tone="primary"`: **"Add home"** (`home-plus-outline`, opens the editor on the Home label) while no Home is saved, otherwise **"+ Add"** (`plus`). Shown only when the saved-places read has succeeded (status `ready`/`refreshing` or cached data); after a failed first read it is hidden, so a passenger whose Home exists is never offered "Add home".
   6. "Saved places" (`bookmark-outline`, default tone) → the full list. Always last.
   Loading (first read, nothing cached): 3 pill skeletons (72/88/64 wide, 32 high) in place of 3-5; chips 1 and 6 stay real.
5. 16 bottom padding (end of peek).

**Sheet content, full state** (scroll inside the sheet; blocks below appear when dragged up):
6. 24 gap. **Offers** (only if `banners.length > 0`): section header `overline` "Offers" x=16 → 8 → Promo card pager (5.30). Section hidden when empty or on error.
7. 24 gap. **Your rides** stats (only if `total_rides > 0`): 3 Stat tiles in a row (width `(window − 32 − 16)/3`, min height 88): `car-outline` `{total_rides}` "Rides" · `map-marker-distance` `{total_distance_km} km` "Distance" · `cash` `{total_spent}` "Spent". No trend chips.
8. 24 gap. **Recent rides:** header row: `overline` "Recent rides" + trailing ghost Button `sm` "See all" → Activity tab. Then a Card with up to 3 ride rows (shared-ride-history row variant compact: Raah line pickup/dropoff 1 line each, trailing `numeric` fare and, below it, `caption` `textSecondary` relative date + time from `completed_at` (e.g. "Yesterday · 7:20 PM")). **[UI-R9 re-review]** The card lists finished rides (`completed` and `cancelled`); the date replaces the status pill, and a cancelled ride shows "No charge" in place of the fare (kit `RecentRidesCard`). Recent-destination chips still come from `completed` rides only. Tap → shared-ride-details.
9. Bottom padding: tab bar height + 16.

Removed from Home: weather, "Active User" pill, quick-action tiles, "Recent Activity", "Account" rows (they live in Account), emoji.

## Services (UI-R20, 2026-10-19)

**Why.** The owner could not tell from Home whether he was booking a ride or a courier ("do I go myself or send something?"), or whether a booking was in-city or city-to-city (before: `audit/passenger-home-uir20-before-light.png`, `-dark.png`). **Owner decision 2026-10-19:** two services only: **Ride** (you travel, within the city) and **Parcel** (a bike courier carries an item; you don't travel). City-to-city is not offered: no tile, no "coming soon", no "intercity" word anywhere. Pattern: inDrive / Careem / Bykea service tiles above the destination field, drawn in our tokens.

### S1. What the sheet header shows

| Condition (first match wins) | Header under the handle | testID |
|---|---|---|
| A ride or parcel is in progress (`liveRide`, T-543/T-559) | Greeting (§7), as today; "Return to your ride" / "Track your parcel" replaces "Where to?" (T-577) | `home-greeting` |
| Parcel tier on (`useParcelAvailable` true, S7) | **Service row**: Ride tile + Parcel tile (S2) | `home-service-ride`, `home-send-parcel` |
| Parcel tier off, unknown on a first-ever launch, or catalogue failed with nothing known | **Ride-only heading**: leading `rides` (`car-side`) 20 `primaryText`, 8 gap, `title` (17/22, 600) `textPrimary` "Rides within the city", 1 line, x = 16, height 22, `accessibilityRole="header"`. No single Ride tile (one tile is not a choice). | `home-ride-only-heading` |

The header is the BottomSheet `header` (drag area together with the handle), so it stays pinned at `full` and the body scrolls under it. The pan's `activeOffsetY ±6` (kit) lets a tap press a tile and a drag that starts on a tile move the sheet (the press is cancelled).

### S2. Service row and tile anatomy (iPhone 17, 402 wide; SE 375)

- Row: x 16..386, 0 top (directly under the 24 handle area), two tiles with `flex: 1`, 12 gap, `alignItems: 'stretch'` (both tiles always the same height). Tile width = (window − 32 − 12) / 2 = **179** (SE **165.5**).
- Tile: radius `lg` (16), border **2pt** on both tiles (colour per S3; the Parcel border equals its fill, so both tiles have identical geometry), padding **12 from the outer edge** (content inset 10 inside the border), no shadow.
- Line 1 (row, centred vertically): **icon disc 44** (circle) with a **28** MDI glyph centred → 12 gap → title `h3` (20/25, 600) `textPrimary`, 1 line (no ellipsis expected: "Ride" 43, "Parcel" 60 wide; space 85.5 on SE, 78 for "Parcel" at 1.3×).
- 8 gap.
- Line 2: subtitle `bodySmall` (14/20, 400) `textSecondary`, start-aligned with the disc's start edge (full tile content width: 155 on iPhone 17, 141.5 on SE), `numberOfLines={2}`; it never truncates with the copy below.
- Height at 1.0×: 12 + 44 + 8 + 20 + 12 = **96**. At 1.3×: 12 + 44 + 8 + 26 + 12 = **102**; if a subtitle wraps to 2 lines (expected only for "Shehar ke andar" on SE at 1.3×: 140 of 141.5), 12 + 44 + 8 + 52 + 12 = **128**, and the other tile stretches to match.
- Order: Ride at the start, Parcel at the end (start/end, never left/right: mirrors in RTL).
- Glyphs (registry names, `src/components/ui/icons.ts`): Ride `rides` (`car-side`); Parcel `parcel` (`package-variant-closed`). Icons first: the disc is the first thing read on each tile; one glyph per tile, no vehicle strip, no illustration.
- Ride is the **active** service (highlighted): it is what "Where to?" right under it books. It is not a toggle: tapping Parcel opens its own screen and the highlight never moves.

### S3. Colours (tokens; values from DESIGN_SYSTEM §1.4)

| Element | Ride light | Ride dark | Parcel light | Parcel dark |
|---|---|---|---|---|
| Fill | `primarySoft` #EEF2FC | `primarySoft` #1C2850 | `surfaceAlt` #EBEEF5 | `surfaceAlt` #1D2438 |
| Border 2pt | `primary` #011C72 (14.89 vs `surface`) | `primary` #3D5FD0 (3.09 vs `surface`) | = fill | = fill |
| Pressed fill | `primarySoftPressed` #DCE4F8 | `primarySoftPressed` #1A3496 | `surfaceAltPressed` #DADFEA | `surfaceAltPressed` #2B3450 |
| Disc | `primary` | `primary` | `accent` #F59A23 | `accent` #F59A23 |
| Glyph | `onPrimary` (14.89) | `onPrimary` (5.61) | `onAccent` (8.33) | `onAccent` (8.33) |
| Title | `textPrimary` (16.39) | `textPrimary` (12.99) | `textPrimary` (15.81) | `textPrimary` (14.01) |
| Subtitle | `textSecondary` (6.64) | `textSecondary` (7.75) | `textSecondary` (6.40) | `textSecondary` (8.35) |

Contrasts computed (WCAG 2.1) against the tile fill. Navy for Ride and saffron for Parcel give each service a colour as well as a glyph (helps users who don't read); the saffron disc is a new `accent` use, recorded in DESIGN_SYSTEM §1.4 [UI-R20]. No hex literals in code: tokens only.

### S4. Copy (i18n `home.*`; en and ur-Latn ship together)

| Key | English | Roman Urdu |
|---|---|---|
| `home.serviceRideTitle` | Ride | Ride |
| `home.serviceRideSub` | Within the city | Shehar ke andar |
| `home.serviceRideA11y` | Ride. You travel, within the city. | Ride. Aap khud safar karein, shehar ke andar. |
| `home.serviceRideHint` | Opens Where to? | "Kahan jana hai?" kholta hai |
| `home.serviceParcelTitle` | Parcel | Parcel |
| `home.serviceParcelSub` | Send an item | Saman bhejein |
| `home.serviceParcelA11y` | Parcel. A bike rider takes your item. You don't travel. | Parcel. Bike rider aap ka saman le jata hai. Aap ko sath nahi jana. |
| `home.serviceParcelHint` | Opens Send a parcel | Parcel bhejne ka form kholta hai |
| `home.rideOnlyHeading` | Rides within the city | Shehar ke andar rides |
| `home.whereToA11y` (changed) | Where to? Book a ride within the city | Kahan jana hai? Shehar ke andar ride book karein |

- "Ride" and "Parcel" stay as loanwords in Roman Urdu: they are the words Pakistani users see on Careem, Bykea and inDrive and on our own Activity and receipts; the subtitle carries the meaning.
- Measured widths (SF Pro, 14 pt): "Within the city" 96, "Send an item" 86, "Shehar ke andar" 108, "Saman bhejein" 97, all one line at 1.0× on SE (141.5 available).
- `parcel.homeEntryTitle` / `parcel.homeEntrySubtitle` lose their only user (the removed chip): delete both keys in `en.ts` and `ur-Latn.ts` after a grep confirms nothing else reads them. `parcel.homeReturn` stays.
- Tile `accessibilityLabel` = the A11y string (not title + subtitle concatenated); `accessibilityHint` = the Hint string; `accessibilityRole="button"`.

### S5. Sheet heights

Peek = **measured header height** (handle 24 + S1 header, from the BottomSheet's existing header `onLayout`) + body peek block (12 + "Where to?" 52 + 12 + chip row 32 + 16 = **124**). `homePeekHeight` takes `{ headerHeight, live }` instead of a constant; the live case keeps the T-577 extra.

| Case | Header | Peek |
|---|---|---|
| Service row, 1.0× (iPhone 17 and SE, en and ur-Latn) | 24 + 96 | **244** (was 170) |
| Service row, 1.3×, one-line subtitles | 24 + 102 | **250** |
| Service row, 1.3×, a subtitle wraps (ur-Latn on SE) | 24 + 128 | **276** |
| Ride-only heading, 1.0× | 24 + 22 | **170** (unchanged) |
| Ride-only heading, 1.3× | 24 + 29 | **177** |
| Ride or parcel in progress | greeting | **202** (T-577, unchanged) |

- `half` = **max(50 % of the window, peek + 180)**, capped at `full` (keeps the compact rides ErrorState, ≤156 + 16, visible at `half`). iPhone 17: 437 (service row) / 437 (ride-only). SE: **424** (service row, 1.0×) / 350 (ride-only).
- `full` unchanged (window − top inset − 8); service row stays pinned in the header, body scrolls.
- Map: camera bottom padding = sheet height + 24 (unchanged); locate button and the T-586 nearby chip ride 16 above the sheet. SE at peek 244: 667 − 244 − tab bar 64 = 359 of map including the status bar.
- What shows at each snap: **peek** = header, "Where to?", chip row. **half** = + location banner (if off) + Recent rides header and the first 1–2 rows (or the compact error / empty hint). **full** = + the rest of the body (offers when BE-10 lands, recent rides).
- The peek is re-applied only when the computed value changes by ≥ 1 pt (font scale, language, parcel availability, live ride), never on every layout pass.

### S6. Parcel tier switched on or off while Home is open

`useParcelAvailable` re-reads the catalogue on focus and on return to the foreground (T-561/T-581). When its value changes:

- **Sheet at `peek`, off → on:** the ride-only heading fades out (`motion.fast` 150), the sheet height animates 170 → 244 (`motion.base` 250, standard easing; timing, no spring overshoot), then the tiles fade in (`motion.fast`). Map camera padding is applied once at the end, not per frame.
- **Sheet at `peek`, on → off:** tiles fade out (150, `pointerEvents="none"` from the first frame of the fade, so a tap on a disappearing Parcel tile does nothing), height 244 → 170 (250), heading fades in (150). "Where to?" and the chips move with the sheet; nothing else reflows.
- **Sheet at `half` or `full`:** header content swaps with the same fades; the sheet keeps its current height (the header grows/shrinks by 74 and the body moves under it). The new `peek`/`half` apply to the next snap.
- **During a drag:** the swap waits until the gesture ends.
- **Reduced motion:** swap at once, the sheet jumps to the new snap height.
- A live ride/parcel always wins (S1): no tiles while it is in progress, whatever the tier does.

### S7. Cold start and unknown availability

1. In-memory catalogue (Booking already read it this session) → use it.
2. Otherwise the **last known value** stored on the device: AsyncStorage key `rh.home.parcelTile` (`'1'`/`'0'`), written only when a catalogue read succeeds and the value changed (not personal data; kept across sign-out). Read it at app start in the same pass as the language preference (LanguageGate) so Home's first frame already has it; Home never waits on it.
3. Nothing known (first launch ever) → ride-only heading (170); when the catalogue answers "on", grow once per S6.
4. Catalogue read fails → keep the current layout; no error UI on Home (the choose-ride sheet has its own catalogue error).
Never a skeleton tile: the header is either the service row or the ride-only heading.

### S8. Interactions

- **Ride tile** → exactly what "Where to?" does (same handler, same push guard): passenger-destination-search with pickup = current location.
- **Parcel tile** → `SendParcel` (T-522), as the old chip did.
- One push per tap: a second tap while the push is in flight is ignored (reuse the "Where to?" guard; if none exists, an in-flight ref released on blur / after 600 ms).
- Press: fill → pressed token and scale 1 → 0.98 in `motion.instant` (100), spring back (§6 #1, damping 18, stiffness 300); Reduce Motion: fill change only. No haptic (not a commit, §6.11).
- No long-press. Location off: both tiles still work (pickup is searched / entered in the parcel form).
- Offline: tiles shown from the last known value; each destination screen shows its own offline state.

### S9. Performance (low-end Android)

- Flat tiles: no images, no Lottie, no shadow/elevation (no overdraw), MDI glyphs from the bundled font.
- `ServiceTile` and the header are `memo` with stable `useCallback` handlers; props are booleans and strings only, so a sheet drag, a map camera move or the nearby-drivers poll re-renders nothing in the header. The greeting's clock is only read while a ride is live.
- No new request: availability comes from the cached `GET /public/vehicle-types` (2-min focus recheck, T-581); one AsyncStorage read at start, one write only on change.
- Press scale and fades run on the UI thread (Reanimated, `usePressScale`). The peek recompute is gated (S5, ≥ 1 pt).

### S10. Builder notes

- New kit component **`ServiceTile`** in `src/components/ui` (exported from the index): props `icon`, `title`, `subtitle`, `tone: 'primary' | 'accent'`, `active?`, `onPress`, `accessibilityLabel`, `accessibilityHint`, `testID`. Dev-gallery preview: both tones, active, pressed, 2-line subtitle, light/dark.
- Home composes it in `features/passenger-home/components` (e.g. `HomeServiceRow`) and passes the right header to the sheet per S1. Remove the parcel `Chip` from `HomeSheet`'s `leading`; update the HomeSheet doc comment and the tests that look for `home-send-parcel` (the testID now lives on the Parcel tile).
- `HOME_PEEK_HEIGHT` constant becomes the S5 calculation; update every user of it (PassengerHomeScreen initial sheet state, T-582 re-place).
- Tokens only (no hex, no raw font sizes, spacing from `space`/`layout`).

### S11. Design review evidence (UI-R20)

`docs/qa-reports/<date>-ui-r20/design-*.png`: iPhone 17 peek / half / full in light and dark; iPhone SE peek and half (light); peek at 1.3× text (dark); peek in Roman Urdu (light, SE); parcel tier off (local admin toggle) peek light, and the on → off switch at peek; a ride in progress (greeting + Return, no tiles); the before shots are `docs/design/audit/passenger-home-uir20-before-{light,dark}.png`.

## States
| State | Spec |
|---|---|
| Loading (first) | Map loads with a `surfaceAlt` placeholder; sheet shows the header (service row or ride-only heading per § Services S7; never a skeleton tile) + "Where to?" bar immediately; shortcuts: 3 skeleton rows (40 circle + 2 lines 120/200 wide); offers: one skeleton card 120 high; stats: 3 skeleton tiles; rides: 2 skeleton rows. |
| No location permission | Banner (shared-permissions denied) above the "Where to?" bar; map centred on Lahore default; "Where to?" still works (pickup must be searched). |
| Location loading | Recenter button shows a 20pt spinner. |
| Empty (new account) | **[UI-R9 review]** Chip row: "Add home" + "Saved places" (chip-row model; no separate "Add Work" chip). Body (visible from `half`): 16 below the chip row, `bodySmall` `textSecondary` start-aligned, "Your recent places and rides will appear here." (one line on iPhone 17, max 2 on SE; i18n key in `home.*`). Shown only when rides are `ready` with zero finished rides and there are no recents (builder's equivalent: no rows in the card and no recent chips); no illustration. |
| Error (any section) | Section-level: keep cached data and show a Toast "Couldn't refresh. Pull down to try again." If no cache: rides section shows **ErrorState compact** **[UI-R9 review, exact]**: row-height block inside the body, start 16 below the chip row: 48 `dangerSoft` circle with 24 `cloud-off-outline` `danger` → 12 → `body` `textPrimary` "Couldn't load your recent rides" (1 line, ellipsis; max 2 at 1.3×) → 12 → Button `sm` `secondary` "Try again" (`fullWidth={false}`, loading while retrying), all centred, total ≤ 156 so the whole block is visible at `half` on iPhone SE (sheet visible 333). The full EmptyState-sized ErrorState (96 circle + `h3` + body + `md` button) is not used in the Home sheet. If the kit has no compact variant, add `size="compact"` to `ErrorState` (kit change, `src/components/ui`). Offers fail silently (hidden). Saved places failing shows no chips for places and hides the Add chip (block 4.5). |
| Offline | Offline banner at the top of the sheet; cached sections shown; "Where to?" opens search which shows its own offline state. |
| Pull to refresh | In full state only (sheet scroll at top, pull down beyond 64): refetch rides, stats, banners, saved places, profile (`GET /auth/profile`, not the Firebase refresh). |
| Active ride exists | Home is replaced by the trip screen for that ride (T-301); on return to Home after completion, sheet resets to peek. |
| Long text | Greeting (live ride only) truncates name to 1 line; shortcut titles 1 line. **[UI-R20]** tile titles 1 line; tile subtitles up to 2 lines (§ Services S2). |
| **[UI-R20]** Parcel tier on / off / changes | § Services S1, S5, S6. |
| **[UI-R20]** Ride or parcel in progress | Service row and ride-only heading hidden; greeting + "Return to your ride"/"Track your parcel" as T-577 (peek 202). |

## Interactions
- Drag sheet between peek and full (spring §6.2); tapping the map collapses to peek.
- "Where to?" tap: shared-element feel: the bar animates (250 ms) to the top of the search screen.
- Shortcut tap: opens destination search with that place prefilled as dropoff and jumps straight to passenger-vehicle-fare.
- Long-press a recent destination → action sheet "Save as Home / Save as Work / Save place / Remove from recents" (remove = local hide only). **[UI-R9 review: deferred to UI-R9b]**
- **[UI-R9 review] Not built yet, by decision:** offers pager (waits for BE-10 `GET /public/banners`; section stays hidden), the 250 ms "Where to?" shared-element transition (UI-R9b), long-press actions (UI-R9b). A recent-destination chip tap opens Booking with that place as the destination, exactly like a saved-place chip.

## Accessibility
- Sheet handle: `accessibilityRole="button"`, label "Expand" / "Collapse" by state. "Where to?" bar: role button, label **[UI-R20]** "Where to? Book a ride within the city". Map: `accessibilityElementsHidden` except the recenter button.
- **[UI-R20]** Focus order: handle → Ride tile → Parcel tile → "Where to?" → chips → body. Tile labels and hints: § Services S4.

## Small device (iPhone SE)
- **[UI-R20]** Peek 244 with the service row (same as iPhone 17 at 1.0×; tiles 165.5 wide), 170 without it. `half` = **max(50 % of the window, peek + 180)**, never above `full`: SE 1.0× = max(333.5, 424) = **424**; iPhone 17 = max(437, 424) = **437**. This keeps the compact rides ErrorState (≤156 + 16 gap) fully visible at `half` (DESIGN_SYSTEM §8.3 [UI-R20]).

## Dark
- Dark map style, sheet `surface` #141A2A, bar `surfaceAlt`. **[UI-R20]** tiles: § Services S3 (token values for both modes).
