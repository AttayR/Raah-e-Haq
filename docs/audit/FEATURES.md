# Feature completeness audit

**Date:** 2026-10-08 · **App:** branch `fix/production-hardening` at `4ddf223` · **Backend:** `~/My-Projects/Raah-e-Haq-backend`, branch `main` at `d9f2f12` (the backend has no `fix/production-hardening` branch yet; rh-backend has to cut it before the first BE task).

**Method:** every navigator and screen under `src/app/navigation` and `src/screens` was read. Each action and data block was traced to the service call, and then to the Laravel route (`php artisan route:list`) and controller. Route matching was checked with the router itself. Four single read-only GETs went to the local backend (`/api/health`, `/api/public/banners` twice, `/api/settings/public`). Production was not contacted.

**Owner product defaults applied:** cash-only payments (wallet shows balance and history, no top-up); in-ride chat between passenger and driver; foreground-only location; realtime on **Laravel Reverb** (the backend has no WebSocket server today).

**Status key:**
- `REAL`: a service call to an existing route that returns the data shown.
- `MOCK`: hardcoded data, placeholder text, local-only state, or a `console.log` handler.
- `BROKEN`: calls a route that doesn't exist, or that matches the wrong controller, sends wrong fields, or crashes.
- `MISSING`: the action does nothing, or a feature the app needs doesn't exist on either side.

`Task` points to the task that fixes the row. Rows already covered by an older task keep that task's ID. New work is listed under **Findings** at the end.

## Screen inventory

| Role | Screen | File | Registered | Reachable |
|---|---|---|---|---|
| Auth | Login | `screens/Auth/LoginScreen.tsx` | AuthStack `Login` | yes |
| Auth | Signup → Registration wizard (Personal, Vehicle, Documents, Review steps) | `SignupScreen.tsx` → `RegistrationForm.tsx` → `RegistrationScreen.tsx` + `steps/*` | AuthStack `Signup` | yes |
| Auth | Phone OTP | `PhoneAuthScreen.tsx` | AuthStack `PhoneAuth` | yes |
| Auth | Role selection | `RoleSelectionScreen.tsx` | AuthStack `RoleSelection` | **no** (nothing navigates to it; Firebase-based) |
| Auth | Basic info | `BasicInfoScreen.tsx` | AuthStack `BasicInfo` | **no** (only from RoleSelection; writes Firestore) |
| Auth | Driver registration (legacy) | `DriverRegistrationScreen.tsx` | AuthStack `DriverRegistration` | **no** (only from RoleSelection; Firebase thunk) |
| Auth | Pending approval | `screens/Driver/DriverPendingApprovalScreen.tsx` | **not registered**; rendered by `AuthFlow.tsx:43` | yes (any non-active user) |
| Passenger | Home | `Passenger/PassengerHomeScreen.tsx` | tab `Home` | yes |
| Passenger | Map / booking | `Passenger/PassengerMapScreen.tsx` | tab `Map` **and** stack `PassengerMap` (mounted twice, PAX-10) | yes |
| Passenger | Notifications | `Passenger/PassengerNotificationsScreen.tsx` | tab `Notifications` **and** stack `PassengerNotifications` | yes |
| Passenger | Chat list | `Passenger/chat/PassengerChatScreen.tsx` | tab `Chat` | yes |
| Passenger | Chat thread | `Passenger/chat/MessagesScreen.tsx` | stack `MessagesScreen` | yes |
| Passenger | Settings | `Passenger/PassengerSettingsScreen.tsx` | tab `Settings` | yes |
| Passenger | Profile | `Passenger/Passengerprofile.tsx` | stack `PassengerPofile` (typo) | yes |
| Passenger | Ride tracking | `Passenger/PassengerRideTrackingScreen.tsx` | stack `PassengerRideTracking` | **no** (nothing navigates; crashes on mount, PAX-06) |
| Passenger | Ride history | `Passenger/RideHistoryScreen.tsx` | stack `RideHistory` | yes |
| Passenger | Favourite locations | `Passenger/FavoriteLocationsScreen.tsx` | stack `FavoriteLocations` | yes |
| Passenger | Wallet | `Passenger/WalletScreen.tsx` | stack `Wallet` | yes |
| Driver | Home | `Driver/DriverHomeScreen.tsx` | tab `Home` | yes |
| Driver | Map / requests | `Driver/DriverMapScreen.tsx` | tab `Map` **and** stack `DriverMap` | yes |
| Driver | Notifications | `Driver/DriverNotificationsScreen.tsx` | tab `Notifications` | yes (static placeholder text) |
| Driver | Chat list | `Driver/DriverChatScreen.tsx` | tab `Chat` | yes |
| Driver | Chat thread | `Driver/DriverMessagesScreen.tsx` | stack `DriverMessagesScreen` | yes |
| Driver | Settings | `Driver/DriverSettingsScreen.tsx` | tab `Settings` | yes |
| Driver | Profile | `Driver/DriverProfile.tsx` | stack `DriverProfile` | yes |
| Driver | Active ride (stops, navigation) | `Driver/DriverRideScreen.tsx` | **not registered** (DRV-15) | **no** |
| Shared | Notification centre (old) | `screens/NotificationScreen.tsx` | **not registered**; broken imports (INF-29) | **no** |

