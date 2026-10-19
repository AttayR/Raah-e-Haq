# Driver · Earnings

- **Tasks:** UI-R17 (absorbs T-616). Built on T-507 (Earnings on real data), T-501 (ride details), BE-08, BE-84 (per-ride split), T-515 / BE-74 (top-up).
- **Route:** `DriverTabs/Earnings` (tab 2 of 4). Code: `src/features/stats/screens/DriverEarningsScreen.tsx`, `components/EarningsHero.tsx`, `components/EarningsWalletCard.tsx`.
- **Revision:** 2026-10-19 (UI-R17 round 1: period hero + amount owed). Owner feedback on the Today card: "this card looks useless, everything looks random".
- **Before shots:** `docs/design/audit/driver-earnings-today-light-before.png`, `-today-dark-before.png`, `-week-light-before.png`, `-week-scrolled-light-before.png`, `-week-chart-dark-before.png`.

## 0. Data (real fields only)

| Source | Field (app model) | Used for |
|---|---|---|
| `GET /driver/earnings?period=day\|week\|month` | `totals.earnings` | Hero net ("You keep"). Can be negative (adjustments): show the sign, never clamp |
| | `totals.grossFares` (`gross_fares`) | "Fares collected" |
| | `totals.commission` (`commission`) | "Commission". Today this is `commission_amount + booking_fee` per ride (BE-84 `split()`) |
| | `totals.trips`, `totals.distanceKm` | Stats row |
| | `from`, `to`, `period`, `currency` | Period caption, money format |
| | `series[]`, `rides[]` | Chart and trips list (round 2) |
| **BE-123 (new)** | `totals.commission_rate` (number or null), `totals.commission_amount`, `totals.booking_fees` | "Commission 20%" label; separate "Booking fee" row when > 0. Until BE-123 ships: label "Commission" without a rate, one row with `totals.commission` |
| **BE-124 (new)** | `totals.online_minutes` (number or null) | "Online" stat. Until then (or when null): the column is not rendered; never 0, never a dash |
| `GET /wallet` (BE-09/BE-74/BE-85) | `amountOwed` (`amount_owed` = max(0, −balance)), `balance`, `currency`, `canTopUp`, `canSettleCommission` | Amount owed card (§2) |

Arithmetic shown on screen comes from the server only: the app never computes the rate, the net or the owed amount. If `grossFares − commission ≠ earnings` (rounding, adjustments), still show the three server numbers as sent.

## 1. Screen order (round 1 changes in bold)

1. Large Header "Earnings" + SegmentedControl "Today | This week | This month" pinned under it (unchanged, §5.2/§5.10).
2. 16 gap: **Period hero (§1.1)**.
3. 12 gap: **Amount owed card (§2)**: always directly under the hero; never below the links.
4. 16 gap: Chart card (week/month), then Statements/Strikes links, then the Trips header and rows: unchanged in round 1, redesigned in round 2 (§3).

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
| 3 | `wallet` | "You keep" in `label` 13/18/600 `heroText` | `numeric` `heroText` = `formatMoney(earnings)` | `earnings-net` |

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
- 12 gap, then actions row (`flexDirection row`, gap 8; stacks vertically when the text scale ≥ 1.3 or width < 360):
  - When `canTopUp`: Button `md` `primary`, `flex 1`, icon `topUp`, label "Pay {amount}" / "{amount} ada karein" → `navigate(ADD_MONEY_ROUTE, topUpParamsFor(amountOwed))`, `testID earnings-owed-pay`.
  - Button `md` `secondary` (`flex 1`; full width when the Pay button is absent), label "Wallet" / "Wallet" → `navigate('Wallet')` (other ways to settle: cash settlement request when `canSettleCommission`), `testID earnings-owed-wallet`.
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

## 3. Round 2 (to follow, not built in round 1)

Interim: chart card, links card and trips rows stay as built today. Round 2 will specify, with screenshots:
- **Chart (week/month):** keep bars from `series`; future dates (after today in `timezone`) draw no stub and use `textDisabled` labels; today's label `captionStrong`; readout row moves into the card header.
- **Statements and Strikes:** compact two-tile row instead of a two-row card with long subtitles.
- **Trips list:** rows grouped by day (header with the day's net from `series`), vehicle glyph leading, route title, time and distance meta, a third line "Fare Rs 150 · Commission 20% − Rs 30", trailing net with a "You keep" caption, no chevron; "Quoted … · Locked fare" moves to ride details.
- Empty, pagination and error states as in the previous version of this spec.

## Review checklist (round 1)
Light and dark on iPhone 17 and iPhone SE (3rd gen), default text and 1.3x, en and ur-Latn: hero matches §1.1 (one big number, three-row equation, equal-column stats with no orphan cell), owed card §2.1 shows above the chart/links with the Pay action when `canTopUp`, calm states §2.2, no hex literals or raw font sizes in the touched files.
