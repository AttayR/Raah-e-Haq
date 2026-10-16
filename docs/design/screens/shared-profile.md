# Shared · Profile (view + edit)

- **Task:** T-618 after T-504 (profile real fields + photo upload), BE-15 (stats in profile), BE-08.
- **Route:** `Account → Profile` (tap the profile header in shared-settings); `ProfileEdit`.
- **Audit:** `audit/passenger-profile-*`, `driver-profile-*`.
- **Data:** `GET /profile` / `GET /auth/profile` → `name`, `email`, `phone`, `profile_image`, `gender`, `date_of_birth`, `address`, `bio`, `pending_phone`, `pending_email`, `phone_verified_at`, `status`, `role`, `rating`, `total_rides`, `created_at` [BE-15]. Update: `PUT /profile`; avatar: `POST /profile/avatar` (multipart).

## Profile view
`Screen scroll`, Header (back, title "Profile", trailing text action "Edit"), background `background`.

1. 16 gap: **Identity block** centred: Avatar 96 with camera badge (5.13) → 12 → `h2` `{name}` → 4 → `bodySmall` `textSecondary` role label "Rider" / "Driver" (no raw "( passenger )") + " · Member since {created_at month year}" (hidden if absent).
2. 16 gap: **Stats row** (Card, 3 equal columns divided by 1pt `border` 40 high): `numericL` `{rating}` + star 16 / `caption` "Rating" ("New" if null) · `numericL` `{total_rides}` / `caption` "Rides" (driver "Trips") · `numericL` years/months since `created_at` ("8 mo", "2 yr") / `caption` "With us". Columns with missing data show "–" in `textMuted`. No invented values.
3. 24 gap: `overline` "Personal info".
4. 8 gap: Card ListItems (two-line, no chevrons, not tappable): "Phone" `{phone}`, "Email" `{email}` (+ Badge success "Verified" if the API marks it), "Gender" `{gender}`, "Date of birth" `{date_of_birth}` formatted, **[T-545]** "Address" `{address}` (icon `pin`) and "About" `{bio}` (icon `info`), both shown in full (no line cap, §5.8). Rows with null or blank values are hidden. Both roles use the same list.
5. Driver only: 24 gap: ListItem button "Vehicle & documents" (chevron) → driver-vehicle-documents.

## Profile edit
**[T-504b/T-545, supersedes the header Save]** `<Screen keyboardAvoiding>` + kit `KeyboardAwareScrollView` (fields 16 apart), Header (back with discard dialog if dirty, title "Edit profile"), **sticky footer** full-width `primary` Button "Save changes", disabled (solid `fillDisabled` / `textDisabled`, §5.4) until dirty and valid, spinner while saving. The focused field and its error stay ≥12 above the keyboard and the footer (§5.6 Keyboard reveal). Date of birth (number pad) and About (multiline) use the screen's iOS `KeyboardDoneBar` (§5.6).
- **Account checks** at the top (verify number, pending number, pending email, confirm email): Banners with `actionPlacement="below"` (§5.17), so an email or number in the copy keeps the full width.
- **Mobile number** group: `overline` "Mobile number" → 8 → Card with one ListItem (icon `phone`, title the formatted number or "No verified number", trailing value "Change number" / "Verify number" + chevron) → 8 → helper `caption` `textSecondary` at x=16, full width (§5.8 Row helper). The row is read-only; it opens the Change number flow.
1. Avatar 96 centred with "Change photo" ghost Button `sm` under it → action sheet "Take photo" / "Choose from library" / "Remove photo" (only if set) / "Cancel". Upload shows a circular progress ring 3pt `primary` around the avatar; failure: Toast + revert.
2. Fields: Full name, Email (`keyboardType="email-address"`), Gender (SegmentedControl), Date of birth (`YYYY-MM-DD`, number pad; driver 18+), Address, About you (multiline, `BIO_MAX`). The phone is not a text field here (see Mobile number group). Server `errors.*` mapped to fields.

## Driver Account entry [T-545]
The profile header Card on driver Account opens Profile (trailing `chevronEnd` 20 `textMuted`, mirrored in RTL); the "Edit profile" row opens Profile edit directly, matching passenger Profile → Edit.

## States
| State | Spec |
|---|---|
| Loading | Avatar circle skeleton, name line 160, stats skeleton, 3 rows. |
| Saving | "Save" spinner; fields disabled. Success: Toast "Profile updated" and pop. |
| Error | Field errors (scrolled into view, §5.6) or Toast. Change number: a wrong code (422) clears the boxes and keeps the error message. |
| Offline | Edit disabled ("You're offline"); view shows cached. |
