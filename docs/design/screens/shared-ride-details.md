# Shared · Ride details / receipt

- **Task:** T-617 after T-501 (ride details/receipt screen).
- **Route:** `RideDetails` {rideId} (stack).
- **Data:** `GET /rides/{id}` → `id`, `status`, `pickup_address/lat/lng`, `dropoff_address/lat/lng`, `stops[]`, `vehicle_type`, `vehicle`, `driver`/`passenger` (other party first name, `profile_image`, `rating`), `base_fare`, `distance_fare`, `time_fare`, `total_fare`, `driver_earnings`, `platform_commission`, `distance_km`, `duration_minutes`, `payment_method`, `payment_status`, `requested_at`, `accepted_at`, `arrived_at`, `started_at`, `completed_at`, `cancelled_at`, `my_rating`, `can_rate`.

## Layout
`Screen scroll`, Header (back, title = date "Mon, 28 Sep", trailing IconButton `share-variant-outline` → OS share of a text receipt), background `background`.

1. **Static map** 180 high, full width (no gutter), non-interactive (`liteMode` on Android, `scrollEnabled={false}` on iOS), route line + pickup/dropoff pins, dark style in dark mode. Fallback without coordinates: `surfaceAlt` block with `map-outline` 32 `textMuted`.
2. 16 gap: **Summary Card**: status pill + `caption` `textMuted` "{completed_at or cancelled_at time}" → 12 → amount `numericXL` (passenger `{total_fare}`, driver `{driver_earnings}`) → 4 → `bodySmall` `textSecondary` "Cash · {payment_status title-cased}" (hidden if absent) → 12 → `bodySmall` `textSecondary` "{distance_km} km · {duration_minutes} min".
3. 12 gap: **Route Card**: vertical Raah line with timestamps right-aligned (`caption` `textMuted`): pickup (`started_at`), stops, dropoff (`completed_at`).
4. 12 gap: **Person Card** (ListItem 72): Avatar 48, other party first name `title`, subtitle passenger-view: "{make} {model} · {license_plate}"; driver-view: "Rider"; trailing: `my_rating` stars display, or ghost Button `sm` "Rate" when `can_rate` (opens the rating sheet using the trip-complete rating card).
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
| Cancelled | Amount block shows "No charge" (or the fee if the API returns one); fare card hidden. |
