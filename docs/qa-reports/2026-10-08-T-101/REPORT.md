# QA report: T-101 Stop displaying/persisting OTP

- Date: 2026-10-08
- Result: **PASS**
- Device: iPhone 17 (iOS 26.5) simulator, Debug build, Metro :8088 (branch fix/phase-1-auth working tree)
- Backend: local only (`.env.development` API_URL=http://localhost:8000/api, checked before sign-in)
- Account: seeded local passenger (phone masked in screenshots)

## Steps
1. **PASS** AUTH-OTP-01: Verify step shows only the code field, "Code expires in", "Resend code in" and Change Phone Number. No OTP value, no "Use This OTP", no "Test Code". (02-verify-step-no-otp.png)
2. **PASS** Countdown: seconds under a minute, m:ss above; on expiry "Code expired. Please request a new code." and Resend Code appears; Verify sends no request while expired (backend attempt counter unchanged). (04, 05, 06, 12)
3. **PASS** Double send within 60 s: local countdown blocks the second send; server 429 "Please wait before requesting another code." shown with countdown from retry_after; daily-cap 429 shown with long countdown. (03, 08)
4. **PASS** Spaced/pasted code `241 469` sanitized to 6 digits; verify succeeds → Home. (13, 14, 18)
5. **PASS** Relaunch after verify stays signed in; persisted state holds no OTP (`otpData:null`, `isOtpSent:false`). Kill mid-flow reopens on Welcome, not Verify. (09, 15)
6. **PASS** Five wrong codes: tries 1-4 "Invalid or expired OTP", 5th "Too many incorrect attempts…", then Verify blocked and Resend shown. (16, 17)

## Visual / other issues (routed)
- Number keypad covers Send Code / code field / Verify Code, no Done key, tap-outside doesn't dismiss (medium) → T-603.
- Disabled Send/Verify buttons look enabled (low) → T-603.
- Expected 4xx on OTP send/verify logged via logger.error → red Debug LogBox banner (`apiThunks.ts:107`) (low) → T-107.
- Server "Please wait…" message stays after countdown ends (low) → T-603.
- Outside T-101: Home status-bar text dark on navy header; promo card "Valid until Dec 31, 2024" hardcoded → existing design/dynamic-content tasks.

## Logs and data
- No OTP values in app or backend logs (logger redacts; backend masks phone).
- Server data: OTP records only for the seeded passenger (~10 sends, 1 good verify, 5 failed). No rides. No migrate:fresh.
- Local backend `.env` OTP limits were raised temporarily for the run, then restored from backup and the server restarted.

Screenshots: 00-start.png … 18-paste-style-retest-not-submitted.png in this folder (phone and codes masked).
