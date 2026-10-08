# QA report: T-109 Maps key from build config

- Date: 2026-10-08 · Result: **PASS**
- Device: iPhone 17 (iOS 26.5) simulator, clean Debug build (ENVFILE=.env.development), Metro :8088, local backend only (`.env.development` checked); location Gulberg III
- The key was never printed: checks compare lengths/equality in the shell only; no screenshot shows it.

## Steps
1. **PASS** Clean native rebuild; react-native-config codegen wrote GeneratedInfoPlistDotEnv.h and Info.plist preprocessing applied it. Built GMSApiKey is non-empty, not the literal token, equal to `.env.development`; other plist keys intact.
2. **PASS** Passenger email sign-in → Home with reverse-geocoded address. (01, 02)
3. **PASS** Map tab renders Google tiles (streets, Urdu labels, POIs). (03)
4. **PASS** Device log (~71k lines): 0 "GMSApiKey is not set", 0 API-key errors, 0 `key=`.
5. **PASS** "Liberty Market" → suggestions; pick → Vehicle step "1.74 km • 3 min"; route polyline from pickup pin to destination pin confirmed by panning. (05-09)
6. **PASS** Fare step reached; Cancel reset to idle; no ride requested. (07, 10)
7. **PASS** Metro log: 0 `key=` (weak check: RN 0.80 Metro log has no app console; device log also 0).
8. **PASS** Android `processDebugMainManifest` (with ANDROID_HOME set): one geo.API_KEY entry, non-empty, not the placeholder, equal to `.env.development`.

## Issues (not T-109; routed)
- Fare mismatch: Bike Rs 56 in the list, Rs 94 on the Fare card, breakdown sums to 108 → T-306.
- Vehicle/Fare sheet covers 75-95% of the map and the camera doesn't fit the route → design track (T-605).
- Map controls and Home header overlap the status bar / Dynamic Island → design track.
- Login keyboard covers fields; Return on Email doesn't move to Password → T-603.
- Pickup address shown as a plus code → T-303.
- "Cancel Ride" copy before any ride exists → T-305 (already noted).
- Places returns India results (no `components=country:pk`) → T-303 (known PASSENGER audit item).

Data: none created (read-only check of rides timestamps). Screenshots: this folder (10 files).
