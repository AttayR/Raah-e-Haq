# Audit: Infrastructure, State, Native Config & Project Health

Audited on 2026-10-03, at commit `9047c5d`. Severity:
- **P0**: crash, data loss or security
- **P1**: broken feature
- **P2**: incorrect behaviour or poor UX
- **P3**: code quality

Measured baseline:

| Check | Result |
|---|---|
| `tsc --noEmit` | 186 errors |
| `eslint` | 136 errors, 135 warnings |
| `jest` | the only suite fails to start (Reanimated ESM) |
| `react-native bundle` (android, release) | **fails**: `Unable to resolve module ../../assets/images/logo.png` |

## Findings

### Build blockers

**INF-01 · P0 · build: the release bundle can't be built**
`DriverPendingApprovalScreen.tsx:123`, `LoginScreen.tsx:197`, `PhoneAuthScreen.tsx:378`, `BasicInfoScreen.tsx:253`, `RoleSelectionScreen.tsx:114`, `RegistrationScreen.tsx:476`, `DriverRegistrationScreen.tsx:383`
- These files `require('../../assets/images/logo.png')`, but git tracks the file as `Logo.png`. Metro resolves file names case-sensitively.
- **Impact:** no store build is possible on either platform.
- **Fix:** rename the file to `logo.png` with `git mv`, or fix all 7 requires.

**INF-02 · P0 · build: missing module**
`src/hooks/useErrorHandler.ts:3`
- `import { showToast } from './ToastProvider'`, but that file doesn't exist in `src/hooks`. It is reachable from the live `PassengerMapScreen`.
- **Impact:** the bundle fails on this error as soon as INF-01 is fixed.
- **Fix:** import from `'../components/ToastProvider'` (or the unified toast once INF-22 is done).

### Security

**INF-03 · P0 · security: release is signed with the debug keystore**
`android/app/build.gradle:112`
- The release build type uses `signingConfigs.debug`, which is the committed `debug.keystore` with the password `android`.
- **Fix:**
  - **Owner:** create an upload keystore and enable Play App Signing.
  - **Code:** read the signing values from `gradle.properties` or the environment.

**INF-04 · P0 · security/PII: passwords, CNIC, bank details and tokens logged**
`src/services/api.ts:201,215,231`, `src/store/thunks/apiThunks.ts:10,19,106`
- Overlaps AUTH-03.
- **Fix:** remove these logs, add a redacting logger, and strip console calls in release builds.

**INF-05 · P0 · security: the OTP is returned to the client and persisted**
`api.ts:397`, `apiThunks.ts:172`, `apiAuthSlice` sendOtp.fulfilled
- Overlaps AUTH-02.
- **Backend (owner):** stop returning `otp_code`.
- **App:** don't log or persist `otpData`.

**INF-06 · P0 · security: one unrestricted Google key in 4 places, also used for REST**
`src/config/mapsConfig.ts:4`, `AndroidManifest.xml:21`, `Info.plist` (GMSApiKey), `AppDelegate.swift:24`
- The same key is used for the Directions, Places and Geocode REST APIs, and REST calls can't be restricted to the app.
- **Fix:**
  - **Owner:** rotate the key, and use separate SDK keys restricted per platform.
  - **Code:** inject keys through env or build config, and proxy REST calls through the backend.

### Auth & state

**INF-07 · P1 · auth: token refresh never runs**
`api.ts:78-101`
- `refresh_token` is never stored, and the contract is a Bearer `/auth/refresh` call.
- When refresh fails, Redux isn't updated, and parallel 401s aren't queued.
- **Fix:** single-flight refresh with a request queue. On failure, dispatch the unified logout. Overlaps AUTH-05.

**INF-08 · P1 · state: an offline cold start wipes the token but keeps `isAuthenticated`**
`apiAuthSlice.ts:76-84`, `apiThunks.ts:422-446`
- Overlaps AUTH-04.

**INF-09 · P1 · state: both slices are named `'auth'`**
`authSlice.ts:35`, `apiAuthSlice.ts:49`
- Action types collide between the two slices.
- Overlaps AUTH-16.

