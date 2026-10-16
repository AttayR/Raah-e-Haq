# QA: regression of 2026-10-16 app work (HEAD a251b70)

QA RESULT: FAIL (one T-550 regression; everything else PASS or noted)
DEVICE: iPhone 17, iOS 26.5 QA sims; native rebuild with patches/react-native+0.80.1.patch; local backend

## Results
1. Booking (T-534) — PASS: no suggestions under 3 chars, results after the pause, no stale rows, picked pickup kept after Back, swap swaps labels and route, choose on map, map mounts at once (1-01 … 1-10).
2. Ride #209 with one stop (T-549/T-550) — PASS: drop-off, stop pin and route through the stop; camera follows; pan → recentre; completed stop pin removed and route redrawn; reopen mid-trip restores everything; Done returns to booking (2-02 … 2-13).
3. Driver battery (T-537) — PASS: offline marker on Drive; location arrow off on Earnings; online posts at once; nearby car on passenger Home within ~2.5 min (server 2-min bucketing, by design); request received on Earnings (3-01 … 3-06).
4. Wallet (T-547) — PASS with nothing owed (4-01); small-fee note not tested.
5. Keyboard (T-548/T-550) — PASS: DOB and bio Done, Address never (4 reopenings), clearing address works, Add money amount/mobile Done, phone pad Done, tab pill after theme switch. BLOCKED: CNIC field (JazzCash sandbox not configured locally). FAIL: code pad autofocuses with no Done bar (also phone pad after Change Phone Number) (5-18, 5-20, 5-21).

## New bugs (filed T-551, T-552)
1. Phone sign-in Done bar missing when a number pad autofocuses (medium) — PhoneAuthScreen / PhoneAuthParts; maybe RegistrationPhoneStep.
2. Typing in the pickup field appends to "Current location" (low) — LocationSearch / DualLocationPicker (1-04).
3. Driver new-request card doesn't show the ride's stops (medium) (3-04).
4. Trip camera ignores active stops; the stop pin sits under the top-right controls (low) (2-06, 2-08).
Minor: old route stays drawn after Back from the vehicle step; a leftover approach line for one frame at trip start (2-05).

## Data
Ride #209 completed and rated (Rs 175 cash). Final: passenger address/bio null, driver offline, no active rides.
