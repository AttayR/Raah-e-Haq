# Screen specs index

All specs use the tokens and components in [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md). Coordinates and sizes are in points. "Gutter" = 16. Every spec lists: route, data sources (real API fields only), a top-to-bottom block list, every state, interactions, accessibility and small-device rules.

Conventions inside specs:
- `{ride.total_fare}` means the API field rendered with the formatting rules in DESIGN_SYSTEM §2 (money, distance, time).
- **[BE-xx]** marks a field that arrives with that backend task; until then the block shows its empty/unknown state, never a made-up value.
- Default states that apply to every screen and aren't repeated: offline banner (§5.17) when NetInfo is offline; font scale 1.3× must not clip; VoiceOver labels on every control; dark mode uses the same tokens.

| Spec | Role | Task |
|---|---|---|
| [auth-splash](auth-splash.md) | auth | T-612 |
| [auth-login](auth-login.md) | auth | T-603 |
| [auth-phone-otp](auth-phone-otp.md) | auth | T-603 |
| [auth-forgot-password](auth-forgot-password.md) | auth | T-603 |
| [auth-registration](auth-registration.md) | auth | T-611 |
| [auth-account-status](auth-account-status.md) | auth (driver pending) | T-612 |
| [shared-permissions](shared-permissions.md) | shared | T-612 |
| [passenger-home](passenger-home.md) | passenger | T-604 |
| [passenger-destination-search](passenger-destination-search.md) | passenger | T-604 |
| [passenger-vehicle-fare](passenger-vehicle-fare.md) | passenger | T-613 |
| [passenger-finding-driver](passenger-finding-driver.md) | passenger | T-613 |
| [passenger-driver-assigned](passenger-driver-assigned.md) | passenger | T-614 |
| [passenger-trip-in-progress](passenger-trip-in-progress.md) | passenger | T-614 |
| [passenger-trip-complete](passenger-trip-complete.md) | passenger | T-614 |
| [passenger-wallet](passenger-wallet.md) | passenger | T-617 |
| [passenger-saved-places](passenger-saved-places.md) | passenger | T-618 |
| [driver-drive-home](driver-drive-home.md) | driver | T-605 |
| [driver-incoming-request](driver-incoming-request.md) | driver | T-605 |
| [driver-to-pickup](driver-to-pickup.md) | driver | T-615 |
| [driver-trip-in-progress](driver-trip-in-progress.md) | driver | T-615 |
| [driver-trip-complete](driver-trip-complete.md) | driver | T-615 |
| [driver-earnings](driver-earnings.md) | driver | T-616 |
| [driver-vehicle-documents](driver-vehicle-documents.md) | driver | T-616 |
| [shared-navigation-shell](shared-navigation-shell.md) | shared | T-610 |
| [shared-notifications](shared-notifications.md) | shared | T-607 |
| [shared-chat-list](shared-chat-list.md) | shared | T-607 |
| [shared-chat-thread](shared-chat-thread.md) | shared | T-607 |
| [shared-ride-history](shared-ride-history.md) | shared | T-617 |
| [shared-ride-details](shared-ride-details.md) | shared | T-617 |
| [shared-profile](shared-profile.md) | shared | T-618 |
| [shared-settings](shared-settings.md) | shared | T-618 |
| [shared-support-invite](shared-support-invite.md) | shared | T-619 |
