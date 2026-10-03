# Task Tracker

**How to read this file:**
- **Status** lives in the summary table only. The task sections below hold scope and acceptance criteria.
- **Status values:** `todo` · `in-progress` · `blocked` · `verified-no-qa` · `done`
- **Owner:** `agent` (handled by `/fix-next`) or `owner` (the human; agents skip these).
- **QA:** `yes` means rh-qa must exercise it in the simulator. The scenario IDs refer to [QA_SCENARIOS.md](QA_SCENARIOS.md).
- **Updates:** `/fix-next` updates the summary table and adds the commit hash in Notes. New bugs found during work are appended as new rows (next free ID in that phase).

## Summary

| ID | Phase | Title | Depends | QA | Owner | Status | Notes |
|---|---|---|---|---|---|---|---|
| T-001 | 0 | Fix release-bundle blockers + add bundle check to gate | | yes | agent | todo | logo rename + useErrorHandler import done early (iOS build fix commit); NotificationScreen + gate bundle check remain |
| T-002 | 0 | Make Jest work (setup, native mocks, App smoke test) | | no | agent | todo | |
| T-003 | 0 | Babel: worklets plugin + strip console in release | T-002 | yes | agent | todo | |
| T-004 | 0 | Repo hygiene: stale bundle, lockfile, Podfile node path | | yes | agent | todo | Podfile NODE_BINARY removed early (iOS build fix commit) |
| T-005 | 0 | Env config: single source for API/WS URLs and keys | T-002 | yes | agent | todo | |
| T-006 | 0 | Redacting logger; remove credential/PII logs | T-002 | no | agent | todo | |
| T-007 | 0 | Typed API layer: ApiResponse/ApiError, fix double unwrap, route all calls through axios | T-005 | no | agent | todo | |
| T-008 | 0 | One working toast system | T-002 | yes | agent | todo | |
| T-101 | 1 | Stop displaying/persisting OTP | T-007 | yes | agent | todo | Backend part = B-01 |
| T-102 | 1 | Single logout thunk used everywhere | T-007 | yes | agent | todo | |
| T-103 | 1 | Auth bootstrap: splash, offline-tolerant init | T-102 | yes | agent | todo | |
| T-104 | 1 | Token in Keychain + single-flight 401 handling | T-103 | yes | agent | todo | |
| T-105 | 1 | normalizeUser + role/status routing | T-103 | yes | agent | todo | Confirm with B-03 |
| T-106 | 1 | Account-status screen (pending/suspended) rebuilt | T-105 | yes | agent | todo | |
| T-107 | 1 | Remove Firebase auth path; fix slices & persist config | T-106 | yes | agent | todo | |
| T-108 | 1 | Android release hardening in code (signing from env, no cleartext) + iOS plist cleanup | T-004 | no | agent | todo | Keystore = B-05 |
| T-109 | 1 | Maps keys from build config; never logged | T-005 | yes | agent | todo | Rotation = B-02 |
| T-201 | 2 | Registration: per-step schema validation | T-107 | yes | agent | todo | |
| T-202 | 2 | Registration: server field errors on every input | T-201 | yes | agent | todo | |
| T-203 | 2 | Driver documents + license number actually uploaded | T-202 | yes | agent | todo | Needs B-03 |
| T-204 | 2 | Auth screens: keyboard, safe area, remove dead Google button | T-201 | yes | agent | todo | |
| T-301 | 3 | Active ride in Redux; single booking route; restore on launch | T-107 | yes | agent | todo | |
| T-302 | 3 | Correct ride payload builder (real user, addresses, vehicle, stops) | T-301 | yes | agent | todo | |
| T-303 | 3 | Location search: debounce, session token, PK bias, keep address | T-109 | yes | agent | todo | |
| T-304 | 3 | Ride status state machine; polling lifecycle; map-tap mode | T-302 | yes | agent | todo | |
| T-305 | 3 | Request safety: double-tap guard, cancel during create, per-request abort | T-304 | yes | agent | todo | |
| T-306 | 3 | Fare from server | T-302 | yes | agent | todo | Needs B-04 |
| T-307 | 3 | Driver-assigned card + passenger tracking screen | T-304 | yes | agent | todo | |
| T-308 | 3 | Location permission UX + shared location watcher | T-301 | yes | agent | todo | |
| T-309 | 3 | Remove crashing Advanced panel + passenger dead duplicates | T-302 | yes | agent | todo | |
| T-401 | 4 | Driver online/offline in Redux backed by API | T-107 | yes | agent | todo | Needs B-04 |
| T-402 | 4 | Driver location tracker rewrite | T-308, T-401 | yes | agent | todo | |
| T-403 | 4 | Incoming ride requests (poll /rides/pending) | T-402 | yes | agent | todo | |
| T-404 | 4 | Accept via assign-driver (409) + reject | T-403 | yes | agent | todo | Needs B-06 |
| T-405 | 4 | Driver ride screen routed: pickup → start → stops → complete | T-404 | yes | agent | todo | |
| T-406 | 4 | WebSocket manager rewrite | T-007 | no | agent | todo | Auth needs B-06 |
| T-407 | 4 | Background driver location | T-402 | yes | agent | todo | Needs B-08 decision |
| T-501 | 5 | Ride history (passenger + driver) from API | T-305, T-405 | yes | agent | todo | |
| T-502 | 5 | Notifications from API + FCM token registration | T-107 | yes | agent | todo | |
| T-503 | 5 | Remove fake data; hide unbuilt features | T-501 | yes | agent | todo | |
| T-504 | 5 | Profile: real fields + photo upload | T-503 | yes | agent | todo | |
| T-505 | 5 | Rating after ride | T-307 | yes | agent | todo | Needs B-04 |
| T-601 | 6 | Theme tokens complete; useColorScheme; persisted choice | T-008 | yes | agent | todo | |
| T-602 | 6 | UI kit (Screen, Header, Button, Input, Card, states) | T-601 | yes | agent | todo | |
| T-603 | 6 | Migrate auth screens to UI kit | T-602, T-204 | yes | agent | todo | |
| T-604 | 6 | Passenger screens: split + migrate | T-602, T-309 | yes | agent | todo | |
| T-605 | 6 | Driver screens: split + migrate | T-602, T-405 | yes | agent | todo | |
| T-606 | 6 | Root ErrorBoundary + crash reporting | T-006 | no | agent | todo | |
| T-701 | 7 | Delete dead code + unused dependencies | T-605 | yes | agent | todo | |
| T-702 | 7 | TypeScript + ESLint to zero; gate requires zero | T-701 | no | agent | todo | |
| T-703 | 7 | Maestro E2E flows for QA scenarios | T-405 | no | agent | todo | |
| T-704 | 7 | CI (GitHub Actions) | T-702 | no | agent | todo | |
| T-705 | 7 | Android R8 + versioning; final iOS config | T-108 | yes | agent | todo | Needs B-05 |
| T-706 | 7 | README + docs rewrite | T-704 | no | agent | todo | |
| B-01 | – | Backend: stop returning otp_code; real SMS | | | owner | todo | |
| B-02 | – | Rotate + restrict Google Maps keys | | | owner | todo | |
| B-03 | – | Confirm auth `role` field + registration/document contract | | | owner | todo | |
| B-04 | – | Endpoints: fare estimate, driver status, pending rides, rating, history, earnings | | | owner | todo | |
| B-05 | – | Signing: Android upload keystore, Apple certs | | | owner | todo | |
| B-06 | – | Backend: passenger from token, atomic assign-driver, WS auth | | | owner | todo | |
| B-07 | – | Test accounts + safe test location in QA_SCENARIOS.md | | | owner | todo | **Needed before any QA** |
| B-08 | – | Product decisions: background location, chat, wallet | | | owner | todo | |

