# Shared · Chat thread (ride conversation)

- **Task:** T-607 after T-510, BE-13, BE-12 (`RideMessageSent`).
- **Route:** `ChatThread` {rideId} (stack; tab bar hidden). One component for both roles (today the passenger uses GiftedChat with a different design from the driver's custom screen).
- **Audit:** `audit/passenger-chat-thread-*`, `driver-chat-thread-*`.
- **Data:** `GET /rides/{id}/messages?after_id` → `{id, sender_id, body, read_at, created_at}`; `POST /rides/{id}/messages` {body ≤1000}; `POST /rides/{id}/messages/read`; ride `status` and other party (first name, `profile_image`), vehicle line for passengers.

## Layout
`Screen` edges top+bottom, background `background`, keyboard-aware (input stays above keyboard).

1. **Header:** back; centre block (Avatar 32 + 8 + column: `title` first name, `caption` `textMuted` subtitle: passenger sees "{vehicle make model} · {plate}", driver sees "Your rider"); trailing IconButton `phone-outline` (only if a call number is provided for the ride).
2. **Ride context strip** under the header (40 high, `surface`, bottom hairline): `caption` `textSecondary` status pill + "To {dropoff short}"; tap → returns to the trip screen.
3. **Messages** (inverted FlatList, padding 16, 4 gap between bubbles of the same sender in a run, 16 between runs):
   - Mine: right-aligned, max width 75 %, `primary` fill, `onPrimary` `body` text, padding 12/16, radius 18 with bottom-right 6.
   - Theirs: left-aligned, `surface` fill (dark: `surfaceAlt`), `textPrimary`, radius 18 with bottom-left 6, 1pt `border` in light.
   - Under the last bubble of a run: `caption` `textMuted` time; for mine also status: sending (`clock-outline` 12), sent (`check` 12), read (`check-all` 12 `primaryText`).
   - Day separators centred `caption` `textMuted` in a `surfaceAlt` pill 24 high.
   - No avatars per bubble (header already shows who it is).
4. **Quick replies** (only while the chat is open and the thread is empty or the last message is theirs): horizontal Chips, one line: passenger "I'm on my way", "I'm at the pickup", "Please wait 2 minutes"; driver "I've arrived", "I'm on my way", "Running a few minutes late". Tap sends immediately.
5. **Composer** (`surface`, top hairline, padding 8/16, bottom `insets.bottom + 8` or keyboard): multiline TextField (search-like, radius 20, min 40, max 5 lines, `surfaceAlt`, placeholder "Message {first name}") + 8 + send IconButton 40 circle `primary` with `send` 20 `onPrimary` (disabled 0.4 when empty). Counter "{n}/1000" `caption` appears above the field after 900 chars.

## States
| State | Spec |
|---|---|
| Loading | 3 skeleton bubbles alternating sides. |
| Empty, open | Centre: `bodySmall` `textMuted` "Messages are shared only with your {driver/rider} for this ride." + quick replies. |
| Sending | Bubble at 60 % opacity with clock; on failure: 16 `alert-circle` `danger` + "Not sent. Tap to retry." `caption` `danger`. |
| Closed (ride ended) | Composer replaced by a 56-high bar: `lock-outline` + `bodySmall` `textSecondary` "This chat is closed because the ride has ended." History stays visible (CHAT-01 step 4). |
| Realtime unavailable | Falls back to polling silently; no UI. |
| Offline | Offline banner; send disabled with placeholder "You're offline". |
| Rate limited (429) | Toast "You're sending messages too fast. Wait a moment." |

Removed: illustrated background, "Hello developer" seed, "?" icons, GiftedChat default styling.
