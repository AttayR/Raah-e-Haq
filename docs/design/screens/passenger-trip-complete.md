# Passenger · Trip complete + rating

- **Task:** T-614 after T-505 (rating), BE-04 (server fare), BE-07 (`POST /rides/{id}/rate`, `can_rate`, `my_rating`).
- **Route:** state `completed` of `PassengerBooking/Trip`, full screen (map hidden); replaces `components/RatingModal.tsx`.
- **Data:** `GET /rides/{id}`: `total_fare`, `base_fare`, `distance_fare`, `time_fare`, `distance_km`, `duration_minutes`, `payment_method` (`cash`), `pickup_address`, `dropoff_address`, `started_at`, `completed_at`, `driver` (`name`, `profile_image`), `can_rate`, `my_rating`. Submit: `POST /rides/{id}/rate` {stars, comment?}.

## Layout
`Screen scroll keyboardAvoiding`, background `background`, no tab bar, Header with trailing IconButton `close` (→ Home) and no back.

1. 8 gap below header: **Amount block** centred: `caption` `textSecondary` "Pay your driver" → 4 → `numericXL` `{total_fare}` `textPrimary` → 8 → Badge status pill neutral with `cash` 16 "Cash".
2. 8 gap: `bodySmall` `textMuted` centred "{completed_at date, time} · {distance_km} km · {duration_minutes} min".
3. 24 gap: **Rating Card** (only when `can_rate`): padding 24, centred content:
   - Avatar 72 (driver), 12 gap, `h3` "How was your ride with {driver first name}?".
   - 16 gap: Rating stars input (5.22, 40 pt).
   - after a star is chosen, reveal (150 ms height+fade): 16 gap, optional compliment Chips (one line, scrollable, multi-select, label-only, no data stored unless BE-07 accepts tags; until then chips are hidden), and a multiline TextField "Add a comment (optional)" max 500 chars with counter `caption` `textMuted` right-aligned "{n}/500".
4. 16 gap: **Receipt Card** `outlined`: Raah line pickup/dropoff; divider; Fare breakdown rows (5.26) from `base_fare`, `distance_fare`, `time_fare` (rows hidden when null) and Total.
5. 24 gap: Button `lg primary` "Submit rating" (disabled until a star is selected); if `can_rate` is false or already rated: Button `lg primary` "Done".
6. 8 gap: Button `lg ghost` "Skip" (only while rating is possible).
7. 16 gap: ghost Button `sm` "Get help with this ride" (`lifebuoy`) → shared-support-invite (new ticket prefilled with the ride id).
8. Bottom `insets.bottom + 16`.

## States
| State | Spec |
|---|---|
| Fare not yet final | If `total_fare` is null right after completion, show a skeleton line for the amount and poll `GET /rides/{id}` up to 10 s; then show "Fare will appear in your ride history." |
| Submitting | Button loading; stars locked. |
| Submitted | Toast success "Thanks for your feedback"; navigate Home. |
| Already rated (`my_rating` set / 409) | Rating card shows read-only stars with `my_rating` and "You rated this ride"; primary "Done". |
| Submit error | Toast error "Couldn't send your rating. Try again."; values kept. |
| Offline | Submit disabled with "You're offline"; Done/Skip available. |
| Skip | Navigate Home; the ride keeps `can_rate` so history shows "Rate ride". |

---

## UI-R12 (2026-10-20): receipt + rating in the trip sheet

**Anatomy:** `shared-trip-sheet.md` (TS1 footer, TS7 swap). **Supersedes** the full-screen Layout above and the after-ride **rating modal** on the booking map (`PassengerRideRatingPrompt` → `RateRideSheet` over the dimmed map, `10c-completed-rating.png`): the rating is now inline in the receipt state of the same sheet. `RateRideSheet` stays for the other entry points (Activity "Rate ride", ride details); both use one extracted `RatingForm` (stars, tags from `GET /rating-tags` up to `max_tags`, comment 500, submit via `POST /rides/{id}/rate`, stale/409 handling) so there is one rating behaviour. **Keeps what ships:** server final fare and breakdown (T-311, BE-82 locked quote labels, BE-60 booking fee, BE-85 waiting), overcharge and AC reports, parcel receipts (T-561/T-574), no-driver-found state (T-583), the Done button pinned in the footer (T-564), cancellation fee line (BE-85).

**Before:** `docs/qa-reports/2026-10-19-t583-t582b-qa/10c-completed-rating.png`, `docs/qa-reports/2026-10-18-t-562-563-564-qa/05-pax-completed-done-pinned.png`, `06-pax-completed-report-offered.png`, `docs/qa-reports/2026-10-15-switch-safety-qa/S7-05-pax-completed.png`, `docs/design/audit/2026-10-11-prod-audit/ref-passenger-trip-complete.png`.

### PR1. Sheet and map

- One snap: `content` (capped at `full`), no handle, not draggable; content scrolls under the pinned status header when it exceeds the cap. Map behind: pickup + drop-off pins, trip route from the directions cache only, no vehicle, camera fits both (TS2.1). Back hidden; Safety shield stays while `isSosAvailable` (30 min after the end). Tab bar hidden (Booking).

### PR2. Content, top to bottom (iPhone 17)

