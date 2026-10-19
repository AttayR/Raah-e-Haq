# Passenger · Finding a driver

- **Task:** T-613 (visual) after T-304 (status state machine), T-305 (cancel during create).
- **Route:** state `requested` of the booking/trip screen (`PassengerBooking/Trip`), not a separate navigation entry.
- **Current source:** `components/passenger/RequestingCard.tsx` ("Finding you a driver…", "Sharing your request with nearby drivers"). Not captured live (no ride was created in the audit).
- **Data:** the created ride `GET /rides/{id}` (polling or `RideAccepted`/`RideStatusChanged` via Reverb [BE-12]): `id`, `status`, `pickup_address`, `dropoff_address`, `vehicle_type`, `total_fare`, `requested_at`. Cancel: `POST /rides/{id}/cancel`.

## Layout
Map full screen; tab bar hidden; **no back button** (Android back opens the cancel dialog); the end-side locate/follow control stays (§9, max two). **[UI-R10] Camera:** no forced re-zoom on entry; the camera keeps its framing as long as the pickup pin and its pulse are fully visible above the sheet, else it eases (600 ms, reduced motion: jump) to centre the pickup at zoom 16 in the area above the sheet.

**On the map:** pickup pin with the **searching pulse** (§6.5); route line hidden (only pins) to keep focus on the pickup.

**Sheet** (fixed snap, content height; not draggable):
1. 2pt indeterminate progress bar flush at the sheet's top edge (inside the top radius clip), `primary` on `surfaceAlt`.
2. 24 gap: **Title** `h2` "Finding you a driver" (no ellipsis character animation unless reduced motion; then "Finding you a driver…" static).
3. 4 gap: **Subtitle** `bodySmall` `textSecondary` "This usually takes under a minute." After 60 s: "Still looking. More drivers are joining." (copy swap with 150 ms fade.)
4. 24 gap: **Trip summary card** (`Card outlined`): Raah line (5.23) with pickup and dropoff (1 line each); divider; row: vehicle glyph 24 + vehicle display name `body` · right `numeric` `{total_fare}` + `caption` `textMuted` "Cash".
5. **Footer** (BottomSheet footer slot, §5.14, same place as the choose-ride "Request" button so the action morphs in place): Button `lg destructiveSoft` "Cancel request" full width; 32 above it (sheet content bottom padding 16 + footer top padding 16, the same rhythm as choose-ride's last row to its CTA; **[UI-R10]** corrected from 16), bottom `max(insets.bottom + 8, 16)` (iPhone 17: 42).

## States
| State | Spec |
|---|---|
| Creating (POST in flight) | Same layout; summary from the draft; Cancel enabled (T-305: cancel during create aborts and then cancels the created id). |
| Waiting | As above. |
| No driver found — **[T-583]** the server (BE-114) sets `cancelled` + `cancellation_reason: no_driver` after the request expires (admin setting, default 10 min); the app never times out on its own | Pulse and progress bar stop. Sheet content: icon circle 64 `surfaceAlt` with `carOff` 32 `textSecondary` → 16 → `h3` centred "No driver found" (parcel: "No rider found") → 8 → `bodySmall` `textSecondary` centred "No driver accepted your ride in time. You were not charged." (parcel: "…your delivery…"). **No fee line, no "Driver asked for more?".** Footer (same slot as Cancel request): Button `lg primary` "Try again" (re-books the same trip, a new Idempotency-Key; loading while sent; the new request replaces this state) → 8 → Button `ghost` "Close" (back to Home, peek). History/receipt: "No driver found · No charge" (no Cancelled pill in the row). A `no_driver` push opens this state while Booking still shows the ride, else the ride's details. |
| Driver accepted | Haptic `notificationSuccess`; content crossfades to passenger-driver-assigned; camera animates to fit driver marker + pickup (600 ms). |
| Cancel tap | Dialog: "Cancel request?" / "We'll stop looking for a driver." / "Keep looking" (`ghost`, start) / "Cancel request" (`destructive`, end) per §5.15 [UI-R3] (**[UI-R10]** corrected). On confirm: button loading → Toast "Request cancelled" → back to Home (peek). |
| Driver cancelled, re-queued (T-546) | **[UI-R10]** Same layout; title `h2` "Finding another driver"; subtitle `bodySmall` `warning` (AA on `surface` per §1 contrast table) "Your driver cancelled. We're asking other drivers nearby." (no ellipsis character, no repeat of the title); progress bar and pulse continue. |
| Creating, back pressed | Back is disabled while POST /rides is in flight (no step back to Choose a ride under a request that is being created); Android back opens the cancel dialog. |
| Cancel error | Toast error "Couldn't cancel. Try again." |
| Offline | Offline banner; pulse continues; Cancel shows the network toast if tapped. |
| App relaunch mid-search | Restored into this state (T-301). |

## Accessibility
- Announce "Finding you a driver" on entry and "Driver found" on acceptance. Pulse is decorative (`accessible={false}`).

## Reduced motion
- Static halo, no progress bar animation: the bar is shown as a **solid `primary` segment 30 % wide at the start** on its `surfaceAlt` track (never hidden: it is the only "working" cue besides the title), static ellipsis.