---

## Phase 0: Foundation

### T-001 · Fix release-bundle blockers + add bundle check to gate
- **Findings:** INF-01, INF-02, INF-29 (NotificationScreen import paths)
- **Files:** the 7 `require('../../assets/images/logo.png')` sites, `src/assets/images/Logo.png`, `src/hooks/useErrorHandler.ts`, `src/screens/NotificationScreen.tsx`, `scripts/quality-gate.js`
- **Acceptance:**
  - [ ] `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/rh.android.js` succeeds; the same for `--platform ios`.
  - [ ] The image is renamed with `git mv` (case-only rename done in two steps on macOS) so that git tracks `logo.png`.
  - [ ] `useErrorHandler` imports an existing module.
  - [ ] `NotificationScreen.tsx` imports resolve (or the file is deleted if grep proves it unused; INF-34 says it is unused).
  - [ ] `scripts/quality-gate.js` gains a `bundle` check (both platforms; output to a temp dir) recorded in the baseline as `bundleOk`; once true it must stay true.
- **QA:** SMOKE-01

### T-002 · Make Jest work
- **Findings:** INF-28
- **Files:** `jest.config.js`, new `jest.setup.js`, `__tests__/App.test.tsx`, `package.json` (devDeps: `@testing-library/react-native`)
- **Acceptance:**
  - [ ] `transformIgnorePatterns` covers `react-native|@react-native|@react-navigation|@react-native-firebase|react-native-.*`.
  - [ ] Mocks exist for: reanimated/worklets, AsyncStorage (official mock), RNFirebase (app, auth, firestore, messaging, storage), react-native-maps, geolocation, google-signin, vector-icons, image-picker, linear-gradient, gesture-handler, safe-area-context, toast-message.
  - [ ] The App smoke test renders without throwing.
  - [ ] One real unit test on a reducer (e.g. `apiAuthSlice`) proves the infra works for logic tests.
  - [ ] `yarn test` passes; the baseline `jestPassing` becomes true.

