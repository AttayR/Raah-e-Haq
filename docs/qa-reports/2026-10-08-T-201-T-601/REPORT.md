# QA report: T-201 + T-601 (run 2026-10-08-T-201-T-601)

**Result: FAIL**, fixed in T-201 retry 2 and re-tested in run 2026-10-09-T-201b.
- iPhone 17 (iOS 26.5), Debug build, local backend only.
- OTP codes were set to a known test value with tinker. BE-61 now replaces that step.

## T-201
- **PASS:**
  - per-step inline errors
  - weak password blocked
  - phone sent as +92…
  - wrong-number hint shown
  - wrong code shows an inline error with no sign-out
  - right code signs in with no prompt
  - sign out, then email/password sign-in works
  - driver vehicle types are Car/Bike/Rickshaw/Van, years go up to 2027, Rickshaw register has no 422
  - decoy screens look the same as a real registration
  - payment question removed
- **FAIL → fixed in retry 2:**
  - (A) iOS swipe-back left the code step without the guard
  - (B) "Go to Sign In" left with no confirm
  - (E) email fields autocorrected
- **Partial:** decoy "5 wrong codes" was not reached. Codes kept expiring, and the send cap hit first.

## T-601
- **PASS:**
  - live appearance switch on Login and Account status
  - soft-navy secondary buttons have readable labels (light 13.3:1, dark 9.8:1)
  - Sign Out colour
  - pending-driver amber tone
  - dark cold start with no flash
- **Not caused by T-601 (recorded on design tasks):**
  - Home, Map and Login cards don't follow dark mode, because they use static BrandColors (T-603/T-604/T-605).
  - Status bar is wrong on the navy Home header (screen-level StatusBar, unchanged since before T-601).
  - Map "+" sits under the status bar and can't be tapped (T-304/T-605).
- **Code check:** dark onSuccess is #0B0F1A, 9.23:1 on dark success. A contrast test was added.

## Other visual issues seen
- Login keyboard covers the fields (T-204).
- The "Previous" button is transparent.
- A long email breaks mid-word.
- CNIC photos are marked required but can be skipped.
- The logo is a white square in dark mode.

All of these are in the design / Phase 2 tasks.

## Server data (local)
- Users 8 (passenger, verified) and 9 (driver, pending, unverified) were created.
- No rides.
