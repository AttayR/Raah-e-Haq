# Driver · Heading to pickup / Arrived

- **Task:** T-615 after T-405 (driver ride screen routed), BE-04 (`arrived`, `start`, driver cancel), T-510 (message).
- **Route:** `DriverTrip` stack screen (tab bar hidden), states `accepted` → `arrived`. Replaces the unregistered `DriverRideScreen` and the Map tab's accept/start buttons.
- **Data:** `GET /rides/{id}`: `pickup_address`, `pickup_latitude/longitude`, `dropoff_address`, `stops[]`, `passenger` (first name, `rating`, `profile_image`), `passenger_count`, `special_instructions`, `total_fare`, `payment_method`, `accepted_at`, `arrived_at`. Actions: `POST /rides/{id}/arrived`, `POST /rides/{id}/start`, `POST /rides/{id}/cancel` {reason}.

## Layout
Map: driver's own vehicle marker (§5.21, top-down, rotated with the course, motion §6.7), pickup pin. Camera: north-up overview fitting the driver and the pickup above the docked panel (§6.7 "Camera (DriverRide)"); a pan or zoom pauses it and shows the recentre IconButton `floating` `locate` 56 at the top end, mirroring the back button. *(Corrected in the T-517 review, 2026-10-13: the earlier heading-up follow and top-centre "Recenter" pill did not fit a screen without in-app turn-by-turn and differed from the app's other recentre controls.)*

**Top navigation card** (y = `insets.top + 8`, x 16..386, `surface`, radius `lg`, `elevation.2`, padding 16):
- `caption` `textSecondary` "Pickup" → `h3` `{pickup_address}` (2 lines max) → 8 → row: `numeric` "{eta} min · {distance} km" + flex + Button `sm secondary` "Navigate" (`navigation-variant-outline`) → opens Google Maps / Waze with the pickup coordinates (`google.navigation:q=lat,lng` / `comgooglemaps://` / Apple Maps fallback).

**Bottom sheet** (snap `peek` blocks 1-3, `half`):
1. Handle; 20 from top.
2. **Passenger row** (5.28): Avatar 56, `h3` first name, rating; trailing IconButtons tonal 56 "Message" (unread Badge) and "Call" (only if the API provides a number).
3. 16 gap: **Primary action:**
   - `accepted`: Button `lg primary` 56 "I've arrived" (enabled always; if > 200 m from pickup, a Dialog confirms "You're {distance} from the pickup. Mark as arrived anyway?").
   - `arrived`: `bodySmall` `textSecondary` waiting timer "Waiting {mm:ss}" (from `arrived_at`) above **Slide to start trip** (5.31).
4. 16 gap (half): `special_instructions` in an info Banner when present ("Note from rider: …").
5. 12 gap: Trip Card: Raah line pickup / stops / drop-off; row `cash` "Cash · {total_fare}".
6. 16 gap: ghost Button (danger text) "Cancel trip" → reason sheet.
7. Bottom `insets.bottom + 8`.

**Cancel reason sheet** (modal): `h2` "Why are you cancelling?" → single-select ListItems with radio: "Rider isn't at the pickup", "Rider asked me to cancel", "Vehicle problem", "Safety concern", "Other" (Other reveals a TextField) → Button `lg destructive` "Cancel trip" (disabled until a reason). Reason strings go to `reason`.

## States
| State | Spec |
|---|---|
| Marking arrived | Button loading; on success haptic `impactLight`; passenger is notified (BE-04). |
| Starting | Slider locks at the end with a spinner on the knob; success → driver-trip-in-progress. |
| Invalid transition (409) | Toast error with server message; refetch ride. |
| Passenger cancelled | Full-sheet message: icon circle 64 `surfaceAlt` `account-cancel-outline`, `h3` "The rider cancelled", `bodySmall` "You're back online.", Button `lg primary` "OK" → Drive online. |
| Offline | Offline banner; actions show network toast; location queue retries. |
| GPS weak | Banner warning "Weak GPS signal". |

## Accessibility
- Slide to start has the double-tap accessibility action. Navigate button label "Navigate to pickup in Maps".

---

## UI-R13 (2026-10-20): to pickup / arrived — same sheet as the passenger, driving density

