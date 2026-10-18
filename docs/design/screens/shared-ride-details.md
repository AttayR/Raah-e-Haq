# Shared · Ride details / receipt

- **Task:** T-617 after T-501 (ride details/receipt screen).
- **Route:** `RideDetails` {rideId} (stack).
- **Data:** `GET /rides/{id}` → `id`, `status`, `pickup_address/lat/lng`, `dropoff_address/lat/lng`, `stops[]`, `vehicle_type`, `vehicle`, `driver`/`passenger` (other party first name, `profile_image`, `rating`), `base_fare`, `distance_fare`, `time_fare`, `total_fare`, `driver_earnings`, `platform_commission`, `distance_km`, `duration_minutes`, `payment_method`, `payment_status`, `requested_at`, `accepted_at`, `arrived_at`, `started_at`, `completed_at`, `cancelled_at`, `my_rating`, `can_rate`.

## Layout
`Screen scroll`, Header (back, title "Ride details" **[ruled UI-R15: the date already leads the Summary card, and a date title reads as a timestamp, not a place in the app]**, trailing IconButton `share-variant-outline` → OS share of a text receipt), background `background`.

1. **Static map** 180 high, full width (no gutter), non-interactive (`liteMode` on Android, `scrollEnabled={false}` on iOS), route line + pickup/dropoff pins, dark style in dark mode. Fallback without coordinates: `surfaceAlt` block with `map-outline` 32 `textMuted`.
2. 16 gap: **Summary Card**: status pill + `caption` `textMuted` "{completed_at or cancelled_at time}" → 12 → amount `numericXL` (passenger `{total_fare}`, driver `{driver_earnings}`) → 4 → `bodySmall` `textSecondary` "Cash · {payment_status title-cased}" (hidden if absent) → 8 → meta row (gap 8, wraps): vehicle glyph 20 `textSecondary` + vehicle name `bodySmall` `textSecondary` + "·" `textMuted` + "{distance_km} km · {duration_minutes} min" `bodySmall` `textSecondary` (same glyph and label as the history row, UI-R15) → 8 → fare-lock chip when `fare_lock` (not cancelled). Summary card top line: status pill + flex + `caption` `textMuted` "{relative day} · {time}" (the date lives here).
3. 12 gap: **Route Card**: vertical Raah line with timestamps right-aligned (`caption` `textMuted`): pickup (`started_at`), stops, dropoff (`completed_at`).
4. 12 gap: **Person Card** (ListItem 72): Avatar 48, other party first name `title`, subtitle passenger-view: "{make} {model} · {license_plate}"; driver-view: "Rider"; trailing: `my_rating` stars display, or ghost Button `sm` "Rate" when `can_rate` (opens the rating sheet using the trip-complete rating card).
   - **[UI-R15 re-review]** "Message" action (§12.5) shows only while the server says `can_open_chat` (BE-13 keeps the ride chat readable for 24 h after the trip, for lost items and disputes); hidden after that. No new BE flag needed.
   - Parcel proof photo ("Photo taken at the pickup"): 180 high, radius `md`, `surfaceAlt` placeholder with `image-outline` 32 `textMuted` while loading or on error.
   - Static map style: city/neighbourhood labels hidden on this map only (they sit on the pickup pin); pins framed with the `staticMap` padding token.
5. 12 gap: **Fare Card** (5.26): passenger: base/distance/time/total; driver: Fare, Raah-e-Haq fee (`platform_commission`), You earned (`driver_earnings`).
6. 12 gap: **Timeline Card** (vertical 5.24): Requested, Accepted, Arrived, Started, Completed/Cancelled with times; only steps with timestamps.
7. 24 gap: ListItem button row "Get help with this ride" (`lifebuoy`, chevron) → support ticket prefilled with `ride id`.
8. `caption` `textMuted` centred "Ride ID {id}" (selectable for support), bottom `insets.bottom + 16`.

## States
| State | Spec |
|---|---|
| Loading | Map placeholder + skeleton cards matching sizes. |
| Error | ErrorState "Couldn't load this ride" + Try again. |
| 403/404 | EmptyState "This ride isn't available", Button "Back". |
| Cancelled | No fee: amount slot "No charge" `title` `textMuted`. Fee charged (`cancellation_fee` > 0, passenger): amount `numericXL` `textPrimary` "Rs 30" + 4 + `bodySmall` `textSecondary` "Cancellation fee" **[UI-R15 re-review]**. Fare card hidden. |
