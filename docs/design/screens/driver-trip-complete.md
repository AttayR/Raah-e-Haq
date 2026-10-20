# Driver · Trip complete (collect cash, rate rider)

- **Task:** T-615 after BE-04 (server fare, `driver_earnings`), BE-07 (rating), T-505.
- **Route:** `DriverTrip` state `completed`, full screen (map hidden), tab bar hidden.
- **Data:** `GET /rides/{id}` after `POST /rides/{id}/complete`: `total_fare`, `driver_earnings`, `platform_commission`, `distance_km`, `duration_minutes`, `payment_method` (`cash`), `passenger` (first name, `profile_image`), `can_rate`, `my_rating`. Rate: `POST /rides/{id}/rate`.

## Layout
`Screen scroll`, background `background`, Header without back, trailing none.

1. 16 gap: **Collect card** (`Card`, padding 24, centred, `successSoft` fill, radius `lg`): icon 32 `cash` `success` → 8 → `caption` `success` "Collect from {first name}" → 4 → `numericXL` `{total_fare}` `textPrimary` → 8 → `bodySmall` `textSecondary` "{distance_km} km · {duration_minutes} min".
2. 16 gap: **Earnings breakdown Card** `outlined`: rows (5.26 style) "Fare" `{total_fare}`, "Raah-e-Haq fee" `−{platform_commission}`, divider, "You earn" `numericL` `{driver_earnings}` in `success`. Rows hidden when null; if `driver_earnings` is null, the card is hidden.
3. 16 gap: **Rate rider Card** (when `can_rate`): `title` "Rate {first name}" → 12 → stars input 40 → optional comment field (revealed after a star).
4. 24 gap: Button `lg primary` "Cash collected" → submits rating if given (or skips), then returns to Drive (online, BE-04 sets driver available).
5. 8 gap: ghost Button "Report a problem" → support ticket prefilled with ride id.
6. Bottom `insets.bottom + 16`.

## States
| State | Spec |
|---|---|
| Fare pending | Skeleton amount; poll up to 10 s; then "Fare will appear in Earnings." and the button still works. |
| Submitting | Button loading. |
| Rating error | Toast error; returning to Drive is still allowed ("Cash collected" retries once then proceeds). |
| Already rated | Read-only stars. |
| Offline | Button label "Back to Drive" (rating disabled). |

---

## UI-R13 (2026-10-20): complete — collect cash, see your share, rate the rider

**Anatomy:** same receipt state as the passenger (`passenger-trip-complete.md` UI-R12 PR1–PR2) with the driver's money. **Supersedes** the Layout above, the floating legacy `DriverRideSummary` card (raw `Text`, `TouchableOpacity`, `styles.total`) and the separate `DriverRideRatingPrompt` modal over it: rating is inline (shared `RatingForm`). **Keeps what ships:** server totals only (BE-04/BE-84 split, BE-82 locked labels, BE-60 booking fee, BE-85 waiting, offer adjustment BE-83), parcel delivered/returned titles and "paid at pickup" (T-561/T-574), rating tags and stale handling (T-505), return to Drive online.

**Before:** `docs/qa-reports/2026-10-15-switch-safety-qa/S7-06-drv-trip-complete.png`, `docs/qa-reports/2026-10-11-regression/05-08-driver-trip-complete.png`, `docs/design/audit/2026-10-11-prod-audit/ref-driver-trip-complete.png`.

### DC1. Content, top to bottom (iPhone 17)

