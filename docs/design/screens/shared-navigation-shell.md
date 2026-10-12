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