**Totals:** 27 screens: auth 7, passenger 11, driver 8, shared 1. Unreachable: 7 (RoleSelection, BasicInfo, DriverRegistration, RideTracking, DriverRide, NotificationScreen, plus the duplicate stack mounts of PassengerMap, DriverMap and PassengerNotifications). Debug-only components that are not screens and are not mounted: `AppTestFlow`, `AuthDebug`, `FirebaseTest`, `GoogleMapsTest`, `RideServiceTest` (T-701).

**Screens a production ride-hailing app needs that don't exist:** driver earnings, driver ride history, ride details or receipt (both roles), help and support tickets, invite friends (referral code), account deletion (required by the App Store and Play policy), and a passenger "driver arriving / on trip" tracking view that works.

## Backend health (the server side of every flow)

| Area | Route | Status | Evidence | Notes |
|---|---|---|---|---|
| Pending rides for drivers | `GET /rides/pending` | BROKEN | `routes/api.php:62` registers `apiResource('rides')` before `rides/pending` (`:67`); the router resolves `/api/rides/pending` → `RidesController@show` (checked with `Router::match`) | Always a 404 model-binding miss. The same applies to `GET /rides/nearby-drivers`. FEAT-01 |
| Ride list scoping | `GET /rides` | BROKEN | `RidesController.php:26-30` filters on `$request->user()->role`; `User` has no `role` column or accessor (roles live in the `role_user` pivot) | Every user gets **every** ride. The history and active-ride restore depend on it. FEAT-02 (also flagged for rh-security) |
| Ride create | `POST /rides` | BROKEN | `RidesController.php:59` requires `passenger_id` from the client; the fare is invented server-side (`100 + 15/km`, `:96-104`) and doesn't match the app's estimate | The passenger must come from the token (was B-06). FEAT-02, FEAT-05 |
| Ride show/update/cancel/destroy | `GET/PUT/DELETE /rides/{id}`, `POST /rides/{id}/cancel` | BROKEN | `RidesController.php:52,159,212,284`: no ownership check; `update` lets the client set `status`, `driver_id` and `fare` | The driver flow uses the generic PUT for accept/start/complete. FEAT-03, FEAT-04 |
| Assign driver | `POST /rides/{id}/assign-driver` | BROKEN | `RidesController.php:226-286`: `driver_id` comes from the body; the check-then-update has no lock; returns 400, not 409; `vehicle_id` is never set | Two drivers can take one ride (was B-06). FEAT-03 |
| Ride lifecycle | arrived / start / complete | MISSING | No dedicated endpoints; `arrived` collapses to `accepted` in `Ride::getStatusForApi()` (`Ride.php:219-233`); nothing computes distance, duration, final fare, driver earnings or commission, and nothing updates `users.total_rides` | FEAT-04 |
| Fare estimate + vehicle catalogue | — | MISSING | No route. `app_settings` has a `fare` category, but the code never reads it | Was B-04. FEAT-05 |
| Driver online/offline | — | MISSING | No route. The app calls `POST /tracking/update-status` (`locationTrackingService.ts:346`), which doesn't exist | `DriverLocation.status` exists (`online/offline/busy/available`). Was B-04. FEAT-06 |
| Driver location | `POST /tracking/update-location`, `GET /tracking/driver/{id}/latest` | REAL (partial) | `DriverTrackingController.php:13-37` | No role check, and any user can read any driver's location. The app calls `/tracking/driver/{id}/location` (`rideService.ts:734`, `locationTrackingService.ts:230`), which doesn't exist. FEAT-06 |
| Rating | — | MISSING | No route; `rides` has no rating columns; `users.rating` is never written | Was B-04. FEAT-07 |
| Stats / earnings | — | MISSING | No passenger stats or driver earnings route | Was B-04. FEAT-08 |
| Wallet (own) | — | MISSING | `Wallet` model and table exist; the only routes are `payments/wallets/{wallet}/…` and `payments/transactions?user_id=`, which are admin-style and unscoped; no wallet is created on register | FEAT-09 (also flagged for rh-security) |
| Offers / banners | `GET /public/banners` | BROKEN | Local GET → **500** `Unknown column 'subtitle'`; `PublicController.php:30-34` selects `subtitle, image_path, link, sort_order`, but the table has `description, image_url, action_url, display_order` | FEAT-10 |
| Notifications list | `GET /notifications`, `/unread-count`, `/read`, `/read-all` | REAL (partial) | `NotificationController.php:131-196` | Admin broadcasts (`target_audience`, no `user_id`) never appear in a user's list. Push is a stub ("In a real implementation…", `:80`). There is no device-token table or route. FEAT-11 |
| Realtime | `POST /websocket/subscribe-*` | MISSING | `WebSocketController.php:59,144,168,181`: stub comments; returns a hardcoded `wss://raahehaq.com/ws/ride/{id}`; `BROADCAST_CONNECTION=log`; no Reverb or Pusher package in `composer.json` | FEAT-12 |
| In-ride chat | — | MISSING | No table, model or route | FEAT-13 |
| Saved places | — | MISSING | No table or route | FEAT-14 |
| Profile | `GET/PUT /profile`, `POST /profile/avatar`, `GET /auth/profile` | REAL (partial) | `ProfileController.php` | The app updates through `PUT /auth/profile` (`api.ts:489`), which doesn't exist. The profile has no vehicle, licence or document status for drivers, and no `rating`, `total_rides` or `created_at` in `UserResource`. There is no account deletion. FEAT-15 |
| OTP | `POST /auth/send-otp` | REAL (partial) | `AuthController.php:136` returns `otp_code` when `app.debug`; `SmsService.php:14-40` only logs (and logs the code) | Was B-01. FEAT-16 |
| Support tickets | `GET/POST /support/tickets`, reply | REAL | `SupportController.php:17-60` scopes to the user | The app has no screen for it. FEAT-17 |
| Referral code | `GET /referrals/code/mine` | BROKEN | `ReferralsController.php:104-108` writes `users.referral_code`, but that column doesn't exist and isn't fillable, so a new code is generated on every call | FEAT-17 |
| Public settings | `GET /settings/public` | REAL | Local GET returns `app_name`, `app_version`, `support_email`, `support_phone` | The app hardcodes support contact in `src/config/support.ts` instead. FEAT-17 |
| Backend tests | `php artisan test` | BROKEN | 33 of 35 tests fail: `phpunit.xml` uses in-memory SQLite, but migrations run MySQL-only `ALTER TABLE … MODIFY ENUM` (`2025_09_17_115753_update_rides_status_enum.php:16`, `2025_09_27_093000_add_motorcycle…:16`) | FEAT-19 → BE-00 (prerequisite for every BE task) |

