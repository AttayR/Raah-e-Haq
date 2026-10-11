# Raah-e-Haq Design System

**Version:** 1.1 (refresh) · **Date:** 2026-10-11 (v1.0: 2026-10-08) · **Owner:** rh-design-director · **Builder:** rh-designer
**Applies to:** passenger app, driver app, auth flow (one codebase, `src/`).
**Status:** source of truth for Phase 6 (T-601 onward). If code and this file disagree, this file wins; if this file is wrong, the design director fixes it here first.

Every value in this file is exact. "≈" never appears. Points (pt) = iOS points = Android dp.

> **v1.1 refresh (2026-10-11).** Owner direction: compete head-on with Uber, inDrive, Yango and Careem, **keep the current brand** (navy `#011C72` + saffron, logo, name). v1.1 refines, it does not rebrand: palette and type scale are unchanged; what changes is how they are applied. Deltas are marked **[v1.1]** in place: buttons become pills (§3.3, §5.4), one Header with three variants (§5.2), a tab bar with an active pill (§5.3), MaterialCommunityIcons actually bundled (§4), map chrome reduced to two controls (§9), haptics map (§6.11) and the screen archetypes, list/card patterns and role-sync rules in **§12**. Execution order: [REFRESH_PLAN.md](REFRESH_PLAN.md) (tasks UI-R1…UI-R19). Current-state evidence: `docs/design/audit/2026-10-11-prod-audit/`.

---

## 0. Principles

1. **The map and the next action come first.** A rider should always see where they are, what is happening and the one thing to do next. One primary button per screen.
2. **Calm navy, warm accents.** Navy carries the brand and every primary action. Saffron (from the logo) is a rare accent: ratings, promos, the brand dot. Never two loud colours side by side.
3. **Real data or honest states.** Every block has loading, empty, error and offline states. No invented numbers, ever. If the API has no value, show an empty state, not a placeholder figure.
4. **One system, two roles.** Passenger and driver share every component. The driver side differs only in density (larger touch targets on driving screens) and in its primary surface (map-first).
5. **Readable in a moving car in Lahore sun.** WCAG AA minimum, 4.5:1 for all text, 3:1 for all UI boundaries and icons. Driving screens use 56pt buttons and 20pt minimum text for addresses.
6. **No decoration behind content.** No illustrated backgrounds, no floating bubbles, no gradients behind text, no emoji as icons.

---

## 1. Colour

### 1.1 Brand navy scale

The existing brand colour `#011C72` is **navy-800**. The scale is built around it.

| Token | Hex | Use |
|---|---|---|
| navy-50 | `#EEF2FC` | `primarySoft` (light): selected rows, chips, soft buttons |
| navy-100 | `#DCE4F8` | pressed soft surfaces (light) |
| navy-200 | `#C9D5F7` | dark-mode text on `primarySoft`, dropoff pin (dark) |
| navy-300 | `#9DB2F0` | `primary` used as text/icon in dark mode, links (dark) |
| navy-400 | `#6A86DE` | focus ring (dark), progress tracks |
| navy-500 | `#3D5FD0` | `primary` fill in dark mode |
| navy-600 | `#2E4FBF` | `primaryPressed` in dark mode |
| navy-700 | `#1A3496` | hover/pressed tint for illustrations only |
| **navy-800** | **`#011C72`** | **brand**; `primary` fill and text in light mode, route line (light) |
| navy-900 | `#01155A` | `primaryPressed` in light mode, brand header backgrounds |
| navy-950 | `#000D3B` | splash background |

### 1.2 Saffron accent (from the logo)

| Token | Hex | Use |
|---|---|---|
| saffron-50 | `#FFF4E5` | promo card background (light) |
| saffron-500 | `#F59A23` | brand dot, promo tag fill (with `#0F1422` text, 8.33:1) |
| saffron-600 | `#C77700` | rating star (light, 3.46:1 on white) |
| saffron-700 | `#A85A00` | saffron text on white (5.09:1) |

Saffron is never used for buttons, never for status, never for large areas. Max one saffron element per screen region.

### 1.3 Neutrals

| Light token | Hex | Dark token | Hex |
|---|---|---|---|
| neutral-0 | `#FFFFFF` | dark-950 | `#0B0F1A` |
| neutral-25 | `#FAFBFD` | dark-900 | `#141A2A` |
| neutral-50 | `#F4F6FA` | dark-850 | `#1D2438` |
| neutral-100 | `#EBEEF5` | dark-800 | `#252D44` |
| neutral-200 | `#DADFEA` | dark-700 | `#2B3450` |
| neutral-300 | `#C3CAD9` | dark-600 | `#626E90` |
| neutral-400 | `#858EA5` | dark-500 | `#9099B0` |
| neutral-500 | `#626B82` | dark-300 | `#B7BFD0` |
| neutral-600 | `#4C556C` | dark-50 | `#F2F4F9` |
| neutral-700 | `#353D52` | | |
| neutral-800 | `#20273A` | | |
| neutral-900 | `#0F1422` | | |

### 1.4 Semantic tokens

Code only ever uses these names (`theme.colors.<token>`). Raw palette names are for this document and `src/theme/palette.ts` only.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `background` | `#F4F6FA` | `#0B0F1A` | screen background behind cards and grouped lists |
| `surface` | `#FFFFFF` | `#141A2A` | cards, sheets, headers, tab bar |
| `surfaceAlt` | `#EBEEF5` | `#1D2438` | text-field fill, chips, segmented control track, skeleton base |
| `surfaceRaised` | `#FFFFFF` | `#252D44` | modals, toasts, popovers (dark mode lifts by colour, not shadow) |
| `surfacePressed` | `#EBEEF5` | `#252D44` | pressed state of list items and cards |
| `textPrimary` | `#0F1422` | `#F2F4F9` | titles, body, values |
| `textSecondary` | `#4C556C` | `#B7BFD0` | supporting text, subtitles, labels |
| `textMuted` | `#626B82` | `#9099B0` | captions, timestamps, placeholders, disabled labels |
| `textInverse` | `#FFFFFF` | `#0F1422` | text on inverse surfaces (toast) |
| `border` | `#DADFEA` | `#2B3450` | dividers, card outlines (decorative, not a boundary) |
| `borderStrong` | `#858EA5` | `#626E90` | text-field and checkbox boundaries (≥3:1) |
| `primary` | `#011C72` | `#3D5FD0` | primary button fill, selected states, active tab |
| `primaryPressed` | `#01155A` | `#2E4FBF` | pressed primary |
| `primaryText` | `#011C72` | `#9DB2F0` | links, ghost buttons, icons that mean "primary" |
| `onPrimary` | `#FFFFFF` | `#FFFFFF` | text/icon on `primary` |
| `primarySoft` | `#EEF2FC` | `#1C2850` | soft button fill, selected chip, selected vehicle card |
| `onPrimarySoft` | `#011C72` | `#C9D5F7` | text on `primarySoft` |
| `focusRing` | `#011C72` | `#6A86DE` | 2pt focus outline (keyboard / accessibility focus) |
| `success` | `#12753B` | `#4ACB7E` | success text/icons, "Completed" |
| `successSoft` | `#E5F4EA` | `#12301F` | success badge/banners background |
| `onSuccess` | `#FFFFFF` | `#0B0F1A` | text on a filled success element |
| `warning` | `#9A5200` | `#F2B44B` | warning text/icons |
| `warningSoft` | `#FFF2DF` | `#332407` | warning banners (e.g. offline) |
| `danger` | `#C0262D` | `#FF7A7F` | errors, destructive text |
| `dangerSoft` | `#FDEBEC` | `#3A1517` | error banners, destructive soft buttons |
| `dangerFill` | `#C0262D` | `#D23A40` | destructive filled button (white text 5.90 / 4.75) |
| `info` | `#1D58C4` | `#7FA8F5` | info text/icons |
| `infoSoft` | `#E7EFFD` | `#15264A` | info banners |
| `accent` | `#F59A23` | `#F59A23` | brand dot, promo tag fill |
| `onAccent` | `#0F1422` | `#0F1422` | text on `accent` |
| `ratingStar` | `#C77700` | `#F5A524` | filled star |
| `ratingStarEmpty` | `#C3CAD9` | `#2B3450` | empty star (decorative; the number is always shown next to it) |
| `overlay` | `rgba(9,12,22,0.48)` | `rgba(0,0,0,0.64)` | modal/sheet scrim |
| `skeletonHighlight` | `#F4F6FA` | `#252D44` | shimmer highlight over `surfaceAlt` |
| `routeLine` | `#011C72` | `#8EA6F2` | active route polyline |
| `routeLineCasing` | `#FFFFFF` | `#0B0F1A` | 2pt casing under the route line |
| `routeLineTraveled` | `#858EA5` | `#626E90` | already-driven part of the route |
| `pickupPin` | `#15803D` | `#3DD17A` | pickup marker (circle) |
| `dropoffPin` | `#011C72` | `#C9D5F7` | dropoff marker (square) |
| `stopPin` | `#4C556C` | `#B7BFD0` | intermediate stop marker (numbered circle) |
| `driverMarker` | `#0F1422` | `#F2F4F9` | car icon body on the map |
| `userLocation` | `#1D58C4` | `#7FA8F5` | blue dot + 20% halo |
| `statusBar` | `dark-content` | `light-content` | set by `Screen`, never per screen |