| # | Block | Spec | Height | Gap after |
|---|---|---|---|---|
| 1 | Top padding | — | 24 | — |
| 2 | **Status header** | title `h2` "You've arrived" / "Aap pohanch gaye" (parcel: shipped delivered/returned titles); subtitle `bodySmall` `textSecondary` "{completed_at time} · {distance_km} km · {duration_minutes} min" (parts the API lacks are dropped) | 50 | 16 |
| 3 | **Money card** | `surfaceAlt`, radius `lg`, padding 16; row: start column `caption` `textSecondary` "Pay your driver in cash" / "Apne driver ko cash dein" (parcel: shipped "Paid in cash at the pickup") → 2 → `numericXL` `textPrimary` final `total_fare`; end, top-aligned: FareTag "Fixed fare" when `fare_locked` (M4) | 16 + 16 + 2 + 40 + 16 = 90 | 8 |
| 4 | **Fare details** row | ListItem 48 (no leading icon): `bodyStrong` "Fare details" / "Kiraye ki tafseel" + trailing `chevron-down` 20 `textSecondary` rotating 180° (150) when open; expands the shipped `FareBreakdown` in place (height + fade 250; Reduce Motion: instant); collapsed by default | 48 | 24 |
| 5 | **Rating block** (when `can_rate`) | centred: Avatar 56 (driver) → 12 → `h3` "How was your ride with {first name}?" / "{first name} ke saath ride kaisi rahi?" (parcel: shipped `rating.titleParcel`) 2 lines max → 16 → RatingStars input 40 (gap 8, target 48, selected `ratingStar` M2, empty `borderStrong`) → 8 → `bodySmall` `textSecondary` star label ("Tap a star to rate" → "Very bad" … "Excellent", shipped strings) → on the first star: reveal (height + fade 250) 16 → tag Chips (`outline` variant, wrapping, multi-select up to `max_tags`, labels from `GET /rating-tags`; retry link on failure, shipped) → 12 → TextField multiline "Add a comment (optional)" / "Comment likhein (optional)" with the counter `caption` `textMuted` "{n}/500" end-aligned | 56 + 12 + 25 + 16 + 48 + 8 + 20 = 185 (before reveal) | 24 |
| 5' | Already rated (`my_rating`) | read-only display stars 24 + "You rated this ride" / "Aap ne is ride ko rate kiya" `bodySmall` `textSecondary`, centred | 48 | 24 |
| 6 | Reports | shipped overcharge and AC report sections, restyled as ListItems 56 with leading 40 icon tiles (§12.4); only when the server offers them | 56 each | 16 |
| F | **Footer** | one `lg primary`: "Submit rating" / "Rating bhejein" once a star is chosen (loading while sending; stars locked); otherwise "Done" / "Theek hai" (= skip; the ride keeps `can_rate`, Activity shows "Rate ride"). After a successful submit: Toast "Thanks for your feedback" / "Aap ki rai ka shukriya", then Home | 16 + 56 + 42 | — |

- **iPhone 17 height:** 24 + 50 + 16 + 90 + 8 + 48 + 24 + 185 + footer 114 = **559** (64 %). After the reveal the sheet grows to the cap and scrolls; the focused comment field rides above the keyboard (§5.6 reveal; footer 8 above the keyboard).
- **SE:** ≈ 533 of 667 (80 %); within the 88 % cap; the map shows the route above.

### PR3. Region rule (saffron)

FareTag (money card) and the rating stars (rating block) are two regions 32 pt apart with the neutral details row between them — §1.2 rule 3 holds. DESIGN_SYSTEM §1.8 row updated accordingly. No BrandBar here.

### PR4. Motion

Entry from on trip: TS7 swap (the map refits to pickup + drop-off over 600 ms in parallel); haptic `notificationSuccess`. Star selection: haptic `selection` per change, star scale 1 → 1.15 → 1 (150) on the chosen star only. The amount never counts up. Reduce Motion: no scale, instant reveal.

### PR5. States

| State | Spec |
|---|---|
| Fare not final yet (`total_fare` null) | amount skeleton 140 × 34; shipped re-read up to 10 s; then "Fare will appear in your ride history." / "Kiraya aap ki ride history mein nazar aayega." in place of the amount; Done works |
| Submitting / submit error | Button loading; error Toast "Couldn't send your rating. Try again." / "Rating nahi bheji ja saki. Dobara koshish karein."; values kept |
| Stale / 409 (already rated elsewhere) | block 5' with the server's `my_rating` (shipped stale handling) |
| `can_rate` false | rating block absent; footer "Done" |
| Offline | Submit disabled, label "You're offline" / "Aap offline hain"; Done available |
| **Ride cancelled** (not no-driver) | title "Ride cancelled" / "Ride cancel ho gayi"; subtitle = shipped by-whom line + fee line (BE-85); money card absent unless a fee was charged (then caption "Cancellation fee" / "Cancellation fee" + `numericL` fee); reports per server; footer "Done" |
| No driver found | shipped T-583 state (`passenger-finding-driver.md`), unchanged |
| Parcel | shipped parcel receipt copy; rating title parcel variant |
| 1.3× / Roman Urdu / Dark | measured heights; ur strings above; `surfaceAlt` money card #1D2438 in dark |

### PR6. Accessibility

Announce "You've arrived. Pay {fare} in cash." / "Aap pohanch gaye. {fare} cash dein." Focus: header → money (one element: "Pay your driver in cash, {fare}, fixed fare") → Fare details (button, expanded state) → rating (stars as one adjustable element, shipped `ratingInputValue`) → tags → comment → reports → footer.

### PR7. Builder notes

- Extract `RatingForm` from `RateRideSheet` (no behaviour change there); `PassengerRideRatingPrompt` is no longer mounted on the booking map (grep its users first); the receipt uses `RatingForm` inline.
- The Done/Submit footer replaces `ActiveRideDoneButton` in the booking sheet footer for this state only.
- `formatMoney` everywhere; FareBreakdown rows only for returned fields (shipped).

### PR8. Design review evidence

Signed-in, local backend: receipt light/dark (collapsed and expanded fare details), star chosen with tags + comment (keyboard up), submitted toast, already rated, can't rate, cancelled with and without a fee, Roman Urdu, 1.3×, iPhone SE light/dark. Pair with the driver's complete (UI-R13).
