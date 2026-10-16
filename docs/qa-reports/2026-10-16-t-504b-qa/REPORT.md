# QA: T-504b profile edit (2026-10-16)

QA RESULT: FAIL (one UX bug; all functional flows pass)
SCOPE: T-504b (commit f49306a, fix/phase-2-onboarding), scenarios 1-5
DEVICE: iPhone 17, iOS 26.5 sims (passenger FFD40F6E…, driver E375B9F1…), Debug build, local backend only

## Steps
1. Profile edit (passenger and driver): prefilled from the server, Save disabled until a change, "Discard changes?" guard, save shows "Profile updated." and Profile shows the new name; bio checked in the DB. PASS (01–04, 14, 19)
2. Driver DOB under 18: field error "Drivers must be at least 18 years old.", no `/api/profile` request. PASS (18). With the number pad open, the error is hidden behind the keyboard and Save bar; the pad has no Done key (17).
3. Email change: Current password field appears; wrong password gives a field error and stays signed in; correct password sets `pending_email` and shows the banner; "Cancel change" clears it. PASS (05–08). The server returns the same text for a missing and a wrong password.
4. Change number: code step; wrong code gives "Invalid or expired code." and stays signed in; right code switches the number; Cancel change clears `pending_phone`; number changed back. PASS (09–12)
5. Dark mode renders correctly (15). FAIL: the focused "About you" field stays hidden behind the keyboard and the sticky Save bar, 2/2, light and dark (13, 16).

## New bugs (filed as T-545)
1. Keyboard hides the focused bio and the DOB error on Edit profile (medium, UX). `src/features/profile-edit/screens/ProfileEditScreen.tsx`.
2. Phone row helper text truncated on iPhone 17 (low).
3. Bio and address never shown on Profile (`ProfileInfoList.tsx`) (low, product).
4. A wrong code is not cleared on the Change number code step (`useChangePhone.ts`) (low).
Also: the pending-email banner wraps the address mid-word; low contrast of the disabled Save in dark mode; driver Account "Edit profile" opens the Profile view, not the form.

## Data
No rides. Temporary changes on passenger id 3 and driver id 2 were restored and checked in the DB. 4 phone codes used on id 3 today.