### T-003 · Babel: worklets plugin + strip console in release
- **Findings:** INF-30, INF-33 (release part), AUTH-03 (release part)
- **Acceptance:**
  - [ ] `react-native-worklets/plugin` is last in plugins; no Reanimated deprecation warning on bundle.
  - [ ] `babel-plugin-transform-remove-console` is enabled only for production builds (keep `console.error`).
  - [ ] The app still launches in debug (QA SMOKE-01) and animations work.

### T-004 · Repo hygiene
- **Findings:** INF-27, INF-31 (lockfile), INF-32
- **Acceptance:**
  - [ ] `android/app/src/main/assets/index.android.bundle` is removed from git and ignored.
  - [ ] `package-lock.json` is removed; the README/CLAUDE says yarn only.
  - [ ] Podfile no longer hardcodes `NODE_BINARY`; `ios/.xcode.env` handles it; `pod install` still works.
  - [ ] An Android debug build still runs with Metro (QA, if an Android emulator is available; otherwise note it).

### T-005 · Env config
- **Findings:** INF-16
- **Acceptance:**
  - [ ] Add `react-native-config`; `.env.example` is committed; `.env*` are git-ignored except the example; `.env.production` holds today's production URLs (the owner's choice: QA runs on production).
  - [ ] `src/config/env.ts` exports a typed `env` (API_URL, WS_URL, MAPS_KEY) and throws a clear error if a value is missing.
  - [ ] `grep -rn "raahehaq.com" src` returns only `src/config`.
  - [ ] The app launches and hits the same backend as before (QA SMOKE-01/02).

### T-006 · Redacting logger
- **Findings:** AUTH-03, INF-04, INF-33, PAX-18 (logs), DRV-22
- **Acceptance:**
  - [ ] `src/core/logging/logger.ts` provides `debug/info/warn/error` and redacts keys matching password, token, otp, otp_code, cnic, phone, account, authorization, fcm. It logs only in `__DEV__`, except `error`.
  - [ ] Unit tests prove the redaction (nested objects, arrays).
  - [ ] Every log that prints credentials, tokens, OTP, CNIC, bank data, FCM tokens or whole user objects is removed or converted (grep evidence in the report).
  - [ ] No new `console.log` is introduced.

### T-007 · Typed API layer
- **Findings:** DRV-02, DRV-06, INF-11, INF-18, PAX-19, DRV-24 (record only)
- **Acceptance:**
  - [ ] `ApiResponse<T>` and `ApiError` types exist, plus one `unwrap()` helper. `rideService` methods return the ride object, not `undefined` (unit test with axios-mock-adapter using the documented envelope).
  - [ ] Duplicate `updateDriverLocation` and `DriverLocation` are removed; one correct version remains.
  - [ ] `webSocketService`, `locationTrackingService` and `notificationService` use the axios client; there are no raw `fetch` calls to the backend and no placeholder tokens.
  - [ ] Errors are normalised to `ApiError` in one interceptor; thunks reject with a string message plus `fieldErrors`.
  - [ ] `docs/api/CONTRACT_NOTES.md` is created, listing every endpoint the app calls, whether it is documented, and open questions (DRV-24).

