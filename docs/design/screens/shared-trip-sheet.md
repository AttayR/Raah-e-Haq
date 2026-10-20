# Shared · Trip sheet anatomy (passenger and driver)

- **Tasks:** UI-R12 (passenger: driver on the way / arrived, on trip, receipt) and UI-R13 (driver: to pickup / arrived, on trip, complete). UI-R11 reuses §TS9 (countdown ring) and §TS2 (map chrome) for the incoming request.
- **Written:** 2026-10-20, rh-design-director. Rules: DESIGN_SYSTEM v1.2 (navy + saffron §1.2/§1.7/§1.8, quality bar of `passenger-home.md` § Services v2). Where this file and an older screen spec disagree, this file and the screen's `UI-R12`/`UI-R13` section win.
- **Why one file:** today the two roles show the same ride with two different sheets. Passenger (`ActiveRidePanel` inside `BookingSheet`, fixed height): `h3` title with labelled progress, PersonCard in a card with Call/Message, a green "Fare locked" pill, the PIN card, then a red SOS + Share button row. Driver (`DriverRidePanel` docked at max 65 %): `h3` title, labelled progress, plain PersonCard with Call/Message/Navigate, AddressPair, and **two 56 pt filled buttons** stacked in the footer ("I've arrived" + pink "Cancel ride"). Neither shows an ETA. Evidence: `docs/qa-reports/2026-10-19-t583-t582b-qa/10a-accepted-passenger.png`, `docs/qa-reports/2026-10-16-t-551-t-552-qa/2-03-driver-ride-screen.png`, `docs/qa-reports/2026-10-15-switch-safety-qa/S7-06-drv-trip-complete.png`, `docs/qa-reports/2026-10-19-t583-t582b-qa/10c-completed-rating.png`.
- **Competitive bar:** Uber (status sentence + big ETA, one primary action, Cancel in the expanded sheet), Careem (PIN and plate up front, plain cash copy), Yango (same sheet morphs between states, no blank frame), inDrive (fare and net shown to the driver, large targets).

## TS0. Defects this anatomy fixes (pt, iPhone 17)

| # | Where | Defect |
|---|---|---|
| 1 | Both, sheet title (y 540 passenger, y 388 driver) | Title is `h3` (20) with no number: neither side says *when* ("Your driver is on the way", "Head to pickup"). |
| 2 | Both, progress (y 575–605 passenger, y 420–450 driver) | Labelled 4-step bar costs 32 pt and repeats the title. |
| 3 | Passenger, PersonCard (x 18–442, y 626–842) | Driver card is a bordered card inside the sheet (card-in-sheet); the driver's card is plain. |
| 4 | Passenger, fare (y 860–890) | "Fare locked: Rs 80" is a green pill: green is status (§12.1) and the booking shows the same promise as the orange FareTag (M4). Two looks for one promise. |
| 5 | Passenger, safety | SOS (`destructiveSoft`) and Share sit as two filled buttons under the PIN, below the fold at `peek`; the driver's SOS is a map shield. Same tool, two places. |
| 6 | Driver, footer (y 800–940) | Two 56 pt filled buttons ("I've arrived" + pink "Cancel ride"): the destructive action is as loud as the primary and 8 pt from it, in thumb reach while driving. |
| 7 | Driver, map (y 0–350) | Map gets 40 % of the screen; no route drawn to the pickup or the drop-off. |
| 8 | Driver, complete card (y 462–940) | Floating legacy card (raw `Text`, `TouchableOpacity`), "Done" instead of a cash action, rating opens as a second modal over it. |
| 9 | Passenger, rating (`10c`) | Rating is a separate modal over a dimmed map, fare receipt hidden behind it. |
| 10 | Both | Copy in Title Case in the cancel dialog ("Cancel Ride", "Keep Ride", "Are you sure…?"). |

## TS1. Sheet structure