**Anatomy:** `shared-trip-sheet.md` (TS1–TS12). **Supersedes** the Layout above (top navigation card, docked panel) and the cancel placement. **Keeps what ships:** step machine (T-405), "I've arrived" with the BE-64 not-near-pickup refusal Banner (T-553), PIN entry before start (BE-81 `PinEntrySheet`, `usePinGate`) and the PIN-blocked Banner with "Contact support", waiting timer (BE-85), no-show offered after `no_show_cancel_at` with its fee preview (BE-85/BE-109) replacing Cancel, `CancelReasonSheet` (reasons, strike copy), masked call (BE-78), chat (T-510), external Navigate (`mapsDirectionsUrl`), SOS shield (T-520), recentre (T-517 camera), parcel steps (BE-88 `DriverParcelSection`, parcel primary/secondary actions), AC and women-mode badges, the T-559 footer row rule for two secondary actions on small phones.

**Before:** `docs/qa-reports/2026-10-16-t-551-t-552-qa/2-03-driver-ride-screen.png`, `docs/design/audit/2026-10-11-prod-audit/ref-driver-ride-to-pickup-light.png`, `ref-driver-ride-to-pickup-dark.png`, `docs/qa-reports/2026-10-11-regression/02-01-driver-ride-screen-light.png`, `02-03-driver-ride-screen-dark.png`.

### DP1. Peek group (iPhone 17)

| # | Block | Height | Gap after |
|---|---|---|---|
| Z0 | Handle area | 24 | — |
| Z1 | Status header (DP2), ETA tile when known | 56 | 12 |
| Z2 | Progress step 2 / 3, no labels | 4 | 16 |
| Z3 | **Target row** (TS6.1): "Pickup" + `h3` pickup address, 2 lines; tap → `expanded` | 66 | 16 |
| Z4 | PersonCard: Avatar 56, first name `h3`, rating or "New rider"; action row **Call · Message · Navigate** (56) | 128 | — |
| Z5 | Arrived only: waiting timer (shipped, fee policy on + verified) | 12 + 64 | — |
| F | **Footer** (DP3) | 16 + action + 42 | — |

- **To pickup:** 24 + 56 + 12 + 4 + 16 + 66 + 16 + 128 + footer (16 + 56 + 42) = **436** (50 %).
- **Arrived (slide 64, timer):** 24 + 56 + 12 + 4 + 16 + 66 + 16 + 128 + 12 + 64 + footer (16 + 64 + 42) = **520** (59 %); with the no-show button (48 + 8): **576** (66 %) — the car is parked, the map need only show the pickup.
- **Compact (< 700, SE, bottom 16):** progress hidden; target row 1 line (41); PersonCard **inline** actions (TS5, 56 total); timer folded into the subtitle (DP2). To pickup: 24 + 56 + 16 + 41 + 16 + 56 + footer (16 + 56 + 16) = **297** (45 %). Arrived: 24 + 56 + 16 + 41 + 16 + 56 + footer (16 + 64 + 16) = **305**; with no-show **361** (54 %).

### DP2. Status header copy

| Step / condition | Title | Subtitle | Tile |
|---|---|---|---|
| To pickup | "Pick up {first name}" / "{first name} ko pick karein" (no name: shipped "Head to pickup") | "{eta.distance_km} away · {fare} cash" / "{km} door · {fare} cash"; no distance: "{fare} cash" | `eta.minutes` to the pickup |
| Arrived | "Waiting for {first name}" / "{first name} ka intezar" (parcel: shipped "Waiting for the sender") | "You arrived at {arrived_at time}" / "Aap {time} par pohanche"; compact with a timer: the timer text "Waiting {mm:ss} · {detail}" (shipped `fare.waiting` + `waitingDetail`) | hidden |
| Offline | unchanged | `warning` `wifi-off` "You're offline. Actions will wait." / "Aap offline hain. Actions intezar karenge." | hidden |
| Weak GPS | unchanged | `warning` "Weak GPS signal" / "GPS signal kamzor hai" | as is |

`{fare}` = `accepted_fare`, else `total_fare`, via `formatMoney`. Badges (AC, women-mode, Parcel) at the subtitle row start.

### DP3. Footer (one primary; nothing destructive next to it)

