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

## UI-R4 review rulings (2026-10-13)
- DESIGN_SYSTEM §8.3 v1.1 wins over the v1.0 overlay above: the top overlay is the avatar (48, top-start) and "locate me" only; the **Today earnings pill lives in the sheet at `half`**, not centred in the overlay. Peek 137 (status row + 56pt button), half 50%, no full.
- At `half`, the Today Card must not repeat the pill: tiles are Rides (today) · Online time (when the API returns it, else hidden) · Rating, as specified in block 4 — no "Earned" tile next to a "Today · Rs …" pill (UI-R11).
- Going online with no fix yet is allowed (UI-R4 parity); "Location permission missing" (denied/services off) must replace the control with the denied card, and online-with-no-fix shows "Finding your location…" under the status row (UI-R11).

## Auto-accept [T-587, owner live session 2026-10-19]
- Auto-accept row between the status row and the Go online/offline button (peek 137 → 201), the Auto-accept settings sheet (minimum fare, max pickup distance, ride types), the online "Auto" badge, the max-pickup circle and the auto-accepted ride takeover: `map-vehicles.md` §7. The driver's own vehicle marker uses the assigned state of `map-vehicles.md` §1.6.

---

## Drive v2 (UI-R11, 2026-10-20): the driver's first view

**Supersedes**, where they conflict: Layout (offline/online blocks), the UI-R4 rulings' half-state tile list, and the States rows marked below. **Keeps what ships:** the auto-accept row, sheet and takeover (T-587, `map-vehicles.md` §7), the driver's own vehicle marker and the max-pickup circle (T-586), the "Location needed" card and its taller peek (T-580), "Resume ride", the online/offline thunks and haptic. Bar: the same first-impression quality as the passenger Home (`passenger-home.md` § Services v2): one hero line, one action, calm map, honest states, a sub-500 ms entrance.

**Before:** `docs/design/screens/shots/ui-r21/drv-drive-offline-light.png`, `drv-drive-offline-dark.png`, `drv-drive-today-rating-star-navy-dark.png`, `docs/qa-reports/2026-10-13-ui-r4/after-driver-drive-online-iphone17-dark.png`, `after-driver-drive-online-half-iphone17-dark.png`, `after-driver-drive-offline-iphonese-light.png`.

### D0. What is wrong today (pt, iPhone 17, `drv-drive-offline-light.png`)

| # | Defect | Where |
|---|---|---|
| 1 | Peek says only "You're offline": the reason/next step ("Go online to start getting ride requests.") is hidden at `half` | sheet y 690–720 |
| 2 | Auto-accept row disabled at 0.4 opacity with a truncated server message ("…is not available while you…") | y 735–795 |
| 3 | Avatar is a solid green disc (not the kit initials on `primarySoft`) and floats without the floating-control family style | (46, 108) |
| 4 | No status-bar scrim: the clock sits on map labels | y 0–60 |
| 5 | At `half`: a "Today · Rs …" chip, then 2–3 stat tiles, then recent trips, then the account card: four blocks with four looks; tiles show for missing values on new accounts (UI-R4 review) | `after-driver-drive-online-half-*` |
| 6 | Going online is a hard swap (no feedback beyond the button spinner); the request area circle pops in | — |
| 7 | Request feed errors and "loading" float as a separate white card over the map (`RideRequestPanel` state card) | above the sheet |
| 8 | Cold open: map and sheet pop in at once | — |

### D1. Peek, top to bottom (iPhone 17 402 × 874; SE 375 × 667)

| # | Block | Height | Gap after |
|---|---|---|---|
| 1 | Handle area | 24 | — |
| 2 | **Status block** (D2): status row 25 + 2 + subtitle 20 | 47 | 12 |
| 3 | Auto-accept row (T-587, unchanged anatomy) | 56 | 12 |
| 4 | Online action: Go online `lg primary` / Go offline `lg outline` / Resume ride `lg primary` (unchanged) | 56 | 16 |

- **Peek = 24 + 47 + 12 + 56 + 12 + 56 + 16 = 223** (was 201; DESIGN_SYSTEM §8.3 updated). Map above the sheet: iPhone 17 874 − 223 − 94 (tab bar 60 + inset 34) = 557; SE 667 − 223 − 60 = 384 (58 %, the T-587 ≥ 45 % rule holds).
- 1.3× text: status row 33 + subtitle 26 (2 lines at most: 52) — measured, never hard-coded (`peek = contentTop + measured header + measured body to the action's bottom + 16`, re-applied on a ≥ 1 pt change).
- Location card shown: the T-580 rule (peek grows by the card minus 56, second snap `full`).
- `half` = max(50 % of the sheet container, peek + 180), capped at `full` (Home rule).