- Kit `BottomSheet`, map mode (no scrim), top radius `xl` 24, `surface`, `elevation.3` (dark: shadow 0, 1 pt `border` top edge per §1.6). Drag on the handle area + status header only; the inner scroll is active only at `expanded`. Android back: collapses `expanded` → `peek` first, then the screen's own back rule.
- **Snaps:** `peek` = measured (handle area + peek group + bottom block) and `expanded` = min(`full`, measured total). New kit snap kind **`content`** (height = measured content + footer, capped at `full` = window − `insets.top` − 8); the sheet never stretches content to fill. Peek is re-applied only on a ≥ 1 pt change (Home rule, `passenger-home.md` V1). Opens at `peek` on every state change.
- **Driver screen:** replaces the fixed dock (`maxHeight: '65%'`) with this sheet; DriverRide camera padding uses the live sheet height (as the dock height today).
- **Passenger:** the trip states (`driver_en_route`, `driver_arrived`, `in_trip`, `completed`, `cancelled`) use this sheet; the booking states before it (`searching` and earlier) keep `BookingSheet` (UI-R10 shipped). The hand-over from finding driver is a content swap inside one sheet container (§TS7), never a remount with a blank frame.
- **Footer (sticky, §5.14):** 16 top padding + action(s) + `max(insets.bottom + 8, 16)` (iPhone 17: 42; SE: 16). A hairline `border` above it only while content runs under it. A sheet with no footer ends with the last block → `max(insets.bottom + 8, 16)`.

### TS1.1 Zones (top to bottom, gutter 16; x from the sheet start edge)

| Zone | Block | Height (1.0×) | Gap after | Notes |
|---|---|---|---|---|
| Z0 | Handle area (kit `sheet.contentTop`) | 24 | — | handle 36 × 5 at y 8, `border` |
| Z1 | **Status header** (§TS3) | 56 with ETA tile; text height otherwise (50 for title + subtitle) | 12 | pinned at `expanded` |
| Z2 | **Progress** (§TS4) | 4 | 16 | hidden on the receipt |
| Z3 | Role zone A (driver: target row §TS6.1; passenger: none) | driver 66 | 16 | |
| Z4 | **PersonCard** (§TS5) | 128 (56 identity + 16 + 56 actions); 56 when inline | 16 | |
| Z5 | Role zone B (passenger: PIN card, fare row; driver: waiting timer at pickup) | see screen spec | 12 between items | |
| — | end of peek group | | | |
| Z6 | **Details** (`expanded` only, 24 below the peek group) | content | 16 between blocks | role-specific; last item is the cancel action where allowed (§TS8) |
| F | **Footer** (driver only during a trip; both on the receipt) | 16 + action + bottom | — | §TS1 |

## TS2. Map chrome on every ride map (both roles; also the incoming request)

- `Screen edges={[]}`; brand map style (`passenger-home.md` V8); **status-bar scrim** (V9: height `insets.top + 24`, `surface` 0.85 → 0, static SVG, `pointerEvents="none"`).
- **Persistent controls (max two, §9):**
  - top-start **Back**: floating IconButton, 48 passenger / 56 driver (`touchTargetDriving`), at `insets.top + 8`, start 16. Behaviour unchanged (passenger: Home with "Return to your ride", T-577; driver: Drive tab with "Resume ride").
  - top-end **Safety shield**: floating IconButton, same size, `shield-alert-outline` 24 in `danger` (6.89 dark / 5.90 light on `surface`), label "Safety" / "Safety tools", end 16. Opens the existing `SosSheet` (calls 15 / 1122, alert my contacts, share trip). Shown while `isSosAvailable(ride)` (from acceptance to 30 min after the end, T-520). **Passenger gains the shield** (moved from the SOS button row); the driver's stays where it is.
- **Transient control:** **Recentre** (`crosshairs-gps`, same size) appears only after the user pans/zooms (camera follow paused), at end 16, its bottom 16 above the sheet top, riding with the sheet; fades in/out `motion.fast`; hidden at `expanded`. The driver's recentre moves from under the shield (today `insets.top + 16 + 56`) to this place, matching the passenger and Home's locate button.
- **Floating style (one family, V9):** light `surface` + `elevation.2`; dark `surfaceRaised` + 1 pt `border`, no shadow.
- **Focus order:** back → safety → (recentre) → sheet.

