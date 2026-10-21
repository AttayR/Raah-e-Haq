# Android smoke round 2 (2026-10-21)

Pixel_9_Pro API 37 emulator, Debug APK from 01857c7, local backend. 9/10 PASS. Report text by rh-debugger, saved by the orchestrator.

| Item | Result | Notes |
|---|---|---|
| T-592 keyboard | PASS | Send Code / Verify above the keyboard; Where to sheet above it with back/locate visible; modal sheet field above it (02, 04, 17, 43). |
| T-593 location | FAIL (approximate) | Primer → OS Precise/Approximate dialog works (11, 12). With Approximate only, Home says Turn on location and opens Settings (13, 14). Cause: geolocation's AndroidLocationManager rejects GPS without FINE and the network provider is off (GLA off) → code 2 → mapped to "disabled". → T-712. |
| T-596 driver precise | PASS | Approximate → Turn on precise card; precise → online; downgrade while online → offline once with toast (32–41). |
| T-594 polish | PASS | OTP Enter at 6 digits, label Raah-e-Haq, one Back to Plan your trip, avatar initials, empty-state title full. |
| UI-R9b pin picker | PASS | 21–23. |
| T-708 banner | PASS | Banner on Account, tap opens Drive (36, 37). |
| T-406 | n/a | Realtime off locally (server_disabled), polling worked. |
| Crashes | none | logcat clean apart from known noise. |

New bug: stale route and a default red teardrop marker left on the Android booking map after Choose on map changes the drop-off (19b, 21, 23–25). → T-713.
