# Fix Plan: from prototype to production

**Goal:**
- A passenger can book a ride and a driver can receive, accept, run and complete it against the real backend, safely, on iOS and Android.
- The UI is consistent.
- There is a test suite and a gate that stops regressions.
- A store-ready release build exists.

**Branch:** `fix/production-hardening` · **Tracker:** [TASKS.md](TASKS.md) · **Findings:** [AUDIT.md](AUDIT.md) · **Target design:** [ARCHITECTURE.md](ARCHITECTURE.md)

## How work flows

```
/fix-next  ──►  rh-implementer  ──►  rh-reviewer  ──►  rh-qa (if QA: yes)  ──►  commit + tracker update
                      ▲                    │ FAIL (max 2 retries)
                      └────────────────────┘
```

- **One task = one commit.** Each commit passes `yarn verify`, and the baseline ratchets down after it.
- **Independent verification.** The reviewer never edits code and re-checks every claim. QA tests in the simulator against production, using test accounts only.
- **Owner tasks.** `B-*` tasks are things only the owner can do. Agents skip them and report them as blockers.
- **Order.** Phases run in order, because each phase relies on the one before.

## Phases

### Phase 0: Foundation (make it build, testable and safe to change)
The release bundle builds, Jest runs, there is one env config, one HTTP client with typed responses, one working toast, and no secrets in logs.

**Exit criteria:**
- `npx react-native bundle` succeeds for iOS and Android.
- Jest runs with at least one meaningful test per new core module.
- Zero hardcoded backend URLs outside `src/config`.
- Zero logs of passwords, tokens or OTPs.
- Toasts appear on screen.

### Phase 1: Security & a single auth system
- Only the Laravel API session exists, with the token in Keychain.
- Splash, then bootstrap that tolerates being offline.
- One logout used everywhere.
- 401 handling, normalised user and role, and a working account-status screen.
- OTP no longer shown.
- Release hardening in code: signing from env, no cleartext, keys from config.

**Exit criteria:**
- QA can log in, kill the app, reopen it (still logged in), and log out from every logout button.
- A pending user can refresh their status and log out.
- No Firebase auth code remains.

### Phase 2: Registration & onboarding
- Per-step validation with the schema.
- Server field errors shown on the field.
- Driver documents and license number actually uploaded.
- Keyboard and safe-area handling done right.

**Exit criteria:** passenger and driver signup complete with real validation, and the backend receives every document. QA uses an owner-provided test identity; agents never create accounts on their own.

### Phase 3: Passenger ride flow (end to end)
- The active ride lives in Redux and is restored on launch.
- A correct payload: the real user, addresses, vehicle type, stops.
- Debounced search.
- A ride status state machine, plus polling and the socket.
- Double-tap and cancel safety.
- Server fare.
- Driver-assigned card and tracking screen.
- Location permission UX.

**Exit criteria:** with the test passenger, QA requests a ride, sees the driver assigned (via the test driver), follows tracking through to completion, and cancels cleanly in the cancel scenario.

### Phase 4: Driver ride flow (end to end)
- Online/offline backed by the API.
- Correct location tracking.
- Incoming requests.
- Accept (atomic) and reject.
- A routed driver ride screen: pickup, start, stops, complete.
- A robust socket manager.

**Exit criteria:** the full two-device E2E scenario (E2E-01) passes.

### Phase 5: Real data instead of mocks
- History, notifications and FCM, and rating come from the API.
- Anything without a backend (wallet top-up, chat, earnings if missing) is hidden or clearly marked "coming soon". It is never faked.

**Exit criteria:** no screen shows invented numbers.

### Phase 6: UI / design system
- Complete theme tokens, dark mode and a UI kit.
- Every screen migrated to the theme and safe-area handling.
- Large screens split up.
- A root ErrorBoundary with crash reporting.

**Exit criteria:** the `no-color-literals` lint rule passes in `src/screens` and `src/features`, and QA visual checks pass in light and dark mode on a small and a large device.

### Phase 7: Release readiness
- Dead code and unused dependencies removed.
- TypeScript and ESLint at 0 errors, after which the gate requires 0.
- Maestro E2E flows in place.
- CI set up.
- R8 and versioning.
- README and docs rewritten.

**Exit criteria:** CI is green, and signed release builds for both stores are produced from CI.

## Owner checklist (blocking items)

| ID | Item | Blocks |
|---|---|---|
| B-01 | Backend stops returning `otp_code`; real SMS | T-101 completeness |
| B-02 | Rotate and restrict the Maps key; separate Android/iOS keys | T-109 |
| B-03 | Confirm the `role` field in auth responses, the driver document field names, and the registration contract | T-105, T-203 |
| B-04 | Endpoints: fare estimate, driver status, pending rides contract, rating, history, earnings | T-306, T-401, T-403, T-505 |
| B-05 | Android upload keystore + Play App Signing; Apple certificates | T-108, T-705 |
| B-06 | Backend: passenger from token, atomic assign-driver (409), WebSocket auth | T-302, T-404, T-406 |
| B-07 | **Test accounts** (1 passenger + 1 driver) on production and a safe test location, written into `docs/QA_SCENARIOS.md` | All QA |
| B-08 | Product decisions: background location, chat, wallet/payments scope | T-407, Phase 5 |

## Risk notes

- **Production backend in QA.** Every QA scenario that creates data is listed in QA_SCENARIOS.md with a cleanup step. Agents may not create accounts or enter credentials, so the owner signs in once per simulator.
- **Backend contract drift.** The docs in the repo may not match the live server. Phase 0 includes a contract check (T-007) that records the real response shapes in `docs/api/CONTRACT_NOTES.md` from responses the owner captures or that QA observes, never by calling destructive endpoints.
- **Scope.** Payments, chat and wallet are *not* in scope until the product decision (B-08). The plan removes the fakes rather than building them.
