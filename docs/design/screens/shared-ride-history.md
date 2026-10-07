# Shared · Ride history (Activity)

- **Task:** T-617 after T-501 (history from API, both roles), BE-01.
- **Route:** passenger `Activity` tab; driver: the Trips list inside driver-earnings uses the same row component (and "See all" pushes this screen in driver variant).
- **Audit:** `audit/passenger-history-*`.
- **Data:** `GET /rides?page` (scoped to the caller, BE-01) → `id`, `status`, `pickup_address`, `dropoff_address`, `stops[]` count, `vehicle_type`, `total_fare`, `driver_earnings` (driver), `requested_at`, `completed_at`, `cancelled_at`, `can_rate` [BE-07].

## Layout
`Screen`, large-title Header "Activity" (driver pushed variant: standard Header "Trips"), background `background`, pull to refresh.

1. 8 gap: **Filter chips** (one line): All · Completed · Cancelled (client-side filter on loaded pages, or server `status` param if BE-01 supports it).
2. 12 gap: **List grouped by month** (section header `overline` `textMuted` "October 2026"), each ride its own Card (pressable), 12 gap:
   - Row 1: `caption` `textMuted` date/time ("Mon, 28 Sep · 2:30 PM") + flex + status pill (5.24 mapping; cancelled = neutral).
   - 12 gap: Raah line compact (pickup / dropoff, `body` 1 line each, row 28 high, no labels) + "+{n} stops" `caption` when stops exist.
   - 12 gap: bottom row: vehicle glyph 20 `textSecondary` + vehicle name `bodySmall` `textSecondary` + flex + amount `numeric`: passenger `{total_fare}`; driver `{driver_earnings}`. Cancelled rides show "No charge" `bodySmall` `textMuted` instead of an amount unless the API returns a cancellation fee.
   - If `can_rate`: a ghost Button `sm` "Rate ride" (star-outline) at the bottom-left of the card.
   - Whole card tap → shared-ride-details. No separate "Details" button.
3. Pagination: spinner row; end of list: `caption` `textMuted` centred "That's all your rides".

## States
| State | Spec |
|---|---|
| Loading | 3 skeleton cards (each 132 high). |
| Empty | EmptyState: icon `car-outline`, passenger: "No rides yet", "Your trips will show up here." + Button `md secondary` "Book a ride" (→ Home "Where to?"); driver: "No trips yet", "Go online to start getting trips." |
| Empty filter | Compact EmptyState "No {completed/cancelled} rides". |
| Error | ErrorState "Couldn't load your rides" + Try again; with cache: Toast. |
| Offline | Offline banner + cached pages. |
