# QA report: T-008 one working toast system (2026-10-08)

**Result:** PASS · iPhone 17 (iOS 26.5) · Debug build, local backend, Metro :8088 · toasts captured with `simctl io screenshot` bursts (~0.47 s)

1. [PASS] SMOKE-01 — no red screen. (01)
2. [PASS] SafeAreaProvider: Home/Settings header, insets and tab bar match the design audit screenshots. (01, 02)
3. [PASS] SMOKE-04 — empty email login shows inline "Email/Password is required". (03)
4. [PASS] Wrong password → dark "Invalid credentials" toast at safe-area inset + 8, ~3 s, then fades. (04a–c)
5. [PASS] Tap dismisses (<0.5 s). (05)  6. [PASS] Swipe up dismisses. (06)
7. [PASS] PhoneAuth invalid number → error toast + inline error. (07a, 07b)
8. [PASS] Send OTP → "OTP sent successfully", moves to Verify; resend → "Verification code sent again". (08a, 08b)
9. [PASS, deviation] 429 checked via the 3-per-15-min cap (UI countdown matches the 60 s cooldown): server message shown, not "[object Object]". (09)
10. [PASS] Login success toast persists over navigation to Home. (10)
11. [PASS] Logout → "Logged out successfully". (11a, 11b)
12. [PASS] Dark appearance toast readable (#252D44 surface, light text); light restored. (12a, 12b)

## Issues (routed)
- Shared Redux auth error carries over from PhoneAuth to Login (banner shows before any submit) → T-107.
- Double feedback (inline + toast) on login/PhoneAuth errors (PAX-16) → T-603.
- Keyboard covers Login fields; first tap with keyboard up only dismisses it → T-603.
- Dark mode: Login/PhoneAuth stay light, PhoneAuth input renders dark (mixed theme) → T-601/T-603.
- PhoneAuth number field rewrites value on each keystroke; fast typing can scramble (low) → T-603.
- Logout has no confirmation → T-102 (already noted).

**Server data created (local only):** 3 OTPs (log gateway) + one 429 for the seeded passenger; 5 failed + 1 successful email login; no rides.
