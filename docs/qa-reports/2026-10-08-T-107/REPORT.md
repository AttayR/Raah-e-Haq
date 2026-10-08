# QA report: T-107 Remove Firebase auth; fix slices & persist (run 1)

- Date: 2026-10-08 · Result: **PASS with BLOCKED sub-checks** (rerun in 2026-10-08-T-107b, PASS)
- Device: iPhone 17 (iOS 26.5) simulator, Debug, Metro :8088; local backend only (`.env.development` checked)

## Steps
1. **PASS** Upgrade from HEAD 89e265d (served from a temporary export on :8089): still signed in after switching to T-107 JS; no "Unexpected key", no LogBox; `persist:root` went from `[auth, apiAuth, user, _persist]` (v0) to `[apiAuth, _persist]` v1, no token; legacy Firebase sign-out flag set. (a01-a03)
2. **PASS** Passenger Home pull-to-refresh → one GET /api/auth/profile. (g01, g02)
3. **PASS** Forced logout (token rows deleted locally) → one sign-out, one /api/auth/logout, no red LogBox. (e01, e10)
4. **PASS** Shared error banner clears on method switch and after returning from PhoneAuth. (c01-c07)
5. **PASS** Double-tap "Sign in with Email" → one /api/auth/login. (d-after-doubletap)
6. **PASS** "Create New Account" opens registration (not submitted). (h-create-account)
7. **PASS** Relaunch after sign-out stays on Login.
8. **BLOCKED** Phone OTP completion (code only in the local log; not typed into chat by policy), driver Online/Offline, explicit Sign Out buttons — Metro reloaded repeatedly because the orchestrator was editing docs/ during the run (Metro watches docs/, tracked under T-108).

Data: passenger tokens deleted for the forced-logout check; no rides; no reseed. Temporary Metro and export removed; RCT_jsLocation restored.