### D2. Status block

- **Row:** status dot 12 (offline `textMuted`, online `success` with a 2 pt `successSoft` ring = 16 outer, on ride `info`) → 12 → `h3` (20/25, 600) status ("You're offline" / "You're online" / "You're on a ride"), 1 line → flex → Auto Badge (T-587 §7.3) when online + on.
- **Subtitle slot** (`bodySmall` 14/20, 1 line, 2 at 1.3×, 2 below the row, start-aligned with the status text at x 40, i.e. after dot 12 + 12). First match wins:

| State | Glyph 16 + tone | English | Roman Urdu |
|---|---|---|---|
| Checking status | — | skeleton 160 × 12 | — |
| Device offline (NetInfo) | `wifi-off` `warning` | "You're offline. Requests are paused." | "Aap offline hain. Requests ruki hui hain." |
| Location uploads failing (3 in a row) | `cloud-off-outline` `danger` | "Can't reach Raah-e-Haq. You may miss requests." | "Raah-e-Haq se rabta nahi ho raha. Requests reh sakti hain." |
| Request feed failed twice (today's floating error card, D0 #7) | `cloud-off-outline` `danger` + trailing link `buttonSmall` `primaryText` "Retry" / "Dobara" (hit 44) | "Couldn't load ride requests." | "Ride requests load nahi ho sakin." |
| Online, no GPS fix yet | `crosshairs` `textSecondary` | "Finding your location…" | "Aap ki location dhoond rahe hain…" |
| Weak GPS (accuracy > 100 m for 30 s) | `crosshairs-question` `warning` | "Weak GPS signal. Requests may be delayed." | "GPS signal kamzor hai. Requests der se aa sakti hain." |
| On a ride | — `textSecondary` | "Finish your ride to go offline." (shipped `drive.onRideHint`) | shipped |
| Online, auto-accept on | — | "Matching rides are accepted for you." (shipped) | shipped |
| Online | — | "Looking for ride requests near you." (shipped) | shipped |
| Offline | — | "Go online to start getting ride requests." (shipped) | shipped |

  The subtitle replaces the old sheet Banners and the floating feed card (no peek jump, Home V3 pattern). The 2 pt `success` searching shimmer (shipped) sits 6 below the subtitle inside the 12 gap, start x 40, width = text column, only while online and no notice is showing.
- `accessibilityRole="summary"`, label "{status}. {subtitle}"; live region polite on the subtitle (announces notice changes, not the searching state).

### D3. Going online / offline (motion)

| Moment | Animation |
|---|---|
| Go online tapped | Button loading (width kept); haptic `impactLight` on success (shipped) |
| Became online | dot colour crossfades `textMuted` → `success` (150) and **one** ring pulse: a 16 `success` ring scales 1 → 2.25 and fades 0.4 → 0 (600 ms, `Easing.out(Easing.quad)`); status text crossfades (150); button variant crossfades primary → outline (150, fill and label colours); the max-pickup / request circle fades in 0 → 1 (250) and scales 0.9 → 1; shimmer starts after 250 |
| Became offline | reverse colour/label crossfades (150); circle fades out (150); no pulse |
| Reduce Motion | colour and label swap at once; no pulse, no scale; shimmer static (shipped) |

### D4. `half` content (below the action, 24 gap, 16 between blocks)

1. **Pending approval** Banner `warning` (shipped copy) — first, because it blocks everything below.
2. **Today card** (replaces the "Today · Rs" chip and `DriverTodayStats` tiles; one block, no duplicate figure): Card `outlined`, radius `lg`, padding 16.
   - Row: `overline` `textSecondary` "TODAY" / "AAJ" → flex → link `buttonSmall` `primaryText` "Earnings" / "Kamai" + `chevron-right` 16 (hit 44) → Earnings tab.
   - 4 → `numericL` (22/28) `textPrimary` `{earnings_today}` (`formatMoney`); `caption` `textSecondary` "earned" / "kamaye" after it on the same baseline, 8 gap.
   - 12 → hairline `border` → 12 → up to three equal cells (value `numeric` `textPrimary`, label `caption` `textSecondary`, centred, hairline vertical separators 24 high): trips today "{n}" / "Trips" ("Trips" / "Trips"); online time "3 h 20 min" / "Online"; rating star 16 `ratingStar` + "4.8" / "Rating" ("New" when null). A cell whose value the API did not send is not drawn; the rest share the width.
   - Loading: skeleton (overline 60 × 12, number 120 × 22, three cells 48 × 16). Error: the card body becomes compact ErrorState (title "Couldn't load today's numbers" / "Aaj ke numbers load nahi ho sake", "Try again" `sm secondary`). All values null on a new account: the card shows only the earnings line "Rs 0" if the API returns 0, else the EmptyState line "Your first trip of the day will show here." / "Aaj ki pehli trip yahan nazar aayegi." (`bodySmall` `textSecondary`), no cells.
3. **Recent trips** card (T-507, shipped `RecentRidesCard`) — hidden while empty.
4. **Vehicle & account** card (shipped ListItem with the approval Badge).

### D5. Map chrome (UI-R20b V9 family)

- Status-bar scrim (V9). Avatar 48 floating circle (kit Avatar 40 with initials on `primarySoft`, never a solid colour disc) top-start → Account tab. Locate 48 end, bottom 16 above the sheet. Both: light `surface` + `elevation.2`, dark `surfaceRaised` + 1 pt `border`. Both fade out at `full` and while a request is shown.
- Map content unchanged: own vehicle (assigned state, 48 with halo), max-pickup circle (T-587) or the 300 m circle; brand map style (V8).

### D6. Cold-open entrance (once per JS session, like Home V7)

Map veil (`theme.mapBackground`, 1 → 0 at `onMapReady`, 250); sheet translateY +40 → 0 (spring damping 28, stiffness 260, overshoot clamped) at 0; status block, auto-accept row, action: opacity 0 → 1 + rise 8 at 60 / 100 / 140 ms (250 each, ends 390); avatar + locate fade at 200 (150). Not on tab switches or returns from DriverRide. Reduce Motion: no translation, veil 150. ≤ 6 animated nodes, all `withDelay` from one effect.

### D7. Hand-over to an incoming request

The Drive sheet becomes the request sheet in place (`driver-incoming-request.md` § Request sheet v2): Drive content fades out (100), tab bar slides down (200, `motion.exit`), the sheet springs to the request height, request content fades in + rises 8 (250). On decline/timeout/taken: the reverse, sheet returns to `peek`, tab bar slides up (250). The avatar, locate button and the max-pickup circle fade out for the request (150) and back after.

### D8. States (adds to / replaces the table above)

| State | Spec |
|---|---|
| Checking | subtitle skeleton; action disabled "Go online" |
| Server refuses going online | Dialog (shipped copy + "View documents") — unchanged |
| Location permission missing | T-580 card (unchanged) |
| Device offline / uploads failing / feed error / no fix / weak GPS | subtitle slot (D2), no Banner, no floating card |
| Online, request arrives | D7 |
| Auto-accepted ride | takeover sheet (`driver-incoming-request.md` R12) |
| Active ride on launch | "Resume ride" in the action slot (shipped); DriverRide restores |
| New account (no stats) | Today card per D4 empty rule; recent trips hidden |
| 1.3× text | subtitle 2 lines max; peek measured; Today cells wrap labels to 2 lines, values 1 line |
| Roman Urdu | all strings above in ur-Latn; "Online ho jayein" fits the 56 button on SE at 1.3× (estimated 150 pt) |
| Dark | sheet `surface`, Today card 1 pt `border`, floating controls `surfaceRaised` |

### D9. Accessibility

Focus order: avatar → locate → handle → status block (summary) → auto-accept row → action → (half) Today card → link → recent trips → account card. The online action's label includes the result ("Go online, start getting ride requests"). Targets: action 56, auto-accept row 56, link 44, floating 48.

### D10. Performance

No new requests (stats from the existing `GET /me/stats` read, feed and location as shipped). The status block re-renders only on status/notice change (memo, primitive props); the shimmer and the one pulse run on the UI thread; the vehicle marker's updates never re-render the sheet.

### D11. Builder notes

- `DriveStatusHeader` gains the subtitle slot with a pure `driveNotice(state)` selector (unit-tested: order of the table in D2). `DriveSheetBody` loses the hint and the chip; new `DriverTodayCard` replaces the chip + `DriverTodayStats` (delete the latter after grep). `RideRequestPanel`'s loading/empty/error card is removed after grep; the error becomes the D2 notice with a retry callback.
- `DRIVE_PEEK_HEIGHT` 201 → measured with first-frame estimate 223.
- `useDriveEntrance()` (once per session flag, Reduce Motion path, tests).
- Kit Avatar inside the floating circle (fixes the solid disc).

### D12. Design review evidence (UI-R11, Drive)

`docs/qa-reports/<date>-ui-r11/design-*.png` (≤ 1000 px): iPhone 17 offline peek light/dark; online peek light/dark (with and without Auto); half light/dark (with stats) and half on a new account; each D2 notice that can be triggered on the local backend (device offline via the backend stopped briefly is the feed-error notice; airplane mode is not used on shared sims); Roman Urdu peek; 1.3× peek; iPhone SE offline and online peek light/dark; a 3-frame capture of going online (0 / 300 / 600 ms).