### T-008 · One working toast system
- **Findings:** INF-15, INF-22, PAX-16 (foundation)
- **Acceptance:**
  - [ ] One toast API (`useToast()` and a non-hook `toast.show()`) backed by the mounted NotificationManager/ModernToast.
  - [ ] Every `showToast` caller (13 files) uses it; `ToastProvider.tsx`, `Toast.tsx` and the local PhoneAuth toast are removed.
  - [ ] QA: submitting the empty Login form shows visible feedback (SMOKE-04).

## Phase 1: Security & single auth

### T-101 · Stop displaying/persisting OTP
- **Findings:** AUTH-02 (app part), INF-05 (app part)
- **Acceptance:**
  - [ ] There is no OTP value, "Use This OTP" button or "Test Code" text anywhere in the UI.
  - [ ] `otpData` (or the code inside it) is not persisted and not logged.
  - [ ] The OTP flow still works when the user types the SMS code.
  - [ ] The report reminds the owner about B-01.

### T-102 · Single logout
- **Findings:** AUTH-09, DRV-13 (sign-out part), INF-10 (logout part)
- **Acceptance:**
  - [ ] There is one `logout` thunk: API logout (best effort), clear the token and user storage, Firebase signOut if still present, dispatch the root `RESET` (every slice back to initial), and `persistor.purge()`.
  - [ ] Every Sign Out / Logout button in the app (grep) uses it.
  - [ ] Unit test: after logout every slice equals its initial state.
  - [ ] QA AUTH-E2E-02: logging out from passenger and driver settings lands on Login, and reopening the app stays logged out.

### T-103 · Auth bootstrap
- **Findings:** AUTH-04, INF-08, INF-23 (isInitialized), AUTH-14 (splash)
- **Acceptance:**
  - [ ] A splash shows until rehydration and `initializeAuth` finish; there is no Login flash.
  - [ ] A network error or timeout keeps the session (no token wipe); only a 401 clears it.
  - [ ] A null result resets to the initial state with `isInitialized: true`.
  - [ ] Unit tests cover offline, 401 and success.

### T-104 · Token in Keychain + 401 handling
- **Findings:** AUTH-05, INF-07, INF-20
- **Acceptance:**
  - [ ] The token is stored with `react-native-keychain`; it is gone from redux-persist and the AsyncStorage `auth_token` (with a one-time migration from the old key).
  - [ ] There is one in-memory token cache for the interceptor.
  - [ ] On 401: single-flight `/auth/refresh` (Bearer, per the docs); queued requests replay; if that fails, `logout()`.
  - [ ] Unit tests: 3 parallel 401s cause exactly one refresh call; a failed refresh dispatches logout.

### T-105 · normalizeUser + routing
- **Findings:** AUTH-08
- **Acceptance:**
  - [ ] `normalizeUser()` derives `role` (`role ?? user_type ?? roles[0]`) and `status`; it is used by every thunk that stores a user.
  - [ ] Routing reads only the normalised fields.
  - [ ] Unit tests cover each response shape.

### T-106 · Account-status screen
- **Findings:** AUTH-01, DRV-12
- **Acceptance:**
  - [ ] It reads `apiAuth.user` (not Firebase) and shows role-specific text for pending, suspended and rejected.
  - [ ] "Check status" calls the profile endpoint and routes in when the user becomes active.
  - [ ] Logout uses T-102.
  - [ ] QA: if the owner has a pending test account, exercise it; otherwise mark the QA step N/A with the reason.

### T-107 · Remove Firebase auth; fix slices
- **Findings:** AUTH-15, AUTH-16, INF-09, INF-10, INF-19
- **Acceptance:**
  - [ ] The Firebase auth screens, thunks, slices and services are deleted only after grep proves they are unused (keep RNFirebase app and messaging for FCM).
  - [ ] No action-type collisions; the slice name matches its key.
  - [ ] The persist config whitelists only what should persist; transient status and error are not persisted.
  - [ ] DriverMap and DriverHome no longer read `state.auth`.
  - [ ] QA: SMOKE-01..03 still pass.