## Auth

| Screen | Action / data | Status | Evidence | Backend route | Notes / task |
|---|---|---|---|---|---|
| Login | Email + password sign in | REAL | `LoginScreen.tsx:337` → `api.ts:203` | `POST /auth/login` | Validation/toast issues: T-008, T-204 |
| Login | Forgot password | REAL | `LoginScreen.tsx:126-160` | `POST /auth/forgot-password` | No reset-password screen in the app (the email link goes to the web) |
| Login | Continue with Google | MOCK | `LoginScreen.tsx:163-170` shows an "not available" toast | — | Remove: T-204 |
| Login | Phone sign-in / Create account | REAL | `LoginScreen.tsx:59,69` | — | Navigation only |
| Phone OTP | Send / resend code | REAL | `PhoneAuthScreen.tsx:80,163` | `POST /auth/send-otp` | SMS is a log stub server-side: FEAT-16 → BE-16 |
| Phone OTP | "Use This OTP" button, "Test Code: 123456" | MOCK | `PhoneAuthScreen.tsx:277-289` | — | T-101 |
| Phone OTP | Verify code | REAL | `PhoneAuthScreen.tsx:132` | `POST /auth/verify-otp` | |
| Registration wizard | Submit (passenger / driver with images) | REAL (partial) | `RegistrationScreen.tsx:339` → `api.ts:350` | `POST /auth/register` | Field validation and documents: T-201..T-203 |
| Role selection / Basic info / Driver registration (legacy) | Whole screens | BROKEN | `BasicInfoScreen.tsx:21,191` (Firestore `saveUserBasicInfo`); `DriverRegistrationScreen.tsx:166` (`driverRegistrationThunk`, Firebase) | — | Unreachable dead code: T-107 deletes them |
| Pending approval | Status text, "Check Status", Sign out | BROKEN | `DriverPendingApprovalScreen.tsx:17,26,43-44` reads `state.auth` (Firebase) and calls `signOutUser` | `GET /auth/profile` | T-106 |
| App bootstrap | Splash, session restore, logout cleanup | BROKEN | `AuthFlow.tsx`, `RootNavigation.tsx` (log the full user object on every render) | `GET /auth/profile` | T-102..T-105 |

