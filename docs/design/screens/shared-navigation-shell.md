# Shared · Navigation shell (tabs, stacks, headers)

- **Task:** T-610. No data-flow change; route names change, so every `navigate()` call site is updated in the same task.
- **Audit:** G-07, G-09; duplicate mounts PAX-10; FEATURES inventory (Map/Notifications mounted twice).
- **Spec source:** DESIGN_SYSTEM §8 (IA), §5.2 (Header), §5.3 (Tab bar).

## Passenger
```
PassengerRoot (native stack)
├─ PassengerTabs (bottom tabs, 4)
│  ├─ Home            icon home-outline / home          → passenger-home
│  ├─ Activity        icon receipt-text-outline / receipt-text → shared-ride-history
│  ├─ Inbox           icon inbox-outline / inbox        → shared-notifications | shared-chat-list (segmented)
│  └─ Account         icon account-circle-outline / account-circle → shared-settings
├─ Booking (stack, tab bar hidden): Search → ChooseRide → Trip (states: requested, accepted, arrived, ongoing, completed)
├─ ChatThread         → shared-chat-thread
├─ RideDetails        → shared-ride-details
├─ Wallet, SavedPlaces, SavedPlaceEdit, Profile, ProfileEdit, Support, SupportTicket, Invite, Appearance, DeleteAccount
```
Removed routes: tab `Map`, tab `Chat`, tab `Settings`, stack `PassengerMap`, stack `PassengerNotifications`, `PassengerPofile` (typo), `PassengerRideTracking` (replaced by Booking/Trip).

## Driver
```
DriverRoot (native stack)
├─ DriverTabs (bottom tabs, 4)
│  ├─ Drive           icon steering                     → driver-drive-home (+ incoming request state)
│  ├─ Earnings        icon chart-box-outline / chart-box → driver-earnings
│  ├─ Inbox           icon inbox-outline / inbox        → shared-notifications | shared-chat-list
│  └─ Account         icon account-circle-outline / account-circle → shared-settings (driver)
├─ DriverTrip (stack, tab bar hidden): ToPickup → OnTrip → Complete
├─ ChatThread, RideDetails, VehicleDocuments, Profile, ProfileEdit, Support, SupportTicket, Invite, Appearance, DeleteAccount
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
