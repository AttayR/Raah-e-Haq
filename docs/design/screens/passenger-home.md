# Passenger · Home

- **Task:** T-604 (visual) after T-506 (real data) and T-610 (navigation shell). **[UI-R20, 2026-10-19]** service choice: two service tiles (Ride, Parcel) replace the greeting at the top of the sheet; see **§ Services (UI-R20)** below, which supersedes any older line here that conflicts with it. **[UI-R20b, 2026-10-20]** the first view is redesigned: greeting + tagline, "Where to?" hero first, outline chips, illustrated Ride/Parcel cards after the chips, brand-tinted map, cold-open entrance; see **§ Services v2 (UI-R20b)**, which supersedes UI-R20 and the Layout blocks where they conflict.
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

**Sheet content, peek state** **[UI-R20: replaces the greeting with the service row; peek is content-defined, see § Services S5]** **[UI-R20b: order and sizes are now § Services v2 V1: greeting + tagline → "Where to?" 56 → chips → service cards; peek 274]**:
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

> **[UI-R20b]** Superseded in part by § Services v2 below: S1, S2, S3, S5, S6 and S10 are replaced (no tiles above "Where to?", no ride-only heading, no active Ride state); S4, S7, S8, S9 stay with the V-section changes.

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
| Disc | `primary` | `primary` | `accent` #F75606 [UI-R21] | `accent` #F75606 [UI-R21] |
| Glyph | `onPrimary` (14.89) | `onPrimary` (5.61) | `onAccent` (5.50 [UI-R21]) | `onAccent` (5.50 [UI-R21]) |
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

- `half` = **max(50 % of the sheet container, peek + 180)**, capped at `full` (keeps the compact rides ErrorState, ≤156 + 16, visible at `half`). The container is the map area above the tab bar (kit `sheetSnaps`, same for every sheet), not the window **[design review UI-R20, 2026-10-19: corrected; was "window", 437]**. iPhone 17 (container 780): **424** (service row, max(390, 424)) / 390 (ride-only). SE: **424** (service row, 1.0×) / 350 (ride-only).
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

## Services v2 (UI-R20b, 2026-10-20): the first view

**Supersedes**, where they conflict: Layout blocks 1–5 (peek), § Services S1, S2, S3, S5, S6 and S10, and the States/Accessibility/SE/Dark lines marked [UI-R20]. S4 (a11y strings and hints), S7 (last-known parcel value), S8 (handlers, one push per tap) and S9 (performance) stay, with the changes noted below. Owner request (2026-10-20): the first screen's impression must be excellent, so V1–V15 cover the whole first view, not only the service cards.

**Owner feedback.** "The Ride and Parcel buttons look very ugly." Asked to choose Uber-style tiles, a Careem-style icon row or no tiles: "make something modern, the best." Then: "If the first screen's impression is excellent, that will be very good for us."

