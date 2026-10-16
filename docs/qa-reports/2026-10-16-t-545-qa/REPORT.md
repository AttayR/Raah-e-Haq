# QA: T-545 + T-535/T-536 regression (2026-10-16)

QA RESULT: FAIL (one T-545 item)
SCOPE: fix/phase-2-onboarding 2369adf (part B ran with T-537 changes in the working tree)
DEVICE: iPhone 17, iOS 26.5 QA sims, Debug build, local backend

## A) T-545
- PASS: phone helper caption (A01); bio stays above keyboard and Save bar (A02, A10); driver under-18 DOB error visible with the number pad open (A14); DOB Done bar (A03, A14); pending-email banner keeps the address whole, action below, Cancel change works (A07, A08, A11); disabled Save readable in dark (A09); wrong code clears the boxes (A12); driver Edit profile → form, card → Profile (A13, A16); Address/About on Profile, About hidden when cleared (A05, A06, A17).
- FAIL: no Done bar on the multiline "About you" field (passenger and driver, light and dark, 4/4) (A04, A10, A15). The bar does show on Address, which has no accessory id (A18).

## B) T-535 / T-536 regression — PASS
- Home → Booking → back: map remounts centred; Drive map remounts after a ride (B01–B03).
- Tab switches keep state; maps don't reload.
- Full ride #207 (Rs 150; commission Rs 30; net Rs 120): statuses prompt, PIN auto-submits, car moves with correct heading (B05–B10).
- Passenger backgrounded ~40 s while searching: no /api/rides/207 calls while backgrounded, one read on return.
- Online driver on Earnings received ride #208 and switched to Drive (B11).

## New bugs (filed as T-548, T-549)
1. Done bar missing on the multiline bio (medium) — ProfileEditScreen / KeyboardDoneBar / TextField.
2. A saved address cannot be cleared ("Enter your address.") — form.ts ~138 (low; backend may also reject empty).
3. Tab highlight pill stuck on Account after a theme switch (intermittent, low) — TabBar.tsx (B04).
4. During the trip the passenger map shows no drop-off marker/route and the camera doesn't follow the car, so it can leave the screen (B08) — product/UX.

## Data
Ride #207 completed, #208 cancelled free; all temporary profile changes restored; driver offline; no active rides.
