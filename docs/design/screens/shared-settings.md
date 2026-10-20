# Shared · Account tab (both roles)

- **Tasks:** UI-R16 (absorbs the rest of T-618). Built on T-502 (notification preferences, BE-11), T-523 (language), T-601 (appearance), T-102 (sign-out), T-545 (account checks), T-520 (emergency contacts), BE-86/BE-88/women mode (driver rows). The Help group (Help, Invite, legal rows) arrives with UI-R18 (`shared-support-invite.md`); Delete account sits in Profile (`shared-profile.md` §P6).
- **Route:** `PassengerTabs/Account`, `DriverTabs/Account` (tab 4 of 4). Code: `src/screens/Passenger/PassengerSettingsScreen.tsx`, `src/screens/Driver/DriverSettingsScreen.tsx`, `src/components/passenger/settings/ProfileSummaryCard.tsx`, `src/components/driver/settings/{AppearanceRow,LanguageRow}.tsx`.
- **Revision:** 2026-10-20 (UI-R16 spec, supersedes the 2026-10-08 version of this file). Archetype: **List** (DESIGN_SYSTEM §12.2).
- **Before shots (latest build that shows these screens):** `docs/qa-reports/2026-10-18-ui-r15b/after-pax-account-light.png`, `after-pax-account-dark.png`, `after-pax-account-scrolled-light.png`, `after-drv-account-light.png`, `after-se-drv-account-light.png`, `after-se-drv-account-dark.png`. Today's sims sit on Home/Drive (`docs/design/audit/2026-10-20-account/pax-now.png`, `drv-now.png`); they were not driven because another review agent was using them.

## 0. What is wrong today (measured on the before shots, pt, iPhone 17 402 wide)

| # | Defect | Where |
|---|---|---|
| A1 | **The two roles don't share an anatomy.** Passenger: "YOUR ACCOUNT" (2 rows), "NOTIFICATIONS" (2), "APP" (Appearance with an inline 3-segment control), Sign out. Driver: one "ACCOUNT" group of **8 rows** (Edit profile, Vehicle & documents, AC, Parcels, Ride history, Emergency contacts, Notifications, Phone notification settings), then "APP". Different group names for the same thing ("Your account" vs "Account") | `after-pax-account-light.png` y 282; `after-drv-account-light.png` y 310–890 |
| A2 | Every row has a subtitle, so every row is 82 high (two lines + tile); the passenger list is 5 rows long and already scrolls past the tab bar. The subtitles repeat the title ("Notifications / Choose which alerts you get") | both, rows y 300–465 |
| A3 | **Phone notification settings** is a top-level row on both roles, and also inside Notifications (`NotificationPreferencesScreen`). Duplicate | pax y 633, driver y 873+ |
| A4 | Appearance is a 64-high row plus a 52-high SegmentedControl inside the group (116 pt for one setting); Language next to it is a row with a value and a sheet. Two patterns for two picks in one group | pax y 760–880 |
| A5 | Driver profile card shows a green "Approved" pill on every visit; passenger card shows nothing. Neither shows the rating although `GET /auth/profile` sends `rating` (BE-07 `publicRating()`) | pax y 145–245, driver y 145–273 |
| A6 | Driver "Edit profile" row duplicates the Profile screen's Edit action (passenger has no such row) | driver y 330–410 |
| A7 | No Help & support, Invite friends, Terms/Privacy, app version, or any way to delete the account (store rejection risk: App Store 5.1.1(v), Google Play account-deletion policy) | both |
| A8 | Contact line: passenger shows the raw `+923009990001`; driver shows the email while a verified phone exists | pax y 211, driver y 208 |

## 1. Data (real fields only)

| Source | Field | Used for |
|---|---|---|
| Redux `apiAuth.user` (from `GET /auth/profile` → `ProfileResource`) | `name`, `phone`, `email`, `profile_image_url`, `status`, `role`, `vehicle_type`, `women_mode`, `rating` (number or null, BE-07) | Profile card (§3), role rows (§4) |
| `GET /notifications/preferences` | not read here | (Notifications screen only) |
| Theme provider | `scheme` (`system` / `light` / `dark`) | Appearance value (§5) |
| i18n | `locale` (`en` / `ur-Latn`) | Language value (§5) |
| `GET /settings/public` (cached for the session, shared with Help) | `terms_url`, `privacy_url` **[BE-130]** | Legal rows (§6); hidden until sent |
| `src/config/env.ts` | `APP_VERSION` (package.json `version`) and `APP_BUILD` (native build number via a build-time constant; no new dependency) | Footer (§8) |

Add `rating?: number | null` to the `User` type in `src/services/api.ts` (the server already sends it). **Do not** read `total_rides` from the user payload: `users.total_rides` is a column nothing writes (BE-130 item f); ride counts come from `GET /me/stats` on Profile only.

