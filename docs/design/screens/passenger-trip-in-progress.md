# Passenger · On trip

- **Task:** T-614 after T-304, T-307, BE-04 (`ongoing`), BE-06/BE-12 (driver location).
- **Route:** state `ongoing` of `PassengerBooking/Trip`. Replaces the crashing `PassengerRideTrackingScreen` (PAX-06).
- **Data:** `GET /rides/{id}`: `status`, `dropoff_address`, `stops[]` (`address`, `stop_order`, `status`, `status_label`), `current_stop_index`, `estimated_arrival`, `started_at`, `total_fare`, `driver`, `vehicle`. Driver position as in passenger-driver-assigned.

## Layout
Map: driver marker (following), route from driver to the next stop or dropoff (`routeLine`), traveled part `routeLineTraveled`, stop pins numbered, dropoff pin. Camera follows the driver with heading-up off (north-up), zoom fits driver + destination; user drag pauses follow and shows the recenter button.

Safety IconButton top-right (as in driver-assigned).

**Sheet** snaps `peek` (blocks 1-4) and `half`:
1. Handle; 20 from top.
2. `h2` "Arriving at {eta time}" (clock time from `estimated_arrival`, e.g. "Arriving at 3:42 PM"); fallback `h2` "On your way".
3. 4 gap: `bodySmall` `textSecondary` "To {dropoff short}" (or "Next stop: {stop address short}" when a stop is pending).
4. 16 gap: Ride status timeline (step 4 current).
5. 16 gap (half): **Driver mini row** (ListItem 64): Avatar 40, name `title`, vehicle + plate `caption`; trailing IconButtons tonal "Message" (with unread Badge) and "Call" (hidden if no number).
6. 16 gap: **Route card**: Raah line with pickup (done, `textMuted`, check 16 `success`), stops (done/next/pending using `status`), dropoff.
7. 16 gap: Row: `cash` `success` 24 + "Cash · {total_fare}" `numeric`, `caption` "Estimated. Final fare at drop-off."
8. 16 gap: ghost Button "Share trip status" (`share-variant-outline`) → OS share sheet with text "I'm on a Raah-e-Haq ride to {dropoff short}. Driver {driver first name}, {vehicle line}, {plate}." (no live link until a backend share URL exists).
9. Bottom padding `insets.bottom + 8`.

No "Cancel ride" once the trip is ongoing (server forbids; BE-04).

## States
| State | Spec |
|---|---|
| Stop reached | Stop row status updates with a 150 ms check fade; next stop line updates. |
| Driver location stale | `caption` "Location updated {n} min ago" under the status line. |
| Completed | Crossfade to passenger-trip-complete; haptic `notificationSuccess`. |
| Offline | Offline banner; last state kept. |
| App relaunch | Restored into this state (T-301). |
