# Architecture: Current vs Target

## Current (as audited, 2026-10-03)

```
App.tsx
 └ ReduxProvider (PersistGate) → ThemeProvider → NotificationManager → NavigationContainer
    └ AuthFlow (reads apiAuth)
       ├ AuthStack ......... Login, PhoneAuth, Signup→RegistrationScreen (4 steps), + unreachable Firebase screens
       ├ DriverPendingApprovalScreen (any non-active user)
       └ RootNavigation (by user.role)
          ├ DriverStack → DriverBottomTabs (Home, Map, Messages, Notifications, Profile)
          └ PassengerStack → PassengerBottomTabs (Home, Map, …) + PassengerMap (mounted twice)

src/services   api.ts (axios + 11 hardcoded URLs elsewhere via fetch), rideService, webSocketService,
               locationTrackingService, notificationService, firebaseAuth, auth, userService, bidService, …
src/store      auth (Firebase) + apiAuth (Laravel), both named 'auth'; user, trip, ride (unused)
src/hooks      useRide (828 lines, passenger + driver), useFare, useDirections, …
```

What is wrong with this structure:
- **Two auth systems.** Firebase and Laravel both hold login state, and the Redux slices collide.
- **Mixed networking.** Services mix `fetch` and axios, with no environments and no typed responses.
- **Screen-local state.** Ride state lives inside screens, so it is lost when switching tabs or restarting.
- **Broken realtime.** The socket token is a placeholder, it reconnects as a zombie, and push notifications are absent.
- **Oversized files.** God-screens run over 1000 lines, with an ignored theme and 878 hex colours.
- **No safety net.** There are no tests, no CI, and the release bundle doesn't build.

## Target

Pragmatic for an RN 0.80 bare app. Reuse what is installed. Add as few dependencies as possible.

### Folder structure (feature-based, migrated incrementally)

```
src/
  app/          App.tsx, providers/, navigation/ (typed param lists)
  config/       env.ts            ← only place that reads env (react-native-config)
  core/
    api/        client.ts (axios), errors.ts (ApiError), types.ts (ApiResponse<T>), endpoints/*
    auth/       session.ts (token in Keychain), bootstrap.ts, logout.ts
    realtime/   socket.ts (one connection manager)
    location/   useLocationWatcher.ts, driverTracker.ts
    push/       fcm.ts
    logging/    logger.ts (redacting; only `error` prints in release)
  features/
    auth/  onboarding/  ride-request/  ride-tracking/  driver-dispatch/  driver-ride/
    history/  notifications/  profile/  wallet/ (later)  chat/ (later)
      each: api.ts, slice.ts or queries, hooks.ts, screens/, components/, __tests__/
  ui/           tokens.ts, Screen, Header, Text, Button, Input, Card, Sheet, Toast, EmptyState, ErrorState
```

Migration rule: **move code into this structure when a task touches it.** No big-bang move.

### Key decisions

| Concern | Decision | Why |
|---|---|---|
| Environments | `react-native-config` with `.env.development`, `.env.production` (staging later); `src/config/env.ts` validates them | One place for the API URL, WS URL and keys; QA can switch servers later |
| HTTP | A single axios client; every service uses it; `ApiResponse<T>` unwrapping in one helper | Fixes the double unwrap (DRV-02), placeholder tokens (DRV-06) and hardcoded URLs (INF-16) |
| Errors | `ApiError { kind: network\|timeout\|auth\|validation\|server, status, message, fieldErrors }` | One way to show errors; field errors map to form inputs (AUTH-10) |
| Server state | **RTK Query** (already in `@reduxjs/toolkit`) for rides, history, notifications | Caching, polling with auto-stop, abort on unmount; no new library |
| Client/session state | Redux slices: `session`, `activeRide`, `driverStatus`, `settings`; persist only `settings` + non-sensitive session bits | A single source of truth |
| Token | `react-native-keychain`; never in redux-persist or plain AsyncStorage | INF-20 |
| Auth | Laravel API only. Firebase is kept only for FCM. `bootstrap()` → splash → route. One `logout()` | AUTH-04/09/15/16 |
| 401 handling | Single-flight refresh (`/auth/refresh` with Bearer) and a request queue; on failure `logout()` | AUTH-05, INF-07 |
| Ride lifecycle | An explicit state machine: `idle → selecting → quoting → requesting → accepted → arrived → ongoing → completed/cancelled`, driven by the server status | PAX-05, DRV-14 |
| Realtime | One socket manager: token auth, subscribe frames, capped backoff with jitter, AppState/NetInfo aware, `dispose()`. Polling via RTK Query as a fallback | DRV-07, INF-12 |
| Driver location | `@react-native-community/geolocation` `watchPosition` with `distanceFilter`; send on movement or every N s; stop when offline. Background mode only after a product decision | DRV-03/09/10/11 |
| Maps REST | Directions and Places through a backend proxy (owner task); until then a restricted key from env, never logged | PAX-01, INF-06 |
| Push | RNFirebase Messaging: register the token with the backend, refresh, foreground/background handlers, deep link to the ride | INF-14 |
| UI | `ui/tokens.ts` (colour roles incl. error/warning/success, spacing, radius, type scale); `useColorScheme` with a persisted override; `react-native-safe-area-context` everywhere; lint rule `react-native/no-color-literals` | INF-24, PAX-21, DRV-21 |
| Feedback | One toast host (NotificationManager/ModernToast) mounted once, plus `useToast()` | INF-15, INF-22, PAX-16 |
| Crashes | A root ErrorBoundary, plus Crashlytics (RNFirebase) in release | INF-23 |
| Logging | `src/core/logging/logger.ts` is the only console user (ESLint `no-console: error` in `src/`). Every argument is redacted by key (password, token, otp, cnic, phone, email, account, bank, address, licence, plate, uid, api key, fcm …) and `key=`/`token=` query values in strings are masked. `debug`/`info`/`warn` are silent in release; `error` always prints, with a stricter set that also redacts names and coordinates. No `transform-remove-console`: it would also strip `error`, which crash reporting (T-606) needs | AUTH-03, INF-33 |
| Tests | Jest + React Native Testing Library + native mocks; `axios-mock-adapter` for API contracts; **Maestro** for E2E flows | INF-28 |
| CI | GitHub Actions: `yarn verify` and a release bundle for both platforms on every PR | INF-29 |

### Navigation (target)

```
Root
 ├ Splash (until bootstrap done)
 ├ Auth: Welcome → Login | PhoneOtp → RoleChoice → PassengerSignup(2 steps) | DriverSignup(4 steps)
 ├ AccountStatus (pending | suspended | rejected; refresh + logout)
 ├ Passenger: Tabs(Home, Rides, Notifications, Profile) + Booking flow (one map route) + RideTracking + Rating
 └ Driver: Tabs(Home/Dispatch map, Rides, Notifications, Profile) + DriverRide (pickup → stops → complete)
```

### Data contract notes (verify against the live backend before coding)

- Response envelope: `{ success, message, data, errors? }`. `apiService.get()` already returns this body, so services return `body.data`.
- User: normalise `role` from `role ?? user_type ?? roles[0]`, and `status` from `status`.
- Ride statuses (API): `requested | accepted | ongoing | completed | cancelled`. Map them in one place.
- Endpoints the client currently calls but the docs don't list are tracked in DRV-24. Confirm each before relying on it.
