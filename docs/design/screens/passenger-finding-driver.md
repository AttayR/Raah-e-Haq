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

## Request reach and nearby vehicles [T-586 / T-587, owner live session 2026-10-19]

Owner: "show which drivers my request went to and who is viewing it". Data: `reach: {sent, viewing}` from BE-116 (b) (counts only; no driver identities, names or phones). Read with the ride on the same poll tick (T-588 pace while `requested`); preferably embedded in `GET /rides/{id}`, else `GET /rides/{id}/reach` right after the ride read, never on its own timer and never faster than the ride poll. Vehicle art and motion: `map-vehicles.md` §1–§2.

**Map:**
- Nearby vehicles **of the requested tier** stay on the map (`map-vehicles.md` §3 filter, §2 nearby motion, max 15), under the pickup pin and its pulse (z-order: vehicles 0, pins above, pulse above the pins' ring). They keep updating at the nearby poll pace; no extra request.
- Calm: no camera refit for vehicles (the UI-R10 camera rule above stands), no marker bounce, no colour flashing. The searching pulse is the only looping animation on the map.
- The map count chip (`map-vehicles.md` §4) is hidden here: the reach strip carries the numbers.
- **Phase 2 (only with BE-116 b2 and an rh-security PASS):** vehicles that were sent the request draw at full opacity and the rest at 0.45; vehicles whose driver is viewing get a 2 pt `success` ring, 32 pt circle, centred on the pivot (round, so rotation does not matter; the view re-tracks once per change). Without b2 every tier vehicle draws at full opacity and nothing on the map claims who received the request.

**Sheet, new block 3a** (between the subtitle, block 3, and the trip summary card, block 4; block 4's 24 gap becomes 16 after it):
3a. 16 gap: **Reach strip**: full width − 32, min height 40, `surfaceAlt`, radius `md`, padding 8 vertical / 12 horizontal, row: leading `access-point` (MDI broadcast) 20 `primaryText` → 8 → text `label` `textPrimary` (numbers tabular) → for the viewing part: " · " + 6 pt dot `success` + 4 + `label` `textSecondary`. One line; at 1.3× font it wraps to two lines (the viewing part moves to line 2), never ellipsized.

| Reach | English | Roman Urdu |
|---|---|---|
| No data yet / `sent` = 0 | "Sending to drivers nearby…" | "Qareeb drivers ko bhej rahe hain…" |
| `sent` = 1, `viewing` = 0 | "Sent to 1 driver" | "1 driver ko bheji gayi" |
| `sent` = n, `viewing` = 0 | "Sent to {n} drivers" | "{n} drivers ko bheji gayi" |
| `viewing` = 1 | "Sent to {n} drivers · 1 viewing" | "{n} drivers ko bheji gayi · 1 dekh raha hai" |
| `viewing` = m | "Sent to {n} drivers · {m} viewing" | "{n} drivers ko bheji gayi · {m} dekh rahe hain" |
| Reach read fails | keep the last value; if none yet, hide the strip (the title already says we are looking). No toast, no error text. | — |
| Re-queued after a driver cancel (T-546) | counts restart from the server's values for the new round; same copy | — |
| No driver found | strip hidden with the rest of the searching content | — |

`declined` is not shown to the passenger (it adds worry and nothing to act on). Counts are shown exactly as sent; `viewing` is never shown above `sent` (clamp to `sent` if a race returns more).

**Motion (calm):** the strip fades in (150 ms) the first time it has text; a number change crossfades the number only (old out 100 ms, new in 150 ms with a 4 pt rise; tabular figures, so nothing shifts); the `success` dot breathes (opacity 1 → 0.4 → 1, 2000 ms, standard curve) only while `viewing` > 0. No count-up, no ticker, no confetti. Reduced motion: no breathe, numbers swap instantly.

**Accessibility:** the strip is one `text` element, label = the visible text. Announce politely only when `sent` first becomes > 0 ("Your request was sent to {n} drivers." / "Aap ki request {n} drivers ko bheji gayi.") and when `viewing` first becomes > 0 ("{m} drivers are viewing it." / "{m} drivers dekh rahe hain."), not on every change.

**Small device (SE):** the sheet grows by 56 (40 + 16); the map above it must still show the pickup pin and pulse (UI-R10 camera rule applies).
