# Raah-e-Haq Design System

**Version:** 1.0 · **Date:** 2026-10-08 · **Owner:** rh-design-director · **Builder:** rh-designer
**Applies to:** passenger app, driver app, auth flow (one codebase, `src/`).
**Status:** source of truth for Phase 6 (T-601 onward). If code and this file disagree, this file wins; if this file is wrong, the design director fixes it here first.

Every value in this file is exact. "≈" never appears. Points (pt) = iOS points = Android dp.

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
| `radius.md` | 12 | buttons, text fields, list-group corners, toasts |
| `radius.lg` | 16 | cards, vehicle option cards, dialogs |
| `radius.xl` | 24 | bottom sheet top corners |
| `radius.pill` | 999 | chips, pills, avatars, FABs, segmented thumb |

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

- **One family:** `MaterialCommunityIcons` from `react-native-vector-icons` (already installed). It covers ride-hailing glyphs the others lack (`motorbike`, `rickshaw`, `car-side`, `van-passenger`, `steering`, `cash`, `map-marker-radius`). Today the code imports 13 families (MaterialIcons ×34 plus 12 single imports via `src/assets/icons/index.tsx`); all go.
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
- Wraps content with safe-area insets, `background` colour, and sets the status bar from the theme (`statusBar` token). Props: `scroll` (ScrollView with `keyboardShouldPersistTaps="handled"`), `edges` (default top+bottom; map screens pass `[]`), `refreshing/onRefresh` (pull to refresh, tint `primary`), `keyboardAvoiding` (default true when `scroll`; uses `react-native-keyboard-controller` `KeyboardAwareScrollView` so the focused field is ≥16 above the keyboard. Today the keyboard covers the Login email field).

### 5.2 Header
- Height 56 + top inset. Background `surface`; bottom border hairline `border` appears only after content scrolls 4pt.
- Leading: back button (IconButton `chevron-left`, 24 icon, 44 target) at x = 4 (icon optical edge at 16). Never a back button on a tab root (today: Notifications tab).
- Title: `title`, centered on iOS, left-aligned at x=56 on Android; single line, tail ellipsis; max width leaves 44+8 on each side.
- Trailing: up to 2 IconButtons or one text action (`buttonSmall`, `primaryText`, single line; today "Mark all" wraps).
- **Large title variant** (tab roots: Home excluded): `h1` title at x=16, 8 below the 56 bar, collapses into the bar on scroll (iOS-style).
- No brand-navy hero headers with bubbles. Navy fills appear only in primary actions, selected states, the slide-to-confirm track, and two money hero cards (Wallet balance, Earnings total).

### 5.3 Tab bar
- Height 56 + bottom inset; background `surface`; top hairline `border`; `elevation.0`.
- 4 items (see section 8, IA). Each item: icon 24 (outline; filled when active) above label `caption` (12/16, 500), 4 gap, centered; item min width 64.
- Colours: active `primaryText` icon + label; inactive `textMuted`. (Today active label is navy on `#1A1A1A` in dark mode, 1.17:1.)
- Badge: `Badge` dot (8) or count (min 18 high) at icon top-right offset (x +12, y −4).
- Hidden on full-screen flows (booking, trip, chat thread).

### 5.4 Button
| Size | Height | Horizontal padding | Text | Icon | Radius |
|---|---|---|---|---|---|
| `lg` | 56 | 24 | `button` | 24, 8 gap | `md` (12) |
| `md` | 48 | 20 | `button` | 20, 8 gap | `md` |
| `sm` | 36 | 16 | `buttonSmall` | 16, 6 gap | `md` |

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
- Height 40, radius `md`, track `surfaceAlt`, padding 4; thumb `surface` + `elevation.1` (dark: `surfaceRaised`), radius 8; labels `label`, active `textPrimary`, inactive `textSecondary`. Used for Phone/Email on Login, Day/Week/Month on Earnings, Notifications/Messages in Inbox. Replaces the navy-filled pill tabs.

### 5.11 Chip
- Height 32, padding 12 horizontal, radius `pill`, `label` text. Default: fill `surfaceAlt`, text `textSecondary`. Selected: fill `primarySoft`, text `onPrimarySoft`, leading `check` 16. Filter chip rows scroll horizontally on one line (no wrapping; today Notifications filters wrap to two rows). 8 gap; row inset 16.

