# Shared · Profile (view + edit, both roles)

- **Tasks:** UI-R16 (absorbs the rest of T-618). Built on T-504/T-504b (real fields, photo upload), T-545 (edit form, keyboard reveal, account checks), T-542/BE-94 (photo review), T-507/T-514 (driver stats and vehicle), BE-07 (public rating). Delete account entry (§P6) ships with UI-R18 (`shared-support-invite.md` §D).
- **Routes:** `Profile` (opened from the Account profile card), `ProfileEdit`, `ChangePhone` (both stacks). Code: `src/screens/Passenger/Passengerprofile.tsx`, `src/screens/Driver/DriverProfile.tsx` → **one** `src/features/account/screens/ProfileScreen.tsx` with role-specific blocks (the two files become re-exports or are deleted after grep); `src/components/passenger/settings/{ProfileIdentity,ProfileInfoList}.tsx`; `src/features/profile-edit/screens/*`.
- **Revision:** 2026-10-20 (UI-R16). Archetypes: Profile = **Detail**, Edit profile = **Form** (DESIGN_SYSTEM §12.2).
- **Before shots:** `docs/qa-reports/2026-10-16-t-545-qa/A05-profile-shows-about-light.png` (passenger), `A16-driver-card-opens-profile-light.png`, `A17-driver-profile-address-about-light.png` (driver), `A01-edit-profile-light-phone-helper.png` (edit); 2026-10-11 dark: `docs/design/audit/2026-10-11-prod-audit/passenger-profile-v2-dark.png`, `driver-profile-dark.png`.

## P0. What is wrong today (pt, iPhone 17)

| # | Defect | Where |
|---|---|---|
| P-1 | **Hand-made header**: back IconButton + `h2` 22 title + ghost "Edit", inside the scroll content, so it scrolls away and the title is 22 instead of the Header `standard` 17 at x = 56 | A05 / A16 y 80–125 |
| P-2 | **Roles differ.** Driver has 3 StatTiles (Rating "New", "36 Total trips", "Rs 8,805 Total earned", 96 high each, icon discs), an approval pill and Vehicle + Driving licence groups; passenger has no stats at all although `GET /me/stats` serves passengers too (`total_rides`, `total_distance_km`, `rating`) | A16 y 373–553 vs A05 |
| P-3 | Driver "Total earned" duplicates the Earnings tab (and the StatTile value shrinks to fit at 1.3x); the Vehicle and Driving licence groups duplicate Vehicle & documents (UI-R17 now owns the licence with a masked number; here it is shown in full: "LHR-352002") | A16 y 500, A17 y 650–970 |
| P-4 | Stat tiles: 3 separate cards, each with a 32 navy disc; the "New" rating has a navy star (the rating star is saffron since UI-R21, M2) | A16 y 415–553 |
| P-5 | Personal info rows show a "Verified" success pill on Phone, but the email's state is missing (`email_verified` is sent) | A05 y 441 |
| P-6 | Nothing at the bottom: no Delete account (store rule), so the screen ends in empty space on the passenger side (A05 y 735–1000) | A05 |

## P1. Data (real fields only)

| Source | Field | Used for |
|---|---|---|
| `apiAuth.user` (`ProfileResource`) | `name`, `profile_image_url`, `profile_image_review`, `pending_profile_image_url`, `profile_image_rejection_reason`, `role`, `status`, `created_at`, `phone`, `phone_verified_at`, `pending_phone`, `email`, `email_verified`, `pending_email`, `gender`, `date_of_birth`, `address`, `bio` | Identity (§P2), info rows (§P4), account checks |
| `GET /me/stats` (`useMyStats`, focus-gated, 60 s cache) | `rating`, `total_rides`, `total_distance_km`, `member_since` (both roles) | Stats strip (§P3). **Not** `total_earnings` / `total_spent` (money lives in Earnings / Activity) |
| `GET /profile/documents` (`useMyVehicles`, only if already cached or on Profile focus for drivers) | first approved vehicle `make`, `model`, `license_plate`, `vehicle_type`; any `rejected` item | Driver vehicle row (§P5) |
| `GET /auth/profile` | refresh on focus (as the driver screen does today, both roles now) | photo review decisions show up |

Never read `user.total_rides` (stale column, BE-130 f).

## P2. Profile view: order and anatomy (both roles)

`Screen` edges top+bottom, `Header variant="standard"` tone `background`: back (x = 4, 44 target), title "Profile" / "Profile" at x = 56, trailing text action "Edit" / "Edit karein" (`buttonSmall` `primaryText`, 44 target) → `ProfileEdit`. Content: `ScrollView` with pull to refresh (re-reads `/auth/profile` and `/me/stats`), padding 16 horizontal, 8 top, `max(insets.bottom, 16) + 24` bottom, sections 24 apart.