## Passenger

| Screen | Action / data | Status | Evidence | Backend route | Notes / task |
|---|---|---|---|---|---|
| Home | Stats "24 rides / 4.8 / 156 km / Rs 1,240" with "+12%" changes | MOCK | `PassengerHomeScreen.tsx:269-274` | none (needs `GET /me/stats`) | FEAT-08 → BE-08, T-506 |
| Home | Special Offers (WELCOME20, "Dec 31, 2024") + "View All" | MOCK | `PassengerHomeScreen.tsx:252-267, 431, 442` | `GET /public/banners` (500) | FEAT-10 → BE-10, T-506 |
| Home | Recent Rides list (Iqbal Town → Liberty Market…) | MOCK | `PassengerHomeScreen.tsx:231-250` | `GET /rides` (unscoped, FEAT-02) | BE-01, T-506 |
| Home | "Recent Activity" (Ride to Airport $24.50, Rated Driver 5.0) | MOCK | `PassengerHomeScreen.tsx:516-600` | — | Remove or derive from rides: T-506 |
| Home | Weather "28°C Sunny" | MOCK | `PassengerHomeScreen.tsx:37` | — | Remove (no weather source; not a product need): T-506 |
| Home | Notification badge fixed at 2 | MOCK | `PassengerHomeScreen.tsx:38, 328-331` | `GET /notifications/unread-count` | T-506 (after T-502) |
| Home | Greeting, user name, "Active User" badge | REAL | `PassengerHomeScreen.tsx:33, 375-386` | `GET /auth/profile` (stored user) | |
| Home | Current address | REAL | `PassengerHomeScreen.tsx:106-139` → `placesService.reverseGeocode` | Google Geocoding (client key) | Key and Nominatim issues: T-109, T-303 |
| Home | Pull to refresh | BROKEN | `PassengerHomeScreen.tsx:143-152` dispatches the Firebase `refreshSessionThunk` (`authThunks.ts:304-318`), which returns early for REST users | `GET /auth/profile` | T-506 |
| Home | Quick actions: Book, History, Favourites, Wallet | REAL (nav) | `PassengerHomeScreen.tsx:167-209` | — | Targets are mock: see rows below |
| Home | Quick action "Schedule Ride" | MOCK | `PassengerHomeScreen.tsx:218` "coming soon" Alert | none (`rides.ride_type`/`scheduled_time` columns exist, no API) | Hidden until the owner wants scheduled rides: T-506 |
| Home | Quick action "Support" | MOCK | `PassengerHomeScreen.tsx:227`: Alert with the email from `config/support.ts` | `GET /settings/public` has `support_email`/`support_phone` | T-511 |
| Home | Account → Edit Profile / Settings | MISSING | `PassengerHomeScreen.tsx:621, 645` `console.log` only | — | T-506 |
| Home | Account → Sign Out | REAL (partial) | `PassengerHomeScreen.tsx:669` `useApiAuth().logout` | `POST /auth/logout` | Unified logout: T-102 |
| Map | Pickup/destination search, route polyline | REAL (partial) | `PassengerMapScreen.tsx:706-725`, `LocationSearch.tsx` | Google Places/Directions (client) | T-303, T-109 |
| Map | Vehicle options with invented ETA "5/7/8/10 min" and prices = fare × 0.6/1/1.4/2 | MOCK | `PassengerMapScreen.tsx:753-756` | none (needs vehicle catalogue + estimate) | FEAT-05 → BE-05, T-310 |
| Map | Fare estimate / breakdown | MOCK | `useFare` → `rideService.calculateFare` (`rideService.ts:588`) | none | T-306 + BE-05 |
| Map | Request ride | BROKEN | `PassengerMapScreen.tsx:52, 327, 457-465`: passenger 11, placeholder addresses, stops dropped; `economy/comfort/premium` → `car` with an unknown `service_level` | `POST /rides` | T-302 + BE-01 |
| Map | Waiting → driver assigned → on trip → completed | BROKEN | PAX-05, PAX-12 (`DriverAssignedCard.tsx:13` ETA default "5 min") | `GET /rides/{id}` polling; realtime MISSING | T-304, T-307 + BE-04, BE-12 |
| Map | Cancel | REAL (partial) | `rideService.ts:383` | `POST /rides/{id}/cancel` | T-305 + BE-01 (ownership) |
| Map | Call / Message driver on the assigned card | MISSING | `DriverAssignedCard.tsx:21-22` handlers not wired (PAX-12) | chat MISSING | T-307 (call), T-510 (message) |
| Ride tracking | Whole screen | BROKEN | `PassengerRideTrackingScreen.tsx:4,8`: imports `rateRide` and `listenToActiveRide`, which don't exist | — | T-307, T-505 + BE-07 |
| Ride history | List | MOCK | `RideHistoryScreen.tsx:16-20` `SAMPLE_RIDES`; no loading, error or empty state | `GET /rides` (unscoped) | T-501 + BE-01 |
| Ride history | "Details" button | MISSING | `RideHistoryScreen.tsx:44-47` no `onPress`; no ride-details screen | `GET /rides/{id}` | T-501 (details/receipt) |
| Favourites | Saved places list (Home/Work seed) | MOCK | `FavoriteLocationsScreen.tsx:13-16`; local state only, lost on close | none | FEAT-14 → BE-14, T-509 |
| Favourites | Add (free text, no geocode) / Remove | MOCK | `FavoriteLocationsScreen.tsx:20-33` | none | T-509 |
| Favourites | Edit / Set Pickup | MISSING | `FavoriteLocationsScreen.tsx:53-60` no `onPress` | — | T-509 |
| Wallet | Balance Rs 1200 | MOCK | `WalletScreen.tsx:22` | none (needs `GET /wallet`) | FEAT-09 → BE-09, T-508 |
| Wallet | "Add Funds" adds Rs 500 locally | MOCK | `WalletScreen.tsx:23, 55-58` | — | Cash-only: remove. T-508 |
| Wallet | "Payment Methods" / "View all" | MISSING | `WalletScreen.tsx:59-70` no `onPress` | — | Cash-only: remove Payment Methods; View all → paginated history. T-508 |
| Wallet | Transactions list | MOCK | `WalletScreen.tsx:14-18` | none (needs `GET /wallet/transactions`) | T-508 |
| Notifications | List, filters, mark read, mark all read | MOCK | `PassengerNotificationsScreen.tsx:19-24` local array; `markAllAsRead`/`toggleRead` local only | `GET /notifications`, `POST …/read`, `…/read-all` exist | T-502 + BE-11 |
| Chat list | Conversations (Ahmed Khan, Muhammad Hassan…) | MOCK | `PassengerChatScreen.tsx:32-75` `dummyChats` | none | FEAT-13 → BE-13, T-510 |
| Chat thread | Messages ("React Native" bot), send, call button | MOCK | `MessagesScreen.tsx:44-60` seeded GiftedChat; send appends locally (`:130`); call button has no `onPress` (`:183`) | none | T-510 |
| Settings | Push / Ride updates / Promotional toggles | MOCK | `PassengerSettingsScreen.tsx:29-31, 177-191` local state | none | T-511 + BE-11 (preferences) |
| Settings | Pull to refresh | MOCK | `PassengerSettingsScreen.tsx:38-46` only logs | `GET /auth/profile` | T-511 |
| Settings | Help & Support / Invite Friends | MISSING | `PassengerSettingsScreen.tsx:199-210` no `onPress` | `/support/tickets` REAL; `/referrals/code/mine` BROKEN | T-511 + BE-17 |
| Settings | Wallet / History / Favourites / Notifications / Profile rows | REAL (nav) | `PassengerSettingsScreen.tsx:132-160` | — | |
| Settings | Logout | REAL (partial) | `PassengerSettingsScreen.tsx:49-57` | `POST /auth/logout` | T-102 |
| Settings | Delete account | MISSING | not present | none | Store requirement: BE-15, T-511 |
| Profile | Name, email, phone, address, role, verified badge | REAL | `Passengerprofile.tsx:150-245` | `GET /auth/profile` (stored) | |
| Profile | Stats "4.8 rating / 24 rides / 2y member" | MOCK | `Passengerprofile.tsx:188, 199, ~210` | none (`UserResource` lacks `rating`, `total_rides`, `created_at` exposure in the profile) | T-504 + BE-08, BE-15 |
| Profile | Change photo | MOCK | `Passengerprofile.tsx:26, 54-70`: picked image kept in local state, never uploaded | `POST /profile/avatar` exists | T-504 |
| Profile | Edit fields | BROKEN | no edit UI; the thunk calls `PUT /auth/profile` (`api.ts:489`), which doesn't exist | `PUT /profile` exists | T-504 |

