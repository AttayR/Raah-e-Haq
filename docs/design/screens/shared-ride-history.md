# Shared · Ride history (Activity)

- **Task:** T-617 after T-501 (history from API, both roles), BE-01.
- **Route:** passenger `Activity` tab; driver: the Trips list inside driver-earnings uses the same row component (and "See all" pushes this screen in driver variant).
- **Audit:** `audit/passenger-history-*`.
- **Data:** `GET /rides?page` (scoped to the caller, BE-01) → `id`, `status`, `pickup_address`, `dropoff_address`, `stops[]` count, `vehicle_type`, `total_fare`, `driver_earnings` (driver), `requested_at`, `completed_at`, `cancelled_at`, `can_rate` [BE-07].

## Layout **[revised UI-R15, 2026-10-18]**
Passenger: inside Activity (Header `large` + `inlineTitle` "Activity", pinned SegmentedControl Rides | Wallet, DESIGN_SYSTEM §5.2). Driver pushed variant: standard Header "Trips". Background `background`, pull to refresh (also re-reads the summary).

1. **Pinned** (does not scroll): Filter chips (one line) All · Completed · Cancelled, padding 4 top / 12 bottom, gutter 16; `ScrollHairline` under them once the list scrolls 4pt.
2. **Summary strip** (passenger Activity only, scrolls away with the list; 12 below the chips' 12, i.e. first item of the list header): one `surfaceAlt` row, radius `md`, padding 8 vertical, up to 4 equal cells divided by hairline `border`: value `numeric` `textPrimary` centred, 2 gap, label `caption` `textSecondary` centred: Rides (`total_rides`), Rating (`rating`), Distance (`total_distance_km`), Spent (`total_spent`) from `GET /me/stats`; `total_rides` 0 or stats absent → no strip (never a row of zeros). One line per value, tail ellipsis; full value in the cell's accessibility label. Loading: one skeleton strip of exactly the loaded strip's height (measured 54 on iPhone 17 at 1.0x; take it from a token, not a literal), so nothing jumps. Replaces the four 2×2 stat cards (owner feedback 2026-10-18: they filled the first screen).
3. **List grouped by local day** (sticky section headers, `caption` `textMuted`, min height 32, 8 top padding, fill `background`: "Today", "Yesterday", "Mon, 28 Sep", year added outside the current year). Cards 8 apart (was 12; the denser list is ruled in UI-R15).
4. **Row card** (`Card` pressable, padding 12 vertical / 16 horizontal; whole card → shared-ride-details, or the live ride while in progress; no Details button, no Rate button):
   - Top line (min height 24, gap 8): vehicle glyph 20 `textSecondary` + time `bodySmall` `textSecondary` (never truncates) + " · {vehicle}" `bodySmall` `textSecondary` (separate text, flex, truncates; the separator belongs to the vehicle text so it never dangles) + trailing slot:
     - `completed`: no pill; amount `numeric` `textPrimary` (passenger `total_fare`, driver `driver_earnings`). A completed ride is the norm and stays quiet (Uber/Careem pattern; ruled UI-R15).
     - `cancelled`: neutral pill "Cancelled" + "No charge" `bodySmall` `textMuted`; when the passenger was charged a fee (`cancellation_fee` > 0): "Rs 30 fee" `bodySmall` `textPrimary` **[UI-R15 re-review: money actually charged is never muted]**.
     - in progress (`requested`, `accepted`, `arrived`, `started`): the 5.24 status pill only, no amount (the fare is not settled yet and the live ride shows it); this also keeps the line on one row on iPhone SE.
   - 4 gap: Raah line compact (pickup / dropoff, `body` 1 line each, row 28, no labels) + "+{n} stops" `caption` `textMuted` at the text start; chevron 20 `textMuted` trailing, vertically centred on the Raah line.
   - No "Rate ride" button on rows (ruled UI-R15): rating lives in trip complete and in ride details (Person card "Rate" when `can_rate`). Revisit only if rating coverage data shows it is needed.
5. Pagination: spinner row; end of list: `caption` `textMuted` centred "That's all your rides".

## States
| State | Spec |
|---|---|
| Loading | Summary strip skeleton + 3 skeleton cards, height = token `skeleton.heights.rideHistoryRow`, which must equal a real 2-address row at 1.0x font (measured 114 on iPhone 17 in UI-R15; token today 120). |
| Empty | EmptyState: icon `car-outline`, passenger: "No rides yet", "Your trips will show up here." + Button `md secondary` "Book a ride" (→ the Booking flow "Where to?"); driver: "No trips yet", "Go online to start getting trips." |
| Empty filter | Compact EmptyState "No {completed/cancelled} rides". |
| Error | ErrorState "Couldn't load your rides" + Try again; with cache: Toast. |
| Offline | Offline banner + cached pages. |