### T-108 · Release hardening (code part)
- **Findings:** INF-03 (code), INF-21, INF-26
- **Acceptance:**
  - [ ] The release signingConfig reads from `gradle.properties`/env (`RH_UPLOAD_STORE_FILE`, …) and falls back to failing with a clear message, never to the debug key.
  - [ ] Cleartext is disabled in the release network config; debug allows localhost only.
  - [ ] iOS `UIBackgroundModes` and usage strings are trimmed to what the code uses (keep `location` only if T-407 is approved), and orientation is portrait.
  - [ ] Notes for the owner on B-05.

### T-109 · Maps keys from config
- **Findings:** PAX-01 (code part), INF-06 (code part)
- **Acceptance:**
  - [ ] The key comes from env into the AndroidManifest (manifestPlaceholders), Info.plist (build setting) and JS (`env.MAPS_KEY`).
  - [ ] No key literal remains in the repo outside `.env.*` (grep).
  - [ ] There is no URL logging containing `key=`.
  - [ ] The map and search still work (QA PAX-E2E-01).

## Phase 2: Registration & onboarding

### T-201 · Per-step schema validation
- **Findings:** AUTH-11, AUTH-12
- **Acceptance:**
  - [ ] Each step validates against `registrationSchema` (yup, already installed) before Next; errors show inline.
  - [ ] Phone is required and correctly formatted (+92…); the password rules apply at step 1.
  - [ ] The vehicle year max is dynamic.
  - [ ] Unit tests cover the schema per step.

### T-202 · Server field errors on every input
- **Findings:** AUTH-10, AUTH-17
- **Acceptance:**
  - [ ] A 422 `fieldErrors` maps to every input of every step; the form jumps to the first step that has an error.
  - [ ] The toast shows one summary, not duplicates.
  - [ ] The registration thunk has reducer cases for loading and error.

### T-203 · Driver documents + license number
- **Findings:** AUTH-06, AUTH-07
- **Depends on owner:** B-03 (field names)
- **Acceptance:**
  - [ ] A license-number input exists, mapped to `license_number`.
  - [ ] All driver images are appended to the FormData with the confirmed field names and correct MIME types and names.
  - [ ] Unit test of the FormData builder.

### T-204 · Auth screens UX
- **Findings:** AUTH-13, AUTH-14 (rest)
- **Acceptance:**
  - [ ] `KeyboardAvoidingView` + `keyboardShouldPersistTaps` on long forms; `SafeAreaView` from safe-area-context.
  - [ ] No nested vertical ScrollViews.
  - [ ] The password is not trimmed.
  - [ ] The Google button is removed (and its config call removed) unless Google sign-in is actually supported by the backend.
  - [ ] QA visual check on iPhone SE and iPhone 15 Pro Max simulators.

## Phase 3: Passenger ride flow

### T-301 · Active ride in Redux; single booking route; restore
- **Findings:** PAX-10
- **Acceptance:**
  - [ ] An `activeRide` slice with API-aligned statuses; `rideSlice` and `tripSlice` are replaced.
  - [ ] `PassengerMapScreen` is mounted once (tab or stack, not both).
  - [ ] On launch, an existing active ride is fetched and the user is taken to it.

### T-302 · Correct ride payload
- **Findings:** PAX-02, PAX-04, PAX-15
- **Acceptance:**
  - [ ] No hardcoded user ID anywhere (grep `11`).
  - [ ] The addresses are the real selected text; the vehicle type is mapped to backend values; stops are included with `stop_order` and addresses; passenger count and instructions are included if the UI provides them.
  - [ ] Unit test of the payload builder.
  - [ ] QA PAX-E2E-02 (creates a ride → must cancel).

### T-303 · Location search
- **Findings:** PAX-13, PAX-18 (Nominatim)
- **Acceptance:**
  - [ ] 300 ms debounce, session token, `components=country:pk`, location bias.
  - [ ] Selecting a result fills the field and passes the address with the coordinates.
  - [ ] Empty, error and loading states.
  - [ ] The Nominatim fallback is removed.

### T-304 · Ride status state machine
- **Findings:** PAX-05, PAX-14
- **Acceptance:**
  - [ ] A pure, unit-tested reducer or state machine maps the server status to the UI stage.
  - [ ] Polling uses an interval keyed on the ride id; it stops on terminal states and when the screen is unfocused.
  - [ ] Map taps only change locations in an explicit choose-on-map mode.