**INF-10 · P1 · state/auth: two parallel auth systems**
`store/index.ts:11-15`, `AuthFlow.tsx:9`, `DriverHomeScreen.tsx:387`, `DriverMapScreen.tsx:35-37`
- Navigation uses `apiAuth`, but the logout buttons and `uid`-gated features use Firebase `auth`.
- **Fix:** make the API the single source of truth.

### Realtime & push

**INF-11 · P1 · realtime: placeholder WebSocket token**
`webSocketService.ts:281-285`
- `getAuthToken()` returns the literal `'your_auth_token_here'`.
- Overlaps DRV-06.

**INF-12 · P1 · realtime: zombie reconnects and unbounded reconnect loops**
`webSocketService.ts:83-88,221-230,244-258`
- Overlaps DRV-07.

**INF-13 · P1 · security: the notifications socket has no auth (possible IDOR)**
`webSocketService.ts:181`
- The app connects to `wss://raahehaq.com/ws/notifications/${userId}` without a token.
- **Fix:** authenticate the socket. **Backend (owner):** verify that the server enforces auth on this socket.

**INF-14 · P1 · push: FCM is not implemented**
`notificationService.ts:1-3, ~374`, `useDriverNotifications.ts`
- No token registration, no `onTokenRefresh` and no background handler.
- No Android `POST_NOTIFICATIONS` permission.
- `fcmToken` is always undefined, and `showLocalNotification` only logs.
- iOS asks for permission at launch, with no context.

**INF-15 · P1 · UX: `showToast` is silent everywhere**
`src/components/ToastProvider.tsx:2-17`
- `const { Toast } = require('react-native-toast-message')`, but the package uses a default export, and no `<Toast/>` host is mounted.
- The TypeError is caught and falls back to `console.log`, so 13 files' toasts never show.

### Networking

**INF-16 · P2 · networking: base URL hardcoded in 11 places; fetch and axios mixed; no environments**
`api.ts:6`, `notificationService.ts:36,82,113,145`, `locationTrackingService.ts:182,229,345`, `webSocketService.ts:50,116,181`
- **Fix:** one env config, with every call going through the axios client.

**INF-17 · P2 · networking: global `cancelAllRequests()` aborts other screens' requests**
`PassengerMapScreen.tsx:107,144`, `api.ts:19-38`
- It uses the deprecated `CancelToken`.
- **Fix:** per-request `AbortController`.

**INF-18 · P2 · networking: no error normalisation**
`api.ts`, `apiThunks.ts`
- `registerUserWithImages` rejects with an object, while the slice casts the payload to `string`.
- **Impact:** rendering that object inside a `<Text>` could crash.
- **Fix:** typed `ApiError {kind, status, message, fieldErrors}`.

### Storage, persistence & platform config

**INF-19 · P2 · state: the persist transform never runs**
`store/index.ts:24-46`
- Its whitelist is `'root'`, but transforms receive the slice keys.
- Overlaps AUTH-16.

**INF-20 · P2 · security: token and PII in plain AsyncStorage (twice); `serializableCheck` disabled**
`store/index.ts:50`, `api.ts:49,134,149`
- **Fix:** store the token in Keychain/Keystore (`react-native-keychain`), keep PII out of persisted state, and re-enable `serializableCheck` while ignoring the persist actions.

**INF-21 · P2 · network security: cleartext HTTP allowed in Android release**
`AndroidManifest.xml:15-16`, `res/xml/network_security_config.xml`
- **Fix:** set cleartext to false in the base config, and allow it for localhost in the debug build only.

**INF-22 · P2 · app shell: three or four toast systems**
`Toast.tsx`, `ModernToast.tsx` + `NotificationManager.tsx`, `ToastProvider.tsx`, and a local one in `PhoneAuthScreen`
- The one that works (NotificationManager) is not used by any screen.
- **Fix:** keep NotificationManager/ModernToast and delete the rest.

**INF-23 · P2 · app shell: no root ErrorBoundary; AuthFlow ignores `isInitialized`; user object logged**
`App.tsx`, `AuthFlow.tsx:9,29`

