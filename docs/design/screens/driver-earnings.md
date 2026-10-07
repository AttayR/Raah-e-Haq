# Driver · Earnings (with trip history)

- **Task:** T-616 after T-507 (Earnings screen on real data), T-501 (driver history), BE-08.
- **Route:** `DriverTabs/Earnings` (tab 2 of 4).
- **Data:** `GET /driver/earnings?period=day|week|month` [BE-08] → totals (`earnings`, `rides`, `online_minutes` if provided), per-day `series` [{date, earnings, rides}], `rides` [{id, completed_at, pickup_address, dropoff_address, driver_earnings, total_fare}]. Rating from `GET /me/stats`.

## Layout
`Screen` with large-title Header "Earnings" (5.2 large title variant), background `background`, pull to refresh.

1. 8 gap: **Period SegmentedControl** "Today | This week | This month" (maps to day/week/month), full width − 32.
2. 16 gap: **Total hero card** (`primary` fill, `onPrimary` text, radius `lg`, padding 20; dark: `primarySoft` / `onPrimarySoft`):
   - `caption` `navy-200` period label ("Mon, 5 Oct" / "29 Sep – 5 Oct" / "October").
   - 4 gap: `numericXL` `{earnings}`.
   - 16 gap: row of 2 metrics separated by a 1pt `navy-700` divider 32 high: `numeric` `{rides}` + `caption` "Trips"; `numeric` online time "{h} h {mm} min" + `caption` "Online" (hidden if absent).
3. 16 gap (week/month only): **Bar chart Card**, height 200 incl. padding 16: one bar per day of `series`, bar width = (card inner width − gaps) / n, max 24, radius top 4; bar colour `primary`, selected bar `navy-400` (dark: selected `navy-200`, others `navy-500`); x labels `caption` `textMuted` (Mon…Sun or dates 1…31 every 5th); no y axis, value label `numericSmall` above the selected bar. Tap a bar selects it and shows "{date}: {earnings} · {rides} trips" `bodySmall` under the chart. Zero days show a 2pt `surfaceAlt` stub.
4. 24 gap: Section header `overline` "Trips".
5. 8 gap: **Trip rows** (shared-ride-history row, driver variant: trailing `numeric` `{driver_earnings}` in `textPrimary`, subtitle time), grouped by day for week/month. Tap → shared-ride-details (driver variant).
6. Pagination spinner row.

## States
| State | Spec |
|---|---|
| Loading | Hero skeleton (same size), chart skeleton (7 `surfaceAlt` bars, all at 40 % of the chart height), 4 row skeletons. |
| Empty period | Hero shows `Rs 0` and "0 trips"; chart shows stubs; EmptyState under Trips: icon `steering`, "No trips {today/this week/this month}", "Go online to start earning." + Button `md secondary` "Go to Drive". |
| Error | ErrorState "Couldn't load earnings" + Try again (keep cached period data if present). |
| Offline | Offline banner + cached. |