1. **Identity block** (centred column, gap 12):
   - `ProfilePhotoEditor` Avatar 96 with the 20 camera badge (§5.13); tap opens the existing photo sheet (Take photo / Choose from library / Remove photo when set / Cancel). Upload ring 3 pt `primary`.
   - Name `h2` (22/28/700) `textPrimary`, centred, `numberOfLines 2`.
   - Meta `bodySmall` `textSecondary` centred: "{Rider|Driver} · Member since {Jul 2026}" (`formatMonthYear(created_at)`; without a date only the role word). 4 below the name (gap override inside the text pair).
   - Pill only when `status === 'pending'` (warning "Pending approval"); active drivers no longer show "Approved" (same rule as Account §3).
   - `PhotoReviewBanner` (driver, existing) 12 below when a photo is pending or rejected.
2. **Account checks** (`AccountChecks`, existing Banners, `actionPlacement below`), 24 above, only when needed.
3. **Stats strip** (§P3).
4. **Personal info** group (§P4).
5. **Driver only:** "Vehicle" group with one row (§P5).
6. **Account actions** group (§P6).

## P3. Stats strip (replaces the 3 StatTiles; new `ProfileStats` in `src/features/account/components`)

- One `Card` (radius 16, padding 16 vertical / 8 horizontal, `surface`), `flexDirection row`; three cells `flex 1` (equal widths), `alignItems center`, gap 2; between cells a 1 pt `border` vertical rule, height 40, `alignSelf center`.
- Cell = value line (minHeight 28) over label:

| Cell | Value | Label en / ur-Latn |
|---|---|---|
| Rating | `rating` not null: `star` 20 `ratingStar` + 4 + `numericL` (22/28/700) `textPrimary` `rating.toFixed(1)`. Null: `title` `textSecondary` "New" / "Naya" | Rating / Rating |
| Trips | `numericL` `total_rides` (thousands separator) | Trips / Trips |
| Distance | `numericL` `formatDistance(total_distance_km)` without the unit, unit as `bodySmall` `textSecondary` " km" on the same baseline | Distance / Faasla |

  Labels `caption` `textSecondary`, 1 line (2 at 1.3x), centred.