### 1.5 Contrast ratios (computed, WCAG 2.1)

Text must be ≥4.5:1 (large text ≥3:1); UI boundaries/icons ≥3:1.

| Pair | Light | Dark |
|---|---|---|
| `textPrimary` on `surface` | 18.37 | 15.76 |
| `textPrimary` on `background` | 16.97 | 17.39 |
| `textSecondary` on `surface` | 7.44 | 9.39 |
| `textSecondary` on `background` | 6.87 | 10.37 |
| `textMuted` on `surface` | 5.32 | 6.09 |
| `textMuted` on `background` | 4.92 | 6.71 |
| `textMuted` on `surfaceAlt` (placeholder) | 4.58 | 5.41 |
| `onPrimary` on `primary` | 14.89 | 5.61 |
| `primaryText` on `surface` | 14.89 | 8.31 |
| `onPrimarySoft` on `primarySoft` | ≥12.71 (measured 12.71 on the darker `#E8EDFA`) | 9.77 |
| `success` on `surface` / on `successSoft` | 5.78 / 5.08 | 8.37 / 6.90 |
| `warning` on `surface` / on `warningSoft` | 5.86 / 5.31 | 9.42 / 8.17 |
| `danger` on `surface` / on `dangerSoft` | 5.90 / 5.14 | 6.89 / 6.42 |
| `info` on `surface` / on `infoSoft` | 6.47 / 5.60 | 7.29 / 6.27 |
| white on `dangerFill` | 5.90 | 4.75 |
| `onAccent` on `accent` | 8.33 | 8.33 |
| `borderStrong` on `surface` (non-text) | 3.28 | 3.43 |
| `ratingStar` on `surface` (non-text) | 3.46 | 8.50 |
| `pickupPin` on light map land `#F2F2F2` | 4.48 | 8.01 (on `#1D2230`) |
| `routeLine` on map land | 13.30 | 6.71 |

**Banned pairs found in today's app** (for reference in reviews): navy text on `#1A1A1A` (1.17), red text on green button (1.48), white on `orange` (1.97), white on `#667EEA` (3.66), `#9CA3AF` text on white (2.54), white on `#10B981` (2.54).

### 1.6 Dark mode rules

- Follow the system setting by default; the user can force Light / Dark / System in Settings → Appearance (persisted).
- The theme must react to `Appearance` changes while the app is open (`useColorScheme`), and every screen must re-render. Today the app reads the scheme once and many screens never switch (audit: chat, wallet, history, saved places, profile, map sheet).
- Elevation in dark mode is shown by surface colour (`surface` → `surfaceRaised`), plus a 1pt `border` on cards; shadows are disabled (opacity 0).
- The map uses the dark map style (section 9) and dark pins.
- Images and the logo: use the logo on a `surface`-coloured round badge in both modes; never invert it.

---

## 2. Typography

**Family:** the platform system font. iOS: SF Pro (do not set `fontFamily`; RN resolves to SF Pro Text/Display automatically). Android: Roboto (default). Today's `'SF Pro Display'` string must be removed, it is not a reliable family name.
**Urdu (future):** Noto Nastaliq Urdu, loaded only for `ur` locale. Nastaliq needs 1.6× line height; every text style below has an `ur` line-height multiplier of 1.6 and containers must not fix heights on text (use min-height).
**Dynamic Type / font scale:** allowed up to 1.3× (`maxFontSizeMultiplier={1.3}` on every Text via the `Text` component). Layouts must survive 1.3× without clipping (QA checks at Settings → Accessibility → Larger Text, 3 steps up).

| Style | Size | Line height | Weight | Letter spacing | Use |
|---|---|---|---|---|---|
| `display` | 34 | 41 | 700 | -0.4 | Splash, onboarding headline (max one per screen) |
| `h1` | 28 | 34 | 700 | -0.3 | Large screen titles (collapsing header expanded state), fare hero label |
| `h2` | 22 | 28 | 700 | -0.2 | Sheet titles ("Choose a ride"), section heroes |
| `h3` | 20 | 25 | 600 | -0.1 | Card titles, driver name on driving screens |
| `title` | 17 | 22 | 600 | -0.2 | Header titles, list item primary text, button-like rows |
| `body` | 16 | 24 | 400 | 0 | Default text, addresses, paragraphs |
| `bodyStrong` | 16 | 24 | 600 | 0 | Emphasised body |
| `bodySmall` | 14 | 20 | 400 | 0 | Secondary lines, descriptions |
| `caption` | 12 | 16 | 500 | 0.1 | Timestamps, meta, helper text, tab labels |
| `label` | 13 | 18 | 600 | 0.1 | Field labels, chip text, badge text (sentence case) |
| `overline` | 12 | 16 | 600 | 0.6 | Section headers in grouped lists, UPPERCASE |
| `button` | 16 | 20 | 600 | 0 | Button text (lg, md) |
| `buttonSmall` | 14 | 18 | 600 | 0 | Small buttons, text links in rows |
| `numericXL` | 34 | 40 | 700 | -0.4 | Fare hero, earnings hero (tabular) |
| `numericL` | 22 | 28 | 700 | -0.2 | Fare in vehicle cards, stat values (tabular) |
| `numeric` | 16 | 20 | 600 | 0 | Inline money, ETA, distance (tabular) |
| `numericSmall` | 13 | 16 | 600 | 0 | Badges with numbers, unread counts (tabular) |

All `numeric*` styles set `fontVariant: ['tabular-nums']`.

**Rules**
- Only these styles. No raw `fontSize`/`fontWeight` in screens (grep gate in review). Weight `'bold'` is banned; use the numeric weights 400/500/600/700 only.
- Max two weights per card (e.g. 600 title + 400 body).
- Text colour comes only from `textPrimary`, `textSecondary`, `textMuted`, `primaryText`, a semantic colour, or `on*` tokens.
- Truncation: single-line addresses use `numberOfLines={1}` + `ellipsizeMode="tail"`; two-line where the spec says so. Never let text overflow the screen edge (today: Home address, Vehicle sheet "Swap").
- Money format: `Rs 1,250` (prefix `Rs`, a space, thousands separator, no decimals unless the API returns a non-zero fraction; then two decimals). Never `$`, never `PKR 24` truncated, never `₨`. Use one helper `formatMoney(amount)`; currency label comes from the API `currency` when present, else `Rs`.
- Distance: `3.4 km` (one decimal under 10 km, none above). Duration: `7 min`, `1 h 05 min`. Time: device locale, 12-hour in `en-PK` (`2:30 PM`). Dates: `Today`, `Yesterday`, then `Mon, 28 Sep`; with year only if not the current year.

---

## 3. Spacing, layout, radii, borders, elevation

### 3.1 Spacing (4-pt grid)

| Token | Value |
|---|---|
| `space.0` | 0 |
| `space.1` | 4 |
| `space.2` | 8 |
| `space.3` | 12 |
| `space.4` | 16 |
| `space.5` | 20 |
| `space.6` | 24 |
| `space.8` | 32 |
| `space.10` | 40 |
| `space.12` | 48 |
| `space.16` | 64 |

Allowed exceptions: hairline (`StyleSheet.hairlineWidth`), 1pt and 2pt borders, and component internals listed in section 5. Any other number in a style is a review FAIL.

### 3.2 Layout

