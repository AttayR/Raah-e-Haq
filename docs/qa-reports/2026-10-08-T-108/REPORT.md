# QA report: T-108 Release hardening (code part)

- Date: 2026-10-08 · Result: **PASS** (rotation checked by config only)
- Device: iPhone 17 (iOS 26.5) simulator, fresh native Debug build (83 s, 0 errors); Metro :8088 restarted with --reset-cache; local backend only (`.env.development` checked)

## Steps
1. **PASS** Clean launch, no native-module errors; RNGoogleSignin absent from package.json, Podfile.lock, src/ and the binary. (01)
2. **PASS** Passenger and driver email login and sign-out; cold start while signed out goes to Login; T-107 legacy Firebase sign-out causes no startup issue. (03, 04, 10, 11, 13, 14)
3. **PASS** Location prompt after privacy reset offers only Allow Once / While Using / Don't Allow (no "Always"), new copy. (04)
4. **PASS, note** First location request right after granting showed "Unable to get your current location"; Retry worked (possible race with the simulated location being set at the same time). (05, 06)
5. **PARTIAL** Rotation: the simulator couldn't be rotated headlessly; the built Info.plist declares Portrait only and iPhone only, no AppDelegate override. Needs a 10-second live check with the Simulator UI.
6. **PASS** Metro ignores docs/: 14 PNGs written into this folder during the run, no rebundle or reload. (09)
7. **PASS** `./gradlew assembleRelease -m` without RH_UPLOAD_* fails with "Release signing is not configured" listing all four values; no keystore created.

## Issues (not T-108; routed)
- Location error on first request after grant → T-308 (permission UX + shared watcher).
- Login keyboard covers fields, bottom band clips "Create New Account", first Email-tab tap ignored → T-603.
- Map buttons under the status bar / Dynamic Island; Driver Home header and stat cards clipped; Driver Settings unlabeled rows; Passenger Settings header under translucent status bar → design track (T-60x).
- Passenger Home demo stats and expired offers → T-506.

Data: none created (logins/logouts only). Simulator location left at Gulberg III, location permission "While Using".
Screenshots: this folder (14 files).