| # | Block | Spec | Height | Gap after |
|---|---|---|---|---|
| 1 | Top padding | — | 24 | — |
| 2 | Status header | `h2` "Trip complete" / "Trip mukammal" (parcel: shipped delivered/returned); subtitle "{distance_km} km · {duration_minutes} min" | 50 | 16 |
| 3 | **Money card** | as PR2 #3: `surfaceAlt`, radius `lg`, padding 16; `caption` `textSecondary` "Collect from {first name}" / "{first name} se lein" (no name: "Collect in cash"; parcel: shipped "Paid in cash at the pickup") → 2 → `numericXL` `{total_fare}`; end: Badge `neutral` `cash` "Cash" | 90 | 8 |
| 4 | **Your share** row | ListItem 56, no leading: `title` "You keep" / "Aap ko milenge" + `caption` `textSecondary` "after {rate} commission" / "{rate} commission ke baad"; trailing `numericL` `textPrimary` `{driver_earnings}` (BE-84 `driver_net` when the completed resource has no `driver_earnings`); hidden if neither is sent | 56 | 0 |
| 5 | **Fare details** row | as PR2 #4; expands: Base, Distance (locked label), Time (locked label), Stops, Minimum fare adjustment, Booking fee, Waiting, Offer adjustment (signed), then the split: Booking fee (platform) −, Commission ({rate}) −, hairline, You keep — rows only for returned fields (shipped logic in `DriverRideSummary`, moved) | 48 | 24 |
| 6 | **Rating block** (`can_rate`) | as PR2 #5 with the rider (Avatar 56, "How was your ride with {first name}?" / "{first name} ke saath ride kaisi rahi?", stars 40, reveal tags + comment) | 185 | 24 |
| F | **Footer** | one `lg primary`: cash ride "Cash collected" / "Cash mil gaya"; parcel or non-cash "Done" / "Theek hai". Submits the rating first when a star is chosen (button loading), then returns to Drive (online). Rating failure: Toast error, the button retries once, then proceeds (the rating is not worth blocking the next ride) | 16 + 56 + 42 | — |

- **iPhone 17:** 24 + 50 + 16 + 90 + 8 + 56 + 48 + 24 + 185 + 114 = **615** (70 %). SE ≈ 589 (88 % cap: scrolls a little; the footer is always visible).
- Map behind: TS2.1 receipt (pickup + drop-off, route from cache only). SOS shield stays 30 min; back hidden.

### DC2. Saffron and colour

M2 rating stars only (§1.8). "You keep" stays `textPrimary` (money you keep is calm and large, not a status green; the Earnings hero carries the BrandBar). Cash badge neutral.

### DC3. States

| State | Spec |
|---|---|
| Fare pending | amount skeleton; shipped re-read up to 10 s; then "Fare will appear in Earnings." / "Kiraya Earnings mein nazar aayega."; footer still works |
| Submitting | footer loading |
| Already rated / can't rate | PR2 #5' / block absent |
| Offline | footer label "Back to Drive" / "Drive par wapas" (rating disabled, PR5 offline rule) |
| Parcel returned | shipped returned title; money card caption from the shipped parcel copy |
| 1.3× / Roman Urdu / Dark | measured; ur strings above; `surfaceAlt` card in dark |

### DC4. Motion, accessibility, performance

Entry: TS7 swap from on trip, haptic `notificationSuccess`; no count-up. Announce "Trip complete. Collect {fare} in cash. You keep {net}." / "Trip mukammal. {fare} cash lein. Aap ko {net} milenge." Focus: header → money → your share → fare details → rating → footer. No new requests (the completed resource is already read; tags from the cached `GET /rating-tags`).

### DC5. Design review evidence (UI-R13)

Signed-in, local backend, two sims (local test passenger + test driver; BE-117 bot allowed): to pickup light/dark (with route, with the ETA tile once TS10 ships), arrival refused Banner, arrived with timer + slide, no-show offered, PIN sheet over the slide, PIN blocked, on trip with a stop and at the drop-off, complete light/dark (details collapsed/expanded, star + tags), rider cancelled, Roman Urdu, 1.3×, iPhone SE (compact inline actions) light/dark. **Pairs with UI-R12:** on the way ↔ to pickup, arrived ↔ arrived, on trip ↔ on trip, receipt ↔ complete, one image per pair side by side.
