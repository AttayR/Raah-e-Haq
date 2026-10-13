# Shared · Navigation shell (tabs, stacks, headers)

- **Task:** UI-R4 (supersedes T-610; owner decision 2026-10-11: no Map tab, map-first Home, 4 tabs per role, in sync). Exact tabs, headers and sheet snap points: DESIGN_SYSTEM §8 v1.1 (that section wins over this file where they differ). No data-flow change; route names change, so every `navigate()` call site is updated in the same task.
- **Audit:** G-07, G-09; duplicate mounts PAX-10; FEATURES inventory (Map/Notifications mounted twice).
- **Spec source:** DESIGN_SYSTEM §8 (IA), §5.2 (Header), §5.3 (Tab bar).

## Passenger
```
PassengerRoot (native stack)
├─ PassengerTabs (bottom tabs, 4)
│  ├─ Home            icon home-outline / home          → passenger-home
│  ├─ Activity        icon clipboard-text-clock-outline / clipboard-text-clock → segmented Rides (shared-ride-history) | Wallet (passenger-wallet)
│  ├─ Inbox           icon inbox-outline / inbox        → shared-notifications | shared-chat-list (segmented)
│  └─ Account         icon account-circle-outline / account-circle → shared-settings
├─ Booking (stack, tab bar hidden): Search → ChooseRide → Trip (states: requested, accepted, arrived, ongoing, completed)
├─ ChatThread         → shared-chat-thread
├─ RideDetails        → shared-ride-details
├─ SavedPlaces, SavedPlaceEdit, Profile, ProfileEdit, Support, SupportTicket, Invite, Appearance, DeleteAccount
```
Removed routes: tab `Map`, tab `Chat`, tab `Settings`, stack `PassengerMap`, stack `PassengerNotifications`, `PassengerPofile` (typo), `PassengerRideTracking` (replaced by Booking/Trip).

## Driver
```
DriverRoot (native stack)
├─ DriverTabs (bottom tabs, 4)
│  ├─ Drive           icon steering                     → driver-drive-home (+ incoming request state)
│  ├─ Earnings        icon wallet-outline / wallet       → driver-earnings (Today | Week | Month, commission owed, settlements)
│  ├─ Inbox           icon inbox-outline / inbox        → shared-notifications | shared-chat-list
│  └─ Account         icon account-circle-outline / account-circle → shared-settings (driver)
├─ DriverTrip (stack, tab bar hidden): ToPickup → OnTrip → Complete
├─ ChatThread, RideDetails, Settlements (wallet/settlement history), VehicleDocuments, Profile, ProfileEdit, Support, SupportTicket, Invite, Appearance, DeleteAccount
```
Removed routes: tab `Home` (dashboard), tab `Map`, tab `Notifications`, tab `Chat`, tab `Settings`, stack `DriverMap`.

## Tab bar
- Exactly DESIGN_SYSTEM §5.3. Labels: "Home", "Activity", "Inbox", "Account" / "Drive", "Earnings", "Inbox", "Account".
- Inbox badge: count = unread notifications [`GET /notifications/unread-count`] + unread chats [BE-13]; dot when count unknown but > 0.
- Hidden on Booking, DriverTrip, ChatThread and all pushed detail screens.

## Headers
- Tab roots: large-title Header (Activity, Inbox, Account, Earnings); Home and Drive have no header (map).
- Pushed screens: standard Header with back.
- Swipe-back on every pushed screen except Booking/Trip states and DriverTrip (back there opens the relevant cancel/discard dialog).

## Transitions
- Native stack defaults (§6.3). Tab switches: no animation (instant), preserving each tab's scroll position.

## States
- While the session bootstraps: auth-splash. While `status !== active`: auth-account-status. While an active ride exists: the role's trip stack is restored on launch (T-301 / T-405).

## Map-first Home and Drive (owner decision 2026-10-11)
- Passenger Home = full map + "Where to?" sheet; Driver Drive = full map + Online/Offline sheet; incoming requests are a sheet state on the Drive map. Snap points, drag and chrome: DESIGN_SYSTEM §8.3.
- During a ride (Booking from "finding driver" on, DriverTrip) the full-screen map stays as today; the tab bar is hidden and the trip state is restored on relaunch.
- The legacy dashboard content (driver account card, today stats; passenger shortcuts) moves into the sheet `half` state or into Activity/Earnings; nothing is shown that the API doesn't return.

## UI-R4 review rulings (2026-10-13)
- **Active tab label** uses the new `captionStrong` text style (12/16, 600, 0.1; DESIGN_SYSTEM §2) — accepted as a token; only the tab bar uses it.
- **List filters under a view switch.** Activity › Rides (All / Completed / Cancelled), Activity › Wallet (All / Money in / Money out) and Inbox › Notifications (All / Unread) render as `FilterChips` (§5.11 [UI-R4]) under the screen SegmentedControl — accepted and now the rule. The chip row must be one horizontal scrolling line (no wrap).
- **SegmentedControl labels** must render at `label` (13) and may shrink only to `minimumFontScale` 0.85; a label drawn smaller than 11pt (the first-mount collapse seen on Activity/Inbox in light mode) is a FAIL. Do not depend on iOS `adjustsFontSizeToFit` measuring a 0-width first layout.
- **Earnings segments** read "Today | This week | This month" (DS §8.1 updated).
- **Driver Drive go-online without a GPS fix** — accepted for UI-R4: same thunks as the old Home tab, the server decides, and the tracker posts on the first fix; the first-poll 422 waits for a fix or a second failure. Not accepted once permission is known to be denied or services are off: UI-R11 must replace the control with the shared-permissions denied card (driver-drive-home "Location permission missing") and show a "Finding your location…" line while online with no fix.
- **Incoming request** stays the legacy `IncomingRequestCard` positioned on the Drive map, with the Drive sheet, map controls and tab bar hidden while it shows — accepted for UI-R4 (shell behaviour, covered by `DriverTabs.test.tsx` and `RideRequestHost.test.tsx`). The real sheet state (fare first, countdown ring, 56pt actions) and its simulator screenshots (light/dark, iPhone 17 + SE, on the Drive map) are UI-R11 acceptance, not UI-R4.
- **Evidence.** A system dialog (e.g. the iOS notification prompt) over a screenshot does not count as evidence for that screen; dismiss it and retake. Committed screenshots are shrunk with `sips -Z 1000`.
