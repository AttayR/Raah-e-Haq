# QA report: T-107 rerun of blocked checks

- Date: 2026-10-08 · Result: **PASS** (OTP completion N/A)
- Device: iPhone 17 (iOS 26.5) simulator, Debug, Metro :8088 (no reloads during the run); local backend only

## Steps
1. **PASS** driver@ login → Driver Home; Map Online/Offline toggled twice: no crash, no red or yellow LogBox, no warn/error in the JS log. (06-11)
2. **PASS** Driver Settings → Sign Out → Login; one /api/auth/logout; no yellow LogBox. (12-14)
3. **PASS** passenger@ Sign Out from Home and from Settings → Login, one logout each, no LogBox; relaunch stays on Login. (15-21)
4. **PASS** Login email field: no duplication on re-focus, delete works (the earlier duplication was input landing late in the simulator, not an app bug). (03-05)
5. **N/A** Phone OTP completion: local SMS driver is `log` and the simulator can't receive SMS; reading the code into chat is not allowed.

## Issues (routed, not T-107)
- Driver online/offline is client-side only, never reaches the backend → T-401.
- Login keyboard covers fields and needs two taps (AUTH-13 / T-603); Driver Settings rows unlabeled; Driver Home header/stat cards clipped; Online toggle style inconsistent; Passenger Settings status-bar contrast; Passenger Home demo data ("$24.50", expired offers) → design track / T-506.

Data: none created; both accounts end signed out. Screenshots: this folder (22 files).