### T-305 · Request safety
- **Findings:** PAX-08, PAX-09, INF-17
- **Acceptance:**
  - [ ] The confirm button is disabled while submitting.
  - [ ] Cancel during create cancels on the server once the id arrives.
  - [ ] `cancelAllRequests` is removed; per-request AbortController.

### T-306 · Fare from server
- **Findings:** PAX-07
- **Depends on owner:** B-04
- **Acceptance:**
  - [ ] The estimate comes from the backend, or, if none exists, it is shown clearly as "estimated" using route distance; the final price shown is the backend `total_fare`.
  - [ ] The breakdown adds up.

### T-307 · Driver-assigned card + tracking
- **Findings:** PAX-06, PAX-12
- **Acceptance:**
  - [ ] The tracking screen is rebuilt on the REST API and routed when the status becomes accepted.
  - [ ] A driver marker updates from the driver location endpoint or socket.
  - [ ] Call opens `tel:`; Message is hidden until chat exists.
  - [ ] Vehicle details come from the API.

### T-308 · Location permission UX + watcher
- **Findings:** PAX-11, DRV-10 (shared hook)
- **Acceptance:**
  - [ ] Denied permission shows an explanation, a Retry button and an Open Settings button; the map falls back to the default region with manual search.
  - [ ] One `useLocationWatcher` (watchPosition + distanceFilter + cleanup) is used by both roles.

### T-309 · Remove the Advanced panel + dead duplicates
- **Findings:** PAX-03, PAX-20, the duplicates table in audit/PASSENGER.md
- **Acceptance:**
  - [ ] The "+" Advanced entry and its components are removed, or the needed features (passenger count, instructions) are moved into the main flow.
  - [ ] Unused duplicates are deleted only after grep proves they are unused.

## Phase 4: Driver ride flow

### T-401 · Driver online/offline
- **Findings:** DRV-01, DRV-13
- **Depends on owner:** B-04 (status endpoint)
- **Acceptance:**
  - [ ] A `driverStatus` slice backed by the API; Home and Map share it.
  - [ ] Undefined function calls are removed.
  - [ ] Going online starts tracking and request polling; going offline stops both.

### T-402 · Location tracker rewrite
- **Findings:** DRV-03, DRV-09, DRV-10, DRV-18
- **Acceptance:**
  - [ ] Uses the shared watcher; sends the correct body to `/tracking/update-location` on movement or on a minimum interval; no duplicate timers; everything is cleaned up when going offline or on unmount.
  - [ ] Unit test of the throttling logic.

### T-403 · Incoming ride requests
- **Findings:** DRV-04, DRV-08
- **Acceptance:**
  - [ ] While online, poll `/rides/pending` with the driver location (documented params), plus socket events when T-406 is done.
  - [ ] Requests go into `incomingRequests` state; the card shows real fields; requests expire.

### T-404 · Accept + reject
- **Findings:** DRV-05, DRV-16
- **Depends on owner:** B-06
- **Acceptance:**
  - [ ] Accept uses `POST /rides/{id}/assign-driver`; a 409 shows "already taken"; there is an in-flight guard.
  - [ ] Reject dismisses the request locally (and calls the API if one exists).

### T-405 · Driver ride screen
- **Findings:** DRV-14, DRV-15, DRV-05 (fare)
- **Acceptance:**
  - [ ] `DriverRideScreen` is registered and navigated to after accept.
  - [ ] It uses the correct `RideResource` fields.
  - [ ] Navigate to pickup → start → stops → complete; complete does not send a client fare.
  - [ ] QA E2E-01.

### T-406 · WebSocket manager
- **Findings:** DRV-07, INF-12, INF-13 (client part)
- **Acceptance:**
  - [ ] A single manager with token auth, subscribe frames, capped backoff with jitter, an intentional-close flag, and AppState/NetInfo handling.
  - [ ] Unit tests with a fake WebSocket: no reconnect after `dispose()`; backoff capped.

### T-407 · Background driver location
- **Findings:** DRV-11
- **Depends on owner:** B-08
- **Acceptance:** defined after the product decision.

## Phase 5: Real data