## Driver

| Screen | Action / data | Status | Evidence | Backend route | Notes / task |
|---|---|---|---|---|---|
| Home | Stats "156 rides / 4.9 / PKR 24k / 8.5h" | MOCK | `DriverHomeScreen.tsx:81-110` | none | FEAT-08 → BE-08, T-507 |
| Home | Recent rides (Sarah Ahmed… `$25.50`) | MOCK | `DriverHomeScreen.tsx:134-162` (dollar signs) | `GET /rides` (unscoped) | BE-01, T-507 |
| Home | Go Online / Offline | MOCK | `DriverHomeScreen.tsx:47-53` local `isOnline` only | none | T-401 + BE-06 |
| Home | Earnings / Ride History quick actions | MISSING | `DriverHomeScreen.tsx:61, 69` `console.log` | none | T-507 (earnings screen) + T-501 (driver history) |
| Home | Vehicle label | REAL (partial) | `DriverHomeScreen.tsx:113-122` reads `user.vehicle_type`/`user.vehicleInfo`; `vehicleInfo` is never returned by the API | profile lacks the vehicle | BE-15, T-507 |
| Home | Sign out | BROKEN | `DriverHomeScreen.tsx:387` `signOutThunk` (Firebase) | — | T-102 |
| Map | Online toggle, location upload, incoming request, accept, start, complete, reject | BROKEN | DRV-01..DRV-05, DRV-14, DRV-16 (`DriverMapScreen.tsx:138, 148, 196, 232, 337`) | `/rides/pending` shadowed (FEAT-01); accept unsafe (FEAT-03); lifecycle missing (FEAT-04) | T-401..T-405 + BE-02..BE-04, BE-06 |
| Map | Fare shown "₨ 150" fallback | MOCK | `DriverMapScreen.tsx:349` | `RideResource.total_fare` | T-405 |
| Active ride | Stops, next stop, complete stop | BROKEN | `DriverRideScreen.tsx` unregistered (DRV-15) | `/rides/{id}/stops/{stop}/complete`, `/navigate-next-stop` exist | T-405 |
| Notifications | Tab content | MISSING | `DriverNotificationsScreen.tsx:1-35` static "will be displayed here" | `GET /notifications` exists | T-502 (both roles) + BE-11 |
| Chat list | Conversations (Sarah Ahmed, Ali Hassan…) | MOCK | `DriverChatScreen.tsx:32-85` `dummyChats` | none | T-510 + BE-13 |
| Chat thread | Messages, send | MOCK | `DriverMessagesScreen.tsx:37-91` `dummyMessages`, local append | none | T-510 |
| Settings | Edit Profile / Notifications / Privacy / Help rows | MISSING | `DriverSettingsScreen.tsx:106, 120, 134, 148` `console.log` | — | T-511 |
| Settings | Logout | REAL (partial) | `DriverSettingsScreen.tsx:162` | `POST /auth/logout` | T-102 |
| Profile | Name, email, phone | REAL | `DriverProfile.tsx` | `GET /auth/profile` | |
| Profile | Stats "4.9 / 156 / $2.4k" | MOCK | `DriverProfile.tsx:190, 201, 212` | none | T-507 + BE-08 |
| Profile | Vehicle "Toyota Corolla 2020", licence "DL-123456789" | MOCK | `DriverProfile.tsx:295, 316` | `vehicles` table exists; not exposed to the driver | T-507 + BE-15 |
| Profile | Preferences: Ride Notifications, Sound Alerts, Auto Accept | MOCK | `DriverProfile.tsx:339-373` static Views, not switches | none | T-511 + BE-11 (prefs). Auto Accept: remove (not a product decision on record) |
| Profile | Help & Support / Share App / Driver Settings / Delete Account | MISSING | `DriverProfile.tsx:395-450` no `onPress` | support REAL, referral BROKEN, deletion MISSING | T-511 + BE-15, BE-17 |
| Profile | Change photo | MOCK | `DriverProfile.tsx:26, 54-70` never uploaded | `POST /profile/avatar` | T-504 |