**INF-24 · P2 · theme: incomplete and static**
`ThemeProvider.tsx`
- It reads `Appearance` once, with no listener, and the user's choice isn't persisted.
- Tokens such as `theme.colors.error` are used but not defined (part of the TS2339 errors).
- There are 878 hardcoded hex colours.

**INF-25 · P2 · android: no R8/ProGuard; `versionCode 1` hardcoded**
`build.gradle:61,93-94`

**INF-26 · P2 · iOS: unused background modes and permissions (rejection risk)**
`Info.plist`
- `location`, `background-processing` and `remote-notification` are declared, plus `NSMicrophoneUsageDescription`.
- Landscape is enabled on a portrait UI.

**INF-27 · P2 · repo: stale 4.6 MB `index.android.bundle` committed**
`android/app/src/main/assets/index.android.bundle`
- A debug build without Metro can silently load this stale JS.
- **Fix:** delete it and add it to `.gitignore`.

### Tooling & hygiene

**INF-28 · P2 · testing: Jest is not set up**
`jest.config.js`, `__tests__/App.test.tsx`
- There is no `transformIgnorePatterns`, setup file or native mocks.

**INF-29 · P3 · types/lint: 186 tsc errors and 136 ESLint errors, no CI**
- `src/screens/NotificationScreen.tsx` has 7 unresolved modules (wrong `../../` paths).

**INF-30 · P3 · babel: deprecated Reanimated plugin**
`babel.config.js:13`
- **Fix:** use `'react-native-worklets/plugin'`, kept last.

**INF-31 · P3 · deps: unused packages**
`package.json`
- `firebase` (JS SDK), `crypto-js`, `react-native-crypto-js`, `redux-thunk`, `react-hook-form`, `@hookform/resolvers`, `react-native-webview`, `react-native-haptic-feedback`, `react-native-keyboard-controller`, `react-native-radio-buttons-group`, `@react-native/new-app-screen`, `@react-native-community/netinfo` (keep netinfo if the realtime layer uses it).
- Two lockfiles are committed.

**INF-32 · P3 · iOS build: hardcoded `NODE_BINARY`**
`ios/Podfile:9`
- `ENV['NODE_BINARY'] = '/usr/local/bin/node'`.
- **Fix:** use `ios/.xcode.env`.

**INF-33 · P3 · logging: about 614 `console.log` and 276 `console.error`/`console.warn` calls**
- They include store dumps, FCM tokens, phone numbers and ride payloads.

**INF-34 · P3 · dead code: 19 files unreachable from `index.js`**
- **Unreachable files:**
  - `components/AppTestFlow.tsx`, `AuthDebug.tsx`, `AuthLoading.tsx`, `FirebaseTest.tsx`, `GoogleMapsTest.tsx`, `RideServiceTest.tsx`, `SimpleFallback.tsx`
  - `components/driver/IncomingRequestCard.tsx`, `components/passenger/PassengerMap.tsx`, `components/passenger/RideRequestPanel.tsx`
  - `hooks/useAuthListener.ts`, `hooks/useDriverRequests.ts`
  - `schemas/registrationSchema.ts`
  - `screens/Driver/DriverRideScreen.tsx`, `screens/NotificationScreen.tsx`
  - `services/auth.ts`, `services/bidService.ts`, `services/paymentService.ts`
  - `types/navigation.ts`
  - Images `3.png`, `bg.png`, `minds_5.png`
- **Exceptions:** `DriverRideScreen` should be revived (DRV-15), not deleted. `registrationSchema` should be used (AUTH-11).
- `userSlice` and `tripSlice` are wired into the store but unused.

**INF-35 · P3 · docs: misleading root docs**
- `README.md` is the RN template.
- `API_DOCUMENTATION.md` uses localhost.
- `RaaheHaq_Documentation.md` describes a Firebase backend that was never built.
- **Fix:** rewrite the README and move the API docs to `docs/api/` with real URLs.

## Target architecture

See [`../ARCHITECTURE.md`](../ARCHITECTURE.md), which combines this audit's recommendations with the other three areas.