### TS2.1 Map content by state

| State | Pins and vehicles | Route | Camera |
|---|---|---|---|
| Driver on the way (`accepted`) | pickup pin; assigned vehicle 48 with halo (`map-vehicles.md` §1.6) | vehicle → pickup, cased `routeLine` (§5.21), when fetched | fit vehicle + pickup |
| Arrived | pickup pin; vehicle snapped to the pickup (T-588) | none | pickup centred at zoom 17 in the area above the sheet |
| On trip (`started`) | numbered stop pins still to visit; drop-off pin (M1, orange) | vehicle → remaining stops → drop-off (T-549 trip route) | passenger: fit vehicle + drop-off (or next stop); driver: §6.7 "Camera (DriverRide)" |
| Receipt | pickup pin + drop-off pin, no vehicle | the trip route from the directions cache only; none if not cached | fit pickup + drop-off |
| Driver cancelled / ride cancelled | as the last state, vehicle removed with a fade (`map-vehicles.md` §2.5) | removed | unchanged |

- **Route fetch rules (both roles, one shared hook):** T-549 rules for every leg: one Directions request when the leg starts (from the directions cache when it answers), again only when the vehicle is > 120 m off the line, never sooner than 60 s, and every 5 min. While a leg is loading or failed: **pins only, never a straight line**. The driver's side gains the vehicle → pickup and trip legs (it draws no route today).
- **Camera padding:** top `insets.top + 72` (8 + 48 control + 16; driver `insets.top + 80` with the 56 controls), bottom = live sheet height + 24, sides 48. Refit only on a state change, a sheet height change of ≥ 24 pt, or when the vehicle leaves the framed area (no refit per location update). A pan pauses follow until Recentre or the next state.

## TS3. Status header (Z1)

