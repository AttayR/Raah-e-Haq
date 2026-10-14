# Audit: Performance (startup, bundle, rendering, maps, network, battery)

Audited on 2026-10-14, at commit `93d3d1d` (branch `fix/phase-2-onboarding`). Read-and-measure only; no app code changed. Target: smooth on low-end Android (2–3 GB RAM, Cortex-A53 class, 3G/4G in Pakistan) and older iPhones.

Severity:
- **P1**: users on low-end devices will feel it (long blank/splash, jank on the main ride screen, battery drain, wasted data)
- **P2**: measurable waste; fix when the area is touched
- **P3**: hygiene; small gain

Estimates are marked **(est.)**. Everything else was measured or read from the code.

## Measured baseline

| Check | Result |
|---|---|
| Hermes | enabled: `android/gradle.properties:39` `hermesEnabled=true`, `ios/Podfile:25` `:hermes_enabled => true` |
| New Architecture | enabled on both (`newArchEnabled=true`, `:new_arch_enabled => true`) |
| Inline requires | on (default from `@react-native/metro-config`, `inlineRequires: true`) |
| Release bundle (android, `--dev false`) | **3.89 MB** JS minified, **932 KB** gzip, **1,655** modules |
| Hermes bytecode (`hermesc -O`) | **5.6 MB** HBC (2.3 MB gzip) |
| Bundled image/raw assets | 40 files, 772 KB (largest: `logo.png` 436 KB) |
| Icon fonts shipped | iOS app: all 19 react-native-vector-icons TTFs (**3.9 MB**); Android: 8 TTFs (**2.8 MB**). Rendered families: MaterialCommunityIcons + MaterialIcons only |
| Android release | `enableProguardInReleaseBuilds = false` (`android/app/build.gradle:69`), `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` |

Biggest bundle contributors (source-map attribution, KB of minified JS):

