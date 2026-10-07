# Shared · Profile (view + edit)

- **Task:** T-618 after T-504 (profile real fields + photo upload), BE-15 (stats in profile), BE-08.
- **Route:** `Account → Profile` (tap the profile header in shared-settings); `ProfileEdit`.
- **Audit:** `audit/passenger-profile-*`, `driver-profile-*`.
- **Data:** `GET /profile` / `GET /auth/profile` → `name`, `email`, `phone`, `profile_image`, `gender`, `date_of_birth`, `status`, `role`, `rating`, `total_rides`, `created_at` [BE-15]. Update: `PUT /profile`; avatar: `POST /profile/avatar` (multipart).

## Profile view
`Screen scroll`, Header (back, title "Profile", trailing text action "Edit"), background `background`.

1. 16 gap: **Identity block** centred: Avatar 96 with camera badge (5.13) → 12 → `h2` `{name}` → 4 → `bodySmall` `textSecondary` role label "Rider" / "Driver" (no raw "( passenger )") + " · Member since {created_at month year}" (hidden if absent).
2. 16 gap: **Stats row** (Card, 3 equal columns divided by 1pt `border` 40 high): `numericL` `{rating}` + star 16 / `caption` "Rating" ("New" if null) · `numericL` `{total_rides}` / `caption` "Rides" (driver "Trips") · `numericL` years/months since `created_at` ("8 mo", "2 yr") / `caption` "With us". Columns with missing data show "–" in `textMuted`. No invented values.
3. 24 gap: `overline` "Personal info".
4. 8 gap: Card ListItems (two-line, no chevrons, not tappable): "Phone" `{phone}`, "Email" `{email}` (+ Badge success "Verified" if the API marks it), "Gender" `{gender}`, "Date of birth" `{date_of_birth}` formatted. Rows with null values are hidden.
5. Driver only: 24 gap: ListItem button "Vehicle & documents" (chevron) → driver-vehicle-documents.

## Profile edit
`Screen scroll keyboardAvoiding`, Header (back with discard dialog if dirty, title "Edit profile", trailing text action "Save" disabled until dirty and valid).
1. Avatar 96 centred with "Change photo" ghost Button `sm` under it → action sheet "Take photo" / "Choose from library" / "Remove photo" (only if set) / "Cancel". Upload shows a circular progress ring 3pt `primary` around the avatar; failure: Toast + revert.
2. Fields: Full name, Email (`keyboardType="email-address"`), Mobile number (phone variant; changing it may require OTP if the API demands, then route to auth-phone-otp), Gender (SegmentedControl), Date of birth (date picker). Server `errors.*` mapped to fields.

## States
| State | Spec |
|---|---|
| Loading | Avatar circle skeleton, name line 160, stats skeleton, 3 rows. |
| Saving | "Save" spinner; fields disabled. Success: Toast "Profile updated" and pop. |
| Error | Field errors or Toast. |
| Offline | Edit disabled ("You're offline"); view shows cached. |