| Step | Footer |
|---|---|
| To pickup | (arrival refused: shipped Banner `warning` above, 8 gap) → **I've arrived** `lg primary` (56), haptic `impactLight`; loading while POST arrived runs |
| Arrived | (no-show ready: **Passenger didn't come** / "Sawari nahi aayi" `md destructiveSoft` (48), shipped copy + fee preview in its sheet, 8 gap) → **Slide to start trip** (kit `SlideToConfirm` 64: track `primary`, knob 56 white with `chevron-double-right` 28 `primary`, label `button` `onPrimary` "Slide to start trip" / "Trip shuru karne ke liye slide karein", completes at 85 %, haptic `impactMedium`) |
| Arrived, PIN required | the slide completing opens `PinEntrySheet` (shipped); the slide springs back while the sheet is up; a correct PIN starts the trip |
| Arrived, PIN blocked | shipped Banner `danger` "Start blocked" + "Contact support" replaces the slide |
| Parcel after arrival | shipped parcel primary (and secondary in the T-559 row) |

The parcel secondary + no-show (two secondaries) share one row (T-559); Cancel is never in the footer (TS8).

### DP4. Details (`expanded`)

1. **Route card** (Card `outlined`): `AddressPair` `size="lg"` (pickup, stops, drop-off; 2 lines each; M1).
2. **Note from the rider** — only if the ride resource carries a rider note (`special_instructions`/`notes`, when the API sends it): Banner `info` "Note from {first name}: {text}".
3. **Money card** (TS6.3): Fare, booking fee, commission ({rate}), You keep (BE-84 split); caption "Collect {fare} in cash at the drop-off."
4. Parcel block (shipped `DriverParcelSection`).
5. **Cancel ride** `md destructiveGhost` (TS8) → shipped `CancelReasonSheet`; absent while no-show is offered (shipped rule).

### DP5. Map

TS2 chrome at driving size (56): back top-start, SOS shield top-end (shipped), recentre after a pan riding 16 above the sheet (moved from under the shield). TS2.1: to pickup = own vehicle (48, halo, heading) + pickup pin + **vehicle → pickup route** (new on the driver side; T-549 fetch rules, pins only while loading); arrived = pickup pin + vehicle, no route. Camera per §6.7 (north-up fit of vehicle + target above the live sheet height).

### DP6. States

| State | Spec |
|---|---|
| Accepted (from the request) | DriverRide opens at `peek` with the to-pickup content; haptic was played on accept |
| Marking arrived | button loading; success → TS7 swap to Arrived, toast shipped ("The passenger knows you have arrived.") |
| Arrival refused (BE-64) | Banner above the button (shipped copy with the server's distance) |
| Starting | slide locks at the end with a spinner in the knob; success → on trip (TS7) |
| Invalid transition (409) / changed elsewhere | shipped toasts; ride re-read |
| Passenger cancelled | sheet state: icon circle 64 `surfaceAlt` `account-cancel-outline` 32 → 16 → `h3` centred "The rider cancelled" / "Sawari ne cancel kar diya" → 8 → `bodySmall` "You're back online." / "Aap dobara online hain." → footer "Back to Drive" / "Drive par wapas" `lg primary` (restyles `DriverRideCancelledCard`; parcel copy shipped) |
| Offline | subtitle offline line; actions show the shipped network toast; location queue retries |
| 1.3× / Roman Urdu | measured peek; slide label 1 line at 1.3× on SE (estimated 230 pt of 279 available after the knob) — if it does not fit, the ur label shortens to "Slide karke shuru karein" |
| Dark | as TS (sheet `surface`, cells `surfaceAlt`, slide track `primary` #3D5FD0, knob white) |

### DP7. Accessibility

Slide exposes the "activate" action (double-tap confirms, shipped kit). Navigate label "Navigate to the pickup in Maps" / "Maps mein pickup tak rasta". Announce state changes once ("You've arrived. Waiting for {name}."). Focus order: back → SOS → header → progress → target → person → Call → Message → Navigate → timer → footer.

### DP8. Performance

As TS11. The ride poll (~8 s) carries `eta`; the route leg follows T-549 limits; the camera refits per §6.7 rules, never per fix.