### T-501 · Ride history from API
- **Acceptance:**
  - [ ] Passenger and driver history come from the API, with pagination, pull to refresh, and empty and error states.
  - [ ] `SAMPLE_RIDES` and the hardcoded lists are removed.

### T-502 · Notifications + FCM
- **Findings:** INF-14, PAX-17, DRV-17
- **Acceptance:**
  - [ ] The notifications screen uses `/notifications` (list, mark read, unread badge).
  - [ ] The FCM token is registered with the backend (endpoint confirmed in CONTRACT_NOTES) and refreshed.
  - [ ] Foreground and background handlers exist.
  - [ ] Permission is asked in context; Android 13 `POST_NOTIFICATIONS` is handled.
  - [ ] The no-op senders are deleted.

### T-503 · Remove fake data
- **Findings:** the mock tables in audit/PASSENGER.md and audit/DRIVER.md, DRV-19
- **Acceptance:**
  - [ ] No invented numbers: weather, stats, offers, the wallet balance and "Add Funds", earnings, the fake vehicle and license, dummy chats.
  - [ ] Features without a backend are hidden or shown as "coming soon".
  - [ ] Dead controls are removed or wired.

### T-504 · Profile
- **Acceptance:**
  - [ ] Real fields are edited through the API; the photo upload works, or is hidden if no endpoint exists.

### T-505 · Rating
- **Depends on owner:** B-04
- **Acceptance:**
  - [ ] The rating modal appears after completion and is submitted to the confirmed endpoint.

## Phase 6: UI / design system

### T-601 · Theme tokens
- **Findings:** INF-24
- **Acceptance:**
  - [ ] The token set covers every colour role used (error, warning, success, info, …); `useColorScheme` listener; the user override is persisted.
  - [ ] The TS2339 errors for missing theme keys are gone.

### T-602 · UI kit
- **Acceptance:**
  - [ ] `src/ui` holds Screen (safe area + status bar), Header, Text, Button (loading/disabled), Input (error), Card, EmptyState, ErrorState, LoadingState, with RNTL tests.
  - [ ] `react-native/no-color-literals` runs as a warning in ESLint.

### T-603 · Auth screens migrated
### T-604 · Passenger screens split + migrated
- **Findings:** PAX-21, PAX-22
- **Acceptance:** no file over ~400 lines in the passenger flow; theme only.

### T-605 · Driver screens split + migrated
- **Findings:** DRV-20, DRV-21

**T-603 to T-605 acceptance (shared):**
- [ ] No hex literals in the migrated files.
- [ ] Safe area via insets.
- [ ] QA visual pass in light and dark mode on a small and a large simulator.

### T-606 · Root ErrorBoundary + crash reporting
- **Findings:** INF-23
- **Acceptance:**
  - [ ] A root boundary with a friendly fallback and restart.
  - [ ] Crashlytics in release (RNFirebase), with no PII.

## Phase 7: Release readiness

### T-701 · Dead code + unused deps
- **Findings:** INF-31, INF-34, DRV-23
- **Acceptance:**
  - [ ] Every removed file is proven unused (grep in the report).
  - [ ] Unused packages are removed.
  - [ ] Pods are reinstalled; the app launches.

### T-702 · Zero TS/ESLint errors
- **Acceptance:**
  - [ ] `tsc` 0, ESLint errors 0.
  - [ ] The gate is changed to require 0 (not just a ratchet).

### T-703 · Maestro flows
- **Acceptance:**
  - [ ] `.maestro/` flows exist for SMOKE-01..04, PAX-E2E-01, and AUTH-E2E-02.
  - [ ] Run instructions are documented. Flows never enter credentials (they start from a signed-in state).

### T-704 · CI
- **Acceptance:**
  - [ ] A GitHub Actions workflow runs `yarn verify` and both bundles on each PR.
  - [ ] A gitleaks secret scan runs.

### T-705 · Android R8 + versioning; iOS final
- **Findings:** INF-25
- **Acceptance:**
  - [ ] R8 is on, with keep rules for RN, Firebase and Maps.
  - [ ] The release build launches.
  - [ ] versionCode and versionName come from a single source.

### T-706 · README + docs
- **Findings:** INF-35
- **Acceptance:**
  - [ ] The README covers real setup, env, scripts and architecture.
  - [ ] The stale root docs are moved to `docs/archive/` or rewritten; the API docs go in `docs/api/`.
