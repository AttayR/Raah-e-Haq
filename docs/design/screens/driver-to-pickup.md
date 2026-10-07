# Driver · Heading to pickup / Arrived

- **Task:** T-615 after T-405 (driver ride screen routed), BE-04 (`arrived`, `start`, driver cancel), T-510 (message).
- **Route:** `DriverTrip` stack screen (tab bar hidden), states `accepted` → `arrived`. Replaces the unregistered `DriverRideScreen` and the Map tab's accept/start buttons.
- **Data:** `GET /rides/{id}`: `pickup_address`, `pickup_latitude/longitude`, `dropoff_address`, `stops[]`, `passenger` (first name, `rating`, `profile_image`), `passenger_count`, `special_instructions`, `total_fare`, `payment_method`, `accepted_at`, `arrived_at`. Actions: `POST /rides/{id}/arrived`, `POST /rides/{id}/start`, `POST /rides/{id}/cancel` {reason}.

## Layout
Map: driver marker following (heading-up on while moving), route driver→pickup `routeLine`, pickup pin. Camera follow; user drag pauses follow and shows a "Recenter" pill button (Button `sm secondary`, top centre).

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