- **Screen gutter:** 16 (all devices, including iPhone SE 375pt wide).
- **Content max width:** 560 on tablets (centered).
- **Section gap:** 24 between sections; 8 between a section header and its content; 12 between stacked cards.
- **Safe areas:** every screen is wrapped by `Screen`, which applies `useSafeAreaInsets()`. Content must never sit under the status bar or the home indicator unless it is a map. Today's 62pt blank band and clipped scroll content under the status bar (Settings, Profile, Chat) are fixed by this.
- **Bottom actions:** sticky action bars sit at `bottom: insets.bottom + 8` (min 16 when `insets.bottom` is 0).
- **Touch targets:** min 44×44 (iOS) / 48×48 (Android); driving screens (driver map, incoming request, to-pickup, trip) min 56 high for primary actions. Use `hitSlop` to reach the minimum on small icons.
- **Grid:** two-column stat grids use `(width − 2×16 − 12) / 2` columns.
- **Small device (iPhone SE, 375×667, no home indicator):** sheets cap at 88% height, hero headers shrink (see each spec), no fixed hero taller than 30% of the screen.

### 3.3 Radii

| Token | Value | Use |
|---|---|---|
| `radius.xs` | 4 | badges inside text, progress bars |
| `radius.sm` | 8 | chips (small), thumbnails, skeleton text lines |
| `radius.md` | 12 | text fields, list-group corners, toasts, icon tiles |
| `radius.lg` | 16 | cards, vehicle option cards, dialogs |
| `radius.xl` | 24 | bottom sheet top corners |
| `radius.pill` | 999 | **[v1.1] all buttons**, chips, pills, avatars, FABs, tab-bar active pill |

### 3.4 Borders

| Token | Value | Use |
|---|---|---|
| `border.hairline` | `StyleSheet.hairlineWidth` | list dividers |
| `border.thin` | 1 | card outline (dark mode always; light only for `Card variant="outlined"`), text-field default |
| `border.focus` | 2 | focused text field, selected card, focus ring |

### 3.5 Elevation

| Token | iOS shadow (color `#0F1422`) | Android `elevation` | Use |
|---|---|---|---|
| `elevation.0` | none | 0 | flat lists, cards on `surface` |
| `elevation.1` | offset (0,2), opacity 0.06, radius 8 | 2 | cards on `background` |
| `elevation.2` | offset (0,4), opacity 0.10, radius 16 | 6 | map floating buttons, sticky bottom bars, search bar on map |
| `elevation.3` | offset (0,-4), opacity 0.12, radius 24 | 12 | bottom sheets (shadow upward) |
| `elevation.4` | offset (0,8), opacity 0.16, radius 32 | 16 | dialogs, toasts |

Dark mode: all shadow opacities are 0; Android elevation stays (it is rendered as a subtle overlay) but cards also get `border.thin` `border`.

---

## 4. Iconography and imagery

- **One family:** `MaterialCommunityIcons` (MDI) from `react-native-vector-icons` (installed). It covers ride-hailing glyphs the others lack (`motorbike`, `rickshaw`, `car-side`, `van-passenger`, `steering`, `cash`, `map-marker-radius`). **[v1.1] State on 2026-10-11:** `src/components/ui/Icon.tsx` maps semantic names to **MaterialIcons** because `MaterialCommunityIcons.ttf` is not in `ios/*/Info.plist` `UIAppFonts`; the tab bars and ~25 legacy files import MaterialIcons, FontAwesome, Ionicons, AntDesign, Entypo, Feather, Fontisto, Foundation, Octicons, SimpleLineIcons, EvilIcons and Zocial directly, and the passenger Saved places "Work" row and driver Profile "Earnings" tile render "?" boxes. UI-R1 bundles the MDI font (iOS `UIAppFonts` + Android `fonts.gradle`), points the `Icon` map at MDI, and UI-R19 removes every other font from the bundle once no file imports it. Outline glyphs by default; the back glyph is `chevron-left` on iOS and `arrow-left` on Android (one `back` semantic name).
- **Style:** outline variants by default (`home-outline`, `bell-outline`); filled variant only for the selected tab and for status glyphs inside badges.
- **Sizes:** 16 (inline with caption), 20 (inline with body, list trailing chevrons), 24 (default: list leading, header actions, tab bar), 28 (map FABs), 32 (vehicle glyphs in cards), 48 (empty/error state glyph inside a 96 circle).
- **Colour:** `textSecondary` for neutral icons, `primaryText` for interactive icons, semantic tokens for status. Never colour an icon navy on a dark surface (today: Home stat icons, Account rows in dark mode).
- **Wrapper:** an `Icon` component takes `name` from a typed map `src/components/ui/icons.ts` (semantic names → MDI names), so screens say `<Icon name="pickup" />`, not glyph names. Missing glyphs must fail type-check (today "?" boxes render on Favourites "Work", Driver chat call/send, Driver profile earnings).
- **No emoji** anywhere in UI text, placeholders, buttons or chips (today: home greeting, section titles, stage chips, vehicle tiles, fare labels, request button, search placeholder).
- **Vehicle glyphs:** car → `car-side`, bike → `motorbike`, rickshaw → `rickshaw`, van → `van-passenger`. Shown at 32 inside a 56×56 `surfaceAlt` rounded-16 tile. The icon key comes from the BE-05 `icon key` field; unknown keys fall back to `car-side`.
- **Illustrations:** only in EmptyState, ErrorState, permission prompts, splash and account-status screens. Flat duotone (navy-800 + saffron-500 on navy-50), max 160×160, always on a plain surface, never behind text, never repeated as a pattern. The current `background_raahe_haq.png` / `bg.png` patterns are removed from every screen (17 files use `ImageBackground`).
- **Avatars:** user photo from `profile_image`; fallback is initials (first letter of first and last word of `name`) in `label` style on `primarySoft`. Never a grey empty circle (today: driver chat "Sarah Ahmed").
- **Logo:** `logo.png` on a 72×72 (auth) / 96×96 (splash) circle of `surface` with `elevation.1`.

---

## 5. Components

All live in `src/components/ui/` and are exported from `src/components/ui/index.ts`. Every component takes `testID` and an `accessibilityLabel` where it is interactive. Sizes are in pt.

### 5.1 Screen
- Wraps content with safe-area insets, `background` colour, and sets the status bar from the theme (`statusBar` token). Props: `scroll` (ScrollView with `keyboardShouldPersistTaps="handled"`), `edges` (default `top`: tab screens sit above the tab bar, which owns the bottom inset; full-screen pushed screens pass top+bottom; map screens pass `[]` and place overlays from `useSafeAreaInsets()`), `refreshing/onRefresh` (pull to refresh, tint `primary`), `keyboardAvoiding` (default true when `scroll`; uses `react-native-keyboard-controller` `KeyboardAwareScrollView` so the focused field is ≥16 above the keyboard. Today the keyboard covers the Login email field).

### 5.2 Header **[v1.1]**
One `Header` component, three variants. Today four header styles ship (large left title on tab roots; centered title + chevron under a 48pt blank band on Wallet/History/Saved places; left title + arrow on Profile v2/Chat/Documents; navy bubble hero on legacy Profile/Login) — all collapse into these:
- **`standard`** (every pushed screen): height 56 below the top inset, background `surface` (or `background` when the screen background is `background`; the bar and the screen never differ in colour until scrolled). Leading back IconButton (44 target, 24 glyph `back`) at x=4, so the glyph's optical edge sits at 16. Title `title` (17/22, 600) `textPrimary`, **left-aligned at x=56 on both platforms** (v1.0 said centered on iOS; the newer screens already left-align and it reads better with long Urdu titles), one line, tail ellipsis. Trailing: up to 2 IconButtons or one text action (`buttonSmall`, `primaryText`, one line). Bottom hairline `border` fades in (150 ms) once content scrolls 4pt.
- **`large`** (tab roots: Activity, Inbox, Account, Earnings): 56 bar with no title until scrolled, then `h1` (28/34, 700) title at x=16, 4 below the bar; on scroll the large title collapses into the bar's `title` (iOS-style; Android: same behaviour via Reanimated). Trailing actions sit in the 56 bar.
- **`overlay`** (map screens): no bar. Floating controls only: back/close as `IconButton floating` (48 visual, 44+ target) at x=16, y=`insets.top + 8`. Never an opaque band behind the status bar on a map (today: driver Map tab shows a grey strip above the map).
- No brand-navy hero headers, bubbles or illustrated backgrounds anywhere (Login, Phone verification, Registration, both Profiles today). Navy fills appear only in primary actions, selected states, the slide-to-confirm track and the two money hero cards (Wallet balance, Earnings total).

