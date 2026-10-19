# Shared · Map vehicles (icons, motion, tier filter, counts, auto-accept)

- **Tasks:** T-586 (icons, motion, tier filter, count chip; §1–§5), T-587 (request reach on finding driver: `passenger-finding-driver.md` § Request reach; driver auto-accept: §7 here). Backend: BE-116 (§6 lists what the app needs from it).
- **Supersedes:** DESIGN_SYSTEM §5.21 "Driver marker [T-517]" and rule (d) (PNG art, nearby at 60 % and not interpolated) and §6.7 "Nearby drivers and reduced motion"; `passenger-home.md` Layout block 2 (24×24 glyphs at 60 %). The pickup/drop-off/stop pins, route line and camera rules of §5.21 are unchanged.
- **Source today:** `src/components/ui/VehicleMarker.tsx` (bitmap from `ride/vehicleAssets.ts`, made by `scripts/generate-vehicle-markers.js`), `src/components/ui/ride/useInterpolatedMarker.ts` + `vehicleMotion.ts` (assigned vehicle motion, T-517/T-535), `src/components/passenger/NearbyDrivers.tsx` (`NearbyDriverMarkers`, `NearbyDriversStatus`), `src/hooks/useNearbyDrivers.ts` (poll 15 s, min gap 10 s).
- **Origin:** owner live session 2026-10-19 with 50 online test drivers: "vehicle movement isn't right", "vehicle icons aren't nice", "if I choose car I should only see cars", "show which drivers my request went to and who is viewing it", "how many drivers are active now", "nearby drivers", "auto mode with our expected price" for drivers.
- **Audit (fresh, 2026-10-19, iPhone 17):** `docs/design/audit/passenger-home-nearby-markers-light.png`, `…-dark.png`; earlier: `docs/qa-reports/2026-10-19-t584-t585-qa/01a-finding.png`, `05h-driver-approaching-before.png`, `docs/qa-reports/2026-10-19-t583-t582b-qa/09a-one-driver-nearby.png`.

## 0. Defects today (what this spec fixes)

| # | Where (iPhone 17 pt) | Defect |
|---|---|---|
| D1 | Home, every nearby marker (e.g. 230,467; 4,197; 461,197) | Every nearby vehicle is the same grey car at 60 % opacity: washed out on the light map (reads as a grey blob), off-brand (no navy), no tier difference. |
| D2 | Home, 50 drivers online, only 4 markers visible | Public positions are snapped to a 0.005° (~550 m) grid (`DriverPrivacy::GRID_DEGREES`) and only change every 120 s (`POSITION_BUCKET_SECONDS`): many drivers stack on one grid point, and moving cars hop one block every two minutes. No interpolation can make that look like driving. |
| D3 | Home and Choose ride | Nearby markers jump (no interpolation, no fade); markers pop in/out at each poll and when the hourly opaque id rotates. |
| D4 | Choose ride | Map shows every tier while "Car" is selected. |
| D5 | Home / Choose ride / Finding | No count of nearby or online drivers on the map (only a text chip in the old planner); owner asked for both. |
| D6 | Finding driver (`01a-finding.png`) | Map shows no vehicles at all; the sheet gives no sign that anyone received the request. |
| D7 | Assigned vehicle | Smooth on the route (T-517) but hard-jumps for moves over 500 m and after a resume; no appear fade. |
| D8 | Driver Drive | No auto-accept. |

---

## 1. Vehicle icon set (top-down, react-native-svg)

One `VehicleGlyph` component per kind, drawn with `react-native-svg` (`Svg`, `G`, `Rect`, `Path`, `Circle`, `Ellipse`, `Line`), **no raster images**. The PNG set in `src/assets/vehicles/` and `scripts/generate-vehicle-markers.js` are retired once nothing imports them (grep first).

### 1.1 Kinds and mapping

| Backend `vehicle_type` | Glyph | Notes |
|---|---|---|
| `car` | `car` | sedan |
| `car_ac` | `carAc` | the car + snowflake roof badge |
| `bike` | `bike` | motorcycle with rider |
| `parcel` | `bikeParcel` | the bike + box on the rear rack (BE-88: parcels go by bike) |
| `rickshaw` | `rickshaw` | three-wheeler with canopy and saffron band |
| `van` | `van` | long box body with roof ribs |
| `null` / unknown | `car` | never guessed in text, only in art |

### 1.2 Canvas, sizes and pivot