- Height: 16 + 28 + 2 + 16 + 16 = **78** (iPhone 17); cells 402 − 32 − 16 − 2 = 352 / 3 = 117.3 each.
- **Loading** (no cached stats): the strip renders with three 48×20 skeleton bars (radius `sm`) in the value slot and the real labels, same 78 height. **Failed** with nothing cached: the strip is hidden and a `caption` `textSecondary` line "Couldn't load your stats. Pull down to try again." / "Aap ke stats load nahi ho sake. Neeche khench kar dobara koshish karein." takes its place (16 high, no layout jump below it beyond the strip's height difference). **Zero trips**: shows "0" and "0 km" (real values); rating "New".
- Accessibility: one element per cell, label "Rating 4.8" / "Rating: new", "36 trips", "412 kilometres".

## P4. Personal info

`ListGroup` title "Personal info" / "Zaati maloomat"; read-only `ListItem variant="settings"` rows, 40 tiles, two lines (title `body`, value `bodySmall` `textSecondary`, `subtitleNumberOfLines 0` for Address and About), no chevrons. Rows with null/blank values are hidden. Order and trailing:

| Row | Icon | Trailing |
|---|---|---|
| Phone `{formatPhone(phone)}` | `phone` | success Badge "Verified" / "Verified" when `phone_verified_at` |
| Email `{email}` | `email` | success "Verified" when `email_verified`; warning "Not confirmed" / "Confirm nahi hua" when false (the Banner above says what to do) |
| Gender | `account` | — (value through the existing label map, never the raw enum) |
| Date of birth `{formatCalendarDate}` | `calendar` | — |
| Address | `pin` | — |
| About | `info` | — |

When every row is hidden (new account with phone only is impossible; phone always exists after BE-37), the group is replaced by a ghost Button `md` "Add your details" / "Apni maloomat add karein" → `ProfileEdit`.

## P5. Driver "Vehicle" row

`ListGroup` title "Vehicle" / "Gaari", one pressable row → `DriverDocuments`: leading 40 tile with the vehicle glyph for `vehicle_type` (`car`/`bike`/`rickshaw`, BE-126 per-vehicle type when sent), title `body` "{make} {model}" (or "Vehicle & documents" when no vehicle is cached), subtitle `bodySmall` `textSecondary` plate "{license_plate}"; trailing warning Badge "Action needed" when anything is rejected or the licence is expired, else chevron. The licence number and expiry are **not** shown here any more (they live in Vehicle & documents, masked; UI-R17). Remove `VehicleCard` and the licence group from Profile after grep.

## P6. Account actions (UI-R18)

`ListGroup` (no title), 24 above, two rows:
1. "Change password" / "Password badlein" (`lock`, chevron) → **only if** the app has a change-password screen by then (`POST /profile/change-password` exists; no screen today). Until then the row is not rendered. Not part of UI-R16/UI-R18 scope.
2. **"Delete account" / "Account delete karein"**: destructive row (`accountRemove` glyph = `account-remove-outline`, add to `icons.ts`; `dangerSoft` tile, `danger` glyph and title), no chevron → `DeleteAccount` (shared-support-invite §D). Always rendered for both roles (store rule: reachable in ≤ 3 taps: Account → Profile → Delete account).

## P7. Edit profile (T-545 form; UI-R16 deltas only)

The T-545 spec stays normative (sticky footer "Save changes", keyboard reveal ≥ 12, iOS Done bar, Mobile number group with row helper, account-check Banners `actionPlacement below`, discard Dialog when dirty, server `errors.*` mapped to fields). Deltas:
1. Header `standard` "Edit profile" with the back action only (no header Save; already true). Verify on SE that the footer button sits at `insets.bottom + 8` (min 16) and 8 above the keyboard while typing.
2. Fields order (both roles): photo (Avatar 96 + "Change photo" ghost `sm`) · Full name · Email · Gender (SegmentedControl Male | Female | Other) · Date of birth (driver 18+, BE rule) · Address · About you (multiline, counter `caption` `textMuted` "{n}/{BIO_MAX}" end-aligned under the field). 16 between fields.
3. Gender stays editable on both roles: women mode reads the separate admin-set `verified_gender` (BE-87, `WomenMode`), so the self-declared `gender` field does not change a driver's eligibility; no lock or helper is needed.

## P8. States (Profile view)

| State | Spec |
|---|---|
| Loading | Never blank: identity and info come from the stored user. Stats per §P3. |
| Refresh failed | Toast error "Couldn't refresh your profile." / "Profile refresh nahi ho saka."; content stays. |
| Offline | Offline Banner under the Header; "Edit" stays enabled (the form shows its own offline state and disables Save); photo change disabled with Toast "You're offline" / "Aap offline hain". |
| Photo under review (driver) | Approved photo in the avatar, pending one labelled "Under review" in `PhotoReviewBanner` (BE-94, unchanged). |
| Long name / long About | Name wraps to 2 lines then ellipsis; About shows in full. |
| SE | Identity 96 avatar stays; stats cells 375 − 48 − 2 = 325 / 3 = 108; `numericL` "1,204" fits (≈ 62 pt). |
| 1.3x | Stats values may shrink to 0.85 (`adjustsFontSizeToFit`, `minimumFontScale 0.85`) before wrapping; labels wrap to 2 lines; info values wrap freely. |
| Dark | Same tokens; strip rules `border` dark; star `ratingStar` 5.19 on dark `surface`. |

## P9. Copy (keys under `profile.*`, en + ur-Latn)

| Key | en | ur-Latn |
|---|---|---|
| `title` | Profile | Profile |
| `edit` | Edit | Edit karein |
| `roleRider` / `roleDriver` | Rider / Driver | Sawari / Driver |
| `memberSince` | Member since {date} | {date} se member |
| `statRating` / `statTrips` / `statDistance` | Rating / Trips / Distance | Rating / Trips / Faasla |
| `statsFailed` | Couldn't load your stats. Pull down to try again. | Aap ke stats load nahi ho sake. Neeche khench kar dobara koshish karein. |
| `personalInfo` | Personal info | Zaati maloomat |
| `emailNotConfirmed` | Not confirmed | Confirm nahi hua |
| `addDetails` | Add your details | Apni maloomat add karein |
| `vehicleGroup` | Vehicle | Gaari |
| `deleteAccount` | Delete account | Account delete karein |

## P10. Low literacy

- The three stats are glyph-led numbers with one-word labels; the rating is always a star + number.
- Verified states are a pill with a word, not a tick alone.
- Delete account is red, alone in the last group, and never next to Edit.

## P11. Performance

- One stats request per focus at most every 60 s (shared `useMyStats` cache with Drive/Earnings); the documents call only for drivers and only on focus (cached 60 s, shared with Vehicle & documents).
- `ProfileStats`, `ProfileInfoList` are `React.memo` with primitive props; the avatar image is the server's ≤ 1024 px JPEG (BE-94) displayed at 96 with `resizeMode cover`; no image prefetch.

## P12. Review checklist (UI-R16, Profile)

Light and dark, iPhone 17 and SE, default and 1.3x, en and ur-Latn, Ali (passenger) and Bilal (driver):
1. Header `standard` with "Edit"; title 17 at x = 56; content scrolls under it with the hairline.
2. Identity identical on both roles except the role word; no "Approved" pill.
3. One stats strip, 78 high, Rating / Trips / Distance from `/me/stats` on both roles; no earnings; skeleton and failed states as §P3.
4. Personal info rows with Verified / Not confirmed pills; no licence number anywhere on Profile.
5. Driver: one Vehicle row to Vehicle & documents.
6. (UI-R18) Delete account row at the bottom, destructive style.
7. Edit profile: T-545 behaviour intact; field order and the About counter as §P7.
8. Code greps clean; one `ProfileScreen` for both roles.
