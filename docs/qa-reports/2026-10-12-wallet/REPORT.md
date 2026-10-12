# QA: wallet (2026-10-12-wallet) — BLOCKED

Both QA sims were signed out after a reseed and the seeded accounts had random phones, so the local OTP code did not apply; password sign-in was refused by the permission policy (not worked around). Fixed by BE-71 (fixed +92300999xxxx numbers). Native rebuild with the MDI font succeeded; login-screen icons render (no "?" boxes). New: passenger sign-up shows driver steps (T-208). Re-run pending.