No new request on tab focus. Pull to refresh re-reads `GET /auth/profile` (as today).

## 2. Screen order (both roles, top to bottom)

`Screen` (edges top) · `Header variant="large" inlineTitle` "Account" / "Account" tone `background` (unchanged, UI-R15b) · `Animated.ScrollView` with `RefreshControl` (tint `primary`) · body padding 16 horizontal, 8 top, 24 bottom, `maxWidth layout.contentMaxWidth`.

| # | Block | Gap above | Passenger | Driver |
|---|---|---|---|---|
| 1 | Profile card (§3) | 8 | yes | yes |
| 2 | Account checks Banners (`AccountChecks phoneOnly`, unchanged) | 12 | when needed | when needed |
| 3 | Group **"Your account"** (§4.1) | 24 | Saved places | Vehicle & documents · Vehicle AC* · Parcel deliveries* · Ride history |
| 4 | Group **"Safety"** (§4.2) | 24 | Emergency contacts | Emergency contacts · Women mode* |
| 5 | Group **"Preferences"** (§5) | 24 | Notifications · Appearance · Language | same |
| 6 | Group **"Help"** (§6) | 24 | Help & support · Invite friends · Terms* · Privacy* | same |
| 7 | Sign out group (§7) | 24 | yes | yes |
| 8 | Footer (§8) | 16 | yes | yes |

\* conditional rows, rules in §4/§6. Every group is a `ListGroup` with an `overline` title (`textMuted`, x = 16 inside the gutter, 8 above the card). Group and row order is identical on both roles; only the rows marked per role differ (DESIGN_SYSTEM §12.7 rule 1).

**Removed:** the driver "Edit profile" row (Profile → Edit, same as passenger; A6), "Phone notification settings" on both roles (it lives in Notifications; A3), every row subtitle (A2), the inline Appearance SegmentedControl (A4), the driver "Approved" pill (A5).

## 3. Profile card