### 5.12 Badge
- **Count:** min 18×18, padding 6 horizontal, radius `pill`, fill `danger`, text `numericSmall` white (11 for 3 digits); `99+` cap.
- **Dot:** 8×8 `danger` with 2pt `surface` ring.
- **Status pill:** height 24, padding 8 horizontal, radius `pill`, `label` text; tones: success (`successSoft`/`success`), warning, danger, info, neutral (`surfaceAlt`/`textSecondary`). Ride status mapping in 5.24.

### 5.13 Avatar
- Sizes 32, 40, 56, 72, 96. Circle. Photo with `surfaceAlt` placeholder while loading; initials fallback (5.4 rules); optional status ring 2pt `success` (driver online) and a 20×20 `surface` circle badge bottom-right for the camera action (profile edit, 96 only).

### 5.14 BottomSheet
- Used for booking, trip states, driver requests, pickers. Library: `@gorhom/bottom-sheet` is not installed; build on Reanimated 4 + Gesture Handler (installed), or the designer adds `@gorhom/bottom-sheet` v5 in T-608 (dependency decision recorded in that task).
- Top radius `xl` (24); fill `surface`; `elevation.3`; handle 36×5, radius `pill`, `border` colour, 8 from top; content starts 24 from top.
- **Snap points (map screens):** `peek` = content-defined collapsed height (e.g. 148 for "Where to?"); `half` = 50% of window; `full` = window − top inset − 8. On iPhone SE the max is 88%.
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

## 8. Information architecture (navigation shell)

Today: both roles have 5 tabs (Home, Map, Notifications, Chat, Settings), Map/Notifications are mounted twice (tab + stack), and Home and Settings duplicate account rows.

**Passenger tabs (4):** Home · Activity · Inbox · Account
- **Home:** map-backed home with the "Where to?" sheet (passenger-home spec). Booking (search → vehicle → finding → trip) is a full-screen stack flow pushed from Home; the tab bar hides during it. The separate Map tab is removed.
- **Activity:** ride history (shared-ride-history) → Ride details.
- **Inbox:** segmented Notifications | Messages (shared-notifications, shared-chat-list). Unread badge = notifications unread + chat unread.
- **Account:** profile summary + settings list (shared-settings), with Wallet, Saved places, Support, Invite, Appearance, Logout.

**Driver tabs (4):** Drive · Earnings · Inbox · Account
- **Drive:** map-first home with online/offline control and today's earnings pill (driver-drive-home). Incoming request and trip screens are states of this screen/stack; tab bar hides while a trip is active.
- **Earnings:** driver-earnings, with ride history inside.
- **Inbox, Account:** as passenger, driver variants.

This is the one structural change in the revamp; it removes the duplicate mounts (PAX-10) and gives each role one obvious home. It is implemented in T-610 (navigation shell) without changing any data flow.

---

## 9. Map style

- Google Maps (react-native-maps, `PROVIDER_GOOGLE` on both platforms) with a custom style JSON in `src/theme/mapStyles.ts`:
  - **Light:** land `#F2F2F2`, water `#C9D8EE`, roads white with `#E1E4EB` outlines, arterials `#FFFFFF` width ×1.2, highways `#E8ECF5`; POI icons hidden except transit stations and hospitals; POI labels `#858EA5`; business POIs off; road labels `#626B82`.
  - **Dark:** land `#1D2230`, water `#0F1A2E`, roads `#2B3247`, highways `#343C55`, labels `#9099B0`, POIs off except transit.
- Bilingual labels stay (Google renders Urdu + English); that is a feature, keep it.
- Map controls: the native compass and my-location button are disabled; the app's floating IconButtons are used and placed below the status bar inset (today they overlap the status bar and battery).
- Initial camera: last known device location, else Lahore centre (31.5204, 74.3587) at zoom 13. Never Karachi by default (today the driver map opens on Karachi).

---

## 10. Platform notes

- iOS: native stack headers are not used (custom `Header` for consistency); swipe-back enabled on every pushed screen; `contentInsetAdjustmentBehavior="never"` with manual insets.
- Android: `StatusBar` translucent with the theme bar style; navigation bar colour = `surface` (light icons in dark mode); back button closes sheets/dialogs before navigating back; ripple on pressables (`android_ripple={{ color: surfacePressed }}`) instead of opacity.
- Haptics: `react-native-haptic-feedback` (installed): `selection`, `impactLight`, `notificationSuccess`, `notificationWarning`, `notificationError` only.

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
