# Driver · Earnings

- **Tasks:** UI-R17 (absorbs T-616). Built on T-507 (Earnings on real data), T-501 (ride details), BE-08, BE-84 (per-ride split), T-515 / BE-74 (top-up).
- **Route:** `DriverTabs/Earnings` (tab 2 of 4). Code: `src/features/stats/screens/DriverEarningsScreen.tsx`, `components/EarningsHero.tsx`, `components/EarningsWalletCard.tsx`.
- **Revision:** 2026-10-19 (UI-R17 round 1: period hero + amount owed, shipped bf07ab0, owner approved). 2026-10-20 (UI-R17 round 2: §3 chart, link tiles, trip rows, refresh/loading/empty, period switch). Owner feedback on the Today card: "this card looks useless, everything looks random"; on round 1: approved, "now do all the work".
- **Before shots:** round 1: `docs/design/audit/driver-earnings-today-light-before.png`, `-today-dark-before.png`, `-week-light-before.png`, `-week-scrolled-light-before.png`, `-week-chart-dark-before.png`. Round 2 (after bf07ab0, Bilal, Tue 20 Oct): `docs/design/audit/driver-earnings-r2-week-chart-light.png`, `-r2-week-scrolled-light.png`, `-r2-month-chart-light.png`, `-r2-month-chart-dark.png`, `-r2-trips-dark.png`.

## 0. Data (real fields only)

