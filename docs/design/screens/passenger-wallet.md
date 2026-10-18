# Passenger · Wallet (cash only)

- **Task:** T-617 after T-508 (wallet from API), BE-09.
- **Route:** passenger Activity › Wallet segment (UI-R4; under the pinned segments with a `ScrollHairline`, no own Header); driver: pushed from Earnings (standard Header "Wallet").
- **Audit:** `audit/passenger-wallet-*` (Wallet defects 1-3).
- **Data:** `GET /wallet` → `balance`, `currency`, `total_spent`; `GET /wallet/transactions?page` → items `{id, type/direction, amount, description, ride reference (ride_id), created_at}` newest first, paginated.

## Layout
`Screen` with Header (back, title "Wallet"), FlatList body, background `background`, pull to refresh.

1. 8 gap: **Balance card** (`Card`, padding 20, `primary` fill with `onPrimary` text, radius `lg`; dark: `primarySoft` fill `#1C2850` with `onPrimarySoft` text):
   - `caption` "Wallet balance" (onPrimary at 80 % opacity is not allowed; use `navy-200` `#C9D5F7` on navy, 10.17:1).
   - 4 gap: `numericXL` `{balance}`.
   - 16 gap: row of one meta: `caption` `navy-200` "Spent on rides" + `numeric` `{total_spent}` (hidden if absent).
   - No "Payment Methods". **[revised UI-R15, owner decision 2026-10-13]** 12 below the card: Button `lg secondary` full width "Add money" (icon `wallet-plus-outline`) only when `GET /wallet` returns `can_top_up` (T-515, JazzCash/Easypaisa); hidden otherwise.
2. 12 gap: **Info Banner** (info tone): `cash` icon, title "Cash only", body "Rides are paid in cash to the driver." (as shipped; accepted UI-R15).
3. 24 gap: Section header `overline` "Transactions"; 8 gap: FilterChips All · Money in · Money out.
4. 8 gap: **Transaction rows** grouped by day (sticky day headers `caption` `textMuted`, 32 high, "Today", "Yesterday", "Mon, 28 Sep") **[revised UI-R15]** as a flat list on `background` (no Card per day; matches the inbox lists and keeps the ledger dense): ListItem 64: leading 40×40 `surfaceAlt` circle icon (`car-outline` ride, `arrow-down` credit, `arrow-up` debit, `cash-refund` refund); title `title` = the type label from the app's copy keyed by `type` ("Ride payment", "Refund", "Top-up", "Commission"), sentence case, falling back to `description` only for unknown types (never a backend Title Case string like "Ride Payment (cash)"); subtitle `caption` `textMuted` = time only, plus " · Reversed" when reversed. **Never show `ride_code`/ride references in the row** (a 26-character ULID is noise and truncates); the reference belongs to the transaction detail and ride details. Trailing `numeric`: credit `+Rs 500` in `success`, debit in `textPrimary`: cash ride records (informational, balance unchanged) unsigned `Rs 520`; real wallet deductions (cancellation fee, commission, dispute charge) signed `−Rs 30`, still `textPrimary`. **Never `danger`/red for money moving** (red is for errors only; ruled UI-R15 re-review, overriding the older "debit red" comment in `wallet/format.ts`). Tap a ride transaction → shared-ride-details.
5. Pagination: spinner row 56 at the end while loading the next page.

## States
| State | Spec |
|---|---|
| Loading | Balance card skeleton (same size, `surfaceAlt`), 5 skeleton rows. |
| Empty (new account) | Balance shows `Rs 0`; EmptyState under the header: icon `clipboard-text-clock-outline`, "No transactions yet", "Your ride payments will show up here." |
| Error | No cache: ErrorState "Couldn't load your wallet" + Try again. With cache: Toast + cached data. |
| Offline | Offline banner, cached data. |
