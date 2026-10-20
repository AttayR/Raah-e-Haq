# Driver · On trip (stops, drop-off)

- **Task:** T-615 after T-405, BE-04 (`complete`), existing stop endpoints `/rides/{id}/stops/{stop}/complete` and `/navigate-next-stop`.
- **Route:** `DriverTrip` state `ongoing`.
- **Current source:** `screens/Driver/DriverRideScreen.tsx` ("Ride in Progress", "Ride ID:", "Current Stop", "Navigation Instructions", "Mark as Completed"). Unregistered today.
- **Data:** `GET /rides/{id}`: `stops[]` (`id`, `address`, `stop_order`, `status`, `status_label`, `estimated_arrival`), `current_stop_index`, `active_stops_count`, `completed_stops_count`, `dropoff_address`, `dropoff_latitude/longitude`, `passenger`, `total_fare`, `started_at`.

## Layout
Map as driver-to-pickup, route driver → next stop or drop-off; traveled part `routeLineTraveled`; numbered stop pins; dropoff pin.

**Top navigation card** (same component as driver-to-pickup): `caption` "Stop {n} of {active_stops_count}" or "Drop-off" → `h3` next address → row `numeric` "{eta} min · {distance} km" + "Navigate".

**Bottom sheet** (`peek` blocks 1-3, `half`):
1. Handle; 20 from top.
2. **Trip line:** `h3` "Taking {first name} to {dropoff short}" (1 line) → `caption` `textMuted` "Started {started_at time}".
3. 16 gap: **Primary action:**
   - Next item is a stop: Button `lg primary` "Arrived at stop {n}" → then "Continue to next stop" (calls stop complete / navigate-next-stop).
   - Next item is drop-off: **Slide to complete trip** (5.31).
4. 16 gap (half): **Route progress Card**: vertical Raah line with pickup (done), each stop with its state (done: check `success` + `textMuted` text; current: `primary` dot 12 + `bodyStrong`; pending: `stopPin`), drop-off.
5. 12 gap: Passenger row (compact, Avatar 40) with Message/Call IconButtons.
6. 12 gap: Row `cash` "Collect cash at drop-off · {total_fare}" (`caption` "Estimated. Final amount shown when you complete.").
7. 16 gap: ghost Button "Need help?" (`lifebuoy`) → support sheet: "Call emergency 15", "Contact Raah-e-Haq support" (from `/settings/public`).

No cancel once ongoing (BE-04).

## States
| State | Spec |
|---|---|
| Completing | Slider knob spinner; success → driver-trip-complete. |
| Complete error / 409 | Slider springs back; Toast with server message. |
| Stop action loading | Button loading. |
| Offline | Offline banner; completing is blocked with Toast "You're offline. Complete the trip when you're back online." (fare must come from the server). |

---

## UI-R13 (2026-10-20): on trip (stops, drop-off)

**Anatomy:** `shared-trip-sheet.md`; header, target row and PersonCard as `driver-to-pickup.md` UI-R13. **Supersedes** the Layout above. **Keeps what ships:** stop completion (`/rides/{id}/stops/{stop}/complete`), complete trip (server fare), parcel deliver/return steps (BE-88), offline block on completing, no cancel once started.

**Before:** `docs/qa-reports/2026-10-11-regression/05-06-driver-on-trip.png`, `docs/design/audit/2026-10-11-prod-audit/ref-driver-on-trip.png`, `docs/qa-reports/2026-10-15-switch-safety-qa/S4-04-drv-correct-pin-trip-started.png`.

### DT1. Peek group (iPhone 17)

Z0 24 → Z1 header 56 → 12 → Z2 progress step 4 → 16 → Z3 target row 66 ("Stop {n} of {total}" or "Drop-off" + `h3` address) → 16 → Z4 PersonCard 128 → footer. **Drop-off next (slide 64):** 24 + 56 + 12 + 4 + 16 + 66 + 16 + 128 + (16 + 64 + 42) = **444** (51 %). **Stop next (button 56):** **436**. Compact (SE): **297** / **305** (DP1 rules).

### DT2. Status header copy

| Next | Title | Subtitle | Tile |
|---|---|---|---|
| A stop | "Head to stop {n}" / "Stop {n} ki taraf" | "{km} to go · {fare} cash" / "{km} baqi · {fare} cash" | ETA to the stop |
| Drop-off | "Drop off {first name}" / "{first name} ko drop karein" (parcel: shipped deliver wording) | "{km} to go · Collect {fare} cash" / "{km} baqi · {fare} cash lein" | ETA to the drop-off |
| No ETA | as above | "Collect {fare} cash at the drop-off" / "Drop-off par {fare} cash lein" | hidden |
| Offline | as above | `warning` "You're offline. Complete the trip when you're back online." (shipped toast copy as the line) | hidden |

### DT3. Footer

| Next | Footer |
|---|---|
| A stop | **Stop {n} done** / "Stop {n} ho gaya" `lg primary` (shipped `completeStop`, now with the stop number); loading while it runs; haptic `impactLight` |
| Drop-off | **Slide to complete trip** / "Trip mukammal karne ke liye slide karein" (`SlideToConfirm` 64); completing locks the knob with a spinner; haptic `impactMedium`; success → receipt (TS7), haptic `notificationSuccess` |
| Offline | the slide is disabled (kit opacity rule) and the subtitle carries the offline line |
| Parcel | shipped deliver / hand-back actions |

### DT4. Details (`expanded`)

1. **Route progress card** (Card `outlined`, `AddressPair` `lg`): pickup row `textMuted` "Picked up"; completed stops `textMuted` "Stop {n} · done"; the next `bodyStrong` "Next stop"; drop-off (M1).
2. Money card (TS6.3).
3. Parcel block (shipped).
4. No cancel; no help row (the SOS shield is on the map).

### DT5. Map

TS2 chrome; TS2.1 on trip: own vehicle (48, halo), numbered stop pins still to visit, drop-off pin, **trip route from the vehicle** (new on the driver side, T-549 rules); camera §6.7 (vehicle + current target).

### DT6. States

| State | Spec |
|---|---|
| Started (from arrived) | TS7 swap; the timer and no-show leave; target row switches to the first stop / drop-off |
| Stop done | toast shipped; title, tile, target row and route card update via TS7 (person unchanged) |
| Complete error / 409 | slide springs back; shipped toast with the server message |
| 1.3× / Roman Urdu / Dark | as DP6 |

### DT7. Accessibility and performance

Announce "Trip started. Head to {target}." once; stop done "Stop {n} done. Next: {target}." Performance as TS11.
