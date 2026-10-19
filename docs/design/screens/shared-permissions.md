# Shared · Permission prompts (location, notifications)

- **Task:** T-612 (visual); behaviour T-308 (location permission UX), T-502 (notification permission in context).
- **Route:** full-screen modal (`presentation: 'fullScreenModal'`) shown **before** the OS prompt, the first time a feature needs it; and inline blocks when denied.
- **Data:** permission status from the OS only.

## Pre-prompt screen (location / notifications)
`Screen`, background `surface`, content vertically centred in the area between header and actions.

1. Header: empty (`tone="background"`, no actions). **[UI-R8 review]** The header "Not now" for notifications is removed: one skip action per screen (the bottom ghost button). Location for passengers can be skipped to manual search; for drivers it cannot be skipped while going online (no "Not now", Android back does nothing).
2. Illustration (UI-R8 Illustration component, see auth-account-status): 160 box / 128 disc / 64 glyph / 48 `accent` badge; 120 / 96 / 48 / 36 on windows under 700 pt. Location passenger: `map` + pin badge; location driver: `map` + car badge; notifications: `bell-ring` + car badge.
3. 24 gap: Title `h1` centred:
   - location (passenger): "Find rides near you"
   - location (driver): "Share your location while online"
   - notifications (passenger): "Know when your driver arrives"
   - notifications (driver): "Never miss a ride request"
4. 8 gap: Body `body` `textSecondary` centred, max 320:
   - passenger: "We use your location to set your pickup and show nearby drivers. Only while you use the app."
   - driver: "We use your location only while you're online, to match you with nearby riders and to show your trip to your rider." (UI-R8 review: clearer than the earlier draft, accepted)
   - notifications (passenger): "Get updates about your ride, messages from your driver and receipts."
   - notifications (driver): "Get ride requests, messages from your riders and trip updates."
   The middle block scrolls (1.3x text on an SE never clips).
5. Bottom actions (padding 16 top / gutter sides, bottom `layout.bottomActionOffset`, min 16 without a home indicator): Button `lg primary` "Continue" (triggers the OS prompt) → 8 → Button `lg ghost` "Not now" (location passenger/notifications only).

## Denied state (inline, inside the screen that needs it)
- **Passenger booking:** the map area shows a `Banner` warning tone at the top of the sheet: icon `map-marker-off-outline`, text "Location is off. Set your pickup by searching.", trailing action "Turn on" → `Linking.openSettings()`. Booking continues with manual pickup search (PAX-E2E-03).
- **Driver Drive tab:** while offline with no open ride, the online control is replaced by an outlined Card (centred column, gap 8): icon circle 64 `warningSoft` + `map-marker-off-outline` 32 `warning` (8 extra below the circle), title `h3` "Location needed to go online", body `bodySmall` "Turn on location for Raah-e-Haq in Settings.", then 16 → Button `lg primary` "Open Settings" → 8 → Button `lg ghost` "Try again" (re-checks).
- **Notifications denied:** Settings → Notifications section shows a Banner info "Notifications are off in your phone settings." with "Open Settings".

## Accessibility
- Illustrations `accessible={false}`; title is the screen's first focus.
