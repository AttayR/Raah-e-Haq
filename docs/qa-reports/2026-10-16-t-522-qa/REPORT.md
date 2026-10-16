# QA: T-522 AC tier, women mode, parcel (2026-10-16)

QA RESULT: FAIL (two high bugs; pickup camera BLOCKED on the simulator)
SCOPE: app f3bcf89 (parts B–C ran on 88aa88a JS), backend 9bb84a6; iPhone 17 QA sims; local backend; tiers and test data set locally and restored afterwards.

## A) AC — PASS
Car AC option with badge (after the 1 h catalogue cache refresh), booking #212, AC driver gets the badge, "AC not working?" during the trip and on the receipt, automatic Rs 50 refund, driver Vehicle AC screen (A01–A07).

## B) Women mode — FAIL (B4)
- PASS: disabled with date when not eligible (B01); one availability request (B02); male driver never gets a women-mode ride; verified female driver gets it (B04, B07); women's-safety SOS (B08, B09); receipt report status from the server (B10, B12); driver Account row (B13).
- FAIL (high): with state no_female_drivers_nearby the fallback sheet never appears, the inline "Allow any driver" is hidden and "Cancel ride" opens nothing — the passenger is stuck (B03). Likely a modal BottomSheet inside the booking sheet that never presents but blocks the next modal.

## C) Parcel — FAIL (C10)
- PASS: Home entry (C01); client validation (C03, C06, C07); booking #215 with timeline and masked receiver (C09); driver card (C10); refuse at pickup (C14); resend countdown stops at 0 (C16, C17).
- BLOCKED: pickup photo — camera only, simulator has no camera (C11, C12). Pickup for #216 run through the API.
- FAIL (high): after entering the delivery code the ride completes but the number pad stays and the driver screen ignores all touches until relaunch (C18).
- FAIL (medium): after pickup the banner and trip-complete card still say to collect cash (C18).
- FAIL (medium): a parcel refused at pickup shows the sender "Your driver cancelled this ride" with no refusal reason (C15).

## New bugs (T-560 high, T-561 others)
1. High: women-mode fallback sheet never shows; blocks Allow any driver and Cancel.
2. High: driver app frozen after the parcel delivery code (stuck modal + keyboard).
3. Medium: parcel cash wording after pickup.
4. Medium: refused parcel shows a generic cancel message to the sender.
5. Medium-low: Account Parcels row keyed on the driver's first vehicle type; an approved bike as a second vehicle never sees opt-in.
6. Low: parcel form footer covers suggestions; receiver phone pad has no Done bar; "Car ac" in history; Home parcel entry below the fold; no AC badge / women-mode marker on the driver's active ride; sender pickup wording; plate chip clips long plates; newly activated tiers hidden for up to 1 h by the catalogue cache.

## Data
Rides #212–#216 created (completed/cancelled); AC dispute #2 auto-upheld; incidents #2 and #3 open; all temporary settings restored; no active QA rides.
