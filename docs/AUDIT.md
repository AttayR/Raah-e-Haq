# Raah-e-Haq: Audit Summary

**Date:** 2026-10-03 · **Commit audited:** `9047c5d` (main) · **Method:** four parallel code audits, plus measured TypeScript, ESLint, Jest and bundle checks.

Detailed findings, each with file:line, impact and fix:

| Area | File | Findings |
|---|---|---|
| Authentication & onboarding | [audit/AUTH.md](audit/AUTH.md) | AUTH-01 … AUTH-17 |
| Passenger experience | [audit/PASSENGER.md](audit/PASSENGER.md) | PAX-01 … PAX-22 |
| Driver experience | [audit/DRIVER.md](audit/DRIVER.md) | DRV-01 … DRV-24 |
| Infrastructure, state, native, tooling | [audit/INFRA.md](audit/INFRA.md) | INF-01 … INF-35 |

## Verdict

The app is a **prototype, not a product**:
- The screens look complete, but the core business flow (a passenger requests, a driver receives and accepts, the ride runs, the ride is paid) **does not work end to end anywhere**.
- Several paths crash.
- The release build cannot even be bundled.
- There are serious security holes.

## Measured baseline

| Check | Result |
|---|---|
| Release JS bundle | ❌ fails (INF-01: `logo.png` vs `Logo.png`; then INF-02) |
| TypeScript | ❌ 186 errors |
| ESLint | ❌ 136 errors, 135 warnings |
| Unit tests | ❌ 0 runnable (Jest not configured) |
| `console.log` calls | ~614 (some log passwords, tokens, CNIC) |
| Hardcoded hex colours | ~878 |
| Unreachable source files | 19 |

These numbers are locked into `.quality/baseline.json` and can only go down (see `scripts/quality-gate.js`).

## Top 12 problems

| # | Problem | IDs |
|---|---|---|
| 1 | **OTP is returned by the API and shown on screen.** Anyone can log in as any phone number. | AUTH-02, INF-05 |
| 2 | **Passwords, bearer tokens, CNIC and bank numbers are written to device logs** in release builds. | AUTH-03, INF-04 |
| 3 | **The release bundle cannot be built** (file-name case, missing module). | INF-01, INF-02 |
| 4 | **Every ride is created as passenger #11** (hardcoded). | PAX-02 |
| 5 | **Drivers can never receive a ride request.** No polling, the socket token is a placeholder, and the "go online" code calls functions that don't exist. | DRV-01, DRV-04, DRV-06 |
| 6 | **Every ride API response is unwrapped twice**, so accept, start and complete return `undefined`. | DRV-02 |
| 7 | **The fare is a client-side guess, and the driver sends a hardcoded PKR 150** on completion. | PAX-07, DRV-05 |
| 8 | **New users get stuck forever on "pending approval"** (no working logout or refresh). | AUTH-01, DRV-12 |
| 9 | **Logout doesn't log out**, and an offline cold start leaves a token-less "logged in" state. | AUTH-04, AUTH-09, INF-08 |
| 10 | **Driver documents are collected but never uploaded.** The license number field is filled from the vehicle number. | AUTH-06, AUTH-07 |
| 11 | **Release APK is signed with the public debug key.** The Maps key is unrestricted and in 4 places. | INF-03, INF-06, PAX-01 |
| 12 | **Toasts never show anywhere** (broken import, no host mounted). Users get no feedback. | INF-15 |

## Feature status at a glance

| Feature | Passenger | Driver |
|---|---|---|
| Login / registration | Partial (OTP hole, stuck pending) | Partial (documents dropped) |
| Map, search, route | Partial | n/a |
| Request ride | Partial (bad payload) | n/a |
| Receive / accept ride | n/a | **Broken** |
| Live tracking | **Broken** | **Broken** |
| Start / complete ride | **Broken** | **Broken** |
| Fare | Mock | Mock |
| Rating | **Broken** | n/a |
| History | Mock | Mock |
| Wallet / payments | Mock | Mock (earnings) |
| Notifications / push | Mock | Mock |
| Chat | Mock | Mock |
| Dark mode / theme | Partial | Partial |

## What only the owner can do (not code)

These block parts of the fix plan and are tracked as `B-*` tasks in [TASKS.md](TASKS.md):

1. **Backend:**
   - Stop returning `otp_code` and send it by SMS.
   - Derive the passenger and driver from the token.
   - Make `assign-driver` atomic (409 on conflict).
   - Authenticate WebSockets.
   - Provide fare-estimate, rating, driver-status, history and earnings endpoints.
   - Confirm the driver document field names and the `role` field in auth responses.
2. **Google Cloud:** rotate the Maps key, then create separate keys restricted to Android (package + SHA-1) and iOS (bundle ID).
3. **Signing:** Android upload keystore with Play App Signing, and Apple distribution certificates.
4. **QA:** one passenger and one driver **test account** on production, plus a test location where real users won't match.
5. **Product decisions:** background driver location, chat, and wallet/payments scope.
