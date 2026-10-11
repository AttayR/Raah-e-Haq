# QA: chat, notifications, design smoke (2026-10-11-chat-notifications)

**Result: FAIL** — two functional bugs (chat composer under the keyboard; driver ride screen misses a passenger cancel). Everything else passed.

- App 2bb7898 (native rebuild, reinstalled), backend 76919a2; local backend only
- Passenger iPhone 17 FFD40F6E, driver iPhone 17 E375B9F1 (iOS 26.5)

## Checks
1. PASS design smoke (T-604/T-605/T-618): passenger Home + booking map, driver Home/Map/Settings, light + dark, no clipping, no fake stats; Appearance switch works. Visual: driver ride screen in dark mode keeps a light map with white status-bar text.
2. T-510 chat: PASS entry points, both-way messages within 5 s, Seen, Chat tab unread badge, no polling while backgrounded, read-only after complete/cancel. **FAIL: keyboard hides the composer on iOS** (rides 206, 207). Low: read-only notice "until 12:16 PM" drops the date (it is tomorrow).
3. PASS T-502 notifications: no prompt at first launch; prompt on first ride request / go online; real rows from ride events; badge = server count; tap marks read and routes (chat row opens thread); All/Unread; Mark all read; preferences persist; one unread-count per visit. Push delivery skipped (no FCM creds). Note: first taps on a preference switch right after opening sometimes ignored.
4. PASS T-204 (fields above keyboard; Sign in button half hidden while Password focused), T-206 (19900115 → 1990-01-15), T-202 driver duplicate plate → step 2 with server message; no user created.

## New bugs
| Sev | Finding | Task |
|---|---|---|
| High | Driver ride screen never learns the passenger cancelled (no status poll; only a 409 on the next action reveals it) | T-413 |
| Medium | Chat composer hidden behind the keyboard on iOS | T-512 |
| Low | Chat read-only notice drops the date | T-512 |
| Low | Driver ride screen dark mode: light map, unreadable status bar; driver Home has no "resume ride" link | T-413 |
| Low (product) | Logout doesn't set the driver offline | owner decision (recorded on T-413) |

## Data
Rides 206 (completed, 3 messages) and 207 (cancelled by passenger after accept). Notification rows for both. No users/vehicles/devices created. Both signed in; driver Online; no active rides.