- Row, `minHeight` 56 when the ETA tile shows; `alignItems: 'center'`; text column `flex: 1`, then 12, then the tile.
- **Title:** `h2` (22/28, 700, −0.2) `textPrimary`, max 2 lines, tail ellipsis, `accessibilityRole="header"`. A status sentence (copy per screen spec), never a label like "Trip in progress".
- **Subtitle:** `bodySmall` (14/20) `textSecondary`, 1 line (2 at 1.3×), tail ellipsis, 2 below the title. Tone switches to `warning` (5.86 / 9.42) or `danger` for the notice states each screen lists (stale location, offline).
- **Badges:** AC (`AcBadge`), Parcel, women-mode badges sit in the subtitle row start, 8 apart, before the subtitle text; the subtitle wraps under them at 1.3×. Never in the title row (they pushed the title in today's driver sheet).
- **ETA tile:** 56 × 56, radius `md` 12, fill `primarySoft` (#EEF2FC / #1C2850). Centred column: value `numericL` (22/28, tabular) `onPrimarySoft` (12.71 / 9.77), then `caption` (12/16) `onPrimarySoft` "min". Value = `eta.minutes` (TS10) clamped 1…99, "99+" above. Hidden (not a skeleton, not a dash) when there is no ETA; the text column then takes the full width.
  - Value change: the number crossfades (old out 100 ms, new in 150 ms with a 4 pt rise); tabular figures, so nothing shifts. Appear/disappear: fade `motion.fast`.
  - a11y: the tile is not focusable on its own; the header's label reads "{title}, {n} minutes away" / "{title}, {n} minute mein".
- **Live region:** the header is `accessibilityLiveRegion="polite"`; it announces only state changes (title change), never ETA ticks.

## TS4. Progress (Z2)

- Kit `RideProgress` with **`showLabels={false}`** on trip sheets (labels stay in the gallery and Ride details): 4 segments, track 4, gap 4, `primary` fill on `surfaceAlt`, radius `xs`. Steps: on the way 2, arrived 3, on trip 4 (segment 1 = requested, always full).
- a11y: one element, role `progressbar`, label "Step {n} of 4: {status}" / "4 mein se qadam {n}: {status}".
- Segment fill animates 250 ms standard on a state change; Reduce Motion: instant.
- Hidden on compact height during `arrived` (see screen specs) and on the receipt.

## TS5. PersonCard (Z4), one component, both roles

- Kit `PersonCard` `variant="plain"` (no card-in-sheet on either role; the passenger's bordered card goes).
- **Identity row:** Avatar 56 (initials on `primarySoft` when no photo or it fails) → 12 → info column (`flex: 1`): name `h3` 1 line (first name only for riders, BE-20); rating row: star 16 `ratingStar` (M2) + 4 + `numeric` value (one decimal), or "New" (passenger view of a driver) / "New rider" (driver view) in `caption` `textMuted`; passenger only: vehicle line `caption` `textSecondary` "{make} {model} · {colour}", wraps to 2 lines (§5.27 [UI-R5]). Passenger only, end: plate pill 28 high (`surfaceAlt`, `numeric`, letter-spacing 0.5, `maxWidth` 45 %), 2 pt `primary` ring while `arrived`.
- **Action row:** 16 below; cells of equal width, 8 apart, 56 high, radius `md`, `surfaceAlt` (pressed `surfaceAltPressed`), glyph 24 `primaryText` over `label` `textPrimary`. Disabled: opacity rule of the kit. Unread count Badge (`dangerFill`) on the Message glyph's top-end, **only once the ride read carries the count** (TS10 second contract ask, added 2026-10-20 at the UI-R12 design review: the ride poll has no unread count today and the sheet must not add a `/chats` poll); until then no badge is drawn and this is not a review FAIL.

| Slot | Passenger | Driver |
|---|---|---|
| 1 | **Call** `phone-outline` (only with `contact.can_call`, BE-78; label "Calling…" while POST /rides/{id}/call runs) | **Call** (same rule) |
| 2 | **Message** `message-text-outline` + unread Badge | **Message** + unread Badge |
| 3 | **Share** `share-variant-outline` "Share trip"; while a live link exists: `share-variant` with a 6 pt `success` dot at the glyph's top-end, label "Sharing" (§TS5.1) | **Navigate** `navigation-variant-outline` (only with a usable target coordinate) → external maps (shipped `mapsDirectionsUrl`) |

  A missing action leaves the others sharing the width (never an empty cell).
- **Inline layout** (`actionsLayout="inline"`, driver only, compact height < 700): the three actions become trailing tonal IconButtons 48 (8 apart, `hitSlop` 4 → 56 targets) in the identity row; the action row is not drawn (identity row 56 = the whole card). Name and rating keep 1 line each.

### TS5.1 Share trip (passenger slot 3)

- Not sharing → tap: create the live link (BE-80, shipped `useLiveShare.start`) and open the native share sheet with it; the cell shows a 20 spinner in place of the glyph while the link is created.
- Sharing → tap: kit Dialog (stacked actions): title "You're sharing this trip" / "Aap ye trip share kar rahe hain"; body "Anyone with the link can follow your ride until it ends." / "Link wala har shakhs ride khatam hone tak aap ki ride dekh sakta hai."; actions "Share link again" (`primary`) / "Stop sharing" (`destructive`) / "Close" (`ghost`).
- Unavailable (`canShareTrip` false) → slot not drawn.

## TS6. Role zones

### TS6.1 Driver target row (Z3)

- Kit `AddressPair` `size="lg"` with **one row**: the current target only (pickup, next stop, or drop-off), rail glyph of that kind (pickup circle / stop circle with number / drop-off orange square with edge, M1). Label `caption` `textMuted` ("Pickup", "Stop {n} of {total}", "Drop-off"), address `h3` (20/25) `textPrimary`, 2 lines (1 line on compact). Height 16 + 50 = 66 (41 compact).
- Tap the row: opens the full route at `expanded`.

### TS6.2 Passenger fare row

- `minHeight` 32, row: `cash` 20 `textSecondary` → 8 → amount `numeric` (16/20, tabular) `textPrimary` → 4 → `caption` `textSecondary` "cash" → flex → **FareTag** (M4, §1.7) "Fixed fare" / "Tay shuda kiraya" when `fare_locked` (BE-82). Amount = `accepted_fare`, else `total_fare`.
- Replaces the green `FareLockBadge` on the trip (the booking's FareTag carries the same promise; DESIGN_SYSTEM §1.8 updated). a11y label unchanged ("Your fare is locked at {amount}. Pay only this amount.").

### TS6.3 Driver money row (details)

- Card `outlined` radius `lg` padding 16: rows 32 high (`bodySmall` `textSecondary` label start, `numeric` `textPrimary` value end): "Fare" `{fare}`; "Booking fee" `−{booking_fee}` (only > 0); "Commission ({rate})" `−{commission_amount}`; hairline; "You keep" `title` + `numericL` `{driver_net}`. Rows only for fields the server sends (BE-84 split); card hidden if neither `fare` nor `driver_net` is present. Caption under it: "Collect {fare} in cash at the drop-off." / "Drop-off par {fare} cash lein." (parcel: shipped "paid at pickup" copy).

## TS7. Motion

- **State swap (§6.12):** old content fades out 100 ms; the sheet springs to the new peek (§6.2: damping 24, stiffness 260); new content fades in and rises 8 → 0 over 250 ms standard. The status header's title crossfades in place (it never jumps); the PersonCard does not animate if the person is unchanged (stable keys), so on the way → arrived → on trip only the header, progress and zone B change.
- **Arrived moment:** plate ring scales 1.15 → 1 with opacity 0 → 1 (250 ms standard) + haptic `notificationWarning` (passenger) / `impactLight` on "I've arrived" success (driver).
- **Trip complete:** haptic `notificationSuccess`; receipt content enters with the state swap; the money amount does not count up.
- **Recentre / ETA tile:** `motion.fast` fades.
- **Reduce Motion:** no rise, no spring (200 ms timing), crossfades only; plate ring appears at once.
- No `LayoutAnimation`, no `entering` layout animations (they measure); opacity/transform on the UI thread only.

## TS8. Cancel placement (both roles)

- Cancel is never in the footer next to the primary action and never a filled slab. It is the **last item of the details zone** (`expanded`): kit Button `md` (48), new variant **`destructiveGhost`** (transparent fill, label and icon `danger` 5.90 / 6.89 on `surface`, pressed `dangerSoft` fill, `danger` label 5.14 / 6.42), full width, leading `close-circle-outline` 20.
- Reaching it: drag the sheet up, or tap the handle (kit: a tap on the handle toggles `peek` ↔ `expanded`; screen readers use its adjustable action). No extra hint chrome.
- Rules and dialogs are the shipped ones: passenger T-589 live cancel dialog (§ passenger spec), driver `CancelReasonSheet` with the no-show fee / strike copy (BE-85, BE-109). Where the driver's no-show is offered it replaces Cancel (shipped rule) and sits in the footer (driver spec).

## TS9. Countdown ring (kit, shared with UI-R11)

New kit `CountdownRing` (react-native-svg), used inside `Button` via a `countdown` prop (`{ startedAt, durationMs, paused }`): 32 × 32 at the button's end, 12 from the end edge, vertically centred; the label centres in the remaining width. Track circle stroke 3 `onPrimary` at opacity 0.32; arc stroke 3 `onPrimary`, round cap, starts at 12 o'clock and shrinks clockwise as time runs out (mirrored in RTL); centre `numericSmall` (13/16) `onPrimary` seconds left. Arc via Reanimated `withTiming` (linear) on `strokeDashoffset` (UI thread); the seconds text is one 1 Hz state in the ring only. Remaining time is computed from `startedAt` (so a backgrounded app resumes correctly). `paused` freezes it (accepting). Reduce Motion: the arc steps once per second instead of sliding. Hidden while the button is `loading`. Contrast: `onPrimary` on `primary` 14.89 / 5.61.

## TS10. Data the sheets read (no new endpoints, one contract ask)

- Everything above is in `GET /rides/{id}` (RideResource) as shipped: `status`, `driver`/`passenger`, `vehicle`, `pin` (BE-81), `accepted_fare`, `fare_locked`, `fare_policy`, `arrived_at`, `arrival_verified`, `contact.can_call`, `cancellation_preview`, `no_show_cancel_at`, stops, BE-84 split for the driver, `can_rate`/`my_rating`, parcel and AC fields.
- **Contract ask (to be filed as a BE task by the orchestrator; not blocking): ride ETA.** Add `eta: { minutes, distance_km, target: 'pickup' | 'stop' | 'dropoff', updated_at } | null` to RideResource for the passenger and the assigned driver while `accepted` or `started`, computed from the driver's latest location with the existing `RideShares::etaMinutes` helper (haversine at `safety.share.eta_speed_kmh`), `null` when that location is older than `safety.share.location_max_age_seconds`. The app reads it on the ride poll it already runs (no new request, no faster polling). **Until it ships, the ETA tile and the "Arriving at" time are hidden and the titles use their no-ETA copy; nothing is computed or guessed on the device.** The existing `estimated_arrival` string ("12 minutes", pickup→next-stop distance × 2) is not an ETA and is never shown.
- **Contract ask 2 (added 2026-10-20, UI-R12 design review; orchestrator to file as a BE task, not blocking): chat unread count on the ride.** Add `chat: { unread_count }` (messages from the other party not yet read by the caller, the same count `GET /chats` returns per ride as `unread_count`) to RideResource for the passenger and the assigned driver while the chat is open. The app reads it on the ride poll it already runs and feeds the TS5 Message badge; no `/chats` poll from the trip sheet, no faster polling.
- Driver distance to the target in the subtitle: the server `eta.distance_km` when present, else hidden (no on-device estimate, one source of truth).

## TS11. Performance (low-end Android first)

- Sheet sections are `memo` with primitive props; the vehicle marker's 3–5 s motion and the camera never re-render the sheet (separate selectors: the sheet reads the ride, the marker reads the location).
- Only three things tick: the countdown ring (UI thread + 1 Hz text), the waiting timer (1 Hz inside its component, shipped), the ETA crossfade on a poll. Nothing else animates at rest.
- Route legs per TS2.1 rules (≤ 1 request/min per leg, usually from cache). No per-update camera refit.
- Static SVG (scrim, ring track); no blur, no masks; the receipt's map is the live map with pins only (no second map instance).

## TS12. Tokens (new, `componentTokens.tripSheet`)

`{ headerMinHeight: 56, etaTile: 56, etaTileRadius: radius.md, headerGap: space[3], zoneGap: space[4], detailsGap: space[6], targetRowLines: 2, compactHeight: 700 }`; `componentTokens.countdownRing: { size: 32, stroke: 3, trackOpacity: 0.32, endInset: space[3] }`. No numbers in components beyond these and DESIGN_SYSTEM §3 exceptions.

## TS13. Builder notes (kit changes this anatomy needs)

- `BottomSheet`: snap kind `content` (measured, capped at `full`); a tap on the handle toggles `peek` ↔ the next snap; `mode="request"` (no handle, not draggable) for UI-R11.
- `Button`: variant `destructiveGhost`; prop `countdown` rendering `CountdownRing` (TS9).
- New kit: `CountdownRing`, `MetricStrip` (UI-R11 R2 #6), `EtaTile` (TS3).
- `PersonCard`: passenger uses `variant="plain"`; new `actionsLayout: 'row' | 'inline'` (TS5); a `busy` state per action (spinner in place of the glyph, Share).
- `RideProgress`: trip sheets pass `showLabels={false}` and an a11y label (TS4).
- `RatingForm` extracted from `RateRideSheet` (one rating behaviour; the sheet keeps using it).
- One shared hook for route legs (`useRideRouteLeg`), generalising `tripRoute.ts` rules to the to-pickup leg and to the driver side (TS2.1).
- Copy through `localizedCopy`/i18n, en + ur-Latn in the same commit; `formatMoney`/`formatDistance`/`formatDuration` only.
- Tests: snap measurement (peek per zone list), ETA tile hidden without `eta`, countdown wall-clock maths, Share dialog actions, Cancel only in details, compact layout switch at 700 pt.
