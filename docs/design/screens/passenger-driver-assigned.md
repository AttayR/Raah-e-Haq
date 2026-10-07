# Passenger · Driver on the way / Driver arrived

- **Task:** T-614 (visual) after T-307 (driver-assigned card + tracking screen), T-510 (message), BE-04 (`arrived` exposed), BE-06 (`GET /rides/{id}/driver-location`).
- **Route:** states `accepted` and `arrived` of `PassengerBooking/Trip`.
- **Current source:** `components/passenger/DriverAssignedCard.tsx` (ETA default "5 min", Call/Message not wired, PAX-12). Not captured live.
- **Data:** `GET /rides/{id}`: `status`, `driver` (`name`, `profile_image`, `rating` [BE-15]), `vehicle` (`make`, `model`, `color`, `license_plate`, `vehicle_type`) [BE-15/BE-03 sets `vehicle_id`], `pickup_address`, `dropoff_address`, `total_fare`, `accepted_at`, `arrived_at`, `estimated_arrival`. Driver position: `GET /rides/{id}/driver-location` or `DriverLocationUpdated` [BE-12] → lat, lng, heading. Unread messages: chat unread count [BE-13].

## Layout
Map full screen: pickup pin, driver marker (5.21, animated), route from driver to pickup (`routeLine`), camera fits both with sheet padding. Tab bar hidden.

**On the map:** IconButton `floating` `shield-check-outline` top-right at (338, `insets.top + 8`) → safety sheet (Share trip status via the OS share sheet with pickup/dropoff text; Call emergency 15). Recenter IconButton `floating` `crosshairs-gps` above the sheet's top-right (16 inset, 16 above sheet).

**Sheet** snaps `peek` (through block 4) and `half`:
1. Handle; 20 from top.
2. **Status line:** `accepted`: `h2` "{eta} min away" where `eta` = minutes from `estimated_arrival` (or computed from driver-location route duration); if neither exists: `h2` "Driver on the way". `arrived`: `h2` "Your driver is here" + Badge status pill warning "Arrived" trailing.
3. 4 gap: `bodySmall` `textSecondary`: `accepted` "Meet at {pickup short}"; `arrived` "Meet your driver at the pickup point." 
4. 16 gap: **Ride status timeline** (5.24, horizontal) with step 2 or 3 current.
5. 16 gap: **Driver card** (5.27): Avatar 56, name, rating, vehicle line, plate pill; actions "Call" and "Message" (Message shows unread Badge count).
6. 16 gap (half state): **Trip summary card**: Raah line pickup/dropoff; row "Cash · {total_fare}" (`numeric`).
7. 16 gap: Button `lg ghost` (danger text colour) "Cancel ride".
8. Bottom padding `insets.bottom + 8`.

## States
| State | Spec |
|---|---|
| Accepted, no driver location yet | Driver marker hidden; status "Driver on the way"; recenter fits pickup only. |
| Driver location stale (>60 s) | `caption` `textMuted` under the status line: "Location updated {n} min ago". |
| Arrived | Haptic `notificationWarning`; push notification (BE-04/BE-11) if backgrounded; status line swap 250 ms; plate pill gets 2pt `primary` ring to help spotting the car. |
| Ongoing | Crossfade to passenger-trip-in-progress. |
| Driver cancelled | Toast warning "Your driver cancelled. Finding you another driver." and return to passenger-finding-driver if the server re-queues (`requested`), else Dialog "Your ride was cancelled" + "Book again". |
| Cancel ride | Dialog: "Cancel ride?" / body: "Your driver is already on the way." (+ fee line only if the API returns a cancellation fee) / "Keep ride" / "Cancel ride" (destructive). |
| Call | Opens the dialer with the number the API provides for the ride (masked/proxy number per BE-20 policy); if no number is provided the Call button is hidden, Message stays. |
| Message | Pushes shared-chat-thread for this ride. |
| Offline | Offline banner; last known driver position kept, stale line shown. |
| Missing fields | No rating → "New"; no vehicle → vehicle line hidden and plate pill hidden; no photo → initials. |

## Small device
- Peek shows status line, timeline and driver card only; trip summary in half.