## Shared / infrastructure

| Item | Status | Evidence | Notes / task |
|---|---|---|---|
| Realtime client | BROKEN | `webSocketService.ts:51, 117, 282` raw `fetch` + placeholder token to stub endpoints | Retarget T-406 to Reverb (Pusher protocol via `laravel-echo` + `pusher-js`) after BE-12 |
| Push notifications (FCM) | MISSING | `notificationService.ts` raw `fetch`; no token registration; backend push is a stub | T-502 + BE-11 |
| Notification service | BROKEN | `notificationService.ts:37, 83, 114, 146` raw `fetch` with its own token lookup | T-007 |
| Payment service | MOCK | `paymentService.ts` Firestore/mock, imported nowhere | Delete in T-508 (cash only) |
| User service | MOCK | `userService.ts` Firestore-based | T-107 |
| Loading / error / empty states | MISSING | RideHistory, Wallet, Favourites, Notifications, Chat and Driver Home have none (all static data) | Each Phase 5 task below requires all three |
| Logout cleanup | BROKEN | Three different sign-out paths (`useApiAuth().logout`, `signOutThunk`, `signOutUser`) | T-102 |

## Summary

| Status | Count |
|---|---|
| REAL (incl. partial and nav-only) | 24 |
| MOCK | 37 |
| BROKEN | 22 |
| MISSING | 22 |
| **Total rows** | **105** |

