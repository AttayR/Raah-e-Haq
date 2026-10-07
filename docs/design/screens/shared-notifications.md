# Shared · Notifications (Inbox → Notifications)

- **Task:** T-607 after T-502 (notifications from API, both roles), BE-11 (`category`, broadcasts).
- **Route:** `Inbox` tab, segment "Notifications" (default segment). Same component for both roles.
- **Audit:** `audit/passenger-notifications-*`, `driver-notifications-*`.
- **Data:** `GET /notifications?page` → `{id, title, body/message, category (ride|promo|system|wallet) [BE-11], data (ride_id …), read_at, created_at}`; `GET /notifications/unread-count`; `POST /notifications/{id}/read`; `POST /notifications/read-all`.

## Layout (Inbox frame)
`Screen`, large-title Header "Inbox", trailing text action "Mark all read" (`buttonSmall`, single line; only on the Notifications segment and only when unread > 0). Background `background`.

1. 8 gap: SegmentedControl "Notifications | Messages" with count Badges inside segment labels when > 0 (e.g. "Notifications 3").
2. 12 gap: **Filter chips** (one line, horizontal scroll, inset 16): All · Rides · Offers · Account (maps to categories ride / promo / system+wallet). Driver: All · Rides · Account. Hidden until BE-11 provides `category`.
3. 12 gap: **List** grouped by day (section header `caption` `textMuted` 32 high: Today / Yesterday / date), each group in a Card:
   - ListItem min 72: leading 40×40 circle with category icon (ride `car-outline` on `primarySoft`/`primaryText`; promo `tag-outline` on `saffron-50`/`saffron-700`; system `information-outline` on `surfaceAlt`/`textSecondary`; wallet `wallet-outline` on `successSoft`/`success`); title `title` (1 line); body `bodySmall` `textSecondary` (2 lines); meta `caption` `textMuted` time ("2:30 PM"; older than today shows the time only since the group shows the date).
   - Unread: title weight 600 + 8×8 `primary` dot at the trailing edge, vertically centred; row background `surface` (no tinted rows). Read: title weight 400 (use `body` style), no dot.
   - Tap: marks read (optimistic), then deep-links by `data` (ride → shared-ride-details; promo with `action_url` → in-app browser; otherwise opens a detail sheet with full text).
   - Swipe left (iOS) / long-press (Android): "Mark as read/unread".
4. Pagination spinner row.

## States
| State | Spec |
|---|---|
| Loading | 6 skeleton rows (40 circle + 2 lines). |
| Empty | EmptyState: icon `bell-outline`, "No notifications yet", passenger: "Ride updates and offers will show up here." driver: "Ride updates and account news will show up here." |
| Empty filter | Compact EmptyState "Nothing in {filter}". |
| Error | ErrorState "Couldn't load notifications" + Try again; with cache: Toast. |
| Mark all read | Text action shows a spinner; rows update; badge clears. |
| Offline | Offline banner; cached list; mark-read queued. |

Removed: back arrow on the tab root, wrapping "Mark all", wrapping chips, demo items, driver placeholder text.