- **Drawing grid:** every coordinate below is in a 48-unit grid, north-up (the vehicle's front points to y = 0). The SVG `viewBox` is **`0 0 56 56`** and all drawing sits in `<G transform="translate(4 4)">`, so the shadow (up to 3.5 units) and casing (2 units) never clip at the canvas edge.
- **Pivot:** the canvas centre (28, 28 in the viewBox = 24, 24 in the grid). Each vehicle is drawn so the middle of its footprint sits on the pivot. Marker `anchor={{x: 0.5, y: 0.5}}`, `flat`, `rotation = heading` (degrees clockwise from north). The pivot never moves between states, so a size change does not shift the vehicle on the map.
- **Rendered sizes** (new `componentTokens.ride.vehicleMarker`):

| Token | Value | Use |
|---|---|---|
| `nearbySize` | 40 pt canvas (0.714 pt per viewBox unit; a car is 27 pt long) | nearby vehicles (Home, Choose ride, Finding) |
| `assignedSize` | 48 pt canvas (0.857 pt per unit; a car is 33 pt long) | the assigned driver (passenger), the driver's own vehicle (Drive, DriverRide) |
| `haloSize` | 56 pt circle, centred on the pivot | assigned state only (§1.6) |
| `assignedViewSize` | 64 pt square marker view | assigned: halo + 48 pt glyph centred |
| `nearbyOpacity` | 1 (was 0.6) | contrast comes from size and z-order, not transparency |

### 1.3 Colour tokens (new, in `SemanticColors`, `src/theme/tokens.ts`)

No hex in components; these are palette references added to `lightColors` / `darkColors`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `vehicleBody` | navy-800 `#011C72` | dark-50 `#F2F4F9` | body, mirrors, bike tank/handlebar |
| `vehicleRoof` | navy-600 `#2E4FBF` | navy-200 `#C9D5F7` | roof, canopy, rider jacket, parcel box |
| `vehicleGlass` | navy-200 `#C9D5F7` | navy-700 `#1A3496` | wind/rear glass, helmet visor |
| `vehicleTyre` | neutral-800 `#20273A` | dark-600 `#626E90` (a darker tyre disappears into the dark casing) | tyres |
| `vehicleCasing` | = `routeLineCasing` (white) | = `routeLineCasing` (dark-950 `#0B0F1A`) | 2-unit outline around the silhouette |
| `vehicleHeadlight` | = `accent` saffron-500 `#F59A23` | = `accent` | head lights, helmet, rickshaw band |
| `vehicleTaillight` | = `danger` `#C0262D` | = `danger` `#FF7A7F` | tail lights |
| `vehicleShadow` | black | black | contact shadow colour (opacity below) |
| `vehicleAcBadge` | white `#FFFFFF` | navy-800 `#011C72` | AC roof disc |
| `vehicleAcGlyph` | navy-800 `#011C72` | white `#FFFFFF` | snowflake strokes |
| `vehicleHalo` | = `primary` navy-800 | navy-400 `#6A86DE` | assigned halo fill and ring |

Opacity constants (`componentTokens.ride.vehicleMarker`): `shadowOuterOpacity` light 0.08 / dark 0.24, `shadowInnerOpacity` light 0.16 / dark 0.40, `haloFillOpacity` light 0.14 / dark 0.20, `haloRingOpacity` light 0.32 / dark 0.45.

**Contrast:** light: navy-800 body on the light map land (≈`#F4F4F4`) ≈ 14:1, roof navy-600 on body is a visible 2.3:1 step (depth, not text); dark: dark-50 body on the dark map (≈`#1D2438`) ≈ 14:1. Every glyph's outer boundary is ≥ 3:1 against both map styles (WCAG 1.4.11). Light vehicles on dark map / navy vehicles on light map is the Uber/Careem convention; the navy keeps our identity.

### 1.4 Paint order (every glyph)

1. **Outer shadow:** `<G opacity={shadowOuterOpacity}>` with every *silhouette* shape filled `vehicleShadow` and stroked `vehicleShadow`, `strokeWidth` 7 (3.5 outside), `strokeLinejoin="round"`.
2. **Inner shadow:** same shapes, `<G opacity={shadowInnerOpacity}>`, `strokeWidth` 5.
3. **Casing:** same shapes, `vehicleCasing` fill and stroke, `strokeWidth` 4 (2 outside), full opacity.
4. **Fills:** the detail shapes in the order listed per glyph.

The shadow is centred under the vehicle (no offset), so it is the same at every rotation (a drop shadow with an offset would swing round as the car turns). It is drawn in the SVG, never `elevation`/`shadow*` on the marker view (DESIGN_SYSTEM §5.21 rule (b): iOS Google Maps snapshots the view and turns native shadows into grey squares). Use group opacity on `G`, not per-shape opacity, so overlapping silhouettes do not double-darken.

### 1.5 Drawings (48-unit grid, front at top)

Seams between same-colour parts are 0.9-unit `vehicleCasing` strokes only where noted. All `rx` values are corner radii.

**`car`** (footprint x 14–34, y 5–43)
- Silhouette: body `Rect x=14 y=5 w=20 h=38 rx=7`; mirrors `Rect x=11.5 y=15 w=3.5 h=2.5 rx=1.25` and `Rect x=33 y=15 w=3.5 h=2.5 rx=1.25`.
- Fills: body + mirrors `vehicleBody`; windshield `Path d="M16.5 15.5 Q24 12.5 31.5 15.5 L30.2 20.5 Q24 19.3 17.8 20.5 Z"` `vehicleGlass`; roof `Rect x=17.8 y=21.5 w=12.4 h=10.5 rx=2.5` `vehicleRoof`; rear glass `Path d="M17.8 33 Q24 34.2 30.2 33 L31 37 Q24 38.8 17 37 Z"` `vehicleGlass`; headlights `Rect x=16.8 y=7 w=4 h=2 rx=1` and `x=27.2` `vehicleHeadlight`; tail lights `Rect x=16.8 y=39.2 w=4 h=1.8 rx=0.9` and `x=27.2` `vehicleTaillight`.

**`carAc`** = `car` + roof badge: `Circle cx=24 cy=26.75 r=5` `vehicleAcBadge`; snowflake = three `Line`s through (24, 26.75), `vehicleAcGlyph`, `strokeWidth` 1.2, `strokeLinecap="round"`: (24, 23.55)→(24, 29.95); (21.23, 25.15)→(26.77, 28.35); (21.23, 28.35)→(26.77, 25.15). The badge rotates with the car (it is a roof marking).

**`van`** (footprint x 13–35, y 3–45)
- Silhouette: body `Rect x=13 y=3 w=22 h=42 rx=4`; mirrors `Rect x=10.5 y=10 w=3.5 h=2.5 rx=1.25`, `Rect x=34 y=10 w=3.5 h=2.5 rx=1.25`.
- Fills: body + mirrors `vehicleBody`; windshield `Path d="M15.2 9.5 Q24 7.2 32.8 9.5 L31.8 14 Q24 13 16.2 14 Z"` `vehicleGlass`; roof `Rect x=15.5 y=15.5 w=17 h=26.5 rx=2` `vehicleRoof`; roof ribs `Line` (17, 24.5)→(31, 24.5) and (17, 33)→(31, 33), `vehicleBody`, `strokeWidth` 1; headlights `Rect x=15 y=4.2 w=4.5 h=1.8 rx=0.9`, `x=28.5`; tail lights `Rect x=15 y=42.2 w=4.5 h=1.6 rx=0.8`, `x=28.5`.

**`rickshaw`** (footprint x 12.8–35.2, y 4.5–41.5)
- Silhouette: front tyre `Rect x=22.7 y=4.5 w=2.6 h=4 rx=1.3`; rear tyres `Rect x=12.8 y=31 w=2.6 h=7 rx=1.3`, `Rect x=32.6 y=31 w=2.6 h=7 rx=1.3`; body `Path d="M24 6.5 C28.4 6.5 31.2 9.6 31.8 14 L33 36.5 Q33 41.5 28.5 41.5 L19.5 41.5 Q15 41.5 15 36.5 L16.2 14 C16.8 9.6 19.6 6.5 24 6.5 Z"`.
- Fills (in order): tyres `vehicleTyre`; body `vehicleBody`; windshield `Path d="M19.2 13 Q24 11.2 28.8 13 L29.4 18 L18.6 18 Z"` `vehicleGlass`; canopy `Rect x=17 y=19.5 w=14 h=19.5 rx=3` `vehicleRoof`; canopy band `Rect x=17 y=35 w=14 h=1.6` `vehicleHeadlight` (the saffron trim of Pakistani rickshaws; the only decorative accent in the set); headlight `Circle cx=24 cy=8.6 r=1.2` `vehicleHeadlight`; tail lights `Rect x=17.5 y=39.8 w=3.2 h=1.2 rx=0.6`, `x=27.3` `vehicleTaillight`.

**`bike`** (footprint x 16–32, y 5–43)
- Silhouette: front tyre `Rect x=22.6 y=5 w=2.8 h=8 rx=1.4`; rear tyre `Rect x=22.6 y=35 w=2.8 h=8 rx=1.4`; handlebar `Rect x=16 y=13 w=16 h=2.4 rx=1.2`; body `Path d="M21.2 15 L26.8 15 L27.4 33.5 Q24 36 20.6 33.5 Z"`; shoulders `Ellipse cx=24 cy=24.5 rx=7.2 ry=4.4`; arms `Line` (18, 22.5)→(17.5, 15) and (30, 22.5)→(30.5, 15) (`strokeWidth` 2.4 in the fill pass, 2.4 + the pass width in shadow/casing passes); helmet `Circle cx=24 cy=22 r=3.8`.
- Fills (in order): tyres `vehicleTyre`; handlebar + body `vehicleBody`; arms + shoulders `vehicleRoof` (rider jacket), `strokeLinecap="round"`; helmet `vehicleHeadlight`; visor `Path d="M21.4 20.4 Q24 18.6 26.6 20.4"` stroke `vehicleGlass` 1.2, round caps, no fill; headlight `Circle cx=24 cy=12.4 r=1.1` `vehicleHeadlight`; tail light `Rect x=22.4 y=34.2 w=3.2 h=1.2 rx=0.6` `vehicleTaillight`.

**Reference renders** (built from exactly the values above; the designer compares the RN components against them): `docs/design/vehicles/vehicle-glyphs-light.svg`, `vehicle-glyphs-dark.svg`, previews `vehicle-glyphs-light-preview.png`, `vehicle-glyphs-dark-preview.png` (order: car, AC car, van, rickshaw, bike).

**`bikeParcel`** = `bike` + box (added to the silhouette too): `Rect x=20 y=30.5 w=8 h=6 rx=1` `vehicleRoof`, tape `Line` (24, 30.5)→(24, 36.5) `vehicleCasing` 0.9. Drawn after the body, before the tail light.

### 1.6 States

| State | Size | Look | z-index |
|---|---|---|---|
| Nearby | 40 | glyph only, opacity 1 | 0 (below pins) |
| Nearby, data stale (§2.4) | 40 | opacity 0.5 | 0 |
| Assigned (passenger: your driver; driver: own vehicle) | 48 glyph in a 64 view | **halo** behind the glyph: `Circle` 56 pt `vehicleHalo` at `haloFillOpacity` + 1 pt ring `vehicleHalo` at `haloRingOpacity`. The halo is round, so rotation does not change it. | above every pin and nearby vehicle (today 4) |
| Assigned, driver arrived | 48 / 64 | halo and pin rules of T-588 (the vehicle snaps to the pickup); no extra decoration | 4 |
| Tier filtered out | not rendered | fades out (§2.5) | — |

No labels, callouts or tap handling on nearby vehicles (`tappable={false}`; the old title/description callout goes: it printed the rotating vehicle type and an ETA from a coarse point). The assigned vehicle keeps its accessibility label ("Your driver's {vehicle}" / "Aap ke driver ki {vehicle}").

**Tracking:** the SVG renders synchronously, so the marker view is tracked (`tracksViewChanges`) for one settle window (`MARKER_SETTLE_MS`) after mount and after any change of kind, size, state or theme, then frozen. Position and rotation are marker props and never re-track the view.

**RTL:** markers are geographic: never mirrored in Urdu RTL.

---

## 2. Motion

Two profiles in `motionPatterns` (`src/theme/motion.ts`); logic stays in `vehicleMotion.ts` + `useInterpolatedMarker.ts` (assigned) and a new shared ticker for the nearby layer.

### 2.1 Constants

| Constant | Assigned (`driverMarker`, extended) | Nearby (`nearbyMarker`, new) |
|---|---|---|
| Update interval U | ride poll (4 s; 3 s under T-588) | `NEARBY_POLL_MS` (15 s) |
| Position duration | gap between the last two updates, clamped `minPositionMs` 300 … min(`maxPositionMs` 8000, 2 × U) (unchanged) | same rule, clamped 1000 … 2 × U (30 s) |
| Position easing | linear (constant speed through consecutive updates) | linear |
| Rotation | shortest arc (`shortestTurn`), exponential ease, τ = `rotationMs`/3 = 100 ms | shortest arc, τ = 200 ms (settles ≈ 600 ms: calmer) |
| Jitter (ignore move) | 3 m | 15 m (privacy fuzz noise) |
| Max plausible speed | 40 m/s (144 km/h) | 30 m/s (108 km/h) |
| Teleport distance | 500 m | 600 m |
| Route snap | 30 m (unchanged) | none (no route for other drivers) |
| Heading source | road segment on route → server/device heading → move bearing | server `heading` (BE-76) → bearing of a move ≥ 40 m → keep last |
| Frame budget | ≤ 30 commits/s (`MARKER_FRAME_MS` 33, T-535) | **one** shared ticker for the whole layer, ≤ 15 ticks/s (66 ms), one batched state update per tick |
| Max markers | 1 | `NEARBY_MAX_MARKERS` = 15, nearest first by `distance_km` (counts in the chip are the server's, not the rendered number) |

### 2.2 Position

- Each update starts a move **from where the marker is drawn now** to the new point, over the duration above, so a vehicle driving steadily arrives about when the next update lands and never stops between polls (one interval behind real time, like the competitors).
- **Implausible move** (distance over the teleport distance, or distance / duration over the max speed): no slide across blocks. **Relocate with a crossfade:** fade out 150 ms (`motion.fast` curve) at the old point, move, fade in 250 ms (`motion.base`) at the new point; rotation is set directly while hidden. Replaces today's hard jump (D7).
- **Grid/fuzz noise:** a move under the jitter distance is ignored (the marker keeps finishing its current move).
- **Overlap (coarse positions only):** when two or more nearby vehicles arrive with the same coordinate (today's 550 m grid, D2), spread them on a circle of radius 40 m around that point, ordered by `id`, so the count on the map matches the chip. The spread is inside the position's own uncertainty, so it invents nothing. Not needed once BE-116 sends finer positions (§6).

### 2.3 Rotation

- Always the shortest way round (`shortestTurn`, −180…180); never a 350° spin.
- Nearby: a server heading change under 20° while moving under 15 m is ignored (no twitch on noise). A null heading keeps the last rotation (new markers start at the bearing of their first move ≥ 40 m, else north).
- Assigned: unchanged T-517 rules (road direction on the route).

### 2.4 Missed or late updates

- **No extrapolation.** When an update is late, the vehicle finishes its current move and **stops** at the last known point. We never draw a position the server did not send.
- Nearby, a poll fails (error/timeout/offline): markers stay. After **2 consecutive failures or 30 s without fresh data** they dim to 0.5 (200 ms fade). After **90 s** they fade out (200 ms) and the count chip shows its error state (§4). Fresh data restores full opacity (150 ms).
- Assigned: the marker never dims for a late update; stale handling of the driver position belongs to the ride screen (T-588).
- App background / screen blurred: the loop pauses (T-535); on return each marker continues from the clock (a move that ended meanwhile lands at its end at once); a resume gap over 30 s relocates with the crossfade instead of a long slide.

### 2.5 Appear and leave

- **Appear** (a new id in a successful response): opacity 0 → 1 and scale 0.85 → 1 over 250 ms (`motion.base` standard curve), new markers in one response staggered 20 ms, max 8 staggered.
- **Leave** (an id missing from a successful response): opacity 1 → 0 over 200 ms (`motion.exit` accelerate), then unmount. A leaving marker keeps its last rotation.
- **Hourly id rotation** (`DriverPrivacy::publicId` changes every hour): in one response, a new id of the same `vehicle_type` within 100 m of an id that disappeared is treated as the same marker (it keeps its view and moves), so all markers do not blink on the hour.
- **Tier switch** (Choose ride, §3): markers of other tiers leave (fade 150 ms), markers of the new tier appear (250 ms, staggered 20 ms, max 8). No request is needed when the response carries all tiers (§6).
- Opacity is animated through the `Marker` `opacity` prop on the shared ticker (≤ 15 steps/s), not by re-tracking the view.

### 2.6 Reduced motion

Position and rotation jump on each update; appear/leave/relocate are instant; stale dimming is instant. Counts still update.

### 2.7 Performance acceptance (low-end Android first)

- Nearby layer: one `requestAnimationFrame` loop for all markers, gated to ≤ 15 ticks/s, one batched `setState` per tick, only markers in motion re-render (`React.memo` per marker with primitive props), frames that move < 0.5 m and turn < 1° are skipped, loop idle when nothing moves. Paused when the map's screen is blurred or the app is in the background.
- Where `react-native-maps` offers native marker animation with the Google provider on both platforms (`animateMarkerToCoordinate(coordinate, duration)`), the builder may use it instead of the JS loop: then JS sends one call per marker per update. Verify on both platforms before relying on it; keep the JS ticker as the fallback.
- No new request bursts: tier switch, tier counts and total online come from the same nearby response.
- QA gate (T-586): Android emulator low-RAM profile and iPhone SE with 15 moving nearby vehicles + the assigned vehicle: JS frame rate ≥ 55 fps while idle on Home, sheet drag stays smooth, no visible stepping at zoom 15–16.

---

## 3. Choose ride: only the selected tier

- Map shows only vehicles that can serve the **selected** tier: a driver is shown when the tier is in its `tiers` list from BE-116 (dispatch rules: an AC-approved car may serve `car`; `car_ac` only approved AC cars; `parcel` only opted-in bikes). Fallback while BE-116 has no `tiers`: `vehicle_type === selectedTier`.
- Each vehicle draws its **own** `vehicle_type` glyph (an AC car serving the car tier shows `carAc`: true to the vehicle).
- Tier switch per §2.5; the count chip updates in the same frame.
- Home (no tier chosen): all tiers, each its own glyph.
- Pickup moved on the map (centre pin): the nearby query centre follows the pickup (existing hook rules, min gap 10 s).

## 4. Map count chip (Home, Choose ride)

**Placement (one rule for both screens):** on the map, bottom-start, x = 16 from the leading edge, its bottom 12 above the sheet's top edge; moves with the sheet (hidden when the sheet is at `full`). On Home it sits on the same baseline as the locate button (end side), centred on it vertically. Hidden on Finding driver (the reach strip replaces it), on Driver assigned and later states.

**Anatomy:** kit `Chip`-style pill, height 32 (min; grows at large text), padding 12 horizontal, radius `pill`, fill `surface`, hairline `border`, no shadow on the map (consistent with markers; the border separates). Leading 8 pt dot `success` (some available) / `textMuted` (none) → 8 → text `label` `textPrimary` with numbers in tabular figures; the online part in `textSecondary`. Max width = screen width − 16 − 16 − locate button (56) − 12; text 1 line, the online part drops first when it would not fit (SE at 1.3× font).

| Screen / state | English | Roman Urdu |
|---|---|---|
| Home, ready, `online_total` > 0 | "{online} drivers online near you" (1: "1 driver online near you") | "{online} drivers aap ke qareeb online hain" (1: "1 driver aap ke qareeb online hai") |
| Home, ready, 0 | "No drivers online near you right now" | "Abhi aap ke qareeb koi driver online nahi" |
| Choose ride, ready, n > 0 | "{n} {tier plural} nearby · {online} online" (n = 1: "1 {tier} nearby · {online} online") | "{n} {tier ur} qareeb · {online} online" |
| Choose ride, n = 0, online > 0 | "No {tier plural} nearby right now · {online} online" | "Abhi qareeb koi {tier ur singular} nahi · {online} online" |
| Choose ride, n = 0, online = 0 | "No {tier plural} nearby right now" | "Abhi qareeb koi {tier ur singular} nahi" |
| Loading (first read) | "Finding {tier plural} nearby…" (Home: "Finding drivers nearby…") + 16 spinner in place of the dot | "Qareeb {tier ur} dhoond rahe hain…" (Home: existing "Qareeb drivers dhoond rahe hain…") |
| Error (§2.4, 90 s) | "Couldn't load nearby drivers" in `danger`, tap = retry now (min gap rules) | "Qareeb drivers load nahi ho sake" |
| Offline | hidden (the offline banner speaks) | — |

Tier nouns:

| Tier | en singular / plural | ur singular / plural |
|---|---|---|
| `car` | car / cars | gaari / gaariyan |
| `car_ac` | AC car / AC cars | AC gaari / AC gaariyan |
| `bike` | bike / bikes | bike / bikes |
| `rickshaw` | rickshaw / rickshaws | rickshaw / rickshaw |
| `van` | van / vans | van / vans |
| `parcel` | parcel rider / parcel riders | parcel rider / parcel riders |

`n` = the server's count for the tier within the query radius (BE-116 `counts.by_tier[tier]`); `online` = the server's total online drivers within the same radius (`counts.online_total`). Both are server numbers, never the number of markers drawn (§2.1 caps markers at 15). If the response has no counts (older backend), the online part is hidden and `n` falls back to the length of the tier's list.

**Accessibility:** `accessibilityRole="text"`, live region polite, announced only when the text changes category (loading → ready, n crosses 0, tier change), not on every poll. Label = the visible text.

**Motion:** number changes swap with a 150 ms fade; no count-up animation. Reduced motion: instant.

## 5. Finding driver

See `passenger-finding-driver.md` § "Request reach and nearby vehicles [T-586/T-587]". Nearby vehicles of the requested tier stay on the map with the motion above.

## 6. What the app needs from BE-116 (contract asks)

1. **Nearby response** (`GET /rides/nearby-drivers`): every tier in one response, each driver `{id, vehicle_type, tiers[], location, heading, distance_km, estimated_arrival_min}` plus `counts: {by_tier: {<tier>: n}, online_total: n}` and the `radius_km` used. Then tier switches and counts cost no request.
2. **Position precision for smooth motion (needs rh-security PASS):** with a 550 m grid and 120 s buckets (today) nearby vehicles can only relocate (crossfade), never drive. For Uber-like motion the public position must be continuous and fresh: proposal for rh-security to rule on: a per-driver offset fixed for the hour (random direction, 80–150 m, tied to the hourly opaque id so it cannot be averaged out within the hour) plus a 15 s position delay, instead of grid snapping; headings stay 15° steps. Until that ships the app runs the coarse path: overlap spread (§2.2), crossfades, no slides over 600 m. The motion rules above need no change when it ships.
3. **Reach** (`GET /rides/{id}/reach` or, better, a `reach: {sent, viewing}` object inside `GET /rides/{id}` while `requested`, so the ride poll carries it with no extra request). Counts only.
4. **Optional (b2, needs rh-security PASS):** the viewer-scoped opaque ids (the same ids as the nearby list) of the drivers who were sent the request and of those viewing it, so the map can mark them (finding-driver spec, "Phase 2"). No identities, no positions beyond the nearby list.
5. **Auto-accept settings** (`GET`/`PUT` driver auto-accept): `{enabled, min_fare, max_pickup_km, tiers[], limits: {min_fare: {min, max, step}, max_pickup_km: {min, max, step}}, eligible_tiers[]}` so the steppers never hardcode ranges; refusal `message` when the driver may not use it.

---

## 7. Driver Drive: auto-accept (T-587)

Extends `driver-drive-home.md` (peek, half). Fares stay server-fixed: "expected price" means the **minimum fare** the driver will auto-accept; nothing lets a driver ask for more (owner rule 2026-10-13).

### 7.1 Auto-accept row (in the Drive sheet, offline and online)

Placement: between the status row and the Go online / Go offline button: status row → 12 → **auto-accept row** → 12 → button. Peek = 24 + status row 25 + 12 + row 56 + 12 + button 56 + 16 = **201** (was 137); DESIGN_SYSTEM §8.3 updated accordingly. On iPhone SE the map keeps ≥ 45 % of the screen above the sheet.

Anatomy: container `surfaceAlt`, radius `md`, min height 56, padding 8 vertical / 16 horizontal (Switch slot absorbs the end padding per §5.9). Leading icon 24: off `flash-outline` `textSecondary`, on `flash` `primaryText`. 12 gap. Text column: title `body` weight 600 `textPrimary` "Auto-accept"; subtitle `caption` `textSecondary`, 1 line, ellipsis at the end (the tier list truncates first). Trailing kit `Switch` (64×44 slot).

| State | Subtitle (en) | Subtitle (ur) |
|---|---|---|
| Off, never set | "Accept matching rides for you" | "Munasib rides aap ke liye khud accept hon" |
| Off, settings saved | "Off · Rs {min_fare}+ · {km} km" | "Band · Rs {min_fare}+ · {km} km" |
| On, online | "Rs {min_fare}+ · up to {km} km · {tiers}" | "Rs {min_fare}+ · {km} km tak · {tiers}" |
| On, offline | "On · starts when you go online" | "On · online hone par shuru hoga" |
| Not allowed (server refusal: not approved, suspended, strikes) | server `message`; row at 0.4 opacity, switch disabled | server `message` |
| Loading settings | skeleton 120×12 in place of the subtitle; switch disabled | — |
| Error loading | "Couldn't load auto-accept" + row tap retries | "Auto-accept load nahi ho saka" |

Interactions:
- Tap the row (outside the switch) → **Auto-accept sheet** (§7.2).
- Switch on with no saved settings → opens the sheet (nothing is turned on until "Turn on").
- Switch on with saved settings → `PUT enabled: true` at once; the switch shows on optimistically; on failure it flips back with Toast error "Couldn't turn on auto-accept. Try again." / "Auto-accept on nahi ho saka. Dobara koshish karein."
- Switch off → `PUT enabled: false`, no confirmation (turning off is safe). Toast "Auto-accept off" / "Auto-accept band".
- Haptic `selection` on toggle.

### 7.2 Auto-accept sheet (modal BottomSheet, content height)

1. Handle; 24 from top. Title `h3` "Auto-accept" (ur "Auto-accept").
2. 4 gap: `bodySmall` `textSecondary`: "Rides that match these settings are accepted for you. Fares are still set by Raah-e-Haq." / "In settings se milti rides aap ke liye accept ho jayengi. Kiraya ab bhi Raah-e-Haq tay karta hai."
3. 24 gap: **Minimum fare** section. Label `label` `textSecondary` "Minimum fare" / "Kam se kam kiraya". 8 gap. Stepper (same anatomy as the passenger `OfferStepper`: IconButtons `minus`/`plus` 48 `secondary` at the ends, value centred `numericL` `textPrimary` "Rs {min_fare}"), steps by `limits.min_fare.step` within `limits.min_fare.min..max`; the button at a limit is disabled. 8 gap. `caption` `textSecondary`: "Only rides paying Rs {min_fare} or more" / "Sirf Rs {min_fare} ya zyada wali rides".
4. 24 gap: **Max pickup distance**: label "Max pickup distance" / "Pickup ki zyada se zyada doori"; same stepper, value "{km} km" (one decimal only when the step is fractional), limits from `limits.max_pickup_km`. Caption "Rides with a pickup up to {km} km from you" / "Aap se {km} km tak pickup wali rides".
5. 24 gap: **Ride types**: label "Ride types" / "Ride ki qisam". 8 gap. Wrapping row of kit `Chip` (selectable, 8 gap) for `eligible_tiers` only, using the tier display names from `GET /vehicle-types` with their glyph (§1, 20 pt `nearby` art scaled, not MDI). At least one stays selected: deselecting the last does nothing and shows the caption `caption` `danger` "Pick at least one ride type" / "Kam se kam ek qisam chunein" for 3 s. A driver with one eligible tier sees no chips, just the line "{tier}" `body`.
6. 16 gap: Banner `info` (no icon emoji; MDI `information-outline`): "Cancelling an auto-accepted ride counts as a strike." / "Auto-accept hui ride cancel karne par strike lagti hai."
7. Footer (§5.14): when off: Button `lg primary` "Turn on auto-accept" / "Auto-accept on karein". When on: Button `lg primary` "Save" / "Save karein" → 8 → Button `ghost` "Turn off auto-accept" / "Auto-accept band karein". Saving: loading state (width kept); success closes the sheet + Toast "Auto-accept on" / "Auto-accept on" or "Saved" / "Save ho gaya"; validation errors from the server under the related field (`caption` `danger`); network error Toast "Couldn't save. Try again." / "Save nahi ho saka. Dobara koshish karein."

States: loading = skeletons for the three sections, footer disabled; offline = kit OfflineBanner at the top, footer disabled "You're offline" / "Aap offline hain".

### 7.3 On state on the Drive map and sheet

- Status row when online + on: title "You're online" with a trailing Badge `primarySoft` / `onPrimarySoft` "Auto" (`label`, `flash` 14 leading) (ur "Auto"); subtitle "Matching rides are accepted for you." / "Munasib rides aap ke liye accept ho rahi hain."
- Map: the decorative 300 m request circle becomes the real **max pickup circle**: radius `max_pickup_km`, fill `primary` 6 %, stroke 1 pt `primary` 24 % dashed 6/4, centred on the driver's vehicle; camera does not refit for it. Off: back to the existing 300 m circle.
- **A ride is auto-accepted:** haptic `notificationSuccess` + the request sound (respects "Sound alerts"); the incoming-request takeover shows title `h2` "Ride accepted for you" / "Ride aap ke liye accept ho gayi" with a 24 `check-circle` `success`, the fare (`numericL`), pickup line and pickup distance, and one Button `lg primary` "Go to pickup" / "Pickup par jayein" (no Accept/Decline, no countdown); after 5 s untouched it moves on to driver-to-pickup by itself. Cancelling later uses the normal to-pickup cancel (strike copy as today).
- Auto-accept stays on across sessions; logout and going offline do not change the setting (it only acts while online).

### 7.4 Offer views (no UI)

The driver app reports `offer-viewed` once per offer when the incoming-request card is first visible on screen for ≥ 1 s (not on background delivery); retries silently once; never blocks the card.

---

## 8. Acceptance (T-586, T-587)

Matches this spec and `passenger-finding-driver.md` in light and dark on iPhone 17 and iPhone SE: glyph geometry and colours (screenshot at 3× compared with an SVG render of §1.5), sizes 40/48/64, halo, no native marker shadow; tier filter; chip copy in en and ur; motion constants in `motion.ts` (no magic numbers in components); performance gate §2.7; reduced motion; no hex, raw font sizes or magic spacing in touched files.
