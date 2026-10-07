# Driver · Incoming ride request

- **Task:** T-605 (visual) after T-403 (poll `/rides/pending`), T-404 (accept via assign-driver, 409, reject), BE-02, BE-03, BE-12 (`RideRequested`).
- **Route:** state of `DriverTabs/Drive` while online.
- **Current source:** `components/driver/IncomingRequestCard.tsx` ("New Ride", "From:", "To:", "Fare: PKR", Accept, Bid). Not captured live.
- **Data:** pending ride (`RideResource`): `id`, `pickup_address`, `pickup_latitude/longitude`, `dropoff_address`, `dropoff_latitude/longitude`, `stops[]`, `vehicle_type`, `passenger_count`, `total_fare`, `distance_km`, `duration_minutes`, `payment_method`, `passenger` (`name` first name only, `rating` [BE-15]; no phone, BE-20). Driver-to-pickup distance/time: computed client-side from the driver location (Directions) or returned by BE-02 if added. Expiry: server `expires_in` if provided, else 15 s client window.

## Layout
Map: camera fits driver → pickup → dropoff; route preview pickup→dropoff `routeLine`, driver→pickup dashed `routeLineTraveled` (dash 6/6). Tab bar hidden while the request is shown.

**Request sheet** (fixed, content height, `elevation.3`; not dismissible by swipe):
1. 20 from top: **Header row:** Badge status pill info with vehicle glyph 16 + vehicle display name; trailing `numericSmall` countdown "{s}s" in `textSecondary`.
2. 12 gap: **Fare** `numericXL` `{total_fare}` + 8 + Badge neutral `cash` "Cash" (vertically centred).
3. 4 gap: `bodySmall` `textSecondary` "{distance_km} km trip · about {duration_minutes} min".
4. 16 gap: **Pickup ETA line** `title` `textPrimary`: "{eta_to_pickup} min · {distance_to_pickup} km away" (hidden until computed; skeleton 160×20).
5. 12 gap: **Raah line** (5.23, driving size: text `body` 1 line each, row min 52): Pickup `{pickup_address}`, stops (if any: "+{n} stops" collapsed row, `caption`), Drop-off `{dropoff_address}`.
6. 12 gap: **Passenger row** `caption` `textSecondary`: Avatar 32 initials + "{first name}" + rating star 16 `{rating}` (or "New") + " · {passenger_count} passengers" when > 1.
7. 20 gap: **Actions** row, 12 gap: Button `lg secondary` "Decline" (flex 1) and Button `lg primary` "Accept" (flex 2) with the **countdown ring**: a 3pt ring drawn on the Accept button border depleting clockwise (`onPrimary` at 100 % on `primary`); at ≤5 s the ring and countdown turn `warning`.
8. Bottom `insets.bottom + 8`.

No "Bid" button (no product decision or API on record; T-404 scope is accept/reject).

## States
| State | Spec |
|---|---|
| Arrives | Sheet springs up (§6.2); haptic `notificationWarning`; sound if "Sound alerts" preference is on (BE-11 prefs); screen kept awake. |
| Multiple pending | Show one at a time, nearest first; a `caption` "+{n} more" chip in the header row. |
| Accepting | Accept button loading; Decline disabled; countdown paused. |
| Accepted | Haptic `notificationSuccess`; crossfade to driver-to-pickup. |
| Taken by another driver (409) | Sheet content: icon circle 64 `surfaceAlt` `car-clock` → `h3` "Ride taken by another driver" → auto-dismiss after 2 s back to online state. |
| Expired | Sheet slides down (200 ms); online state resumes; no toast. |
| Decline | Immediate dismiss (reject call in background); no confirmation. |
| Network error on accept | Toast error "Couldn't accept. Check your connection."; sheet stays if not expired. |
| Long addresses | 1 line each with ellipsis; tapping the Raah line expands to 3 lines each (sheet grows). |

## Accessibility
- Announce "New ride request, {fare}, pickup {eta} minutes away" on arrival. Countdown announced at 10 s and 5 s only. Accept/Decline min 56 high.

## Small device
- Fare `numericL`; passenger row merged into the header row.
