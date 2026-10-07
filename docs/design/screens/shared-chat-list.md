# Shared · Messages list (Inbox → Messages)

- **Task:** T-607 after T-510 (in-ride chat), BE-13 (`GET /chats`).
- **Route:** `Inbox` tab, segment "Messages". Same component for both roles.
- **Audit:** `audit/passenger-chat-list-*`, `driver-chat-list-*`.
- **Data:** `GET /chats` → per ride: `ride_id`, other party `name` (first name) and `profile_image`, `last_message` {body, created_at, sender is me}, `unread_count`, ride `status`, chat open/closed (posting allowed while accepted/arrived/ongoing).

## Layout
Inbox frame (shared-notifications) with segment "Messages" selected.

1. 12 gap: **Active section** (rides in accepted/arrived/ongoing): `overline` "Current ride" + Card with the conversation row(s).
2. 24 gap: **Earlier** section: `overline` "Earlier" + Card with rows.
3. Conversation row ListItem min 72: Avatar 48 (initials fallback); title `title` other party first name + `caption` `textMuted` " · {ride date}"; subtitle `bodySmall` `textSecondary` last message, 1 line, prefixed "You: " when sent by me; trailing column: time `caption` `textMuted` top, unread count Badge below (or nothing). Unread rows: subtitle `textPrimary` weight 600.
4. Rows for closed chats show subtitle in `textMuted` and a trailing `lock-outline` 16.

## States
| State | Spec |
|---|---|
| Loading | 4 skeleton rows (48 circle + 2 lines). |
| Empty | EmptyState: icon `message-text-outline`, "No messages", "You can message your {driver/rider} during a ride." |
| Error | ErrorState "Couldn't load messages" + Try again. |
| Offline | Offline banner, cached. |

Removed: navy hero header, stock-photo demo conversations, grey empty avatars.
