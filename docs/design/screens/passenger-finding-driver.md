# Passenger · Finding a driver

- **Task:** T-613 (visual) after T-304 (status state machine), T-305 (cancel during create).
- **Route:** state `requested` of the booking/trip screen (`PassengerBooking/Trip`), not a separate navigation entry.
- **Current source:** `components/passenger/RequestingCard.tsx` ("Finding you a driver…", "Sharing your request with nearby drivers"). Not captured live (no ride was created in the audit).
- **Data:** the created ride `GET /rides/{id}` (polling or `RideAccepted`/`RideStatusChanged` via Reverb [BE-12]): `id`, `status`, `pickup_address`, `dropoff_address`, `vehicle_type`, `total_fare`, `requested_at`. Cancel: `POST /rides/{id}/cancel`.

## Layout
Map full screen, camera centred on the pickup pin at zoom 16; tab bar hidden; no back button (Android back opens the cancel dialog).

**On the map:** pickup pin with the **searching pulse** (§6.5); route line hidden (only pins) to keep focus on the pickup.

**Sheet** (fixed snap, content height; not draggable):
1. 2pt indeterminate progress bar flush at the sheet's top edge (inside the top radius clip), `primary` on `surfaceAlt`.
2. 24 gap: **Title** `h2` "Finding you a driver" (no ellipsis character animation unless reduced motion; then "Finding you a driver…" static).
3. 4 gap: **Subtitle** `bodySmall` `textSecondary` "This usually takes under a minute." After 60 s: "Still looking. More drivers are joining." (copy swap with 150 ms fade.)
4. 24 gap: **Trip summary card** (`Card outlined`): Raah line (5.23) with pickup and dropoff (1 line each); divider; row: vehicle glyph 24 + vehicle display name `body` · right `numeric` `{total_fare}` + `caption` `textMuted` "Cash".
5. 16 gap: Button `lg destructiveSoft` "Cancel request" full width.
6. Bottom padding `insets.bottom + 8`.

## States
| State | Spec |
|---|---|
| Creating (POST in flight) | Same layout; summary from the draft; Cancel enabled (T-305: cancel during create aborts and then cancels the created id). |
| Waiting | As above. |
| No driver found (server sets `cancelled` with reason, or client timeout per T-304) | Sheet content crossfades to: icon circle 64 `surfaceAlt` `car-off` → `h3` "No drivers available" → `bodySmall` "All nearby drivers are busy. Try again in a few minutes." → Button `lg primary` "Try again" (re-requests same draft) → ghost "Change ride" (back to passenger-vehicle-fare). Pulse stops. |
| Driver accepted | Haptic `notificationSuccess`; content crossfades to passenger-driver-assigned; camera animates to fit driver marker + pickup (600 ms). |
| Cancel tap | Dialog: "Cancel request?" / "We'll stop looking for a driver." / "Keep looking" (primary) / "Cancel request" (destructive). On confirm: button loading → Toast "Request cancelled" → back to Home (peek). |
| Cancel error | Toast error "Couldn't cancel. Try again." |
| Offline | Offline banner; pulse continues; Cancel shows the network toast if tapped. |
| App relaunch mid-search | Restored into this state (T-301). |

## Accessibility
- Announce "Finding you a driver" on entry and "Driver found" on acceptance. Pulse is decorative (`accessible={false}`).

## Reduced motion
- Static halo, no progress bar animation (bar shown as a solid 30 % segment), static ellipsis.
