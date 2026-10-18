# QA: T-569, T-570, T-571 (2026-10-18)

QA RESULT: FAIL on one new bug (bug 1, in a sheet T-571 did not change). T-569, T-570 and T-571's own fixes pass.
DEVICE: iPhone 17, iOS 26.5 QA sims (passenger FFD40F6E…, driver E375B9F1…), Debug apps on Metro 8081 at 3c7b416. Local backend only (`.env.development` → localhost:8000, SMS log driver).
Timing from `simctl recordVideo` frame sheets (`*-contact.jpg`). MCP taps arrive ~0.05–0.1 s apart.

## T-571
1. Cancel ride → Keep Ride → Cancel ride: dialog fade-out 0.18 s; taps at 0.25–0.35 s brought it back 6/6 (01); taps ≤0.2 s (during the fade) lost 4/4 (02). Was ~1.5 s before. Text never swaps. PASS (limit at the low end)
2. After a confirm, the next tap registers from ~0.25 s; Keep → Safety at 0.25 s opens (07). PASS
3. Scrim close: slide ~0.21 s; tap at ~0.2 s lost (04); ~0.3 s and 0.45 s registered (03). Taps while visibly sliding lost (known native limit). PASS
4. Overcharge sheet after typing: reopens at normal height; Safety 0.4 s later full (05, 06). PASS
5. Parcel code sheet and PIN sheet Cancel with number pad: pad goes down with the sheet (18, 11). PASS (1–2 frame offset)
6. confirm() then a sheet: no freeze (07). PASS
7. Dialog fades smooth light/dark (01, 08). PASS

## T-570
8. Email segment: Forgot password and Sign in above the keyboard for both fields (22, 23). PASS
9. PhoneAuth step 2: inline banner, no toast; Change number visible above Verify (25). PASS (title scrolls off with the keyboard up)
10. Re-entry within 60 s: number prefilled, "Send Code (30s)" disabled (26); other number enabled (27); first Send after the countdown works. PASS
11. Phone sign-in → sign-out → PhoneAuth: no prefill/countdown (28). PASS
12. Dark Login selected segment clearly visible (24). PASS
13. Driver wizard (+923009990571, stopped at Payout, no user created): Make disabled before a type (29), bike makes for Bike (30), Car Toyota → Bike clears (31). PASS
14. Payout: empty Continue marks fields red and visible (32); Account number above Continue and keyboard (33). PASS (toast covers the first red field's label on longer steps)

## T-569
15. Car ride #235: "Passenger didn't come" and passenger copy (09, 10); driver rates "Your passenger" ride tags (12); passenger "How was your trip?" (13). PASS
16. Parcel #236/#237 driver: "Waiting for the sender"; short "No-show" label by layout (full label for screen readers) (14); sheet sender copy and Rs 30 fee line (15). PASS
17. Parcel #237 completed: driver "Your sender" + rider-to-sender tags (19); sender "Your rider", "How was the delivery?" + parcel tags, no "Clean car" (20); both submitted. PASS
18. Sender ride details show parcel tag labels (21). PASS

## New bugs (filed as T-573, T-574)
1. HIGH — a tap during the driver no-show/cancel sheet slide-out presses its destructive button: on parcel #236 a tap ~0.1 s after "Keep ride" hit "Cancel as no-show" and cancelled the ride with a Rs 30 fee (16). `src/components/driver/CancelReasonSheet.tsx` uses its own `<Modal animationType="slide">`, so the T-571 closing guard doesn't apply. → T-573
2. Low — after a parcel ends, "Done" opens the ride planner, not Home (1–4 back taps). → T-574
3. Low — parcel copy still says ride/driver: accept toast "Ride accepted…", "Trip complete", "Keep ride" on the sender no-show sheet, "Your driver cancelled this ride.", "Thanks for riding…", ride details "Your driver" and "Driver asked for more?" label on a parcel. → T-574

## Visual notes
- Wizard: "Please fix the highlighted fields." toast covers the first red field's label after the auto-scroll (Vehicle, Documents).
- While typing in the wizard, the next field sits under the sticky Continue (focused field visible).
- PhoneAuth step 2 title scrolls off with the keyboard up.
- ~1 s without a pressed/loading state after "Request Car".
- No LogBox banner this run.

## Local data
Rides #234 (passenger free cancel), #235 (completed; arrived_at backdated 15 min → Rs 39 waiting fee), #236 (parcel, cancelled as no-show via bug 1, Rs 30 fee), #237 (parcel completed; pickup via tinker; both rated). None active. Parcel tier and driver 2 opt-in restored; cache flushed once. Sims: passenger 3 on Home, driver 2 offline.
