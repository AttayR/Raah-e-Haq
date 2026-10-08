# QA report: T-111 phone OTP refusal states (run 2026-10-08-T-111)

**Result: PASS** (with the scope deviations below). iPhone 17 (iOS 26.5), Debug build, Metro :8088, local backend only (`.env.development` → localhost:8000, SMS_DRIVER=log).

## Scope deviations
- Made-up numbers +923009990001/02/03 (no account) were used instead of passenger@'s number. The backend answers known and unknown numbers identically (BE-27/SEC-13), so the app's refusal handling is the same. The known-number path was not driven.
- OTP_TTL_SECONDS was temporarily 600 s (tool round-trips were too slow for 5 tries in 60 s); the countdown follows the server's `expires_in`.
- For check 3 the single SMS budget slot was taken with `RateLimiter::hit(SmsService::BUDGET_KEY)`.
- Backend `.env` restored byte for byte, `cache:clear`, server restarted; config back to ttl 60 / budget 500 / ip max 50 (orchestrator re-checked).

## Results
1. Burned code (5 wrong codes): PASS. Inline + toast "Too many incorrect attempts…", input cleared, burned notice, resend countdown from server `retry_after`, Verify sends nothing while burned, Resend clears the state (02–20). An `otp_send_limit` on the 4th send in 15 min showed the server text and the right countdown (14).
2. Cooldown: PASS. Client blocks same-number resend inside a session; after a relaunch the server's "Please wait…" shows (24, 27). A different number is not blocked (25, 26).
3. SMS unavailable: PASS. Server message instead of the generic error; send blocked with a countdown (29, 30).
4. otp_ip_limit + email fallback: PASS. Message, hint, "Sign in with email" button and countdown (31). Minor: lands on the Phone tab (32).

## Visual issues → T-113 / design track
- Number-pad keyboard covers Send/Verify, with no way to dismiss it; the first tap on Verify sometimes only closes the keyboard (00).
- Disabled Verify looks the same as enabled (05, 06, 12).
- "Code expired" and the old "Invalid or expired OTP" show together (05).
- The "Sign in with email" pill has no horizontal padding (31); the card scrolls under the header with the keyboard up (23, 25).

## New bugs (→ AUTH-18, T-113)
1. Expected refusals (503/429) log through logger.error → red LogBox in dev (33). Should be warn/info.
2. Global refusals (sms_unavailable, otp_ip_limit) only block the typed number.
3. Send success copy says a code was sent even when the server says "If this number is registered…".
4. Email fallback lands on the Phone tab.
5. A stale-HMR redbox (`verifyPhone.pending` undefined) went away on cold relaunch, so it is not a bug (00-stale-hmr-redbox.png).

Server data: no rides, no reseed, no real accounts touched; `raahehaq:otp-reset` was run on the made-up numbers only.