**Before** (shipped UI-R20; iPhone 17, 402 × 874 pt): `shots/ui-r20b/before-owner-peek-light-iphone17.png` (owner's screenshot), `shots/ui-r20b/before-peek-light-iphone17.png` (sim, 2026-10-20), `shots/ui-r20/peek-light-iphone17.png`, `peek-dark-iphone17.png`, `peek-dark-large-text-iphone17.png`, `peek-roman-urdu-light-iphone17.png`, `parcel-off-peek-light-iphone17.png`, `half-light-iphone17.png`.
**Target** (geometry mock drawn from the values below; system font weights are not rendered by the mock tool, so text weight follows the spec, not the mock): `shots/ui-r20b/target-peek-light-iphone17.png`, `target-peek-dark-iphone17.png`, `target-peek-light-se.png` (SVG sources next to them).

### V0. What is wrong today (measured on `before-peek-light-iphone17.png`, pt)

| # | Defect | Where (pt) |
|---|---|---|
| 1 | The tiles are the first thing in the sheet; "Where to?", the main action, starts 133 below the sheet top | tiles y 560–656, "Where to?" y 668–720 |
| 2 | Ride tile: 2 pt `primary` border on `primarySoft` reads as a selected toggle, though nothing can be selected | Ride tile x 16–195 |
| 3 | Two heavy 96-high boxes, both on tinted fills, plus a grey "Where to?" and grey chips: four grey/tinted blocks in a row with the same weight | sheet y 535–791 |
| 4 | Navy 44 disc next to an orange 44 disc: two loud fills side by side; flat MDI glyphs look generic | discs at x 37 and x 222, y 586 |
| 5 | The subtitles repeat what the a11y label and the field already say ("Within the city", "Send an item") | y 628 |
| 6 | "Where to?" is 52 with a grey `magnify`: it does not look like the hero | y 668 |
| 7 | Chips: `surfaceAlt` fill, same as the field above: no hierarchy between hero and shortcuts; the last chip is cut by the screen edge with no fade | y 731 |
| 8 | The user's dot is navy `primary` (not `userLocation`) and looks like a brand mark among the navy vehicles | map centre |
| 9 | The status bar sits on busy map labels with no scrim | y 0–60 |
| 10 | Count chip (hairline, no shadow) and locate button (`elevation.2`) are styled differently; the chip's "bottom 12" rule and "centred on locate" rule contradict each other | y 491–523 |
| 11 | No greeting and no personality on the first view (the greeting shows only with a live ride) | — |
| 12 | Cold open: the sheet and map pop in at once, no entrance | — |

### V1. Peek, top to bottom (iPhone 17, 402 wide; SE 375)

All x values from the sheet's start edge; gutter 16. Heights at 1.0× text.

| # | Block | Height | Gap after | Notes |
|---|---|---|---|---|
| 1 | Handle area (kit, `sheet.contentTop`) | 24 | — | handle 36 × 5 at y 8, `border` |
| 2 | **Greeting block** (V3): greeting `title` 22 + tagline `bodySmall` 20 (no gap; the line heights space them) | 42 | 12 | pinned header |
| 3 | **"Where to?" hero** (V4) | 56 | 12 | pinned header |
| 4 | **Chip row** (V5) | 32 | 12 | body |
| 5 | **Service row** (V2), only while the parcel tier is on (S7 value) | 72 | 12 | body |

- **Peek, iPhone 17:** 24 + 42 + 12 + 56 + 12 + 32 + 12 + 72 + 12 = **274** (UI-R20: 244). Without the service row (parcel off or unknown): 274 − 84 = **190**.
- **Compact height** (window height < 700, i.e. iPhone SE 667): the tagline is hidden (greeting only, 22): **254**, without the service row **170**. Map on SE at 254: 667 − 254 − 64 (tab bar) = 349 pt including the status bar (UI-R20: 359).
- **1.3× text (iPhone 17):** greeting 29 + tagline 26, chips grow to their measured height (≈38), "Where to?" and the cards keep their min heights (56, 72): ≈ **293**. Never computed by hand: see the formula below.
- **Live ride or parcel** (T-577): greeting (no tagline) 22 + 12 + "Return to your ride" 56 + 8 + status 20 + 12 + chips 32 + 12 = **198** (was 202). No service row while live (S1 rule kept).
- **Formula:** `peek = sheet.contentTop + measured header + measured peek group`. Header = block 2 + 12 + block 3 + 12 (its bottom padding); peek group = a wrapper around block 4 + 12 + block 5 + 12 (or block 4 + 12 without services; live: Return 56 + 8 + status 20 + 12 + chips 32 + 12). Both are `onLayout` heights; the peek is re-applied only on a ≥ 1 pt change (S5 rule kept). `homePeekHeight` takes `{ headerHeight, peekGroupHeight }`. First-frame estimates (`HOME_HEADER_ESTIMATE` and a new `HOME_PEEK_GROUP_ESTIMATE`): header **122** (compact 102, live 34); group **128** with services, **44** without, **140** live. Check: 24 + 122 + 128 = 274; 24 + 122 + 44 = 190; 24 + 102 + 128 = 254; 24 + 34 + 140 = 198.
- `half` = max(50 % of the sheet container, peek + 180), capped at `full` (S5 rule kept): iPhone 17 = max(390, 454) = **454**; SE = max(302, 434) = **434**.
- **Pinned at `full`:** handle + greeting block + "Where to?" (the header). Chips, cards and everything below scroll under it.
- Order is fixed: greeting → "Where to?" → chips → services. "Where to?" is the first control in the sheet; the chips sit under it because they are destinations (they book the same thing faster); the services come last because they are entry points, not choices.

### V2. Service cards (new kit `ServiceCard`, replaces `ServiceTile`)

**Row:** x 16..386 (SE 16..359), two cards `flex: 1`, gap 12. Card width = (window − 32 − 12) / 2 = **179** (SE **165.5**).

**Card anatomy:**
- `minHeight` **72**, radius `lg` 16, `overflow: 'hidden'`, **no border, no shadow, no selected state** (Ride is never highlighted; both cards are equal entry points).
- Fill by kind (tokens): Ride `primarySoft` (#EEF2FC / #1C2850); Parcel `accentSoft` (#FFF1E8 / #3A1A0C).
- **Label:** one word, `title` (17/22, 600, −0.2) `textPrimary`, top 12, start 12, `numberOfLines={1}`, `ellipsizeMode="tail"`, max width = card width − 24. "Ride" / "Parcel" in both en and ur-Latn (loanwords, S4). No subtitle.
- **Art box:** absolutely positioned, end **0**, bottom **2**, **104 × 56** pt, drawing `viewBox="0 0 88 48"` (scale 1.18). The art is the largest thing in the card: picture first, word second.
- **Exclusion rule (tested):** no art shape has any point with viewBox x < 16 and y < 24, so the label never touches the art, even at 1.3× on SE ("Parcel" at 1.3× ends at x 80; SE art box starts at x 61.5 → viewBox x ≤ 15.7, label bottom 41 → viewBox y ≤ 23).
- Height never grows with text: label bottom is 34 at 1.0×, 41 at 1.3× (72 − 2 − 56 = 14 is the art box top; the overlap region is empty by the exclusion rule). Nastaliq (future `ur`): `minHeight`, so the card may grow; the art stays bottom-anchored.
- **RTL:** label at the start (right); art box at the end (left) and mirrored (`transform: [{ scaleX: -1 }]` on the art's `Svg`), so the vehicle's front always faces the end edge.
- Contrasts (WCAG 2.1, against the card fill): label `textPrimary` 16.39 / 12.99 on `primarySoft`, 16.62 / 14.32 on `accentSoft`; Ride body (car) 13.29 / 12.99; Parcel box edge facing the card (`illoBoxSide` light, `illoBoxFront` dark) 5.30 / 4.72; front face on light 3.02 (≥ 3, non-text). Pressed fills: label 14.91 on `accentSoftPressed` light, 12.29 dark; 14.43 on `primarySoftPressed` light, 9.66 dark.

**New illustration tokens** (`SemanticColors`, palette references, no hex in components; add to `contrastPairs.ts` and the dev gallery):

| Token | Light | Dark | Use |
|---|---|---|---|
| `illoHub` | neutral-300 `#C3CAD9` | dark-300 `#B7BFD0` | wheel hubs |
| `illoShadow` | black, opacity `illoShadowOpacity` **0.10** | black, opacity **0.30** | ground shadow ellipse |
| `illoBoxFront` | saffron-500 `#F75606` | saffron-500 `#F75606` | parcel box front face |
| `illoBoxTop` | saffron-300 `#FF9B66` | saffron-300 `#FF9B66` | box top face |
| `illoBoxSide` | saffron-700 `#B33D00` | saffron-700 `#B33D00` | box side face |
| `illoBoxTape` | saffron-100 `#FFE2D1` | saffron-100 `#FFE2D1` | tape and label |
| `illoMotion` | navy-400 `#6A86DE` | navy-400 `#6A86DE` | speed lines (3.13 / 4.56 on `accentSoft`, decorative) |

The car reuses the T-586 vehicle tokens (`vehicleBody`, `vehicleRoof`, `vehicleGlass`, `vehicleTyre`, `vehicleHeadlight` = `accent`, `vehicleTaillight`), so the card car and the map cars are one family (navy body in light, near-white body in dark). The wheel-arch cut-outs take the **card fill** (`cutout` prop), never a hard-coded colour.

**Ride art: sedan, side view, front at the end edge** (`viewBox 0 0 88 48`, paint order top to bottom; every value exact):

| # | Shape | Geometry | Fill |
|---|---|---|---|
| 1 | Ground shadow | `Ellipse cx=44 cy=44.5 rx=38 ry=2.5` | `illoShadow` at `illoShadowOpacity` |
| 2 | Body (one path: lower body + cabin) | `M6 34 Q6 27 12 26 L24 24.5 L33 15 Q35.5 12.5 39 12.5 L58 12.5 Q61.5 12.5 64 15 L71.5 23.5 L80 25 Q84 25.8 84 30 L84 35 Q84 38 81 38 L9 38 Q6 38 6 35 Z` | `vehicleBody` |
| 3 | Rear side window | `M28 24 L34.5 17 Q36.2 15.5 38.5 15.5 L46.5 15.5 L46.5 24 Z` | `vehicleGlass` |
| 4 | Front side window | `M49.5 15.5 L57.5 15.5 Q59.8 15.5 61.4 17.2 L67.5 24 L49.5 24 Z` | `vehicleGlass` |
| 5 | Sill stripe | `Rect x=10 y=32.5 w=70 h=2.5 rx=1.25` | `vehicleRoof` |
| 6 | Door handles | `Rect x=40 y=26.5 w=4 h=1.2 rx=0.6`, `Rect x=53 y=26.5 w=4 h=1.2 rx=0.6` | `vehicleGlass` |
| 7 | Headlight | `Rect x=79.5 y=27.5 w=4 h=3 rx=1.5` | `vehicleHeadlight` |
| 8 | Tail light | `Rect x=6 y=28 w=2.5 h=4 rx=1` | `vehicleTaillight` |
| 9 | Wheel arches | `Circle cx=22 cy=37.5 r=8.5`, `Circle cx=66 cy=37.5 r=8.5` | card fill (`cutout`) |
| 10 | Tyres | `Circle cx=22 cy=37.5 r=6.5`, `Circle cx=66 cy=37.5 r=6.5` | `vehicleTyre` |
| 11 | Hubs | `Circle cx=22 cy=37.5 r=2.75`, `Circle cx=66 cy=37.5 r=2.75` | `illoHub` |

Footprint x 6–84, y 12.5–47. Exclusion check: at x < 16 the body starts at y ≥ 26.

**Parcel art: box with speed lines, oblique view (depth +12, −8), front at the end edge:**

| # | Shape | Geometry | Fill / stroke |
|---|---|---|---|
| 1 | Ground shadow | `Ellipse cx=56 cy=44.5 rx=26 ry=2.5` | `illoShadow` at `illoShadowOpacity` |
| 2 | Speed lines | `Line` (18,24)→(28,24); (12,31)→(28,31); (20,38)→(28,38) | stroke `illoMotion`, width 2.5, `strokeLinecap="round"` |
| 3 | Side face | `M66 18 L78 10 L78 36 L66 44 Z` | `illoBoxSide` |
| 4 | Top face | `M34 18 L46 10 L78 10 L66 18 Z` | `illoBoxTop` |
| 5 | Front face | `Rect x=34 y=18 w=32 h=26` | `illoBoxFront` |
| 6 | Tape on top | `M47 18 L59 10 L65 10 L53 18 Z` | `illoBoxTape` |
| 7 | Tape on front | `Rect x=47 y=18 w=6 h=11` | `illoBoxTape` |
| 8 | Shipping label | `Rect x=37 y=35 w=8 h=5 rx=1` | `illoBoxTape` |

Footprint x 10.75–78, y 10–47. Exclusion check: the top speed line's round cap starts at x 16.75 (y 22.75–25.25); every other shape is at x ≥ 10.75 only for y ≥ 29.75.

Why this art: one family with the T-586 map vehicles (same tokens, same lights), drawn by us in SVG (no stock, no raster), readable at a glance without words (a car = I travel; a box = I send something). The box is the Parcel's one saffron moment in the row (§1.2 rule 3), replacing the 44 orange disc; the Ride card has no saffron except the 4 × 3 headlight (M8 vehicle lights).

**States of a card:**

| State | Look |
|---|---|
| Rest | fill as above |
| Pressed | fill → `primarySoftPressed` (#DCE4F8 / #1A3496) or `accentSoftPressed` (#FFE2D1 / #4A2412); card scale 1 → **0.98** and the art translates **+3 pt toward the end edge** (−3 in RTL: the vehicle "nudges forward"), both in `motion.instant` 100; release springs back (§6 #1, damping 18, stiffness 300). Reduce Motion: fill only |
| Disabled | none (a service is either shown or hidden) |
| Focused (keyboard / switch control) | 2 pt `focusRing` outline, radius 16, outside the card |

### V3. Greeting and tagline (the personality line)

- **Greeting:** `greetingFor(now, user.name)` (exists): "Good morning / afternoon / evening, {first name}", "Hello, {first name}" from 22:00 to 05:00; Roman Urdu "Subah bakhair / Salam / Shaam bakhair / Assalam-o-Alaikum, {first name}" (existing `home.greeting*` keys). `title` (17/22, 600) `textPrimary`, 1 line, tail ellipsis (only the first word of `name`, `firstNameOf`), `accessibilityRole="header"`. No name → the salutation alone. No emoji, no wave.
- **Tagline:** `bodySmall` (14/20, 400) `textSecondary` (7.44 / 9.39 on `surface`), 1 line. New key **`home.tagline`**: en "Fixed fares, within the city"; ur-Latn "Tay shuda kiraya, shehar ke andar". It is static copy (an i18n string, not data) and carries the in-city promise that the retired ride-only heading carried (UI-R20 S1).
- **Tagline slot by state** (first match wins):

| State | Slot shows |
|---|---|
| Live ride/parcel | nothing (greeting only; the status line under "Return" speaks) |
| Offline (NetInfo `isConnected === false`) | `offline` glyph (`wifi-off`) 16 `warning` → 4 → `bodySmall` `warning` (5.86 / 9.42) **`home.offlineTagline`**: en "You're offline. Showing saved info."; ur-Latn "Aap offline hain. Mehfooz maloomat dikha rahe hain." Replaces the sheet-top offline Banner on Home (no peek jump) |
| Compact height (< 700) | hidden (greeting only), except the offline line, which replaces the greeting's tagline slot and is always shown (peek +20 while offline on SE) |
| Otherwise | the tagline |

- **Clock:** the greeting is re-evaluated on focus, on return to the foreground, and by one `setTimeout` to the next boundary (05:00, 12:00, 17:00, 22:00), cleared on blur/unmount. No per-minute tick (replaces the UI-R20 "ticks only while live" timer).
- Greeting widths (SF Pro 17/600, estimated at ~8.6 pt per character): "Good afternoon, Muhammad" ≈ 205, "Assalam-o-Alaikum, Muhammad" ≈ 235, both one line on SE (343 available); a longer name ellipsizes. The reviewer checks these on device.

### V4. "Where to?" hero

- `minHeight` **56** (was 52), full width − 32, radius **`pill`**, fill `surfaceAlt`, pressed `surfaceAltPressed` + scale 0.98 (`usePressScale`, §6 #1). **No shadow or elevation in either mode** (rule: nothing inside a sheet is elevated; the sheet owns `elevation.3`; a shadow under a grey fill on white reads muddy and costs overdraw on Android). The field-boundary rule §5.6 does not apply: it is a button with a visible label, as in UI-R9.
- Leading **search disc 32** (circle) `primary` with the 20 `search` glyph `onPrimary` (14.89 / 5.61), start inset **12** (disc x 28..60 on screen). The disc is decorative against the bar (12.82 light; 2.75 dark: the label identifies the control). Navy, not orange (§1.7 "evaluated and not adopted": orange search icon).
- 12 gap → label "Where to?" in **`h3`** (20/25, 600, −0.1) `textPrimary` (15.81 / 14.01 on `surfaceAlt`), 1 line. At 1.3× the line is 33 and fits in 56.
- Trailing: nothing today (the "Now"/schedule chip stays hidden until scheduled rides exist).
- Label, hint, testID unchanged (`home-where-to`, "Where to? Book a ride within the city").
- Live ride: replaced by "Return to your ride" / "Track your parcel" (T-577), unchanged.

### V5. Chip row polish

- Kit `Chip` gets **`variant: 'filled' | 'outline'`** (default `filled`, existing look everywhere else). Home's chip row uses `outline`: fill `surface`, 1 pt `border` (#DADFEA / #2B3450; decorative, the label identifies it), pressed `surfacePressed` (#EBEEF5 / #252D44). This puts a clear step between the filled hero and its shortcuts.
- Height 32 (min), padding 12, leading glyph 16, kit gap; label `label` (13/18, 600). Colours: place chips (Home, Work, other, recents, Saved places): glyph `textSecondary`, label **`textPrimary`** (was `textSecondary`); Add chip ("Add home" / "+ Add", `tone="primary"`): glyph and label `primaryText`; "Turn on location": glyph `locationOff` in `warning`, label `textPrimary`.
- Recent-destination chips: max width 160, label tail-ellipsis.
- **Edge fade:** a 16 wide gradient at the trailing edge of the row (exactly the content inset, so it never covers the last chip at the scroll end), `surface` opacity 0 → 1, `react-native-svg` `LinearGradient`, static, `pointerEvents="none"`, rendered only while the content is wider than the row (`onContentSizeChange`); at the start edge in RTL. No leading fade.
- Order, content rules and skeletons unchanged (block 4 above, UI-R9).

### V6. Service row: parcel tier on/off, cold start (replaces S1, S6)

- Parcel on (S7 value) and nothing live → the service row (V2). Parcel off, unknown (first launch ever) or catalogue failed with nothing known → **no service row** and no heading: the **ride-only heading is retired** (one Ride card would only repeat "Where to?"; the tagline now states "within the city"). Live ride → no service row.
- **Off → on at `peek`:** the sheet eases 190 → 274 (`motion.base` 250, timing, no spring), then both cards fade in and rise 8 → 0 (`motion.fast` 150). Camera padding applied once at the end.
- **On → off at `peek`:** cards fade out (150, `pointerEvents="none"` from the first frame), then the sheet eases 274 → 190 (250).
- **At `half`/`full`:** the row's wrapper height eases 84 ↔ 0 (250) with the fade; the body below moves with it (one animated height, not `LayoutAnimation`). The sheet keeps its height; the new peek applies to the next snap.
- During a drag: waits for the gesture end (S6 rule kept). Reduce Motion: swap at once.
- Cold start: S7 unchanged (in-memory catalogue → `rh.home.parcelTile` → nothing). The service row is never a skeleton.

### V7. Cold-open entrance (first impression)

**When:** only the first time Home is focused in this JS session (after the splash, after sign-in, after a relaunch). Not after a tab switch, a return from Booking/Parcel, a theme or language change, or a resume from the background. A module-level flag `homeEntered` is set at the end.

**Timeline** (ms from Home's first layout; everything on the UI thread with Reanimated shared values; opacity and transform only):

| Element | From → to | Start | Duration / curve |
|---|---|---|---|
| Map veil: a full-cover `View` in `theme.mapBackground` above the map, `pointerEvents="none"` | opacity 1 → 0 | `onMapReady` (if it fires before 0, at 0) | 250, `motion.base` |
| Sheet (whole sheet container) | translateY +40 → 0 | 0 | spring damping 28, stiffness 260, mass 1, `overshootClamping: true` (≈ 300, no bounce) |
| Greeting block | opacity 0 → 1, translateY 8 → 0 | 60 | 250, `motion.base` |
| "Where to?" | same | 100 | 250 |
| Chip row (one block, not per chip) | same | 140 | 250 |
| Ride card | same | 180 | 250 |
| Parcel card | same | 220 | 250 → ends at **470** |
| Avatar, locate button, count chip | opacity 0 → 1 | 200 | 150, `motion.fast` |

- Total under 500 ms (470). The map veil is the only thing allowed to finish later: it waits for `onMapReady` (network), so a slow map shows the calm land colour, never Google's grey or a white flash.
- Every control is pressable from frame 0 (no `pointerEvents` gate); a tap mid-entrance simply proceeds.
- **Reduce Motion:** no translation and no spring; sheet content and controls are visible at once; the map veil fades in 150.
- **Low-end Android:** ≤ 9 animated nodes, all started from one effect after the first layout with `withDelay` (no JS timers, no `entering` layout animations, which measure); nothing animates on later focuses.
- Camera padding uses the final peek from the start (the map never re-fits during the entrance).

### V8. Map: brand-tinted style (`src/theme/mapStyles.ts`, all maps; DESIGN_SYSTEM §9 updated)

`react-native-maps` with `PROVIDER_GOOGLE` and `customMapStyle={theme.mapStyle}` already runs on Home (no cloud map ID, so JSON styling works on both platforms). The arrays stay module constants (stable identity: a new array per render would restyle the native map). `mapBackgrounds` = the land colour of each mode.

**Light:**

| featureType / elementType | Stylers |
|---|---|
| (all) `geometry` | color `#F3F5F9` (cool, navy-tinted land; was `#F2F2F2`) |
| `poi.park` `geometry` | color `#E3EEE6` |
| `water` `geometry` | color `#CCDBF2` |
| `road` `geometry.fill` | color `#FFFFFF` |
| `road` `geometry.stroke` | color `#E1E5EE` |
| `road.arterial` `geometry` | weight 1.2 |
| `road.highway` `geometry.fill` | color `#E4EAF7` |
| `road.highway` `geometry.stroke` | color `#CDD7EE` |
| `road` `labels.text.fill` | color `#626B82` |
| `road` `labels.text.stroke` | color `#FFFFFF` |
| `administrative.locality` `labels.text.fill` | color `#4C556C` |
| `administrative.neighborhood` `labels.text.fill` | color `#858EA5` |
| `poi` `labels.icon` | visibility off |
| `poi` `labels.text.fill` | color `#858EA5` |
| `poi.business` | visibility off |
| `poi.medical` `labels.icon` | visibility on |
| `transit.line` `geometry` | color `#DADFEA` |
| `transit.station` `labels.icon` | visibility on |

**Dark:**

| featureType / elementType | Stylers |
|---|---|
| (all) `geometry` | color `#1B2233` (was `#1D2230`) |
| (all) `labels.text.fill` | color `#8A94AD` |
| (all) `labels.text.stroke` | color `#1B2233` |
| `administrative.locality` `labels.text.fill` | color `#B7BFD0` |
| `poi.park` `geometry` | color `#1A2A2A` |
| `water` `geometry` | color `#0E1830` |
| `road` `geometry.fill` | color `#283149` |
| `road` `geometry.stroke` | color `#1B2233` |
| `road.arterial` `geometry.fill` | color `#2E3852` |
| `road.highway` `geometry.fill` | color `#34426B` (navy tint) |
| `road.highway` `geometry.stroke` | color `#283149` |
| `road` `labels.text.fill` | color `#8A94AD` |
| `poi` | visibility off |
| `transit.station` | visibility on |

Contrasts against the new land (WCAG 2.1, non-text unless noted): light `pickupPin` 4.60, `routeLine` 13.64, `dropoffPin` 3.06, `userLocation` 5.93, road labels (text) 4.88, locality labels 6.81; dark `pickupPin` 8.01, `dropoffPin` 4.75, `routeLine` 6.72, `driverMarker`/vehicle body 14.42, `userLocation` 6.67, labels 5.23. Pickup pin on a light park 4.21. The hex values live only in `mapStyles.ts` (the documented place for map style JSON, like `palette.ts`).

### V9. Map chrome

- **Status-bar scrim:** height `insets.top + 24`, vertical `LinearGradient` `surface` at opacity 0.85 → 0, static SVG, `pointerEvents="none"`, above the map and below every control; hidden at `full`. Keeps the clock and battery legible over map labels.
- **Avatar** (top-start, unchanged position `insets.top + 8`, x 16): 48 floating circle with the 40 avatar.
- **User location:** halo `Circle` 40 `userLocation` at opacity 0.16 (light) / 0.20 (dark) → ring 20 `routeLineCasing` → dot 14 `userLocation` (#1D58C4 / #7FA8F5). Static (no pulse). Marker tracked for one settle window, then frozen (T-586 rule). Replaces the navy `primary` dot.
- **Locate button and count chip, one family:**
  - Locate: floating 48, end 16, its bottom 16 above the sheet top (unchanged).
  - Count chip: start 16, `minHeight` 32, **vertically centred on the locate button**: bottom = sheet top − 16 − (48 − chip height) / 2 (= 24 at 1.0×, measured at 1.3×). Max width rule (map-vehicles §4) unchanged.
  - Both (and the avatar circle): light fill `surface` + `elevation.2`; dark fill `surfaceRaised` (#252D44) + 1 pt `border`, no shadow (§3.5). Supersedes map-vehicles §4 "no shadow, hairline border" for the Home chip; Choose ride's chip follows the same rule.
  - Both fade out at `full` (unchanged) and in with the entrance (V7).

### V10. First view by state

| State | First view |
|---|---|
| Normal (signed in, location on, online, parcel on) | Target shots. Peek 274 (SE 254) |
| Parcel tier off / unknown | No service row; peek 190 (SE 170); tagline still says "within the city" |
| New account, nothing saved, no rides | Greeting with the first name (no name → salutation alone); chips "Add home" + "Saved places"; service row; at `half` the one-line empty hint (UI-R9). Count chip as the server says ("No drivers online near you right now" when 0) |
| Offline at launch | Map veil fades to cached tiles or stays the land colour (tiles may be missing; never an error over the map); tagline slot shows the offline line (V3); count chip hidden (map-vehicles §4); chips and service row from cache / last known; "Where to?" opens search, which shows its own offline state. No Banner, no peek jump |
| Location refused or off | "Turn on location" chip first (T-580); camera on Lahore centre (§9); no user dot; locate button asks for permission (existing) |
| Map failed (fallback component) | Land colour + "Map is loading" (`home.mapLoading`) centred in the map area; sheet unaffected |
| Live ride or parcel | Greeting, "Return to your ride"/"Track your parcel" + status, chips; no service row; peek 198 |
| 1.3× text | ≈ 293 (iPhone 17); every line one line except chips grow; card labels never touch the art (V2 exclusion) |
| Roman Urdu | Greeting and tagline in ur-Latn; card words "Ride"/"Parcel"; tagline 1 line on SE ("Tay shuda kiraya, shehar ke andar" ≈ 225 at 14 pt, estimated; 343 available) |
| RTL (future `ur`) | Everything mirrors by start/end; card art mirrored (V2); chip fade at the start edge |

### V11. Copy changes (i18n `home.*`, en + ur-Latn ship together)

| Key | Change |
|---|---|
| `home.tagline` | **new**: "Fixed fares, within the city" / "Tay shuda kiraya, shehar ke andar" |
| `home.offlineTagline` | **new**: "You're offline. Showing saved info." / "Aap offline hain. Mehfooz maloomat dikha rahe hain." |
| `home.serviceRideSub`, `home.serviceParcelSub` | **delete** (no subtitles) after a grep shows no other reader |
| `home.rideOnlyHeading` | **delete** (heading retired) after grep |
| `home.serviceRideA11y`, `…Hint`, `home.serviceParcelA11y`, `…Hint`, `home.serviceRideTitle`, `home.serviceParcelTitle`, `home.whereToA11y` | unchanged (S4) |

### V12. Accessibility

- Focus order: avatar → locate → count chip → handle → greeting (header) → tagline → "Where to?" → chips → Ride card → Parcel card → body.
- Cards: `accessibilityRole="button"`, label/hint per S4 (the art is `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`). Targets: cards 72 high, "Where to?" 56, chips 32 visual with `hitSlop` to 44.
- The entrance never delays a screen reader: elements are in the tree from frame 0 (opacity only).

### V13. Performance (adds to S9)

- No new request: greeting from the stored profile, tagline static, services from the cached catalogue (S7), counts from the existing nearby poll.
- `ServiceCard` and `ServiceArt` are `memo`; the art is a static `Svg` (Ride 15 shapes, Parcel 10), no gradients, no masks, no filters inside it; its props are a kind, a fill colour and a boolean (`flip`), so drags, camera moves and nearby polls re-render nothing. The two `LinearGradient`s (scrim, chip fade) are static and never re-render.
- Press feedback and the entrance run on the UI thread; nothing animates after the first 500 ms except the map veil (once) and user-driven presses.
- `mapStyles` constants keep their identity across renders.

### V14. Builder notes (replaces S10)

- **Kit:** new `ServiceCard` in `src/components/ui` (props `kind: 'ride' | 'parcel'`, `title`, `onPress`, `accessibilityLabel`, `accessibilityHint`, `testID`, gallery-only `previewPressed`); new `ServiceArt` in `src/components/ui/ride/` with its geometry as data in `serviceArt.ts` (same pattern as `vehicleGlyphs.ts`), unit-tested against this spec (shape values, exclusion rule). Delete `ServiceTile` and its gallery section/test after grep (it has no other users today: `HomeSheetTop`, the gallery and `__tests__/components/ui/serviceTile.test.tsx`). `componentTokens.serviceTile` → `componentTokens.serviceCard: { minHeight: 72, artWidth: 104, artHeight: 56, artBottom: 2, rowGap: space[3], labelInset: space[3], pressNudge: 3 }`.
- Kit `Chip` gains `variant="outline"` (V5); dev gallery shows both variants in light/dark.
- Home: header = greeting block + "Where to?" (`HomeSheetTop` simplifies: the header no longer swaps kinds except greeting-with/without tagline and the live "Return" block); the service row moves into the body after the chip row inside a measured `peekGroup` wrapper (V1 formula). `useHomePeek` follows the new formula and estimates.
- Theme: illustration tokens (V2), `mapStyles.ts` and `mapBackgrounds` (V8). Update `contrastPairs.ts` and any snapshot keyed to the old map land.
- Entrance (V7) lives in a small hook `useHomeEntrance()` returning the animated styles; tests: runs once per session, skipped on refocus, Reduce Motion path.
- Tokens only: no hex in components or screens, no raw font sizes, spacing from `space`/`layout` (the 2 pt art bottom offset and the 3 pt nudge are component internals recorded in `componentTokens`).

### V15. Design review evidence (UI-R20b)

`docs/qa-reports/<date>-ui-r20b/design-*.png`, each shrunk with `sips -Z 1000`: iPhone 17 peek light and dark; half and full light; Ride and Parcel pressed (light); peek at 1.3× (dark); Roman Urdu peek (light); parcel tier off peek (light) and the on → off switch; offline first view (backend stopped briefly on the local machine, light); new-account first view (fresh local test account, light); location refused (light); live ride (greeting + Return, no cards); iPhone SE peek light and dark and SE 1.3×; a 3-frame capture of the cold-open entrance (≈ 100 / 250 / 500 ms) on iPhone 17. Before shots: `docs/design/screens/shots/ui-r20b/before-*.png`; target: `target-*.png`.


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
| **[UI-R20]** Parcel tier on / off / changes | § Services S1, S5, S6. **[UI-R20b]** § Services v2 V6 (row shown or hidden; heading retired). |
| **[UI-R20b]** First view (cold open, offline, new account, location off, 1.3×, Roman Urdu) | § Services v2 V7, V10. |
| **[UI-R20]** Ride or parcel in progress | Service row and ride-only heading hidden; greeting + "Return to your ride"/"Track your parcel" as T-577 (peek 202). |

## Interactions
- Drag sheet between peek and full (spring §6.2); tapping the map collapses to peek.
- "Where to?" tap: shared-element feel: the bar animates (250 ms) to the top of the search screen.
- Shortcut tap: opens destination search with that place prefilled as dropoff and jumps straight to passenger-vehicle-fare.
- Long-press a recent destination → action sheet "Save as Home / Save as Work / Save place / Remove from recents" (remove = local hide only). **[UI-R9 review: deferred to UI-R9b]**
- **[UI-R9 review] Not built yet, by decision:** offers pager (waits for BE-10 `GET /public/banners`; section stays hidden), the 250 ms "Where to?" shared-element transition (UI-R9b), long-press actions (UI-R9b). A recent-destination chip tap opens Booking with that place as the destination, exactly like a saved-place chip.

## Accessibility
- Sheet handle: `accessibilityRole="button"`, label "Expand" / "Collapse" by state. "Where to?" bar: role button, label **[UI-R20]** "Where to? Book a ride within the city". Map: `accessibilityElementsHidden` except the recenter button.
- ~~**[UI-R20]** Focus order: handle → Ride tile → Parcel tile → "Where to?" → chips → body.~~ **[UI-R20b]** Focus order and card roles: § Services v2 V12. Labels and hints: § Services S4.

## Small device (iPhone SE)
- **[UI-R20b]** Compact height (< 700): tagline hidden; peek **254** with the cards, **170** without; `half` 434 (§ Services v2 V1).
- **[UI-R20]** Peek 244 with the service row (same as iPhone 17 at 1.0×; tiles 165.5 wide), 170 without it. `half` = **max(50 % of the sheet container, peek + 180)**, never above `full`: SE 1.0× = **424**; iPhone 17 = max(390, 424) = **424** (corrected in design review, was 437). This keeps the compact rides ErrorState (≤156 + 16 gap) fully visible at `half` (DESIGN_SYSTEM §8.3 [UI-R20]).

## Dark
- **[UI-R20b]** Dark map style per § Services v2 V8 (land `#1B2233`), card fills `primarySoft` #1C2850 / `accentSoft` #3A1A0C, floating controls `surfaceRaised` + 1 pt `border` (V9).
- Dark map style, sheet `surface` #141A2A, bar `surfaceAlt`. **[UI-R20]** tiles: § Services S3 (token values for both modes).
