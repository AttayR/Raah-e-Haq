# QA: UI-R6, T-565, T-566, T-567, T-568 (2026-10-18)

QA RESULT: FAIL (steps 2, 7, 8 and bug 3; plus 2 small layout bugs). Everything else passes.
DEVICE: iPhone 17, iOS 26.5 QA sims (passenger FFD40F6E…, driver E375B9F1…), installed Debug apps on Metro 8081 at 85e9ebc (no native change since a203b81). Local backend only (`.env.development` → localhost:8000, mail and SMS log drivers).
Animations and immediate taps were judged from `simctl recordVideo` frame sheets (`*-contact.jpg`). Pickup camera blocked on the sim; parcel #233 pickup done locally.

## UI-R6
1. Login light/dark: no wallpaper or hero, logo badge, title, Phone|Email, "Create account" visible (01, 02, 11, 13). PASS
2. Email segment with the keyboard up: Sign in and "Forgot password?" stay under the keyboard; needs a manual scroll (03, 04). FAIL (bug 4)
3. Inline validation and wrong password "Invalid credentials", no toast (05, 06, 11). PASS
4. Forgot-password sheet: prefill, invalid email, sent state, scrim slide-out, dark (07–10, 12). PASS
5. PhoneAuth step 1: +92, Done bar, sticky Send above the keyboard (gap fine on iPhone 17), pasted numbers normalised (14–16, 22, 23). PASS
6. PhoneAuth step 2: Verify disabled at 5 digits and during resend, countdown and expiry, Change number, back, OTP sign-in (18–21). PASS with bugs 3 and 5. Unconfirmed: re-entering within the cooldown, the first Send tap did nothing.

## T-565 / T-568
7. Tap within ~0.25 s of a sheet closing is swallowed (51); from ~0.3 s it registers (28, 30, 48). FAIL (bug 2)
8. Cancel ride → Keep Ride → Cancel ride within 0.3–0.5 s is ignored (3/3); works at ~1.5 s. Fading text never swaps (27). FAIL (bug 1)
9. confirm() then a sheet opens normally. PASS
10. Rating, AC, safety and overcharge report sheets slide out with their text (32, 34–36). PASS
11. Women-mode fallback slides out on accept, asks again after a re-queue (37–39). PASS
12. Driver parcel refuse/return sheets keep title and reasons while closing (41, 45, 46). PASS (number pad lingers ~0.2 s after Cancel)
13. Booking-error ModernModal "Not now", next tap registers (47, 48). PASS; bug 6 seen here (29).

## T-566
14. Refused parcel #232: no report button (42). PASS
15. Free-cancelled normal ride #229 still offers it (31); returned parcel #233 offers it per server can_report. PASS

## T-567
16. Driver +923009990567 (user #28): emergency name/relation saved in the DB (49). PASS
17. Inline "Registration received" banner, no toast (50). PASS
18. Refused parcel receipt "No charge" (43, 44). PASS
19. Ride ID on one line (33, 44). PASS
20. Parcel pickup "Waiting for the sender" (40). PASS
21. "Verify number" one line (47). PASS

## Visual (not blocking)
- Dark Login: selected segment pill low contrast (11, 13).
- Driver wizard: Bike selected still lists car makes.
- Payout step: sticky Continue covers the Account number field with the keyboard up; once a "Please fix the highlighted fields." toast with nothing highlighted.
- LogBox "Open debugger to view warnings." twice on the passenger sim (text not readable).

## New bugs (filed as T-570, T-571)
1. Taps lost for up to ~1 s after a confirm() dialog closes (medium) — `Dialog.tsx` DialogHost / `useQueuedModal` dismissing hold. → T-571
2. Tap during a sheet's ~0.25 s slide-out is swallowed (low–medium) — `BottomSheet.tsx`: stop catching touches when the close starts. → T-571
3. PhoneAuth "code sent" toast covers the step-2 title (20, 25) (low). → T-570
4. Email sign-in leaves Sign in / Forgot password under the keyboard (03, 04) (medium). → T-570
5. PhoneAuth step 2: sticky footer cuts off "Change number" with the keyboard up (24) (low). → T-570
6. A sheet opened while another is closing comes up full height with a blank half (29) (low). → T-571

## Local data
Rides #229–#233 (none active; #231 logged a decline for driver 2; #230 has AC refund Rs 50, an overcharge report and safety incident #4). User #28 pending driver (+923009990567). Temporary changes restored: tiers inactive, driver 2 opt-in/gender cleared and women-mode suspension lifted, user 3 gender and phone_verified_at restored. Sims: passenger 3 on Home, driver 2 offline.
