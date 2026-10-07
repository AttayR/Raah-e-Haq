# Passenger · Wallet (cash only)

- **Task:** T-617 after T-508 (wallet from API), BE-09.
- **Route:** `Account → Wallet` (stack).
- **Audit:** `audit/passenger-wallet-*` (Wallet defects 1-3).
- **Data:** `GET /wallet` → `balance`, `currency`, `total_spent`; `GET /wallet/transactions?page` → items `{id, type/direction, amount, description, ride reference (ride_id), created_at}` newest first, paginated.

## Layout
`Screen` with Header (back, title "Wallet"), FlatList body, background `background`, pull to refresh.

1. 8 gap: **Balance card** (`Card`, padding 20, `primary` fill with `onPrimary` text, radius `lg`; dark: `primarySoft` fill `#1C2850` with `onPrimarySoft` text):
   - `caption` "Wallet balance" (onPrimary at 80 % opacity is not allowed; use `navy-200` `#C9D5F7` on navy, 10.17:1).
   - 4 gap: `numericXL` `{balance}`.
   - 16 gap: row of one meta: `caption` `navy-200` "Spent on rides" + `numeric` `{total_spent}` (hidden if absent).
   - No "Add Funds", no "Payment Methods".
2. 12 gap: **Info Banner** (info tone): `cash` icon, "Raah-e-Haq is cash only. Pay your driver at the end of each trip."
3. 24 gap: Section header `overline` "Transactions".
4. 8 gap: **Transaction rows** grouped by day (sticky day headers `caption` `textMuted`, 32 high, "Today", "Yesterday", "Mon, 28 Sep"), inside Cards per day: ListItem 64: leading 40×40 `surfaceAlt` circle icon (`car-outline` ride, `arrow-down` credit, `arrow-up` debit, `cash-refund` refund); title `title` = `description` (1 line); subtitle `caption` `textMuted` = time; trailing `numeric`: credit `+Rs 500` in `success`, debit `Rs 520` in `textPrimary` (no red for normal spending). Tap a ride transaction → shared-ride-details.
5. Pagination: spinner row 56 at the end while loading the next page.

## States
| State | Spec |
|---|---|
| Loading | Balance card skeleton (same size, `surfaceAlt`), 5 skeleton rows. |
| Empty (new account) | Balance shows `Rs 0`; EmptyState under the header: icon `receipt-text-outline`, "No transactions yet", "Your ride payments will show up here." |
| Error | No cache: ErrorState "Couldn't load your wallet" + Try again. With cache: Toast + cached data. |
| Offline | Offline banner, cached data. |