### 5.3 Tab bar **[v1.1]**
- Custom `tabBar` component (React Navigation `tabBar` prop) shared by both roles; never the library default (today both tab bars are default bars with MaterialIcons glyphs and an `text + '80'` inactive colour).
- Height 60 + bottom inset; background `surface`; top hairline `border`; no shadow.
- **4 items per role** (section 8): passenger Home · Activity · Inbox · Account; driver Drive · Earnings · Inbox · Account. Item: 56×32 indicator pill (radius `pill`) with the 24 icon centered → 4 → label `caption` (12/16) → 6 bottom padding. Item min width 64, equal widths.
- **Active:** pill fill `primarySoft`, icon filled variant in `onPrimarySoft`, label 600 `primaryText`. **Inactive:** no pill, outline icon `textMuted`, label 500 `textMuted`. Indicator pill animates width 32→56 and opacity 0→1 in `motion.fast` on selection; haptic `selection`.
- Badge: count Badge (5.12) anchored to the indicator pill's top-right (x +4, y −4 from the pill corner); the Inbox badge = unread notifications + unread chats.
- Hidden on full-screen flows (booking, finding driver, trip, chat thread, auth).

### 5.4 Button
| Size | Height | Horizontal padding | Text | Icon | Radius |
|---|---|---|---|---|---|
| `lg` | 56 | 24 | `button` | 24, 8 gap | `pill` **[v1.1]** |
| `md` | 48 | 20 | `button` | 20, 8 gap | `pill` |
| `sm` | 36 | 16 | `buttonSmall` | 16, 6 gap | `pill` |

| Variant | Fill | Text/icon | Border |
|---|---|---|---|
| `primary` | `primary` | `onPrimary` | none |
| `secondary` | `primarySoft` | `onPrimarySoft` | none |
| `outline` | transparent | `primaryText` | 1pt `borderStrong` |
| `ghost` | transparent | `primaryText` | none |
| `destructive` | `dangerFill` | white | none |
| `destructiveSoft` | `dangerSoft` | `danger` | none |

States: **pressed** fill → `primaryPressed` (primary) or `surfacePressed`/`navy-100` (others), scale 0.98 (see motion); **disabled** opacity 0.4 on the whole button, no press feedback (today disabled "Next" is grey `#9CA3AF` with white text, 2.54:1); **loading** replaces the label with a 20pt `ActivityIndicator` in the text colour, keeps width, sets `accessibilityState.busy`, ignores taps (prevents double-submit). Full-width by default inside forms and sheets; `fullWidth={false}` hugs content.
Never use orange/periwinkle/green/blue fills for buttons (today: "Create New Account" orange, "Confirm & Request" `#667EEA`, quick action tiles blue/green/purple).

### 5.5 IconButton
- 44×44 target; visual 40×40 circle. Variants: `plain` (transparent, icon `textPrimary`), `tonal` (`surfaceAlt`), `floating` (`surface` + `elevation.2`, used on the map, 48×48 visual, 28 icon). Requires `accessibilityLabel`.

