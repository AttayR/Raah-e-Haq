# QA report: T-201 retry 2, focused re-run (2026-10-09-T-201b)

**Result: PASS.** Check 4 needs the AUTH_PENDING_LOGIN_TOKENS=false config to reach its screen.
- iPhone 17 (iOS 26.5), Debug build, local backend.
- OTPs used the BE-61 local test code with +92300999xxxx numbers.

| # | Check | Result |
|---|---|---|
| 1 | Edge swipe on the code step does nothing. Leave confirm: Stay keeps the step; Leave returns to Login, and Create New Account works again. (Android back is covered by usePreventRemove; not driven.) | PASS |
| 2 | "Go to Sign In" shows the confirm. After Leave only Login is left on the stack. | PASS |
| 3 | No email autocorrect on Login or registration. | PASS |
| 4 | Driver (Rickshaw) verify succeeds. Local AUTH_PENDING_LOGIN_TOKENS=true signs the pending driver in to account status, so the "Number verified" screen only appears when the flag is false. | PASS (config note) |
| 5 | Passenger: a wrong code shows an inline error; the right code signs in with no prompt. | PASS |
| 6 | Typing clears the phone error. An empty password shows no meter. | PASS |

## Notes
- The code step has no visible back button; "Go to Sign In" is the way out.
- Once, while the numeric keyboard was up, focus went to the wrong emergency-contact field. Possibly a simulator quirk; check by hand later.

## Server data (local)
- +923009990021 passenger, verified.
- +923009990022 driver, pending, verified phone, 6 sample photos.
- +923009990023 passenger, unverified.
- No rides.