(Counted over every row of the backend, auth, passenger, driver and shared tables above.)

**Bottom line:**
- Sign-in, registration submit, OTP, cancel, profile read and the notifications API are real.
- Every number a user sees on Home, Profile, Wallet, History, Notifications and Chat, in both roles, is invented.
- The core ride loop can't work even after the planned app fixes, because the backend:
  - never shows pending rides to drivers (route shadowing)
  - returns every user's rides to everyone
  - trusts the client for the passenger, the driver and the fare
  - has no lifecycle, fare, rating, earnings, wallet, chat, saved-places, device-token or realtime endpoints

## Findings

### FEAT-01 · P0 · backend: `/rides/pending` and `/rides/nearby-drivers` are unreachable
`routes/api.php:62,67-68`. `apiResource('rides')` registers `rides/{ride}` first, so both paths resolve to `RidesController@show` and return 404. `getPendingRides` also requires `driver_id` from the client and filters on `vehicle_type ?? 'car'` instead of the driver's own vehicle. → **BE-02**.

### FEAT-02 · P0 · backend: rides are not scoped to the caller
`RidesController.php:26-30` reads `$user->role`, which is always null (roles are a pivot), so `GET /rides` returns all rides. `store` takes `passenger_id` from the body. `show`, `update`, `cancel` and `destroy` have no ownership check. → **BE-01** (supersedes the "passenger from token" part of B-06).

### FEAT-03 · P0 · backend: assign-driver is not atomic and trusts the body
`RidesController.php:212-286`. `driver_id` comes from the request, there is no row lock or conditional update, the conflict code is 400 (not 409), there is no driver-role or approval check, and `vehicle_id` is never stored. → **BE-03** (supersedes B-06 "atomic assign-driver").

### FEAT-04 · P1 · backend: no ride lifecycle endpoints; the client sets status and fare
- There is no arrived, start, complete or driver-cancel endpoint.
- `PUT /rides/{id}` accepts `status`, `driver_id` and `fare` from any user.
- `arrived` is hidden from the API.
- Completion computes nothing: distance, duration, final fare, driver earnings, commission, the cash payment record and `total_rides` are all left alone.

→ **BE-04**.

