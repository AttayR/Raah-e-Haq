# Phase 0 gate regression (2026-10-08)

**Result:** Phase 0 gate PASS — no Phase 0 regressions. SMOKE-01/02/03/04 PASS; AUTH-OTP-01 FAIL on the known OTP-on-screen hole (AUTH-02, owned by Phase 1 T-101).
**Device:** iPhone 17, iOS 26.5 · fresh Debug build · local backend · Metro :8088

- SMOKE-01 PASS (01). SMOKE-04 PASS (02, 03; network-off simulated by stopping the local backend). SMOKE-02 PASS passenger tabs + logout (10–14, 17). SMOKE-03 PASS driver login offline by default, tabs, logout (18–24).
- AUTH-OTP-01: send/verify works within the 60 s TTL (04, 09); the "Your OTP Code" box and "Use This OTP" button are still shown (PhoneAuthScreen.tsx:266-284) → T-101.

## New issues (routed)
- OTP field shows 6 digits but fails the 4–6 digit check with pasted/auto input → T-101/T-603.
- No expiry countdown / "code expired, resend" hint (TTL 60 s) → T-101.
- Driver map opens on Karachi instead of device location → T-402.
- Home pull-to-refresh silent when backend is down → T-506.
- Verify screen: keyboard covers field/button, no back button on PhoneAuth/Verify → T-603.
- Seeded driver has users.is_available=1 while app shows Offline → BE-06.

**Server data (local):** 2 OTP sends, 2 logins, 2 logouts; no rides created.
