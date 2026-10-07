# Shared · Account (settings)

- **Task:** T-618 after T-511 (settings, support, invite, deletion), BE-11 (preferences), T-102 (logout confirm), T-601 (appearance).
- **Route:** `Account` tab (both roles).
- **Audit:** `audit/passenger-settings-*`, `driver-settings-*` (driver list collapsed to icons; passenger 4 hardcoded stars, oversized switches, "DANGER ZONE").
- **Data:** stored profile (`name`, `profile_image`, `rating`, `email`/`phone`); preferences `GET/PUT /profile/preferences` [BE-11] → `push_enabled`, `ride_updates`, `promotions`, driver `sound_alerts`; app version from the native build.

## Layout
`Screen scroll`, large-title Header "Account", background `background`, pull to refresh (`GET /auth/profile`).

1. 8 gap: **Profile header Card** (pressable → shared-profile): Avatar 56 → 16 → column: `h3` `{name}`, `bodySmall` `textSecondary` `{phone or email}`, rating display (5.22, 16) `{rating}` or "New" → trailing chevron.
2. 24 gap: **Grouped list "Your account"** (passenger): Wallet (`wallet-outline`) · Saved places (`map-marker-star-outline`) · Ride history is in Activity (not repeated). **Driver:** Vehicle & documents (`card-account-details-outline`) · Earnings is a tab (not repeated).
3. 24 gap: **"Notifications"** group (Switch rows, ListItem 56): Push notifications (`push_enabled`) · Ride updates (`ride_updates`; row disabled at 0.5 opacity while push is off) · Offers and promotions (`promotions`, passenger only) · Sound for ride requests (`sound_alerts`, driver only). Switch changes save immediately (optimistic; revert + Toast on failure). If OS notifications are denied: info Banner at the top of the group (shared-permissions).
4. 24 gap: **"App"** group: Appearance (`theme-light-dark`, trailing value "System"/"Light"/"Dark" → picker sheet with 3 radio rows) · Language (`translate`, trailing "English"; disabled with `caption` "Urdu coming soon" until i18n ships).
5. 24 gap: **"Support"** group: Help & support (`lifebuoy`) · Invite friends (`gift-outline`) · Terms of service (`file-document-outline`, opens URL) · Privacy policy (`shield-lock-outline`, opens URL). URL rows hidden if `/settings/public` doesn't provide them.
6. 24 gap: **Logout** Card with one destructive row (no chevron): `logout` "Log out" in `danger`.
7. 12 gap: ghost Button `sm` centred "Delete account" in `textMuted` style (destructive flow in shared-support-invite).
8. 16 gap: `caption` `textMuted` centred "Raah-e-Haq {version} ({build})". Bottom: tab bar + 16.

## States
| State | Spec |
|---|---|
| Loading prefs | Switches show skeleton 51×31 pills. |
| Prefs unavailable (pre-BE-11) | The Notifications group is replaced by a single row "Notifications" → opens OS settings. Never show local-only toggles that don't persist. |
| Logout | Dialog "Log out? / You'll need to sign in again to book rides." (driver: "…to drive.") / "Cancel" / "Log out" (destructive). Driver online: body adds "You'll go offline." On confirm: full-screen overlay spinner then Login. |
| Offline | Offline banner; switches disabled. |

Removed: navy hero with 4 stars, "DANGER ZONE", custom oversized switches, icon-only driver list, duplicated Home account rows.