Pressable `Card` (radius 16, padding 16, `surface`, `elevation.1` light / 1 pt `border` dark; pressed `surfacePressed`), opens Profile. One component for both roles: `ProfileSummaryCard` (move to `src/components/account/ProfileSummaryCard.tsx`; the driver's inline copy is deleted after grep).

Row: `flexDirection row`, `alignItems center`, gap 16.
1. Avatar 56 (`profile_image_url`, initials fallback §5.13). Driver with a photo under review shows the approved photo (BE-94 rule, `ownPhotoUri`), never the pending one.
2. Text column, `flex 1`, `minWidth 0`, gap 4:
   - Name `h3` (20/25/600) `textPrimary`, `numberOfLines 2`. Fallback "Rider" / "Driver" (`account.fallbackName*`).
   - Contact `bodySmall` `textSecondary`, 1 line, `ellipsizeMode middle`: the verified `phone` formatted `+92 300 9990001` (`formatPhone`, same helper as Edit profile); when `phone` is null: `email`; when both null: row omitted.
   - Rating row, minHeight 20, gap 4: `rating !== null` → `star` 16 `ratingStar` (M2) + `numeric` (16/20/600, tabular) `textPrimary` `rating.toFixed(1)`. `rating === null` → `caption` `textMuted` "New" (no star).
   - Status pill (Badge status, height 24) **only** when `status === 'pending'`: warning "Pending approval". Active accounts show no pill on either role (A5).
3. `chevronEnd` 20 `textMuted`, mirrored in RTL.

Height: 16 + max(56, 25 + 4 + 20 + 4 + 20 = 73) + 16 = **105** (pill adds 4 + 24). Accessibility: one button, label "{name}, {contact}, rated {rating} / new, {pending}", hint "Opens your profile".

## 4. Role rows

All rows: `ListItem variant="settings"`, leading 40 tile (`surfaceAlt`, radius 12, 24 glyph `textSecondary`), title `body` `textPrimary` **one line, no subtitle**, trailing chevron (or value + chevron). Row height 12 + 40 + 12 = **64**; dividers inset 72. Title wraps to 2 lines at 1.3x rather than truncating (`numberOfLines 2`).

### 4.1 "Your account" (`account.groupYourAccount`)

| Row | Icon | Title en / ur-Latn | Opens | Shown when |
|---|---|---|---|---|
| Saved places | `bookmark` | Saved places / Save ki hui jaghein | `FavoriteLocations` | passenger |
| Vehicle & documents | `idCard` | Vehicle & documents / Gaari aur documents | `DriverDocuments` | driver |
| Vehicle AC | `ac` | Vehicle AC / Gaari ka AC | `VehicleAc` | driver, `vehicle_type` null or `car` (BE-86, unchanged rule) |
| Parcel deliveries | `parcel` | Parcel deliveries / Parcel delivery | `ParcelOptIn` | driver, `showParcelOptInRow()` (T-561, unchanged rule) |
| Ride history | `history` | Ride history / Ride history | `RideHistory` | driver (the passenger's is the Activity tab) |

Vehicle & documents carries a **trailing status Badge** instead of the chevron when the documents need action: warning "Action needed" / "Tawajjo chahiye" when any document or vehicle is `rejected` or the licence is expired. Source: the cached `useMyVehicles` / documents summary only if it is already in memory; never a new request from the Account tab. Without cached data the row shows the plain chevron.

### 4.2 "Safety" (`account.groupSafety`)

| Row | Icon | Title en / ur-Latn | Opens | Shown when |
|---|---|---|---|---|
| Emergency contacts | `contacts` | Emergency contacts / Emergency contacts | `EmergencyContacts` | both |
| Women mode | `womenMode` | existing `DriverWomenModeRow` (title only; its subtitle moves to the screen it opens) | its screen | driver, existing rule |

## 5. "Preferences" (`account.groupPreferences`)

| Row | Icon | Title en / ur-Latn | Trailing | Opens |
|---|---|---|---|---|
| Notifications | `bell` | Notifications / Notifications | chevron | `NotificationPreferences` (the phone-settings row stays inside that screen) |
| Appearance | `theme` | Appearance / Roop | value "System" / "Light" / "Dark" ("System" / "Light" / "Dark" in ur-Latn too: the OS words) + chevron | picker sheet |
| Language | `language` | Language / Zaban | value "English" / "Roman Urdu" + chevron | picker sheet (existing `LanguageRow`) |

**Picker sheet** (one pattern for both): modal `BottomSheet` (scrim `overlay`, content snap), title `h3` "Appearance" / "Language" at 24 from the top, 8 gap, Radio rows (§5.9.1: 24 radio, 12 gap, `body` label, optional `bodySmall` `textSecondary` second line, min height 44, padding 8 vertical), footer padding `max(insets.bottom + 8, 16)`. Selecting a row applies immediately, fires `selection` haptic, closes the sheet in `motion.exit` (200 ms); no Save button. Appearance options: System ("Match your phone" / "Phone ke mutabiq"), Light, Dark. The theme switch re-renders without a flash: the sheet closes first, then the scheme changes on the close callback.

## 6. "Help" (`account.groupHelp`, rows from UI-R18)

| Row | Icon | Title en / ur-Latn | Opens | Shown when |
|---|---|---|---|---|
| Help & support | `support` | Help & support / Madad aur support | `Support` (shared-support-invite §H) | always |
| Invite friends | `gift` | Invite friends / Doston ko invite karein | `Invite` (§I) | always (the row is neutral: grey tile, no saffron; DESIGN_SYSTEM §1.8) |
| Terms of service | `document` | Terms of service / Sharaait | external browser (`Linking.openURL`), trailing `open-in-new` 20 `textMuted` instead of the chevron (add `externalLink: 'open-in-new'` to `icons.ts`) | `terms_url` present [BE-130] |
| Privacy policy | `lock` | Privacy policy / Privacy policy | same | `privacy_url` present [BE-130] |

Only `https:` URLs open; anything else hides the row.

## 7. Sign out

Own `ListGroup` (no title), one destructive row: `logout` 24 glyph in a `dangerSoft` tile with `danger` glyph, title `body` `danger` "Sign out" / "Sign out", no chevron. While signing out: title "Signing out…" and disabled. Confirm Dialog (unchanged copy, `useLogout`): driver online adds "You'll go offline." (owner decision 2026-10-11: logout sets the driver offline).

## 8. Footer

16 below the sign-out group: `caption` `textMuted` centred "Raah-e-Haq {APP_VERSION} ({APP_BUILD})". Not pressable. In Debug builds append " · Debug" so screenshots are never mistaken for release. Then 24 bottom padding above the tab bar.

## 9. Measurements (iPhone 17, 402 × 874, top inset 62, tab bar 60 + 34)

Passenger, default text: header 62–118 · card 126–231 · "Your account" overline 255–271, group 279–343 · "Safety" 367–383 / 391–455 · "Preferences" 479–495 / 503–695 · "Help" overline 719–735, group starts 743 (first row fully visible to 807 is under the tab bar edge at 780: the Help group is the scroll cue). Today the same viewport ends inside "App".
Driver (car, no parcels): rows add 3 × 64 to "Your account" (Vehicle & documents, AC, Ride history), so "Preferences" starts at 671.
iPhone SE (375 × 667, top inset 20, tab bar 60): header 20–76 · card 84–189 · first group ends 301; viewport bottom 607 shows "Your account", "Safety" and the "Preferences" overline plus 2 rows.

## 10. States

| State | Spec |
|---|---|
| First paint | Everything renders from the stored user; there is no loading state for the tab. With no stored user (should not happen behind auth) the card shows the fallback name and no contact/rating rows. |
| Pull to refresh | `RefreshControl` while `getUserProfile()` runs. Failure: Toast error "Couldn't refresh your account." / "Account refresh nahi ho saka."; content stays. |
| Offline | Offline Banner (§5.17) sticky under the Header. Rows still navigate (their screens show their own offline states); Sign out still works locally. |
| Pending driver | Card shows "Pending approval"; driver rows that need approval still show (their screens explain). |
| Signing out | Row disabled with "Signing out…", then the auth stack. |
| 1.3x text | Row titles wrap to 2 lines (the row grows past 64; the 40 tile stays vertically centred). Card name wraps to 2 lines, contact stays 1 line with middle ellipsis. Appearance/Language values never truncate: the value takes its width and the title wraps. |
| Roman Urdu | Longest titles: "Doston ko invite karein" (23 chars), "Gaari aur documents" fit one line at default on SE (text column 375 − 32 − 72 − 16 − 28 = 227 pt). Group titles in `overline` uppercase: "AAP KA ACCOUNT", "HIFAZAT", "PASAND", "MADAD". |
| Dark | Same tokens. Card on `surface` dark with 1 pt `border`; tiles `surfaceAlt` dark; destructive tile `dangerSoft` dark `#3A1517` with `danger` `#FF7A7F` (6.42). |
| RTL (future Urdu script) | `start`/`end` paddings; chevrons and the external-link glyph mirror; rating star stays before the number in reading order. |

## 11. Copy (keys under `account.*`; en and ur-Latn ship together)

| Key | en | ur-Latn |
|---|---|---|
| `groupYourAccount` | Your account | Aap ka account |
| `groupSafety` | Safety | Hifazat |
| `groupPreferences` | Preferences | Pasand |
| `groupHelp` | Help | Madad |
| `ratingNew` | New | Naya |
| `pendingApproval` | Pending approval | Approval baqi hai |
| `documentsAction` | Action needed | Tawajjo chahiye |
| `appearance` / `appearanceSystemHint` | Appearance / Match your phone | Roop / Phone ke mutabiq |
| `help` / `invite` / `terms` / `privacy` | Help & support / Invite friends / Terms of service / Privacy policy | Madad aur support / Doston ko invite karein / Sharaait / Privacy policy |
| `refreshFailed` | Couldn't refresh your account. | Account refresh nahi ho saka. |
| `version` | Raah-e-Haq {version} ({build}) | Raah-e-Haq {version} ({build}) |

Existing keys (`savedPlaces.title`, `safety.contactsRow`, `language.rowTitle`, `ac.rowTitle`, `parcel.optInRowTitle`) are reused; the `*Subtitle` keys of removed subtitles are deleted after grep.

## 12. Low literacy

- Every row leads with a distinct glyph; groups are short (≤ 4 rows) and named with one word.
- The rating is a star plus a number, never stars alone; "New" is a word, not an empty star row.
- Destructive is red glyph + red word + its own group at the bottom; it never sits between normal rows.

## 13. Performance

- No network call on focus; the tab re-renders only when `apiAuth.user`, `scheme` or `locale` change (`useSelector` picks the user fields it needs with `shallowEqual`, not the whole slice).
- Rows are static elements (no FlatList needed for ≤ 16 rows); `ProfileSummaryCard` is `React.memo`.
- Picker sheets mount on first open only (lazy), and unmount on close.
- `GET /settings/public` is read once per session (shared cache with Help) and only when the Help group renders, not on app start.

## 14. Review checklist (UI-R16, Account)

Light and dark, iPhone 17 and iPhone SE, default and 1.3x text, en and ur-Latn, passenger Ali and driver Bilal (car) plus a bike driver if seeded:
1. Same group order and names on both roles; per-role rows exactly as §4; no subtitles; rows 64.
2. Profile card: rating star + number or "New"; formatted phone; no pill for active accounts; "Pending approval" for a pending one.
3. Appearance and Language are value rows with the same radio sheet; changing either applies at once.
4. No "Phone notification settings" or driver "Edit profile" row; Notifications opens the preferences screen that still has the phone-settings row.
5. Help group: UI-R16 ships without it (no row that opens nothing); UI-R18 adds it with Help & support and Invite friends; Terms/Privacy stay hidden until BE-130 sends the URLs.
6. Footer version line; Debug suffix in Debug.
7. Code: no hex, no raw font sizes, no magic spacing; one shared `ProfileSummaryCard`; components from `src/components/ui`.
