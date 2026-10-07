# QA report: T-004 repo hygiene (2026-10-08)

**Result:** BLOCKED on Android runtime (environment), PASS on repo/APK checks and iOS SMOKE-01 → task marked `verified-no-qa`.

1. [PASS] Repo: no android assets bundle, no generated drawables, no keep.xml, no package-lock.json; .gitignore covers them.
2. [PASS] `./gradlew installDebug` builds (note: `clean installDebug` in one command fails on the reanimated/worklets prefab step — run `./gradlew clean && ./gradlew installDebug`).
3. [PASS] Debug APK contains no index.android.bundle, no src_assets_*/node_modules_* drawables, no res/raw/keep.xml.
4–6. [BLOCKED] Emulator Pixel_9_Pro (API 37) repeatedly lost system_server under heavy host load; JS never finished loading. First launch showed "Unable to load script" because RN's emulator default dev host is 10.0.2.2:8081 (8081 belongs to another project here) — confirms the stale bundle is no longer silently used.
7. [NOT RUN] Android login/icons (depends on 6).
8. [PASS] iOS SMOKE-01: relaunch, Home renders with icons/images. (ios-01)

## Follow-ups
- Re-run Android smoke on an API 34/35 emulator when the host is idle; set bundle location to `10.0.2.2:8088` (Dev Menu → Change bundle location) when Metro isn't on 8081.
- Document the Android dev-host note and the clean/build split in README (T-108).

**Server data created:** none.
