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