| Package / area | KB | Note |
|---|---|---|
| react-native | 759 | framework; both Paper and Fabric renderers ship (116–118 KB each) |
| react-native-reanimated | 666 | 208 KB is `layoutReanimation` (entering/exiting presets), mostly unused |
| src/features | 413 | of which **dev-gallery 70 KB** (dev-only, PERF-08) |
| src/components | 221 | |
| src/screens | 141 | Auth screens 97 KB |
| react-native-gesture-handler | 112 | |
| @react-navigation/* | 220 | |
| @react-native-firebase/app + auth | **87** | auth only for a one-time legacy sign-out (PERF-07) |
| yup | 48 | one schema file |
| glyphmap JSON (unmapped) | ~245 (est.) | MaterialCommunityIcons.json 190 KB + MaterialIcons.json 55 KB |

Steady-state request rates (foreground, from the constants in code):

| Situation | Requests per minute | Sources |
|---|---|---|
| Passenger searching for a driver | ~21 | `GET /rides/{id}` every 3 s (`SEARCHING_POLL_MS`), unread count 60 s |
| Passenger, driver assigned | ~22 | `GET /rides/{id}` 10 s + `GET /rides/{id}/driver-location` 4 s + unread 60 s |
| Passenger booking (no ride) | ~3 + typing | nearby drivers 30 s, unread 60 s, **one Places autocomplete per keystroke** (PERF-10) |
| Driver online, idle | ~25 | pending requests 5 s + location post ≥5 s + unread 60 s |
| Driver on a ride | ~23 | location post 4 s + ride poll 8 s + unread 60 s |
| Chat open | +12 | `CHAT_POLL_INTERVAL_MS` 5 s (pauses the ride polls: Booking loses focus) |

All are under the backend's 120/min per user. The cost is battery, data and re-renders, not rate limits.

## Findings

### Startup

**PERF-01 · P1 · startup: a signed-in cold start waits on the network behind the splash, for up to 30 s**
`src/store/thunks/apiThunks.ts:454` (`initializeAuth` awaits `apiService.getProfile()`), `src/services/api.ts:25` (`timeout: 30000`), `src/store/slices/apiAuthSlice.ts:89-95` (`isInitialized` only on fulfil), `src/app/navigation/AuthFlow.tsx:22-24` (splash until initialised).
- Boot chain: PersistGate rehydrate (AsyncStorage) → `initializeAuth`: AsyncStorage `multiGet` + Keychain read → `GET /auth/profile` → route. The first screen appears only after the profile round trip. On a slow or captive network the axios default of 30 s applies, and only then does the existing "keep the stored session" fallback (line 496) route the user.
- **Impact:** every app open of a signed-in user costs one full API round trip before anything is shown (0.5–2 s on Pakistani 4G/3G (est.)); with a bad signal the splash can sit for 30 s.
- **Fix:** give the boot profile check its own short timeout (e.g. 4 s) so a slow network falls into the existing fallback path quickly; better, route at once on a cached user whose status is `active` and revalidate in the background (the 401/403 handlers already move the user out if the server refuses). Keep T-106's rule that an unconfirmed non-active status never enters the home screens.

**PERF-02 · P1 · startup: the splash logo is a 2084×2084 PNG shown at 120 pt**
`src/components/SplashScreen.tsx:21,38-39`; the same `src/assets/images/logo.png` (436 KB) in `LoginScreen.tsx:221`, `PhoneAuthParts.tsx:49`, `RegistrationHeader.tsx:28`, `AccountStatusScreen.tsx:65`.
- Decoded it is 2084 × 2084 × 4 B ≈ **17 MB** of bitmap, decoded on the first frame of every launch, and again on the auth screens. 120 pt needs at most 360 px (@3x).
- Android has no splash theme (`android/app/src/main/res/values/styles.xml` has no `windowBackground`) and the iOS `LaunchScreen.storyboard` is still the RN template ("Powered by React Native"), so users see a white/template screen, then the JS splash.
- **Impact:** slower first frame and a memory spike on 2 GB Android phones; a visible white flash before the brand.
- **Fix:** export `logo.png` at 120/240/360 px (`logo.png`, `@2x`, `@3x`), WebP or optimised PNG (target < 30 KB total); add a native splash (Android 12 SplashScreen API / `windowBackground`, iOS storyboard) that matches the JS splash. Also `background_raahe_haq.png` (104 KB) and `2.png`/`4.png` can be optimised; `bg.png`, `minds_5.png`, `3.png` are not referenced (repo weight only).

**PERF-03 · P2 · startup: every screen module is evaluated when the role stack mounts**
`src/app/navigation/stacks/PassengerStack.tsx:8-25`, `DriverStack.tsx`, `tabs/*BottomTabs.tsx`.
- Screens are passed as `component={X}`, so inline requires do not help: the stack module references all of them and Metro evaluates each module (and its imports: wallet top-up + WebView, saved-place editor, notification preferences, ride details, chat thread) before the first tab paints.
- **Impact:** extra JS work on the first frame after sign-in (est. 50–150 ms on a low-end Android with Hermes).
- **Fix:** keep the first tab eager; load the rest with `getComponent={() => require('…').default}` (React Navigation 7 supports it) for secondary routes: AddMoney, TopUpCheckout, TopUpStatus, WalletTransaction, SavedPlaces/Editor, NotificationPreferences, RideDetails, Profile, Settlements, PayCommission. Same idea for the registration wizard in AuthStack.

### Bundle and app size

**PERF-04 · P1 · size: unused native Firebase SDKs (Firestore, Storage, Auth, Analytics) are linked**
`package.json` (`@react-native-firebase/firestore`, `/storage`, `/auth`, `firebase`), `src/services/firebase.ts:3-9` (only importer: `src/services/bidService.ts`, which nothing imports), `android/app/build.gradle` (`firebase-analytics`), `ios/Podfile.lock` (FirebaseFirestore, FirebaseFirestoreInternal, gRPC-Core, BoringSSL-GRPC, abseil, leveldb-library, FirebaseStorage, FirebaseAuth, FirebaseAnalytics, GoogleAppMeasurement).
- The app only uses FCM (`@react-native-firebase/messaging`). Firestore drags in gRPC + BoringSSL + abseil + leveldb.
- **Impact:** est. +10–15 MB iOS binary and +3–5 MB Android per ABI, longer native start (Firebase component registration, Analytics/AppMeasurement start-up work), much longer pod builds. Download size matters for users on metered data.
- **Fix:** delete `bidService.ts` and `services/firebase.ts` (grep shows no importers), remove `@react-native-firebase/firestore`, `/storage`, the web `firebase` package and the `firebase-analytics` Gradle line (unless analytics is wanted: then it is an owner decision), `pod install`. `/auth` is handled in PERF-07.

**PERF-05 · P1 · size: all icon fonts ship; only two families render**
iOS `Info.plist` `UIAppFonts` lists 8 fonts but the app bundle carries all 19 TTFs (3.9 MB, seen in the built `RaaHeHaq.app`); `android/app/build.gradle:192-202` copies 8 (2.8 MB). Rendered: MaterialCommunityIcons (`src/components/ui/Icon.tsx:3`, 1.15 MB TTF) and MaterialIcons (22 legacy files: auth steps, `ErrorBoundary`, `MapErrorBoundary`, `OffersRow`, `DriverRideScreen`, …). `src/assets/icons/index.tsx` imports all 15 families but nothing imports it any more (dead since `93d3d1d`).
- **Impact:** est. 3.5 MB iOS / 2.5 MB Android of fonts never drawn; two glyphmap JSONs (~245 KB) parsed into the bundle.
- **Fix:** move the 22 MaterialIcons users to the kit `Icon` (MDI), then ship only `MaterialCommunityIcons.ttf`: Android `iconFontNames: ['MaterialCommunityIcons.ttf']`; iOS stop copying the pod's `Fonts` folder (remove the resource from the build phase / use `react-native-vector-icons` font selection) and list one font in `UIAppFonts`. Delete `src/assets/icons/index.tsx`. Later option: subset MDI to the ~85 glyphs in `src/components/ui/icons.ts` with `createIconSet` (TTF 1.15 MB → < 30 KB, glyphmap 190 KB → < 3 KB).

**PERF-06 · P2 · size: unused JS dependencies, one with native code**
`package.json`: `react-native-gifted-chat`, `react-native-keyboard-controller` (native module, autolinked), `react-native-radio-buttons-group`, `crypto-js`, `react-native-crypto-js`, `@react-native/new-app-screen`, `react-hook-form`, `@hookform/resolvers`, `react-native-toast-message`, `redux-thunk` (RTK ships its own), `firebase` (web SDK). A grep of `src`, `App.tsx` and `index.js` finds no import of any of them.
- **Impact:** `react-native-keyboard-controller` adds native code and start-up registration on both platforms; the rest slow installs and widen the supply-chain surface. They are not in the JS bundle.
- **Fix:** remove them (`yarn remove …`, `pod install`), run the gate.

**PERF-07 · P2 · size: Firebase Auth (87 KB JS + native SDK) kept for a one-time legacy sign-out**
`src/services/legacyFirebaseSignOut.ts:2`, called from `src/app/providers/AuthProvider.tsx` on every launch.
- **Impact:** RNFB app+auth JS is evaluated at every boot and FirebaseAuth stays linked, for a migration only pre-T-107 installs need. No store build has shipped yet.
- **Fix:** since no production build with Firebase Auth exists in users' hands, remove `legacyFirebaseSignOut` and `@react-native-firebase/auth` (owner confirm: no TestFlight/APK with Firebase Auth was given to real users).

**PERF-08 · P2 · size: the dev kit gallery ships in release**
`src/features/dev-gallery/DevKitGalleryHost.tsx:7` imports `KitGalleryScreen` at module level; `enabled = __DEV__` only gates rendering.
- **Impact:** 70 KB of dev-only screens and fixtures in every release bundle and in HBC.
- **Fix:** load it as `__DEV__ ? require('./KitGalleryScreen').KitGalleryScreen : null` inside the host (Metro folds `__DEV__` and drops the dependency in release) and add a bundle check to the quality gate that `dev-gallery` is absent.

**PERF-09 · P2 · size: Android release has no R8 and ships x86 ABIs**
`android/app/build.gradle:69` `enableProguardInReleaseBuilds = false`; `android/gradle.properties:28` four ABIs.
- **Impact:** larger dex and an APK with emulator-only x86/x86_64 libs (est. +15–25 MB for a universal APK; a Play AAB splits ABIs, a sideloaded APK does not).
- **Fix:** enable R8 (`minifyEnabled true`, `shrinkResources true`) with keep rules for RN, Hermes, react-native-maps, RNFB, keychain; build release with `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a`; distribute as AAB. Needs a release-build smoke test (QA on device).

### Rendering

**PERF-10 · P1 · rendering + network: typing an address re-renders the whole booking screen and fires one Places request per keystroke**
`src/components/passenger/LocationSearch.tsx:65-93` (effect on `query`, no debounce, no abort, no session token); `src/screens/Passenger/PassengerMapScreen.tsx:96-97` (`pickupQuery`/`destQuery` state lives in the 688-line screen).
- Each character: setState in `PassengerMapScreen` → re-render of the screen, the `MapView` props, every map child (PERF-12) and the sheet; plus `fetchAutocomplete` direct to Google.
- **Impact:** keyboard lag on low-end Android while typing (the most-used input in the app); "Gulberg Lahore" = 13 requests, billed per request without a session token; late responses can overwrite newer ones on slow networks (only a `cancelled` flag protects).
- **Fix:** debounce 300 ms and require 3 chars; `AbortController` per request; Places session token per search (autocomplete + details share it, much cheaper billing); add `location`/`radius` bias near the pickup. Keep the query text inside `LocationSearch`/`DualLocationPicker` (uncontrolled or local state) and lift only the selected place.

**PERF-11 · P1 · rendering: the booking/ride screen re-renders on every status poll, even when nothing changed**
`src/features/active-ride/slice.ts:172-178` (`state.ride = action.payload` on every fulfilled refresh); `src/screens/Passenger/PassengerMapScreen.tsx:83` (`useSelector(selectActiveRide)`), `:80` (`usePassengerNotifications()` result unused, subscribes to the whole notifications slice).
- `GET /rides/{id}` returns a new object every 3 s (searching) or 10 s, so `currentRide` changes identity and the 688-line screen, its `SafeMapView`, map layers and `ActiveRidePanel` all re-render. `driverLocation` (every 4 s) and the notifications slice (every 60 s) trigger more full re-renders.
- **Impact:** ~20 full renders a minute of the heaviest screen during a ride, with map prop diffs each time (est. 15–40 ms each on low-end Android), competing with the marker animation (PERF-13).
- **Fix:** in the reducer keep the old `ride` when the payload is equal (compare `updated_at`/`status` + a shallow field compare, or `fast-deep-equal`); drop the unused `usePassengerNotifications()` call; select narrow fields (`status`, `id`) where that is all a component needs. Pair with PERF-12 so whatever still changes stays local.

**PERF-12 · P1 · rendering: map children and MapView props are rebuilt on every render**
`src/components/SafeMapView.tsx:181` (`mapPadding={{…}}` new object each render, component not memoised, `logger.debug` per render at :157); `src/components/ui/ride/RouteLine.tsx:66-67` (`coordinates.slice(0, count)` and `traveled.slice()` create new arrays every render → 2–4 Polylines resend the whole route to native); `src/features/ride-booking/components/BookingMapLayers.tsx`, `src/components/passenger/NearbyDrivers.tsx:25`, `ActiveRidePanel.tsx:188` `AssignedDriverMarker` (new `coordinate` object each render) — none are `React.memo`; `PassengerMapScreen.tsx:506-517` inline `onMapReady`; `DriverDriveScreen.tsx:145-170` inline `initialRegion` object and `onMapReady`.
- **Impact:** every parent render (PERF-10, PERF-11, sheet height, location) pushes polyline coordinate arrays (100–400 points from `overview_polyline`, est.) and marker props across to the native map on Fabric. This is the main jank source on the booking screen.
- **Fix:** `React.memo` on `BookingMapLayers`, `RouteLine`, `RideMarker`, `NearbyDriverMarkers`, `AssignedDriverMarker`, `VehicleMarker`; in `RouteLine` memoise `visible`/`done` with `useMemo([coordinates, count])`; hoist `mapPadding` to a constant and memoise `SafeMapView`; `useCallback` the map handlers; memoise `initialRegion` (it is only read on mount anyway). Then split `PassengerMapScreen` (688 lines; the ~400 line rule in CLAUDE.md) into a map layer component and a sheet component that own their own state.

**PERF-13 · P1 · animation: the live vehicle marker re-renders React 60 times a second for the whole ride**
`src/components/ui/ride/useInterpolatedMarker.ts:149-174` (rAF loop, `setState` via `commit()` every frame), driven over the full poll gap (~4 s), so with 4 s polls the loop never rests; `VehicleMarker.tsx:93-120` re-renders and sends `coordinate` + `rotation` to the native Marker each frame.
- **Impact:** a continuous 60 Hz JS → Fabric commit loop on the JS thread while the passenger watches the driver (and on the driver's Drive/ride map for their own marker). On a low-end Android this costs a large share of the JS frame budget and battery, and makes any other work (polls, sheet gestures) janky. The visual gain over 30 fps or 20 fps for a car moving a few metres per second at city zoom is near zero.
- **Fix:** cap commits (e.g. ≤ 30 fps, and skip a frame when the move is below ~0.5 m and the turn below 1°); stop the loop when the app is in the background or the screen is blurred; longer term, drive the marker natively (`MarkerAnimated` + `AnimatedRegion.timing` on Android / `animateMarkerToCoordinate`) so JS only sets the target once per poll. Keep the existing tests for the motion maths (`vehicleMotion.ts`).

**PERF-14 · P1 · memory: two Google Maps are alive at the same time, and background tabs keep rendering**
Passenger: Home tab map (`PassengerHomeScreen.tsx:148`) stays mounted under the pushed `Booking` map (`PassengerStack.tsx:93`). Driver: Drive tab map (`DriverDriveScreen.tsx:145`) under `DriverRide` (`DriverRideScreen.tsx`). No `freezeOnBlur` anywhere (`src/app/navigation/**`).
- **Impact:** each Google Map view costs tens of MB of native memory (est. 40–80 MB with tiles) — two at once is the classic way low-end Android kills a ride app in the background or stutters. Blurred tab screens also re-render on every Redux change (ride, notifications, auth).
- **Fix:** set `freezeOnBlur: true` in the tab and stack `screenOptions` (react-native-screens supports it; the blurred tree stops rendering); unmount or detach the Home/Drive `MapView` while a full-screen map is on top (render it only when `useIsFocused()` or keep one shared map). QA both roles for the map coming back correctly.

**PERF-15 · P2 · startup of a screen: the booking map is held back by an artificial 1 s timer**
`src/screens/Passenger/PassengerMapScreen.tsx:148-151` (`setTimeout(() => setIsMapReady(true), 1000)`) with `:496-499` (`!isMapReady ? <MapPlaceholder/> : <SafeMapView/>`).
- The map is not mounted until `isMapReady`, and `onMapReady` cannot fire before the map exists, so every open of "Where to?" shows "Loading map…" for a fixed second.
- **Impact:** +1 s on the most important flow, every time.
- **Fix:** mount `SafeMapView` immediately (overlay the placeholder until `onMapReady`), or use `InteractionManager.runAfterInteractions` so it mounts right after the push animation (~300 ms).

**PERF-16 · P3 · rendering: auth/role navigators re-render on any auth-slice change**
`AuthFlow.tsx:16`, `RootNavigation.tsx:18`, plus `const { user } = useSelector(s => s.apiAuth)` in `PassengerHomeScreen.tsx:50`, `DriverDriveScreen.tsx:66`, settings/profile screens; `src/hooks/useApiAuth.ts:27` selects the whole slice (used by `AuthProvider` at the app root).
- **Impact:** small: the whole slice changes on every auth thunk `status` flip (profile save, OTP, etc.), re-rendering the navigator roots and those screens.
- **Fix:** select the fields needed (`s.apiAuth.user`, `s.apiAuth.isInitialized`, …) or use `shallowEqual`; `useApiAuth` should not subscribe in `AuthProvider` (it only needs `dispatch`).

### Network

**PERF-17 · P2 · network: the passenger ride poll ignores background state and has no back-off**
`src/features/active-ride/hooks.ts:121-136` (`setInterval(poll, pollMs)`, gated only on `enabled` = focused; the driver-location read is gated by `useAppIsActive`, the status read is not); compare `src/features/driver-ride/hooks.ts:269` which uses the shared `usePolling` engine (one in flight, back-off, Retry-After).
- **Impact:** on Android the JS timer keeps firing for a while after the app is backgrounded (requests + radio wake-ups); on 429 or 5xx it keeps hitting every 3 s.
- **Fix:** use `usePolling` (from `src/features/chat/polling.ts`, consider moving it to `src/core/polling`) for the status poll too, with `enabled && appActive`; one shared poll hook for every interval in the app.

**PERF-18 · P2 · network: two requests every few seconds where one would do**
`GET /rides/{id}` (10 s) and `GET /rides/{id}/driver-location` (4 s) during an assigned ride; `GET /rides/pending` 5 s for an idle online driver.
- **Impact:** ~22 requests a minute per rider on a trip; full ride JSON re-sent even when unchanged; battery and data on 3G.
- **Fix (backend + app):** return the driver location inside `GET /rides/{id}` (or `status` + `updated_at` inside driver-location) so one 4 s poll serves both; support `ETag`/`If-None-Match` (or `?since=updated_at` → 304) on `GET /rides/{id}` and `/rides/pending`. WebSockets (BE-12/T-406) replace this later; this is the cheap step before it.

**PERF-19 · P2 · network: no caching of stable data; Home loads 20 rides to show 3**
`src/screens/Passenger/PassengerHomeScreen.tsx:67` (`useRideHistory('all', isFocused)` = `per_page=20`, `src/features/ride-history/api.ts:25`), while the driver Home already uses `useRecentRides(3)` (`DriverDriveScreen.tsx:83`); `src/features/ride-booking/hooks.ts:26-45` (`GET /public/vehicle-types` on every Booking mount); Home rides, saved places and stats refetch on every focus with no freshness window; `useDirections` refetches the same route (no cache by origin/destination).
- **Impact:** extra requests and JSON parsing on every tab switch (est. 20–40 KB per Home focus for 20 full ride resources).
- **Fix:** passenger Home uses `useRecentRides(3)`; a small in-memory cache with a TTL (vehicle types 1 h, saved places/stats 60 s, directions by rounded points 5 min) — either a tiny `useCachedQuery` helper or RTK Query on the existing axios client.

### Battery and location

**PERF-20 · P1 · battery: an offline driver keeps high-accuracy GPS on, even on other tabs**
`src/features/driver-location/hooks.ts:98-107` (`useDriverDevicePosition` acquires the shared watch whenever the app is active, no focus gate), used by `DriverDriveScreen.tsx:72` (Drive is the first tab and stays mounted); `src/features/driver-location/config.ts:54-60` (`enableHighAccuracy: true`, `distanceFilter: 10`, `interval: 5000`).
- **Impact:** a driver who is offline and reading Earnings or Inbox still runs the GPS at high accuracy; every fix re-renders the Drive screen. GPS is the top battery drain for driver apps.
- **Fix:** acquire the watch only when `isFocused` (or tracking is on); when offline use a low-power one (`enableHighAccuracy: false`, `distanceFilter: 50`, `interval: 15000`) or a one-shot read on focus; keep the current high-accuracy options for online and on-ride. Check the iOS one-shot/watch interplay noted in T-410.

**PERF-21 · P3 · battery: online-idle cadence is ride cadence-light but still GPS-heavy**
`config.ts:5-30` (online idle: post ≥5 s if moved ≥10 m, heartbeat 30 s, high accuracy).
- **Impact:** an online driver waiting at a stand keeps the GPS hot; matching does not need 5 s / 10 m precision while idle.
- **Fix:** while online without a ride: `distanceFilter: 25–30`, `interval: 10000`, `enableHighAccuracy` on Android balanced; ride cadence unchanged. Agree the nearby-drivers freshness with BE-20 first.

### Minor

**PERF-22 · P3 · uploads: document photos at 2000 px, quality 0.8**
`src/features/driverDocuments/upload.ts:18-21`.
- **Impact:** est. 0.5–1 MB per photo; registration sends 5–8 photos on mobile data.
- **Fix:** 1600 px, quality 0.7 is still readable for CNIC/licence checks (confirm with admin review), cuts upload size about in half.

**PERF-23 · P3 · bundle: Reanimated layout-animation presets and yup**
208 KB of `react-native-reanimated/src/layoutReanimation` and 48 KB `yup` (only `src/schemas/registrationSchema.ts`).
- **Impact:** module evaluation and HBC size; nothing user-visible on its own.
- **Fix:** none needed now; Metro cannot tree-shake Reanimated. If the registration schemas are rewritten, plain validators remove yup. Track only.

## What is already good

- Hermes, New Architecture and inline requires are on; release strips `console.*` except `error`.
- Lists that can grow are virtualised and paginated (`RideHistoryScreen`, `WalletScreen` SectionList, Notifications, Chat list and thread FlatLists; 20 per page, chat 50) with memoised rows.
- RN `Animated` calls use `useNativeDriver: true`; sheets use Reanimated.
- Polls are cleaned up on unmount; nearby drivers, unread count, chat and the driver ride poll stop in the background; the chat/driver poll engine allows one request in flight and honours Retry-After.
- Custom markers freeze `tracksViewChanges` after 1 s (`useMarkerTracking.ts`); the map style JSON is small (19 rules, 2.4 KB source).
- Passenger location is one-shot (`getCurrentPosition`, low accuracy), not a watcher.

## How this was measured

```
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output <scratch>/a.js --sourcemap-output <scratch>/a.map --assets-dest <scratch>/assets
node_modules/react-native/sdks/hermesc/osx-bin/hermesc -emit-binary -O -out <scratch>/a.hbc <scratch>/a.js
# per-package attribution: walk a.map mappings with node_modules/source-map (0.5.7), sum generated columns per source
sips -g pixelWidth -g pixelHeight src/assets/images/logo.png   # 2084 x 2084
```

Not measured (needs a device profile, rh-qa): cold-start time to first screen, JS FPS during a ride, memory with two maps, battery per hour online. Suggested follow-up: one Android low-end device run (or emulator with 2 GB RAM, 4 cores) with the Perf Monitor and `adb shell dumpsys meminfo` before and after T-531..T-536.
