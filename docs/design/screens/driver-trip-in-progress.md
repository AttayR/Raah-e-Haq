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
