# QA report: T-113 PhoneAuth polish (run 2026-10-08-T-113)

**Result: PASS.** All 7 checks passed. The optional Login loading state could not be captured, because local responses come back too fast.
- Device: iPhone 17 (iOS 26.5), Debug build, Metro :8088.
- Backend: local only (`.env.development` → localhost:8000).
- Numbers: made-up, with no account (+923009990001–07).

## Method
- Backend `.env` was backed up first. During the run:
  - `OTP_TTL_SECONDS=300`;
  - `SMS_DAILY_BUDGET=1` plus one budget hit in tinker, to force `sms_unavailable`;
  - `OTP_IP_DAILY_MAX_SENDS=1`, to force `otp_ip_limit`.
- Afterwards `.env` was restored byte for byte (sha1 matched) and `cache:clear` / `config:clear` were run. The orchestrator re-checked that config is back to 60/500/50.

## Results
| # | Check | Result | Screenshots |
|---|---|---|---|
| 1 | Phone step, keyboard up: compact header, Send visible, Done bar and header tap close the keyboard, first tap on Send sends | PASS | 01–04 |
| 2 | Code step, keyboard up: Verify visible, the first tap with 6 digits sends exactly one verify-otp (backend log 18:28:53), the grey Verify with 5 digits sends nothing | PASS | 05–10 |
| 3 | Disabled Verify and Send are grey in light and dark mode | PASS | 05–07, 12, 14, 18, 19, 21, 23 |
| 4 | Login button while loading | NOT CAPTURED (response too fast) | 25 |
| 5 | Global refusals (`sms_unavailable`, `otp_ip_limit`) block Send even after a digit changes; `otp_cooldown` still lets another number send | PASS | 16–23 |
| 6 | 503 `sms_unavailable` shows no red LogBox, only the yellow warnings bar | PASS | 20 |
| 7 | Neutral copy in the toast and the code-step subtitle | PASS | 05, 18 |
| 8 | Wrong code, then expiry: only the "Code expired" line remains | PASS | 10–12 |
| 9 | "Sign in with email" lands on Login with the Email tab; no second Login underneath; the pill has padding | PASS | 22, 24 |

## Visual issues (outside T-113 → T-204 / T-603 / T-601)
- **Dark mode only half applies on the auth screens.** Themed inputs, disabled buttons and the Done bar sit inside a hardcoded light card and header. The dark disabled fill looks close to navy. The Done bar stays white if appearance changes while the app is running (13, 15–19).
- **Code step:** with the keyboard up, "Change Phone Number" is partly under the Done bar (09).
- **Login Email tab:** the keyboard covers the email field (T-204).
- **Phone step:** Send is enabled with only "+92" typed (01). The inline reason for `sms_unavailable` disappears after a digit changes; only the countdown stays (21).
- **Phone Verification header:** there is no visible back control.

## Server data (local only)
- No rides, no accounts, no reseed.
- OTP sends and refusals on made-up numbers only.
- One failed login for a made-up email.
- `cache:clear` reset the local rate-limit counters.