### FEAT-05 · P1 · fare estimate and vehicle catalogue are invented on both sides
- **App:** ETAs and prices are hardcoded multipliers (`PassengerMapScreen.tsx:753-756`).
- **Server:** the fare is `100 + 15/km` (`RidesController.php:96-104`) and ignores `app_settings` (category `fare`).
- The vehicle list differs: the app offers bike/economy/comfort/premium/van, while the server accepts car, bike, rickshaw and van (the DB also has motorcycle).

→ **BE-05**, **T-310** (plus the existing T-306).

### FEAT-06 · P1 · driver online/offline and location have no proper API
- There is no status endpoint; the app calls `/tracking/update-status` (missing) and `/tracking/driver/{id}/location` (missing; the server has `/latest`).
- `update-location` has no driver-role check, and every call inserts a new row with no pruning.

→ **BE-06** (supersedes B-04 "driver status").

### FEAT-07 · P1 · rating doesn't exist server-side
There are no columns, no route, and nothing recomputes `users.rating`. → **BE-07** (supersedes B-04 "rating").

### FEAT-08 · P1 · stats and earnings: Home and Profile numbers, both roles
There is no endpoint for passenger stats (rides, distance, spent, rating, member since) or driver stats and earnings (today/week/month, rides, rating, online time). → **BE-08**, **T-506**, **T-507** (supersedes B-04 "history, earnings"; history itself is `GET /rides` once BE-01 lands).

### FEAT-09 · P1 · wallet (cash only) has no "my wallet" API; the app shows a fake balance and a fake top-up
→ **BE-09**, **T-508**.

### FEAT-10 · P1 · banners endpoint returns 500; Home offers are hardcoded
`PublicController.php:30-34` selects columns that don't exist (confirmed with a local GET). There is also no date-window, audience or position filter. → **BE-10**, **T-506**.

### FEAT-11 · P1 · notifications: no device tokens, stub push, no preferences, broadcasts invisible
`NotificationController.php:78-90`. There is no `user_devices` table or route. Admin broadcasts have no `user_id`, so they never reach the user list. The app's toggles are local. The driver tab is a placeholder. → **BE-11** (plus the existing T-502, extended to both roles), **T-511** (preferences UI).

### FEAT-12 · P1 · no WebSocket server
`WebSocketController.php` is a stub; `BROADCAST_CONNECTION=log`; no Reverb package. → **BE-12** (Laravel Reverb, private channels, Sanctum broadcast auth). The app's T-406 is retargeted to the Reverb/Pusher protocol.

### FEAT-13 · P1 · in-ride chat is fake on both sides
There are demo threads in four screens and no backend. → **BE-13**, **T-510**.

### FEAT-14 · P2 · saved places are local only
→ **BE-14**, **T-509**.

### FEAT-15 · P1 · profile gaps: driver vehicle/licence, stats exposure, wrong update URL, no account deletion
- The app updates through `PUT /auth/profile`, which is missing.
- Drivers can't see their vehicle, licence or documents.
- There is no `DELETE /profile`, which App Store guideline 5.1.1(v) and Google Play require.

→ **BE-15** (plus the existing T-504, and T-507 / T-511).

### FEAT-16 · P1 · OTP: SMS is a log stub, and the code is logged
`SmsService.php:14-40` logs the full message, including the code. `otp_code` comes back whenever `APP_DEBUG=true`. → **BE-16** (supersedes B-01's code part). The SMS gateway account and credentials are still the owner's job.

### FEAT-17 · P2 · support, invite and app-info screens are missing in the app; the referral code is broken server-side
The support tickets API is real and scoped. `GET /referrals/code/mine` writes a column that doesn't exist. Support contact is hardcoded in `src/config/support.ts`, although `GET /settings/public` serves it. → **BE-17**, **T-511**.

### FEAT-18 · P2 · Home and Profile leftovers with no data source
- Weather, the "Recent Activity" block, the "Schedule Ride" quick action and the `console.log` account rows.
- Pull to refresh uses the Firebase session.

→ **T-506** (remove weather; derive activity from rides or drop it; hide Schedule Ride; wire the rows; refresh calls `GET /auth/profile`).

### FEAT-19 · P1 · backend: the test suite can't run
`php artisan test` → 33 failed, 2 passed. The MySQL-only enum migrations break on the SQLite test DB. No BE task can prove itself until this is fixed. → **BE-00**.