### 5.6 TextField
- Anatomy top→bottom: label (`label`, `textSecondary`, 6 below → field), field, helper/error (`caption`, 4 below field).
- Field: height 52 (single line), radius `md`, fill `surfaceAlt`, border 1pt transparent; padding 16 horizontal; text `body` `textPrimary`; placeholder `textMuted`.
- Leading icon 20 at x=16 (text starts at 48); trailing slot 44×44 (clear, show/hide password, search spinner).
- **Focus:** border 2pt `focusRing`, fill `surface`. (Today focus has no visible state.)
- **Error:** border 2pt `danger`, helper text in `danger` with a 16 `alert-circle-outline` icon; `accessibilityLabel` includes the error. (Today the error text shows but the border doesn't change.)
- **Disabled:** opacity 0.5. **Multiline:** min height 96, padding 12 vertical, max 5 lines then scroll.
- Variants: `phone` (fixed `+92` prefix block, 56 wide, separated by a 1pt `border` divider; digits keypad; formats `3xx xxxxxxx`), `password` (eye toggle), `search` (40 high, radius `pill`, leading `magnify`), `otp` (6 boxes, 48×56 each, 8 gap, `numericL`, auto-advance, paste support, `textContentType="oneTimeCode"`).
- Dark mode uses the same tokens (today inputs turn black `#1A1A1A` on white cards in dark mode and stay black in light mode in the registration wizard).

### 5.7 Card
- Radius `lg` (16), padding 16, fill `surface`, `elevation.1` on `background`; variants `outlined` (1pt `border`, no shadow), `filled` (`surfaceAlt`), `selected` (2pt `primary` border + `primarySoft` fill). Pressable cards get `surfacePressed` on press. Cards never nest more than one level.

### 5.8 ListItem
- Min height 56 (one line) / 72 (two lines); padding 16 horizontal, 12 vertical.
- Leading: icon 24 in `textSecondary`, or a 40×40 icon tile (`surfaceAlt`, radius `md`), or Avatar 40. 16 gap to text.
- Text: primary line `body` (16/24, 400) `textPrimary` for settings rows, `title` (17/22, 600) for content rows (rides, chats, places); second line `bodySmall` `textSecondary`; optional third meta line `caption` `textMuted`.
- Trailing: chevron-right 20 `textMuted`, Switch, value text (`bodySmall` `textSecondary`), or Badge. 8 gap.
- Dividers: hairline `border`, inset to the text start (x=56 with icon, 72 with tile/avatar).
- Grouped list: items inside a Card with `radius.lg` and no inner padding; section header `overline` `textMuted` at x=16 (relative to gutter), 8 above the group.
- Destructive row: label and icon in `danger`, no chevron.

### 5.9 Switch
- Native `Switch` with `trackColor={{false: borderStrong, true: primary}}`, thumb white (iOS default). One switch style app-wide (today: navy oversized custom on passenger, green on driver, invisible off-track in dark mode).

### 5.10 SegmentedControl
- Segments min height 44 (the touch-target rule wins; track 52 with padding 4), radius `md`, track `surfaceAlt`, padding 4; labels shrink to 0.85 before truncating; thumb `surface` + `elevation.1` (dark: `surfaceRaised`), radius 8; labels `label`, active `textPrimary`, inactive `textSecondary`. Used for Phone/Email on Login, Day/Week/Month on Earnings, Notifications/Messages in Inbox. Replaces the navy-filled pill tabs.

### 5.11 Chip
- Height 32, padding 12 horizontal, radius `pill`, `label` text. Default: fill `surfaceAlt`, text `textSecondary`. Selected: fill `primarySoft`, text `onPrimarySoft`, leading `check` 16. Filter chip rows scroll horizontally on one line (no wrapping; today Notifications filters wrap to two rows). 8 gap; row inset 16.

### 5.12 Badge
- **Count:** min 18×18, padding 6 horizontal, radius `pill`, fill `danger`, text `numericSmall` white (11 for 3 digits); `99+` cap.
- **Dot:** 8×8 `danger` with 2pt `surface` ring.
- **Status pill:** height 24, padding 8 horizontal, radius `pill`, `label` text; tones: success (`successSoft`/`success`), warning, danger, info, neutral (`surfaceAlt`/`textSecondary`). Ride status mapping in 5.24.

### 5.13 Avatar
- Sizes 32, 40, 48 (header/floating avatar, driver-drive-home), 56, 72, 96. Circle. Photo with `surfaceAlt` placeholder while loading; initials fallback (5.4 rules); optional status ring 2pt `success` (driver online) and a 20×20 `surface` circle badge bottom-right for the camera action (profile edit, 96 only).

### 5.14 BottomSheet
- Used for booking, trip states, driver requests, pickers. Library: `@gorhom/bottom-sheet` is not installed; build on Reanimated 4 + Gesture Handler (installed), or the designer adds `@gorhom/bottom-sheet` v5 in T-608 (dependency decision recorded in that task).
- Top radius `xl` (24); fill `surface`; `elevation.3`; handle 36×5, radius `pill`, `border` colour, 8 from top; content starts 24 from top.
- **Snap points (map screens):** `peek` = content-defined collapsed height (170 for the passenger Home sheet, 137 for the driver Drive sheet; §8.3); `half` = 50% of window; `full` = window − top inset − 8. On iPhone SE the max is 88%.
- Backdrop: none for map sheets (map stays interactive above the sheet); `overlay` for modal sheets (pickers, confirmations), tapping it closes.
- Sheets never cover the whole map on the booking flow: the route must remain visible above the sheet (today the vehicle list covers 95% of the map).
- Keyboard: the sheet goes to `full` when a field inside is focused.

### 5.15 Dialog (Modal)
- Centered, width `min(window − 48, 340)`, radius `lg`, padding 24, `surfaceRaised`, `elevation.4`, scrim `overlay`.
- Title `h3`, body `bodySmall` `textSecondary` 8 below, actions 24 below: stacked full-width `md` buttons (primary on top) or side-by-side when both labels fit in one line.
- Destructive confirm uses `destructive` button. Copy rules in section 7 (today the booking reset says "Cancel Ride" when no ride exists).
- Native `Alert` is allowed only for OS-level confirmations; all product dialogs use this component so they theme correctly.

### 5.16 Toast
- Top-anchored at `insets.top + 8`, horizontal 16, min height 48, radius `md`, fill `textPrimary` (inverse) with `textInverse` text in light; in dark `surfaceRaised` with `textPrimary`, `elevation.4`.
- Leading 20 icon tinted by tone (success `#4ACB7E`, error `#FF7A7F`, info `#7FA8F5` — the dark-tone values, which pass on the inverse surface); text `bodySmall`, max 2 lines; optional action `buttonSmall` in `navy-300`.
- Duration 3 s (4 s with action); swipe up to dismiss; one at a time (queue). Replaces the three toast systems (T-008).

### 5.17 Banner (inline)
- Full-width inside content, radius `md`, padding 12/16, tone fills (`warningSoft`, `dangerSoft`, `infoSoft`, `successSoft`), leading 20 icon, text `bodySmall` in the tone colour, optional trailing text action.
- **Offline banner:** `warningSoft`, icon `wifi-off`, "You're offline. Showing saved info." Sticky under the Header (or at the top of the map below the status bar) while NetInfo reports offline.

### 5.18 Skeleton
- Blocks in `surfaceAlt`, radius `sm` for text (height = style line height − 6), `pill` for avatars, `lg` for cards. Shimmer: highlight `skeletonHighlight` band 40% wide sweeping left→right in 1200 ms, linear, infinite; reduced motion: no shimmer, static blocks at 100%.
- Each screen spec defines its skeleton layout; it mirrors the real layout (same heights) so nothing jumps.

### 5.19 EmptyState
- Centered column, max width 280: illustration or icon circle (96, `primarySoft`, glyph 48 `primaryText`) → 16 → title `h3` `textPrimary` → 8 → body `bodySmall` `textSecondary` centered → 24 → optional `md` button (`secondary` variant).
- Placed 64 from the top of the content area (not vertically centered in long screens).

### 5.20 ErrorState
- Same layout as EmptyState; icon circle `dangerSoft`, glyph `cloud-alert-outline` (network) or `alert-circle-outline` (server) in `danger`; title "Couldn't load {thing}"; body explains in one sentence; primary `md` button "Try again" (loading state while retrying). If cached data exists, show the data plus an error Toast or Banner instead of replacing content.

### 5.21 Map pins and route
- **Pickup pin:** 20×20 circle `pickupPin` with 4pt white ring (dark: `#0B0F1A` ring) and `elevation.2`; label bubble above (optional) radius `sm`, `surface`, `caption`.
- **Dropoff pin:** 20×20 square radius 4 `dropoffPin` with 4pt ring; inner 6×6 square in ring colour.
- **Stop pin:** 22×22 circle `stopPin` with white `numericSmall` index.
- **Driver marker:** 40×40 top-down car glyph (`car` MDI rendered to bitmap, or a 2-colour PNG asset at 1x/2x/3x) rotated to `heading`; body `driverMarker`, 2pt white outline; animate position over 1000 ms linear between updates.
- **User location:** native blue dot (`showsUserLocation`), tinted `userLocation` on Android.
- **Center pin (choose on map):** 32 tall stem pin in `primary`, lifts 8pt with a shadow while the map moves (motion 6.5).
- **Route line:** width 5, colour `routeLine`, casing width 7 `routeLineCasing` drawn underneath; traveled part `routeLineTraveled`; line cap/join round. Draw-on animation 600 ms ease-out when a new route appears (reduced motion: instant).
- Camera: fit route with padding top `insets.top + 72`, bottom = current sheet height + 24, sides 48.

### 5.22 Rating stars
- 5 stars, MDI `star` / `star-outline`; sizes: input 40 (gap 8, target 48), display 16 (gap 2).
- Input: tap or drag to select; selected stars `ratingStar`, empty `ratingStarEmpty`; label under the row (`bodySmall` `textSecondary`): 1 "Very bad", 2 "Bad", 3 "Okay", 4 "Good", 5 "Excellent". Haptic `selection` per change.
- Display: always star + numeric `numeric` value (e.g. `{user.rating}` to one decimal). If `rating` is null show "New" (`caption` `textMuted`), never four hardcoded stars (today: Settings header).

### 5.23 Address pair ("Raah line", brand signature)
- Vertical stack of pickup and dropoff (and stops) rows. Leading rail at x=16..36: pickup 10×10 circle `pickupPin`, dropoff 10×10 square `dropoffPin`, stops 8×8 circle `stopPin`; connected by a 2pt dotted line (`borderStrong`, dash 2 / gap 3) through the vertical centres.
- Row: min height 48; text `body` `textPrimary` 1 line (ellipsis), optional label above in `caption` `textMuted` ("Pickup", "Drop-off"). Divider hairline inset to text start (x=48) between rows when the rows are editable fields.
- Used in: booking, history cards, ride details, incoming request, trip screens. One component, one look everywhere.

### 5.24 Ride status timeline + status pill mapping
- Horizontal 4-step progress for the passenger trip sheet: Requested → Driver on the way → Arrived → On trip. Track 4pt `surfaceAlt`, filled `primary`; current step label `label` `textPrimary`; others `caption` `textMuted`. Vertical variant in Ride details with timestamps from `requested_at`, `accepted_at`, `arrived_at`, `started_at`, `completed_at`/`cancelled_at`.
- Status pill (API `status`): `requested` → info "Finding driver"; `accepted` → info "Driver on the way"; `arrived` → warning "Driver arrived"; `ongoing` → info "On trip"; `completed` → success "Completed"; `cancelled` → neutral "Cancelled" (not red: cancelling is not an error); unknown → neutral with the raw label title-cased.

### 5.25 Vehicle option card
- Height 72, padding 12/16, radius `lg`; layout: vehicle tile 56×56 (5.4 glyph rules) → 12 → text column (name `title`, under it `caption` `textMuted`: "{capacity} seats · {duration_min} min") → flex → fare `numericL` right-aligned (`textPrimary`).
- Selected: `Card selected` (2pt `primary` border, `primarySoft` fill). Unavailable: opacity 0.4, trailing "Unavailable" `caption`.
- Loading: skeleton of 3 cards. List gap 8.
- Today's emoji tiles on navy squares and periwinkle prices are replaced.

### 5.26 Fare breakdown
- Card `outlined`; rows 32 high: label `bodySmall` `textSecondary` left, value `numeric` `textPrimary` right (tabular). Rows: Base fare (`breakdown.base`), Distance (`breakdown.distance`, label "Distance · {distance_km} km"), Time (`breakdown.time`, "Time · {duration_min} min"), Stops (`breakdown.stops`, only if > 0), Discount (only if present, value in `success` with a minus sign). Divider hairline. Total row: `title` label "Total" + `numericL` value.
- Footnote `caption` `textMuted`: "Estimated fare. Final fare is calculated at the end of the trip. Pay cash to your driver."
- Rows render only for fields the API returns; no rate strings like "@ Rs 30/km" unless the API provides them.

### 5.27 Driver card (passenger side)
- Avatar 56 + online ring none; name `h3`; under it rating display (5.22) `{driver.rating}` and `caption` "{vehicle.make} {vehicle.model} · {vehicle.color}"; right column: plate in a 28-high pill (`surfaceAlt`, `numeric`, letter-spacing 0.5) = `vehicle.license_plate`.
- Actions row 16 below: two `md` `secondary` buttons side by side, 12 gap: "Call" (`phone-outline`) and "Message" (`message-text-outline`, Badge for unread). Optional third IconButton `dots-horizontal` (Share trip, Cancel ride).
- ETA line above the card in `h2`: "{eta} min away" while `accepted`; "Your driver has arrived" while `arrived`.

### 5.28 Passenger card (driver side)
- Avatar 56; name `h3` (first name only + initial, per BE-20 privacy); rating display; actions: IconButton tonal 56 "Call", "Message". No phone number shown as text.

### 5.29 Stat tile
- Card (not outlined), padding 16, min height 96: icon 20 in a 32×32 `primarySoft` circle → 12 → value `numericL` `textPrimary` (1 line, `adjustsFontSizeToFit` min scale 0.8) → 2 → label `caption` `textSecondary`. No trend chips unless the API returns a delta (today "+12%" is invented).

### 5.30 Promo / banner card
- Width = window − 48 (peek of next card 16), height 120, radius `lg`, image `image_url` cover with a bottom gradient `rgba(9,12,22,0)→rgba(9,12,22,0.72)` only under the text (the only gradient allowed), title `title` white, description `bodySmall` white 2 lines max. Without an image: fill `saffron-50` (dark: `surfaceAlt`), text `textPrimary`, a 24 `tag-outline` icon in `saffron-700`. Horizontal pager, snap, 12 gap, page dots 6×6 below (active `primary`, 16 wide pill).

### 5.31 Slide-to-confirm (driver)
- Used for "Start trip" and "Complete trip" on driving screens to prevent accidental taps. Height 64, radius `pill`, track `primary`; knob 56×56 white circle with `chevron-double-right` 28 `primary`, 4 inset; label `button` `onPrimary` centered, fades as the knob moves. Completes at 85% travel; springs back otherwise. Accessibility: exposes as a button with `accessibilityActions` "activate" (double-tap confirms) so screen-reader users are not blocked.

---

## 6. Motion

Library: Reanimated 4 (installed). All durations in ms.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion.instant` | 100 | `Easing.out(Easing.quad)` | press feedback, toggles |
| `motion.fast` | 150 | `Easing.out(Easing.cubic)` | fades, chip select, small reveals |
| `motion.base` | 250 | `Easing.bezier(0.2, 0, 0, 1)` (standard) | content changes, card expand, toast in |
| `motion.slow` | 350 | `Easing.bezier(0.2, 0, 0, 1)` | screen transitions, sheet content swaps |
| `motion.exit` | 200 | `Easing.bezier(0.3, 0, 1, 1)` (accelerate) | dismissals, toast out |

1. **Button press:** scale 1 → 0.98 and fill → pressed colour in 100 ms; release springs back (`withSpring`, damping 18, stiffness 300). Haptic `impactLight` on primary actions that commit (request ride, accept, start, complete).
2. **Sheet snap:** `withSpring` damping 24, stiffness 260, mass 1, overshoot clamping off; velocity from the gesture. Programmatic snaps (state change) use the same spring.
3. **Screen transitions:** native stack defaults (iOS push 350 ms, Android fade-from-bottom). Modal flows (booking, chat thread) use `presentation: 'card'` push; full-screen trip states swap sheet content with a 250 ms crossfade + 8pt vertical slide, not a navigation push.
4. **List appear:** first render after loading: items fade 0→1 and translate y 8→0, 250 ms, staggered 30 ms per item, max 8 items staggered (rest appear with the 8th). No animation on pull-to-refresh updates or pagination.
5. **Searching-for-driver pulse:** around the pickup pin, 3 concentric rings, each scales 1 → 3.2 and fades opacity 0.35 → 0 over 2000 ms, `Easing.out(Easing.quad)`, staggered 666 ms, infinite; ring colour `primary` (dark: `navy-400`). Plus a 2pt indeterminate progress bar at the sheet top (`primary` on `surfaceAlt`, 1500 ms loop).
6. **Center pin lift:** pin translates y −8 and its shadow scales 0.8 on map drag start, 150 ms; drops back with a spring on drag end.
7. **Driver marker:** position interpolates over 1000 ms linear; rotation takes the shortest path over 300 ms.
8. **Incoming request (driver):** sheet rises with the spring; a 15 s (or server `expires_in`) countdown ring around the Accept button depletes linearly; haptic `notificationWarning` + system sound (respects the "Sound alerts" preference) on arrival.
9. **Toast:** in = translate y −16→0 + fade, 250 ms standard; out = fade + translate −8, 200 ms accelerate.
10. **Skeleton shimmer:** 1200 ms linear loop.
11. **[v1.1] Haptics map** (`src/core/haptics.ts`, wraps `react-native-haptic-feedback`; respects reduced motion only for animation, not haptics; today nothing in `src/` triggers a haptic): `selection` = tab change, chip/segment/vehicle select, rating star change; `impactLight` = primary commit (Request ride, Go online/offline, Accept, I've arrived, Send message); `impactMedium` = slide-to-confirm completes; `notificationSuccess` = driver found, trip complete; `notificationWarning` = incoming request (driver), driver arrived (passenger); `notificationError` = request failed / ride taken (409).
12. **[v1.1] Sheet content swap:** when the booking/trip state changes, the sheet height springs to the new content height while old content fades out (100 ms) and new content fades + slides up 8pt (250 ms standard). Never a blank frame between states.

**Reduced motion** (`AccessibilityInfo.isReduceMotionEnabled` / Reanimated `useReducedMotion`): no scale on press (colour change only), sheet snaps use a 200 ms timing with no spring overshoot, list appear is a 150 ms fade without translation, the searching pulse is replaced by a static 2-ring halo at 0.2 opacity and the progress bar by an ellipsis label ("Finding a driver…" with no animation), route draw-on and marker interpolation become instant jumps, shimmer off.

---

## 7. Voice, copy and localisation

**Voice:** clear, calm, respectful, brief. Second person ("your driver"), active verbs, sentence case for everything (titles, buttons, tabs). No exclamation marks except in a single celebratory line (trip complete). No developer text in UI (today: "(API accepts only these values)", "Hello developer", "Test Code").

| Do | Don't |
|---|---|
| "Where to?" | "🔍 Search destination..." |
| "Request Economy" (button names the action + choice) | "🔔 Confirm & Request" |
| "Finding you a driver" | "Searching..." |
| "Discard this trip?" / "Keep editing" / "Discard" (before a ride exists) | "Cancel Ride" when no ride exists |
| "Cancel ride?" / body states any fee from the API / "Keep ride" / "Cancel ride" | "Are you sure?" |
| "Couldn't load your rides. Check your connection and try again." | "Error: Network request failed" |
| "You're offline. Showing saved info." | silent failure |
| "Good evening, {firstName}" (greeting by local time: 5–12 morning, 12–17 afternoon, 17–22 evening, otherwise "Hello") | "Good Morning" at 1:22 AM |
| "Rs 1,250" | "$24.50", "PKR 24", "Rs 1200" |

- Buttons: verb first, max 3 words where possible ("Go online", "Accept", "Start trip", "Complete trip", "Try again").
- Errors: what happened + what to do. Never blame the user. Show server validation messages as returned (they are already human-readable from Laravel), mapped to the field.
- Empty states: say what will appear here and how to make it appear.
- Brand name in copy: **Raah-e-Haq** (this casing everywhere; today "RaaH-E-Haq", "RaaHeHaq", "RaaheHaq" are mixed).

**Localisation readiness (Urdu, RTL):**
- All copy in a strings module (`src/i18n/en.ts`) keyed by screen; no string literals in JSX after Phase 6.
- Layout uses `start`/`end` (`marginStart`, `paddingEnd`, `left`→`start` in absolute positioning); icons that imply direction (`chevron-right`, `arrow-left`, slide-to-confirm) flip with `I18nManager.isRTL`; the Raah line rail moves to the end side in RTL.
- No text inside images. No fixed-width text containers; allow 40% expansion.
- Numbers and money stay Western digits with `Rs` prefix in both languages (owner may revisit).
- Dates via `Intl.DateTimeFormat` with the active locale.

---

## 8. Information architecture (navigation shell) **[v1.1, owner decision 2026-10-11]**

Today (2026-10-11): passenger has 4 default tabs (Home dashboard, Notifications, Chat, Settings) and opens the map as a pushed `PassengerMap` route; driver has 5 tabs (Home dashboard, Map, Notifications, Chat, Settings) where Home and Map duplicate each other. **Owner decision:** no separate Map tab; a map-first Home like Uber/Careem/inDrive/Yango; 4 tabs per role, in sync; during a ride the full-screen map stays as today. Implemented by **UI-R4** (supersedes T-610); exact routes in [screens/shared-navigation-shell.md](screens/shared-navigation-shell.md).

### 8.1 Tabs (exact labels and MDI glyphs; outline when inactive, filled when active)
| Slot | Passenger | Driver |
|---|---|---|
| 1 | **Home** · `home-outline` / `home` | **Drive** · `steering` / `steering` (no outline variant; active state carried by the pill) |
| 2 | **Activity** · `receipt-text-outline` / `receipt-text` | **Earnings** · `wallet-outline` / `wallet` |
| 3 | **Inbox** · `inbox-outline` / `inbox` (badge) | **Inbox** · `inbox-outline` / `inbox` (badge) |
| 4 | **Account** · `account-circle-outline` / `account-circle` | **Account** · `account-circle-outline` / `account-circle` |

- **Passenger Home:** full-bleed map + "Where to?" BottomSheet (8.3). Saved places (Home/Work/favourites) and recent destinations live in the sheet; offers and recent rides live lower in the sheet (half/full) only when the API returns them. Stats move to Activity. Tapping "Where to?" pushes the Booking flow (search → choose ride → finding → trip) full-screen, tab bar hidden.
- **Passenger Activity:** `large` header "Activity"; SegmentedControl **Rides | Wallet**: Rides = ride history → Ride details/receipt; Wallet = balance hero + ledger (cash only, no top-up).
- **Inbox (both roles):** `large` header "Inbox"; SegmentedControl **Notifications | Messages**; badge = unread notifications + unread chats.
- **Passenger Account:** profile card (avatar, name, phone, rating or "New") → Profile; groups: Your account (Saved places; ride history and wallet live in Activity), Preferences (Notifications, Appearance), Help (Help & support, Invite friends), Sign out. Delete account sits inside Profile.
- **Driver Drive:** full-bleed map + Drive sheet (8.3) with the big Online/Offline control, today's earnings pill and approval/document warnings; incoming requests appear as a sheet state on this map; once accepted the full-screen trip map takes over (tab bar hidden).
- **Driver Earnings:** `large` header "Earnings"; SegmentedControl **Today | Week | Month**; money hero (earnings for the period), commission owed and settlements card (from the wallet/settlement API), trips list → Ride details. Wallet/settlement history is a pushed screen from the commission card.
- **Driver Account:** profile card (avatar, name, rating, Approved/Pending pill) → Profile; groups: Your account (Vehicle & documents), Preferences (Notifications, Appearance), Help, Sign out.

### 8.2 Headers per surface
| Surface | Header |
|---|---|
| Home, Drive, Booking, Trip | `overlay` (no bar; floating controls; §5.2) |
| Activity, Inbox, Account, Earnings | `large` (title collapses on scroll; trailing action e.g. "Mark all read" in Inbox › Notifications only) |
| Every pushed screen | `standard` with back |

### 8.3 Home / Drive sheet behaviour
- Library and spring per §5.14 and §6.2; handle 36×5 always visible; drag anywhere on the handle area or the sheet header; content scrolls only at the `full` snap.
- **Passenger Home sheet:** snap points `peek` = 24 (top padding) + greeting `title` 22 + 12 + "Where to?" field 52 + 12 + shortcut chip row 32 + 16 = **170**, plus the tab bar height underneath (sheet sits above the tab bar); `half` = 50% of window; `full` = window − top inset − 8. Opens at `peek`. Map camera padding bottom = current sheet height + 24. At `full` the sheet gets a 1pt `border` top edge and the map controls fade out.
- **Driver Drive sheet:** `peek` = 24 + status row (dot + "You're offline"/"You're online" `h3` 25) + 16 + Online/Offline button 56 + 16 = **137** above the tab bar; `half` = 50% (today's earnings, account/document warnings, tips); no `full`. Offline: button "Go online" (lg, `primary`); online: "Go offline" (lg, `outline`), a 2pt `success` progress shimmer under the status row while searching for requests. Haptic `impactLight` on toggle.
- **Incoming request (driver):** replaces the Drive sheet content with the request (§12.5), sheet springs to content height (max 70%); tab bar hides while a request is shown; on decline/timeout the Drive sheet returns at `peek`.
- Map chrome on Home/Drive: top-start avatar or nothing, top-end bell is NOT shown (Inbox tab has the badge); end-side "locate me" floating button riding 16 above the sheet. Max two floating controls (§9).

This is the one structural change in the revamp; it removes the duplicate mounts (PAX-10) and gives each role one obvious home without changing data flow.

---

## 9. Map style

- Google Maps (react-native-maps, `PROVIDER_GOOGLE` on both platforms) with a custom style JSON in `src/theme/mapStyles.ts`:
  - **Light:** land `#F2F2F2`, water `#C9D8EE`, roads white with `#E1E4EB` outlines, arterials `#FFFFFF` width ×1.2, highways `#E8ECF5`; POI icons hidden except transit stations and hospitals; POI labels `#858EA5`; business POIs off; road labels `#626B82`.
  - **Dark:** land `#1D2230`, water `#0F1A2E`, roads `#2B3247`, highways `#343C55`, labels `#9099B0`, POIs off except transit.
- Bilingual labels stay (Google renders Urdu + English); that is a feature, keep it.
- Map controls: the native compass and my-location button are disabled; the app's floating IconButtons are used and placed below the status bar inset. **[v1.1] Max two floating controls per map screen:** back/close at top-start and "locate me" at end, 16 above the sheet's top edge (it rides with the sheet). Today the booking map shows four unlabeled circles (back, locate, refresh, +): refresh is removed (data refreshes itself), "add stop" moves into the sheet as a text row. The driver online/offline control lives in the Drive sheet, not as a red power FAB.
- **[v1.1] Pins are always custom** (5.21). Today the booking and trip maps still show Google's default green/blue teardrops and the route has no casing.
- Initial camera: last known device location, else Lahore centre (31.5204, 74.3587) at zoom 13. Never Karachi by default (today the driver map opens on Karachi).

---

## 10. Platform notes

- iOS: native stack headers are not used (custom `Header` for consistency); swipe-back enabled on every pushed screen; `contentInsetAdjustmentBehavior="never"` with manual insets.
- Android: `StatusBar` translucent with the theme bar style; navigation bar colour = `surface` (light icons in dark mode); back button closes sheets/dialogs before navigating back; ripple on pressables (`android_ripple={{ color: surfacePressed }}`) instead of opacity.
- Haptics: `react-native-haptic-feedback` (installed): `selection`, `impactLight`, `impactMedium`, `notificationSuccess`, `notificationWarning`, `notificationError` only, called through `src/core/haptics.ts` per the map in §6.11.

---

## 11. Review checklist (used by `review <task>`)

1. Screens match the spec block list within ±1pt (spacing, sizes), exact type styles and tokens.
2. Light and dark screenshots on iPhone 17 and iPhone SE (3rd gen) for every screen in scope; every state in the spec that can be triggered.
3. `grep -nE "#[0-9A-Fa-f]{3,8}\b|rgba?\(" <files>` → none outside `src/theme/`.
4. `grep -nE "fontSize|fontWeight|fontFamily" <files>` → none outside `src/theme/` and `src/components/ui/Text.tsx`.
5. `grep -nE "(margin|padding|gap|top|left|right|bottom|width|height|borderRadius)\w*: *[0-9]+" <files>` → only token references or the allowed exceptions (0, 1, 2, hairline, component internals documented here).
6. Imports from `src/components/ui` only for UI primitives; no `react-native-vector-icons/*` imports outside `src/components/ui/Icon.tsx`; no `ImageBackground`; no emoji (`grep -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]"`).
7. VoiceOver: every interactive element has a label; focus order follows the visual order; touch targets ≥44.
8. Font scale 1.3×: no clipping.
9. **[v1.1]** No `Alert.alert` for product confirmations (Dialog only); no `react-native-vector-icons/*` import outside `Icon.tsx`; no `BrandColors`; money only through `formatMoney` (grep `PKR`, `\$` in UI strings → FAIL).

---

## 12. Refresh direction (v1.1): patterns that make it feel production-grade

The palette, type scale and spacing grid above were right on 2026-10-08; the app does not feel finished because half the screens never adopted them and the other half adopted them without a shared screen structure. This section fixes structure. It is the bar UI-R tasks are reviewed against.

### 12.1 Brand application (keep, refine)
- **Navy is the only action colour.** Primary buttons, selected states, active tab, route line, slide-to-confirm. Light mode `#011C72`, dark mode `#3D5FD0` (`primary` token). Nothing else may look like a primary action: the periwinkle CTA and prices on the booking sheet, the green Accept on the driver request, the orange/"Create New Account" and three different button blues on Login all go.
- **Saffron is the signature, used sparingly:** the brand dot in the logo badge, rating stars, promo tags and the promo card. Max one saffron element per screen region.
- **Green is status, not action:** `success` for Completed, Approved, Online dot, cash collected. Red is `danger` for errors and destructive actions; "Cancel ride" is a `destructiveSoft` text-style button, never a pink filled slab (today: passenger trip sheet).
- The logo appears only on splash and auth screens (72/96 badge, §4); never repeated as a pattern. Brand name casing **Raah-e-Haq** (today: "RaaH-E-Haq", "RaaHeHaq" on Login/Registration).

### 12.2 Screen archetypes (every screen is exactly one)
| Archetype | Structure | Examples |
|---|---|---|
| **Map** | `Screen edges={[]}` · full-bleed map with custom style · `Header overlay` (≤2 floating controls) · one `BottomSheet` whose footer holds the single primary action, pinned above the home indicator | Passenger Home, booking, finding driver, trip; Driver Drive, request, to pickup, on trip |
| **List** | `Header large` (tab roots) or `standard` · grouped `ListGroup`s or a `FlatList` of rows/cards · pull to refresh · skeleton → content → EmptyState/ErrorState | Activity, Inbox, Account, Earnings, Saved places, Notifications |
| **Detail** | `Header standard` · hero block (avatar or money or map snapshot) · grouped info rows · actions at the bottom (sticky footer if primary) | Ride details/receipt, Profile, Wallet, Vehicle & documents |
| **Form** | `Header standard` (or none on auth root) · `Screen scroll keyboardAvoiding` · fields 16 apart · sticky footer primary button that rides above the keyboard | Login, Phone/OTP, Registration steps, Edit profile, Add place, Support ticket |

Rules: one primary button per screen, always in the same place for its archetype (sheet footer on Map, sticky footer on Form/Detail). Secondary actions are `secondary`/`ghost` buttons or rows, never a second filled navy button.

### 12.3 Density and rhythm
- Gutter 16. Section gap 24. Header-to-first-content 8 (standard) / 16 (large). Card internal padding 16. Between stacked cards 12. Inside a sheet: 24 top (below the handle), 16 between blocks, footer 16 top padding + `insets.bottom + 8`.
- Row heights: settings row 56; content row (ride, chat, notification, place) 72; vehicle option 72; driver/passenger card 88. Never shorter rows to "fit more"; scroll instead.
- One title per block: block titles use `title` (17/22 600) or `overline` for grouped-list section headers — not both. No bold+uppercase+colour stacking.
- Copy is sentence case everywhere: "Ride history", "Saved places", "Sign out", "Add a stop" (today: "Ride History", "Favorite Locations", "Add Funds", "Sign Out", "Confirm & Request", notification titles "Driver Assigned").

### 12.4 List and card patterns
- **Grouped settings list:** `overline` header at x=16 → 8 → Card(radius 16, no padding) of `ListItem`s with 40×40 icon tiles (`surfaceAlt`, radius 12, 24 glyph `textSecondary`), hairline dividers inset to 72. This is what driver Settings / passenger Settings v2 already do; Profile, Wallet, Saved places and History adopt it.
- **Content card (ride, place):** Card radius 16, padding 16; top row = meta (`caption` `textMuted` date · status pill end-aligned); body = AddressPair; footer row = money `numeric` start + one ghost action end. The whole card is the tap target (no "Details" filled button; today History shows a navy "Details >" slab on every card).
- **Notification row:** leading 40 icon tile whose glyph and tone depend on `type` (ride → `car-side` info; chat → `message-text-outline` primary; payment → `cash` success; promo → `tag-outline` accent; system → `bell-outline` neutral) — today every ride notification uses the same taxi glyph. Unread = 8pt `primary` dot at the end + title 600; read = title 400.
- **Chat row:** Avatar 48 (initials fallback always; today passenger sees solid periwinkle blobs) · name `title` · last message `bodySmall` 1 line · time `caption` end · status chip only when the chat is closed ("Ended", neutral), not "Read-only".
- **Money:** `formatMoney()` everywhere — `Rs 1,250`. Today the driver side prints `PKR 150`, passenger `Rs 150`, wallet `Rs 1200`, driver profile `$2.4k`.

### 12.5 Ride-flow components (both roles share them)
- **Booking sheet states replace the stage chips.** "1. Pickup · 2. Destination · 3. Vehicle · 4. Fare" reads like a developer stepper; the sheet itself shows the step: *Where to* → *Choose a ride* → *Finding driver* → *Driver on the way* → *On trip* → *Receipt*. The back button goes back one sheet state and never leaves a half-cleared route on the map.
- **Choose a ride:** half sheet; route visible above it; AddressPair summary row (tap to edit); vehicle list (VehicleOptionCard, 72 high, MDI vehicle glyph in a 56 `surfaceAlt` tile, name + "{capacity} seats · {eta} min", fare `numericL` `textPrimary` end); selected card = 2pt `primary` border + `primarySoft`; a "Fare details" row that expands the FareBreakdown in place; sticky footer button **"Choose {vehicle}"** (lg, primary) with the fare inside the label ("Choose Rickshaw · Rs 104"). No separate fare step, no emoji, no bell.
- **Person card** (driver card on passenger side, passenger card on driver side): one component, two data shapes. Avatar 56 · name `h3` · rating display or "New" · vehicle line / plate pill (passenger side only) · action row of three equal tonal IconButtons with labels (Call, Message with unread badge, and Safety on passenger side / Navigate on driver side). Today the driver side has an icon trio and the passenger side has a full-width Call inside the card plus stacked full-width Message and pink Cancel — that difference is the most visible "not in sync" problem.
- **Ride progress:** a 4-segment progress bar at the top of the trip sheet (Requested → On the way → Arrived → On trip), same component on both roles; the sheet title is the status sentence (`h2`: "Driver arrives in 4 min", "Head to pickup · 4 min").
- **Incoming request (driver):** a map-screen sheet, not a card floating over the Home dashboard (today). Fare `numericXL` first, then pickup ETA + distance, AddressPair, rider name + rating; Accept = lg primary with a depleting countdown ring; Decline = ghost. 
- **Receipt (both roles):** money hero (`numericXL`), "Paid in cash" / "Collect cash" pill, FareBreakdown, rating input, Done. Driver adds "Your earnings" row from the API.

### 12.6 Empty, loading, error
- Loading = Skeleton mirroring the layout (no centered spinners on content screens; spinners only inside buttons and the finding-driver pulse).
- Empty = EmptyState with a duotone illustration (navy-800 + saffron-500 on navy-50, 120×120) or icon circle, a one-line title and a next step button. Today empty areas are a stray sentence ("Your recent places will appear here.", "Today's numbers aren't available yet.") or dashes in stat tiles; stat tiles with no data are hidden, not dashed.
- Error = ErrorState with "Try again"; with cached data, keep the data and show a Banner.

### 12.7 Role sync rules (passenger ↔ driver)
1. Same tab bar component, same 4-slot structure, same Inbox and Account screens (role-specific rows only).
2. Same Header variants, same back glyph, same ListItem/Card/Avatar, same Settings layout (already true for Settings v2).
3. Same ride components: AddressPair, PersonCard, progress bar, FareBreakdown, receipt layout, status pills, money format.
4. Driving screens differ only by density: 56 primary buttons, 20pt minimum address text, slide-to-confirm for Start/Complete.
5. Each UI-R screen task is reviewed with a side-by-side screenshot pair (passenger vs driver) where a counterpart exists.

### 12.8 Urdu / RTL readiness (built in now, translated later)
- Strings through `src/i18n/en.ts` with `t()` (UI-R1 scaffolds it; each UI-R task moves the strings of the screens it touches).
- `start`/`end` only; direction glyphs flip; AddressPair rail moves to the end side; no fixed-width text containers; line heights survive the Nastaliq 1.6× multiplier (min-height, never fixed height on text rows).
