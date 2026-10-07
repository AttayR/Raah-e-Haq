# Shared · Permission prompts (location, notifications)

- **Task:** T-612 (visual); behaviour T-308 (location permission UX), T-502 (notification permission in context).
- **Route:** full-screen modal (`presentation: 'fullScreenModal'`) shown **before** the OS prompt, the first time a feature needs it; and inline blocks when denied.
- **Data:** permission status from the OS only.

## Pre-prompt screen (location / notifications)
`Screen`, background `surface`, content vertically centred in the area between header and actions.

1. Header: trailing ghost Button `sm` "Not now" (notifications only; location for passengers can be skipped to manual search, for drivers it cannot be skipped while going online).
2. Illustration 160×160 (location: map with pin; notifications: bell with ride card).
3. 24 gap: Title `h1` centred:
   - location (passenger): "Find rides near you"
   - location (driver): "Share your location while online"
   - notifications: "Know when your driver arrives"
4. 8 gap: Body `body` `textSecondary` centred, max 320:
   - passenger: "We use your location to set your pickup and show nearby drivers. Only while you use the app."
   - driver: "Riders see where you are only during a trip. We use your location only while you're online."
   - notifications: "Get updates about your ride, messages from your driver and receipts."
5. Bottom actions (padding 16, `insets.bottom + 8`): Button `lg primary` "Continue" (triggers the OS prompt) → 8 → Button `lg ghost` "Not now" (location passenger/notifications only).

## Denied state (inline, inside the screen that needs it)
- **Passenger booking:** the map area shows a `Banner` warning tone at the top of the sheet: icon `map-marker-off-outline`, text "Location is off. Set your pickup by searching.", trailing action "Turn on" → `Linking.openSettings()`. Booking continues with manual pickup search (PAX-E2E-03).
- **Driver Drive tab:** the online control is replaced by a Card: icon circle 64 `warningSoft` + `map-marker-off-outline`, title `h3` "Location needed to go online", body `bodySmall` "Turn on location for Raah-e-Haq in Settings.", Button `lg primary` "Open Settings", ghost "Try again" (re-checks).
- **Notifications denied:** Settings → Notifications section shows a Banner info "Notifications are off in your phone settings." with "Open Settings".

## Accessibility
- Illustrations `accessible={false}`; title is the screen's first focus.