| Source | Field (app model) | Used for |
|---|---|---|
| `GET /driver/earnings?period=day\|week\|month` | `totals.earnings` | Hero net ("You keep"). Can be negative (adjustments): show the sign, never clamp |
| | `totals.grossFares` (`gross_fares`) | "Fares collected" |
| | `totals.commission` (`commission`) | "Commission". Today this is `commission_amount + booking_fee` per ride (BE-84 `split()`) |
| | `totals.trips`, `totals.distanceKm` | Stats row |
| | `from`, `to`, `period`, `currency` | Period caption, money format |
| | `series[]` (`date`, `trips`, `gross_fares`, `earnings`; every day of the period, zero-filled, **including days after today**) | Chart (§3.1) and the day headers of the trips list (§3.3) |
| | `rides[]` (`id`, `pickup_address`, `dropoff_address`, `vehicle_type`, `completed_at`, `distance_km`, `fare`/`total_fare`, `commission_amount`, `commission_rate`, `booking_fee`, `platform_commission`, `driver_net`/`driver_earnings`), `pagination` (`current_page`, `last_page`, `total`) | Trip rows (§3.3), paging |
| **BE-125 (new)** | `today` (`YYYY-MM-DD`, the server's local date in `timezone`) | Splits the chart into past / today / future (§3.1). Until it ships: today = the device clock shifted by the UTC offset printed in `from` (e.g. `+05:00`); no `Intl` time-zone lookup |
| `GET /driver/strikes` (T-521) | `active_count`, `review_threshold`, `under_review` | Status line on the Strikes tile (§3.2). Optional: the tile works without it |
| **BE-123 (new)** | `totals.commission_rate` (number or null), `totals.commission_amount`, `totals.booking_fees` | "Commission 20%" label; separate "Booking fee" row when > 0. Until BE-123 ships: label "Commission" without a rate, one row with `totals.commission` |
| **BE-124 (new)** | `totals.online_minutes` (number or null) | "Online" stat. Until then (or when null): the column is not rendered; never 0, never a dash |
| `GET /wallet` (BE-09/BE-74/BE-85) | `amountOwed` (`amount_owed` = max(0, −balance)), `balance`, `currency`, `canTopUp`, `canSettleCommission` | Amount owed card (§2) |

Arithmetic shown on screen comes from the server only: the app never computes the rate, the net or the owed amount. If `grossFares − commission ≠ earnings` (rounding, adjustments), still show the three server numbers as sent.

## 1. Screen order (round 1 changes in bold)

1. Large Header "Earnings" + SegmentedControl "Today | This week | This month" pinned under it (unchanged, §5.2/§5.10).
2. 16 gap: **Period hero (§1.1)**.
3. 12 gap: **Amount owed card (§2)**: always directly under the hero; never below the links.
4. 16 gap: refresh-error Banner when present (§3.4).
5. 16 gap: **Chart card (§3.1)**, week and month only, hidden when `totals.trips === 0`.
6. 16 gap: **Link tiles (§3.2)**: Weekly statements, then Strikes, side by side.
7. 24 gap: **Trips (§3.3)**: section header, then day groups (week/month) or one group (today), paged on scroll.
8. Footer (§3.5), 32 bottom padding above the tab bar.

Everything from 2 to 7 is one `FlatList` (header component + items), so one scroll, one refresh control.

## 1.1 Period hero (round 1, normative)

Goal: one big number (what the driver keeps), the money story under it as an equation, and one balanced stats row. Nothing else lives in this card.

### Container
- View, fill: light `primary` (navy-800 #011C72); dark `primarySoft` (#1C2850). Radius `radius.lg` (16). Padding 20 all sides. No shadow (flat on `background`). Full width inside `layout.gutter` (16).
- Text colours inside the hero (new semantic tokens, add to `src/theme/tokens.ts` and DESIGN_SYSTEM §1 as **[UI-R17]**):

| Token | Light | Dark | Contrast on hero fill |
|---|---|---|---|
| `heroText` | white #FFFFFF (`onPrimary`) | white #FFFFFF | 14.89:1 / 14.30:1 |
| `heroTextMuted` | navy-200 #C9D5F7 | navy-300 #9DB2F0 | 10.17:1 / 6.85:1 |
| `heroDivider` | navy-700 #1A3496 | navy-500 #3D5FD0 | decorative (1.4:1 / 2.55:1), never the only separator of meaning |

  (Dark today renders the big number in navy-200 on #1C2850; white is the fix: the number must be the brightest thing on screen.)

### Anatomy, top to bottom

**A. Headline** (accessible group, label "You keep {net}, {period caption}")
1. Row, `justifyContent: space-between`, `alignItems: center`, minHeight 20:
   - Start: `label` (13/18/600) `heroTextMuted`: "You keep". 
   - End: `caption` (12/16/500) `heroTextMuted`, `numberOfLines 1`: the period caption from `periodCaption(period, from, to)`: day "Mon, 19 Oct", week "19 – 25 Oct", month "October 2026". `testID earnings-period-caption`.
2. 4 gap: net, `numericXL` (34/40/700, tabular) `heroText`, `numberOfLines 1`, `adjustsFontSizeToFit`, `minimumFontScale 0.6`, `testID earnings-total`. Value `formatMoney(totals.earnings, { currency })`.

**B. Money story (breakdown)**, 16 gap after A. Hidden when `totals.trips === 0` (see States).
- Three rows + one divider. Each row: `flexDirection row`, `alignItems center`, `gap 8`, minHeight 28 (grows with text). Leading icon 16 `heroTextMuted`; label `bodySmall` (14/20/400) `heroTextMuted`, `flex 1`, up to 2 lines; value `numeric` (16/20/600, tabular) `heroText`, `numberOfLines 1`, `flexShrink 0`, right-aligned (end-aligned in RTL).

| # | Icon | Label (en) | Value | testID |
|---|---|---|---|---|
| 1 | `cash` | "Fares collected" | `formatMoney(grossFares)` | `earnings-fares` |
| 2 | `moneyOut` | "Commission {rate}%" (BE-123 `commission_rate`, formatted without trailing zeros: 20, 12.5); "Commission" when null | "− " + `formatMoney(commission_amount ?? commission)` | `earnings-commission` |
| 2b | `receipt` | "Booking fee" (only when BE-123 `booking_fees > 0`) | "− " + `formatMoney(booking_fees)` | `earnings-booking-fee` |
| — | divider: 1pt (`borderWidth.hairline` rounded up to 1) `heroDivider`, marginVertical 4 | | | |
| 3 | `wallet` | "Net" / "Bacha" in `label` 13/18/600 `heroText` (not "You keep" again: the headline says it; UI-R17 on-device fix) | `numeric` `heroText` = `formatMoney(earnings)` | `earnings-net` |

  The minus is U+2212 followed by a space, in the same style as the value. No red: commission is a normal, agreed cost, not an error.
  Accessibility: the block is one accessible group, label "Fares collected {fares}, minus commission {rate} percent {commission}, you keep {net}".

**C. Stats row**, 16 gap after B (after A when B is hidden).
- Top divider: 1pt `heroDivider` full width; then 12 padding-top.
- `flexDirection row`; each cell `flex 1` (equal widths), `alignItems center`, `gap 2`; between cells a 1pt `heroDivider` vertical rule, height 32, `alignSelf center`. Cells:

| Cell | Present when | Icon (16, `heroTextMuted`) | Value `numeric` `heroText` | Caption `caption` `heroTextMuted` |
|---|---|---|---|---|
| Trips | always | `rides` | `String(totals.trips)` | "Trips" |
| Online | BE-124 `online_minutes` is a number | `clock` | "{h} h {m} min" / "{m} min" under 60 | "Online" |
| Distance | always (0 shows "0 km") | `distance` | `formatDistanceKm(totals.distanceKm)` | "Distance" |

- Icon sits above the value (column: icon, 4, value, 2, caption). Value `numberOfLines 1`, `adjustsFontSizeToFit`, `minimumFontScale 0.75`; caption up to 2 lines, centred.
- With 2 cells (no online time) the cells are still equal halves: never a 3 + 1 grid and never an orphan row. `flexWrap` is not allowed.
- Each cell is its own accessible element: "{caption}: {value}".

### Measurements (iPhone 17, 402 pt wide, default text)
Card inner width 402 − 32 − 40 = 330. Height ≈ 20 + 20 + 4 + 40 + 16 + (3 × 28 + 9) + 16 + 1 + 12 + 58 + 20 = **300**. iPhone SE (375): inner 303, 3 cells of ~100 each.

### States
| State | Hero |
|---|---|
| Loading (no data) | Skeleton block, same radius, height 300 (`componentTokens.skeleton.heights.earningsHero` updated to 300) in `surfaceAlt`; segments stay interactive. Switching period with cached data keeps the old hero at 0.5 opacity (150 ms `motion.fast`) until the new period lands; no skeleton flash |
| Zero trips in period | A shows "Rs 0"; B is replaced by one `bodySmall` `heroTextMuted` line (16 gap): "No trips {today / this week / this month} yet." C shows Trips 0 and Distance 0 km (online if BE-124 sends it) |
| Refresh error with cached data | Hero keeps cached values; the existing `earnings-refresh-error` text sits under the owed card, not inside the hero |
| Load error, no data | Whole-screen ErrorState (unchanged) |
| Offline | Offline banner (global) + cached hero |
| Negative net | Value shows "−Rs 40" (`formatMoney` sign), same colour; no special treatment |
| Long values | "Rs 1,234,567" shrinks via `adjustsFontSizeToFit` (min 0.6); breakdown values never wrap: labels wrap instead |

### 1.3x text and iPhone SE
- At 1.3x (iOS Larger Text ~ xxLarge, `maxFontSizeMultiplier` not lowered below 1.3 for any hero text) on a 375 pt SE: net number may shrink to fit; breakdown labels wrap to 2 lines with values still on line 1 aligned to the first line (`alignItems flex-start` when wrapped is acceptable; keep icon top-aligned with the first line); stats captions wrap to 2 lines centred; nothing clips or truncates with an ellipsis except the period caption.
- Minimum touch: the hero is not tappable in round 1 (no chevron, no press state).

### Roman Urdu (ur-Latn) and RTL
- Copy (add to `src/i18n` `earnings.*`; keys suggested, final keys the builder's):

| Key | en | ur-Latn |
|---|---|---|
| `heroKeep` | You keep | Aap ki kamai |
| `heroNet` (total row) | Net | Bacha |
| `heroFares` | Fares collected | Wusool kiya gaya kiraya |
| `heroCommission` | Commission {rate}% | Commission {rate}% |
| `heroCommissionNoRate` | Commission | Commission |
| `heroBookingFee` | Booking fee | Booking fee |
| `heroNoTrips.day/week/month` | No trips today yet. / No trips this week yet. / No trips this month yet. | Aaj abhi koi trip nahi. / Is hafte abhi koi trip nahi. / Is mahine abhi koi trip nahi. |
| `statTrips` | Trips | Trips |
| `statOnline` | Online | Online waqt |
| `statDistance` | Distance | Faasla |

- Roman Urdu labels are up to ~40 % longer: rely on the wrapping rules above; no fixed widths on labels.
- RTL-safe: use `start`/`end`, `marginStart`, `textAlign` defaults; amounts stay LTR digits ("Rs 1,048"); the minus sign stays attached to the amount.

### Low-literacy and performance
- Every breakdown row and stat carries an icon; numbers are the largest text in their row; one big number only.
- `EarningsHero` is `React.memo` on `(totals, currency, from, to, period)`; no animation on value change other than the period crossfade; icons are the existing vector set (no images); no extra request: hero reads only the earnings response.

## 2. Amount owed card (round 1, normative)

Directly under the hero, 12 gap. Data: `GET /wallet` (`useWallet(isFocused)`, as today). The card is about the wallet *now*, not the selected period; it does not change with the segment.

### 2.1 Owed (`amountOwed > 0`): prominent
- Card, fill `warningSoft` (light #FFF2DF / dark #332407), radius `radius.lg` 16, padding 16, no border, `testID earnings-owed`.
- Row 1: icon `moneyOut` 24 `warning` in a 40 circle of `surface` (light) / `surfaceAlt` (dark); 12 gap; text column `flex 1`:
  - `label` `warning` (5.31:1 light, 8.17:1 dark): "You owe Raah-e-Haq" / "Aap ne Raah-e-Haq ko dena hai".
  - `numericL` (22/28/700) `textPrimary`: `formatMoney(amountOwed, { currency })`, `testID earnings-owed-amount`.
  - `caption` `textSecondary`, up to 3 lines: "Commission from your cash trips. Pay with JazzCash or Easypaisa." / "Cash trips ka commission. JazzCash ya Easypaisa se ada karein." The provider names come from `wallet.topUp.providers[].name` joined with " or " / " ya "; if no providers, the sentence after the first full stop is omitted.
- 12 gap, then the actions, stacked (column, gap 4). The Pay label never truncates: "Pay Rs 99,999" fits at 1.0x on iPhone 17 and SE (UI-R17 on-device fix; a side-by-side row cut it to "Pay Rs 3,0…"):
  - When `canTopUp`: Button `md` `primary`, full width, icon `topUp`, label "Pay {amount}" / "{amount} ada karein" → `navigate(ADD_MONEY_ROUTE, topUpParamsFor(amountOwed))`, `testID earnings-owed-pay`.
  - Button `md`, full width, `ghost` under Pay (`secondary` when the Pay button is absent), label "Wallet" / "Wallet" → `navigate('Wallet')` (other ways to settle: cash settlement request when `canSettleCommission`), `testID earnings-owed-wallet`.
- Accessibility: card group label "You owe Raah-e-Haq {amount}"; buttons are separate elements, 48 high (≥ 44).

### 2.2 Nothing owed or credit: calm
- Card `surface` (default Card), padding none, one ListItem (§5.8) → Wallet:
  - `balance > 0`: icon `wallet` in `successSoft` circle, `success` glyph; title "Wallet credit {balance}" / "Wallet mein {balance}"; subtitle "Covers your next commission" / "Agle commission mein kat jaye ga".
  - `balance === 0`: icon `checkMark` in `successSoft` circle, `success` glyph; title "Nothing owed" / "Kuch baqaya nahi"; subtitle "You're all settled" / "Sab hisaab barabar".
  - Trailing chevron, `testID earnings-wallet`.

### 2.3 Other states
| State | Spec |
|---|---|
| Wallet loading, no cache | Skeleton 72 high, radius 16 (not the "Balance and payment reports" placeholder text) |
| Wallet failed | ListItem `networkError` icon, title "Couldn't load your wallet" / "Wallet load nahi ho saka", subtitle "Tap to try again", tap = refetch; long-press not needed |
| Wallet `status` suspended/blocked | Owed layout as 2.1 without the Pay button; caption from the server message if sent, else "Your wallet is on hold. Contact support." |

## 3. Round 2 (normative, 2026-10-20)

What the round 2 shots show (iPhone 17, Bilal, Tue 20 Oct, after bf07ab0):

| # | Where | Defect today | Fixed by |
|---|---|---|---|
| D1 | Week chart (`-r2-week-chart-light`, y≈605 of 1000) | Tue (today, Rs 0) and Wed–Sun (future) draw the same 2pt `surfaceAlt` stub: the chart says "you earned nothing all week" | §3.1 past / today / future |
| D2 | Month chart (`-r2-month-chart-light`, x 290–420) | Days 21–31 (future) look exactly like the zero days 2–4; today (20) is not marked; label "20" sits under a future-looking slot | §3.1 |
| D3 | Chart readout (y≈657) | The selected-day line sits under the bars in `bodySmall` 14 grey; the only number in the card is the smallest text | §3.1 header readout |
| D4 | Month chart | 28–31 slots of ~9pt are tap targets well under 44pt; each is its own Pressable (31 accessibility stops) | §3.1 scrub + adjustable |
| D5 | Link card (`-r2-week-scrolled-light`, y 305–505) | Two full-width rows with two-line subtitles take 200pt to say "Statements" and "Strikes"; the strike status is invisible until opened | §3.2 tiles |
| D6 | Trip rows (`-r2-trips-dark`) | Subtitle "Yesterday · 9:07 PM · Quoted 1.1 km · Locked fare Rs 150 · commission 20% = Rs 30" wraps to 2 lines on every row, repeats "Yesterday" 30 times and buries fare and commission | §3.3 |
| D7 | Trip rows (`-r2-trips-dark`, x≈355–405) | Net amounts are not end-aligned: "Rs 64" and "Rs 80" sit 12pt left of "Rs 120" because the title width pushes the column | §3.3 fixed trailing column |
| D8 | Trip rows | Rows lie flat on `background`, full bleed, unlike every other list in the app (grouped cards, §5.8); no day grouping | §3.3 day groups |
| D9 | Whole list | Refresh error is a bare red line; switching period dims only the hero, chart and rows still show the old period at full strength | §3.4, §3.6 |
| D10 | Empty period | A full-height EmptyState under the links, centred in the remaining space, with "Go online" as body text but no action | §3.5 |

### 3.1 Daily chart (week and month)

Shown when `period !== 'day'`, `series.length > 0` and `totals.trips > 0` (a zero-trip period already says "No trips this week yet" in the hero; an empty chart adds nothing). `EarningsChart`, `React.memo` on `(series, period, currency, today, stale)`.

**Day classes** (date strings compared as `YYYY-MM-DD`, never as `Date` objects):
- `today` = BE-125 `today`; fallback (until BE-125): `Date.now()` + the UTC offset parsed from `from` (`+05:00` → +300 min), formatted as the UTC calendar date. If `from` has no offset, every day counts as past (old behaviour, no regressions).
- **past**: `date < today`; **today**: `date === today`; **future**: `date > today`.

**Container**: `Card` (default: `surface`, radius 16, padding 16, `elevation.1`), `testID earnings-chart`.

**A. Header (readout), top of the card**
1. Row, `space-between`, `alignItems center`, minHeight 16:
   - Start: `overline` `textMuted` "Earnings per day" / "Rozana kamai", `accessibilityRole header`.
   - End: `caption` `textSecondary`, one line: the selected day: "Today" / "Aaj" when it is today, else `formatSeriesDate` ("Fri, 16 Oct" / "Jum, 16 Oct"). `testID earnings-chart-date`.
2. 4 gap. Row, `alignItems baseline` (`flex-end` on Android), gap 8:
   - `numericL` (22/28/700, tabular) `textPrimary`: `formatMoney(day.earnings, { currency })`, `numberOfLines 1`, `testID earnings-chart-amount`.
   - `bodySmall` `textSecondary`: "{n} trips" / "1 trip" (ur-Latn "{n} trips" / "1 trip"); "No trips" / "Koi trip nahi" when 0. `flexShrink 1`, `numberOfLines 1`.
   - The pair is one accessible text with `accessibilityLiveRegion polite` (Android) / announced on change (iOS): "{date}: {amount}, {n} trips".
   The old readout line under the plot (`earnings-chart-selected`) is removed; keep that testID on this row.

**B. Plot**, 16 gap after A.
- Plot area: height `PLOT_HEIGHT` 120 for bars + 1 baseline + 4 gap + 16 label row = 141. Width = card inner width (iPhone 17: 402 − 32 − 32 = 338; SE: 311).
- Slots: `flexDirection row`, one slot per `series` day, `flex 1` each, gap `space[1]` 4 (week) / 2 (month, `plotDense`). Bars are centred in their slot, width 60 % of the slot, max 24 (week) / 8 (month), min 3.
- **Past and today with `earnings > 0`**: bar, height `max(4, ratio × 120)` (`barRatios`), top corners radius 4 (week) / 2 (month), bottom square on the baseline. Fill: unselected `borderStrong` (3.28:1 light, 3.43:1 dark on `surface`); selected light `primary` (14.89:1), dark `primaryText` navy-300 (8.31:1).
- **Past and today with `earnings <= 0`** (a day worked and earned nothing): no bar; a **zero dot** 4×4, radius 2, `borderStrong` (selected: the primary colour as above), centred, its bottom on the baseline. This is the mark of a real "0".
- **Future**: nothing above the baseline: no bar, no dot, no stub.
- **Baseline**: one row of 1pt segments, one per slot, spanning the slot plus its gap: past and today `borderStrong`; future `border` (1.34 / 1.41: decorative, the meaning also comes from the missing dot and from the labels). Result: a solid line that fades out where the days have not happened yet.
- **Labels** (`caption` 12/16, centred, `numberOfLines 1`, 4 under the baseline):
  - Week: every day, weekday short ("Mon" / "Pir"). Month: day 1, every 5th day, and today; a 5th-day label within 2 days of today is dropped so they never collide; month labels keep the 28pt width that overflows the slot (as today).
  - Past: `textMuted` (5.32 / 6.09). Future: `textMuted` too (labels stay readable, AA). Today: `captionStrong` `textPrimary`, with a 2pt × 16pt `primary` (dark `primaryText`) bar, radius 1, 2 under the label (`testID earnings-chart-today`).
  - (Correction to the round 1 note: `textDisabled` is not used: in light it is neutral-600, darker than `textMuted`, so future days would look more important.)

**C. Interaction**
- Selection default: today when it is in the period and today's `earnings > 0`; else the past-or-today day with the highest earnings; else today (or the last past day if today is outside the period). Recomputed when `series` or the period changes.
- Tap or drag across the plot selects the slot under the finger: one responder on the plot `View` (not one Pressable per bar): `onStartShouldSetResponder` true, `onMoveShouldSetResponder` only when |dx| > |dy| (vertical drags stay with the list), `onResponderTerminationRequest` true. Index = `floor(locationX / slotWidth)`, mirrored when `I18nManager.isRTL`. Future slots cannot be selected: the selection clamps to the nearest past-or-today slot. `setSelected` only when the index changes (no re-render per move event). Haptic: `selection` once per index change, iOS only (haptics follow §6.11; none on Android, where cheap motors buzz).
- The plot is one accessibility element: role `adjustable`, label "Earnings per day, {period caption}", value = the readout text; swipe up/down (iOS) or `increment`/`decrement` actions move the selection one past-or-today day.
- No animation when the selection changes (colour swap only). Bars do not grow on load (performance; nothing to animate on a 31-bar list on low-end Android).
- While stale (§3.6): opacity 0.5, responder disabled, `accessibilityState.disabled`.

**D. Measurements** (iPhone 17, default text): 16 + 16 + 4 + 28 + 16 + 141 + 16 = **237** card height. Skeleton height for the chart: 237 (`componentTokens.skeleton.heights.earningsChart`, new).

**E. 1.3x and SE**: readout amount may shrink (`adjustsFontSizeToFit`, min 0.75); trips text truncates with ellipsis before the amount ever does; the date caption truncates first in the header row. Labels keep `maxFontSizeMultiplier 1.3` (they sit under 9pt slots; month labels at 1.3x are ~16pt wide and still fit in their 28pt box). Plot height does not scale.

### 3.2 Link tiles: Weekly statements, Strikes

Order is fixed: **Weekly statements first** (money, the thing a driver opens every week), **Strikes second**. Placed directly under the chart (under the owed card when there is no chart), above the trips list, so they are always reachable without paging through rides.

- Row, gap 12, two equal tiles (`flex 1`); on any width the two stay side by side (SE inner 343 → tiles 165.5).
- **Tile** (`EarningsLinkTile`, new): Pressable `Card` (default `surface`, radius 16, `elevation.1`), padding 12, minHeight 96, press fill `surfacePressed`, scale 0.98 (`usePressScale`, none with reduced motion), `accessibilityRole button`.
  - Top row, `space-between`: icon tile 36×36, `surfaceAlt`, radius `md` (12), glyph 20 `primaryText` (light 12.82:1, dark 7.39:1 on `surfaceAlt`) | `chevronEnd` 16 `textMuted` (flips in RTL).
  - 12 gap: title `bodyStrong` (16/24/600) `textPrimary`, up to 2 lines.
  - 2 gap: status line `caption` `textSecondary`, up to 2 lines.

| Tile | Icon | Title en / ur-Latn | Status line | testID |
|---|---|---|---|---|
| Statements | `statement` | "Weekly statements" / "Hafta war hisaab" | "Fares, commission, payments" / "Kiraya, commission, adaigi" (static) | `earnings-statements` |
| Strikes | `dispute` | "Strikes" / "Strikes" | From `GET /driver/strikes` (below) | `earnings-strikes` |

- **Strikes status line** (only these server states; no guessing):
  - Not loaded yet or failed: static "Cancellations and reports" / "Cancel aur shikayatein", `textSecondary`.
  - `under_review`: icon `alertTriangle` 14 + text in `danger` "Account under review" / "Account review mein hai".
  - `active_count > 0`: icon `warning` 14 + text in `warning` "{n} of {threshold} active" / "{threshold} mein se {n} active" (5.86 / 9.42 on `surface`).
  - `active_count === 0`: icon `checkMark` 14 + text in `success` "None active" / "Koi active nahi".
  - Icon and text sit in one row, gap 4, icon top-aligned with the first line.
- Data: `useDriverStrikes` read only while the Earnings tab is focused, through the query cache with a 60 s TTL (same pattern as `/me/stats`, T-536): one request on first focus, none on period switches, one on pull to refresh. Never polled.
- Accessibility: one element per tile, label "{title}, {status line}", hint "Opens {title}".
- Replaces `EarningsLinksCard` (delete only after grep shows no other importer).

### 3.3 Trips list

**Section header**, 24 above (after the tiles): `overline` `textMuted` "Trips" / "Trips", `accessibilityRole header`, 8 below. No count (the hero has it).

**Day groups (week and month)**. Rides arrive newest first. A ride's local date = `completed_at` shifted by the UTC offset parsed from `from` (the server sends `completed_at` in UTC); a ride without `completed_at` goes into the group of the ride above it (or the first group).
- Each date that has rides gets a **day header** directly above its first ride:
  - Row, `space-between`, `alignItems center`, paddingHorizontal 16 (aligned with the card text), paddingTop 16 (0 for the first group, which sits 8 under the section header), paddingBottom 8.
  - Start: `label` (13/18/600) `textSecondary`: "Today" / "Aaj", "Yesterday" / "Kal", else `formatSeriesDate` ("Fri, 16 Oct").
  - End: `caption` `textSecondary` tabular: the day's numbers **from `series`** (not summed in the app): "{earnings} · {n} trips" ("Rs 1,048 · 10 trips"). If the date is not in `series`, the end text is omitted.
  - `accessibilityRole header`, label "{day}, you kept {earnings} from {n} trips".
- **Today** (`period === 'day'`): no day headers; one group.
- The rides of a group form one grouped card (§5.8): rows render their own segment of it: fill `surface`, first row top radius 16, last row bottom radius 16 (a ride is "last" when the next item is a day header or the end of the loaded list; when more pages are loading, the last loaded row keeps square bottom corners until the next page decides), no shadow on segments (a split shadow would show seams), cards 16 in from the screen edge (`layout.gutter`). Divider: hairline `border` inset 72 from the card's start (16 + 40 + 16), drawn as the row's top border except on the first row of a group.
- Implementation note: one `FlatList` with mixed items `{ kind: 'day', date } | { kind: 'ride', ride, first, last }` built in a `useMemo` from the loaded rides; keys `day-{date}` and `ride-{id}`. Paging (`onEndReached`) unchanged.

**Trip row** (`EarningsTripRow`, new, `React.memo` on `(ride, currency, first, last, stale)`), minHeight 72, paddingHorizontal 16, paddingVertical 12, `flexDirection row`, `alignItems center`:
1. **Leading** tile 40×40, `surfaceAlt`, radius `md`, glyph 24 `textSecondary` from `vehicleIconName(ride.vehicle_type)` (car, bike, rickshaw, van; AC/parcel tiers use their glyphs from T-586 when the type says so).
2. 16 gap. **Text column**, `flex 1`, `minWidth 0`:
   - Line 1: `bodyStrong` (16/24/600) `textPrimary`, `numberOfLines 1`, tail ellipsis: the route `shortPlace(pickup) → shortPlace(dropoff)` (arrow U+2192, U+2190 in RTL). No addresses: the time ("9:07 PM") as the title and line 2 starts at the distance.
   - Line 2: `caption` (12/16/500) `textSecondary`, `numberOfLines 1`: "{time} · {distance}" ("9:07 PM · 1.1 km"). Time = `formatTime(completed_at)` only: the day is in the group header (in the Today view the day is implied). Distance = `distance_km` when > 0, else omitted. **No** "Quoted …", **no** "Locked fare", **no** "Yesterday".
   - Line 3: `caption` `textMuted`, tabular, up to 2 lines: "Fare {fare} · Commission {commission}" / "Kiraya {fare} · Commission {commission}". `fare` = `fare` (`total_fare`); `commission` = `commission_amount` (BE-84) or `platform_commission` when null. When `booking_fee > 0`: " · Fee {booking_fee}" / " · Fee {booking_fee}". The commission rate is not repeated per row (it is in the hero and the ride details).
3. 12 gap. **Trailing column**, `flexShrink 0`, `minWidth 72`, `alignItems flex-end` (end in RTL), so every amount lines up on one edge whatever the title length (fixes D7):
   - `numeric` (16/20/600, tabular) `textPrimary`: `formatMoney(driver_net ?? driver_earnings)`, `numberOfLines 1`. Negative shows "−Rs 40" in the same colour.
   - 2 gap. `caption` `textMuted` "Net" / "Bacha".
4. No chevron (the whole row is the target and the hint says it opens details). Press: `surfacePressed` fill on the segment; tap → `navigate(RIDE_DETAILS_ROUTE, { rideId: ride.id })`. Ride details already shows the full split (booking fee, commission at its rate, you earned) and the locked-fare / quoted-distance facts that leave the row.
- Accessibility: one element, role button, label "{route or time}, {time}, fare {fare}, commission {commission}, you keep {net}", hint "Opens the ride details" / "Ride ki tafseel kholta hai". testIDs `earnings-ride-{id}` (row), `-title`, `-net`, `-split`.
- Measurements, iPhone 17 default text: card inner 370; text column = 370 − 32 − 40 − 16 − 12 − 72 = **198** ("Fare Rs 1,250 · Commission Rs 250" ≈ 190 at 12pt fits one line); SE: **171** (wraps to 2 lines, allowed). Row height 12 + 24 + 16 + 16 + 12 = **80** with one split line.

### 3.4 Pull to refresh

- `RefreshControl` on the list, tint light `primary`, dark `primaryText` (iOS `tintColor`, Android `colors` + `progressBackgroundColor` `surface`). Only the user's pull shows the spinner (focus refetches are silent, as today).
- One pull = page 1 of the current period + `GET /wallet` + the strikes summary, in parallel, each at most once (a pull while one is in flight is ignored). Loaded later pages are dropped and paging restarts from page 1 (as `useDriverEarnings` does today).
- Content stays fully visible and interactive during a pull (no dim, no skeleton).
- **Refresh failed with data on screen**: replace the bare red `earnings-refresh-error` text with a `Banner` tone `warning`, 16 under the owed card: text "Couldn't refresh. Showing your last numbers." / "Refresh nahi ho saka. Pichle numbers dikh rahe hain.", action "Retry" / "Dobara" → `refresh()`. `testID earnings-refresh-error` stays. Hidden after the next success. When the device is offline the global offline banner already says so: this Banner is not shown on top of it.

### 3.5 Loading, paging and empty

| State | Spec |
|---|---|
| First load, no data | Header + segments as now; skeleton mirrors the layout: hero block 300 (radius 16), 12 gap, owed block 72 (radius 16), 16 gap; week/month: chart block 237 (radius 16), 16 gap; tiles: two blocks 96 (radius 16, gap 12); 24 gap; overline line 60×10; 8 gap; one card (radius 16) with 4 row skeletons (40 tile + two text lines 140/90, trailing line 56), each 80 high. Static with reduced motion. No spinner. |
| Paging (`loadingMore`) | Footer 56 high: `ActivityIndicator` small, light `primary` / dark `primaryText`, centred. |
| Paging failed | Footer: `caption` `textSecondary` centred "Couldn't load more trips." / "Mazeed trips load nahi ho sakin." + Button `sm` `ghost` "Try again" / "Dobara koshish karein" → `loadMore`. `onEndReached` does not fire again until retried (as today). |
| End of list (`page === lastPage`, rides > 0, more than one page was loaded) | Footer `caption` `textMuted` centred "That's every trip {today / this week / this month}." / "{Aaj / Is hafte / Is mahine} ki saari trips." 16 padding. Not shown when everything fit on page 1. |
| Empty period (`rides.length === 0` and `totals.trips === 0`) | Hero zero state (§1.1), owed card, no chart, link tiles, Trips header, then **`EmptyState size="compact"`** (not full-height, not vertically centred) inside a `surface` card (radius 16, padding 16): icon `rides`, title "No trips {today / this week / this month}" / "{Aaj / Is hafte / Is mahine} koi trip nahi", body "Go online on the Drive tab to get ride requests." / "Ride requests ke liye Drive tab par online hon.", action `sm` `secondary` "Go to Drive" / "Drive par jayein" → `navigation.navigate('Drive')` (tab switch only; it never toggles online). `testID earnings-empty`. |
| Mismatch (`totals.trips > 0` but page 1 returned no rides) | Same empty card without the action, title "Trips couldn't be listed" / "Trips list nahi ho sakin", body "Pull down to try again." (server inconsistency; never hide the hero numbers). |
| Load error, no data | Full `ErrorState` (unchanged). |
| Offline with cache | Global offline banner + cached content; pull shows the spinner then the offline toast from the API layer; no warning Banner (above). |

### 3.6 Period switch (chart and list follow the hero)

- On a segment change, if any period's data is on screen: the hero (as round 1), the chart and the trips list (day headers and rows) keep the **last period's content at opacity 0.5** (`motion.fast` 150 ms, `easing.out`) until the new period's page 1 lands; then the new content replaces it and fades to 1 in 150 ms. Reduced motion: opacity switches with no animation.
- The owed card and the link tiles are not period data: never dimmed.
- While stale: rows and the chart are not interactive (`pointerEvents none` on those blocks, `accessibilityState.disabled`), `onEndReached` paging is off, and the refresh control is still allowed (it refreshes the new period).
- Scroll: the list jumps to offset 0 without animation on the switch (the hairline follows, as today), so the driver sees the hero dimmed, not the middle of an old list.
- A period loaded in the last 60 s (switching back and forth) shows immediately at full opacity and revalidates silently: per-period cache in `useDriverEarnings` with the same 60 s TTL (no request burst when a driver flicks Today / Week / Month).
- The new period fails to load: content stays dimmed and the warning Banner (§3.4) reads "Couldn't load {This week}." / "{Is hafta} load nahi ho saka." with Retry; the segment stays on the new period. Never undim the old period's numbers under the new period's label.
- `stale` is one boolean from the screen passed to `EarningsHero`, `EarningsChart` and the rows (or one `DimmedContext` provider around them); no per-row timers.

### 3.7 Light and dark

All colours above are semantic tokens; nothing new. Checks: unselected bars `borderStrong` 3.28 / 3.43 (non-text ≥ 3), selected bar 14.89 / 8.31, labels `textMuted` 5.32 / 6.09, row text `textSecondary` 7.44 / 9.39, split line `textMuted` 5.32 / 6.09 on `surface`, tile glyph `primaryText` on `surfaceAlt` 12.82 / 7.39, strike states `success` 5.78 / 8.37, `warning` 5.86 / 9.42, `danger` 5.90 / 6.89. Dark segments use `surface` dark-900 on `background` dark-950 (cards read as cards with no shadow, as elsewhere in dark).

### 3.8 iPhone SE and 1.3x text

- SE (375): chart inner 311 (month slots ≈ 8.1, bars ≈ 5); tiles 165.5; row text column 171.
- 1.3x: tile titles wrap to 2 lines ("Hafta war hisaab" fits on one), status lines to 2; row title stays one line with ellipsis, line 3 wraps to 2; trailing net never wraps or truncates (`minWidth 72` grows with the text: `numberOfLines 1` and no `adjustsFontSizeToFit` on row amounts, the column takes what it needs and the text column shrinks); day header end text may wrap under the start text (`flexWrap wrap`, gap 4) rather than truncate the amount.
- Nothing in round 2 lowers `maxFontSizeMultiplier` below 1.3 except the chart's day labels (fixed at 1.3).

### 3.9 Roman Urdu copy (keys suggested under `earnings.*`)

| Key | en | ur-Latn |
|---|---|---|
| `chartTitle` | Earnings per day | Rozana kamai |
| `chartToday` | Today | Aaj |
| `chartTrips` | {n} trips / 1 trip | {n} trips / 1 trip |
| `chartNoTrips` | No trips | Koi trip nahi |
| `chartA11y` | Earnings per day, {caption} | Rozana kamai, {caption} |
| `statementsTile` / `statementsTileBody` | Weekly statements / Fares, commission, payments | Hafta war hisaab / Kiraya, commission, adaigi |
| `strikesTile` / `strikesTileBody` | Strikes / Cancellations and reports | Strikes / Cancel aur shikayatein |
| `strikesNone` / `strikesActive` / `strikesReview` | None active / {n} of {threshold} active / Account under review | Koi active nahi / {threshold} mein se {n} active / Account review mein hai |
| `dayToday` / `dayYesterday` | Today / Yesterday | Aaj / Kal |
| `dayTotals` | {earnings} · {n} trips | {earnings} · {n} trips |
| `rowSplit` | Fare {fare} · Commission {commission} | Kiraya {fare} · Commission {commission} |
| `rowFee` | · Fee {fee} | · Fee {fee} |
| `rowNet` | Net | Bacha |
| `refreshFailed` | Couldn't refresh. Showing your last numbers. | Refresh nahi ho saka. Pichle numbers dikh rahe hain. |
| `periodFailed` | Couldn't load {period}. | {period} load nahi ho saka. |
| `moreFailed` | Couldn't load more trips. | Mazeed trips load nahi ho sakin. |
| `endOfList` | That's every trip {today / this week / this month}. | {Aaj / Is hafte / Is mahine} ki saari trips. |
| `emptyTitle` | No trips {today / this week / this month} | {Aaj / Is hafte / Is mahine} koi trip nahi |
| `emptyBody` / `emptyAction` | Go online on the Drive tab to get ride requests. / Go to Drive | Ride requests ke liye Drive tab par online hon. / Drive par jayein |

Roman Urdu is LTR; RTL readiness (future Urdu script) is covered by `start`/`end` styles, the mirrored chart responder and the arrow swap above.

### 3.10 Low literacy

- Every row and tile leads with a glyph (vehicle, statement, strike state); money is always the largest text in its row, and the net sits in one place (trailing) on every row.
- Strike state uses icon + colour + words, never colour alone. The chart's "today" has a bar marker and bold text, not colour alone; future days are blank, which reads without words.
- Words: "Fare", "Commission", "Net" / "Kiraya", "Commission", "Bacha", the same words as the hero.

### 3.11 Performance

- Rows: `React.memo`, no inline styles built per render (static `StyleSheet` + the two corner variants), `formatMoney` results computed in the `useMemo` that builds the items, `keyExtractor` stable, `initialNumToRender 8`, `maxToRenderPerBatch 8`, `windowSize 7`, `removeClippedSubviews` on Android. No images in the list (vector glyphs only).
- Chart: plain Views, one responder (not 31 Pressables), selection state changes only when the index changes, no layout animation.
- Requests: one earnings call per period per 60 s at most (cache), strikes once per focus at most per 60 s, wallet unchanged; a pull refreshes each once. No new polling, no WebSocket.
- `ListHeaderComponent` content memoised so chart selection and pull state do not re-render the hero, owed card and tiles.

## 4. Review checklist (round 2)

Light and dark on iPhone 17 and iPhone SE (3rd gen), default text and 1.3x, en and ur-Latn, Bilal's week and month (seeded rides on past days, today with and without trips):
1. Chart: future days blank with a faded baseline, zero days a dot, today marked (bold label + bar), readout in the card header with the amount in `numericL`; drag across a month selects days and never a future one; VoiceOver treats the plot as one adjustable element.
2. Tiles: Weekly statements then Strikes, side by side, strike status from the server in the right tone.
3. Trips: day groups with headers from `series`, grouped cards, rows with route, time · distance, "Fare · Commission" line and an end-aligned net; no "Quoted", "Locked fare" or "Yesterday" in rows; tap opens ride details.
4. Pull to refresh refreshes earnings, wallet and strikes; failure shows the warning Banner with Retry.
5. Period switch dims hero, chart and rows together at 0.5 and blocks taps until the new period lands; back-and-forth within 60 s does not refetch.
6. Skeleton matches §3.5 heights (no jump); empty period shows the compact empty card with "Go to Drive".
7. Code: no hex literals, no raw font sizes or magic spacing in touched files; components from `src/components/ui`.

(Round 1 checklist: hero §1.1 and owed card §2 as built in bf07ab0, unchanged by round 2.)
