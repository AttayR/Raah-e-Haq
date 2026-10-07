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
