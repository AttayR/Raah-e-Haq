# Driver · Vehicle & documents

- **Task:** T-616 after BE-15 (driver vehicle, licence, document statuses), BE-22 (private document URLs).
- **Route:** `Account → Vehicle & documents` (stack); also from Drive (vehicle row) and from the "can't go online" dialog.
- **Audit:** `audit/driver-profile-scrolled-*` (invented "Toyota Corolla 2020", "DL-123456789").
- **Data:** profile [BE-15]: `vehicle` {make, model, year, color, license_plate, vehicle_type, verification_status}, `license_number`, `license_expiry_date`, document statuses (per document: type, status, rejection reason if provided, updated_at). Images via authorized temporary URLs [BE-22].

## Layout
`Screen scroll`, Header (back, title "Vehicle & documents"), background `background`, pull to refresh.

1. 8 gap: **Vehicle Card**: top row: vehicle tile 56 (glyph by `vehicle_type`) → 12 → `h3` "{make} {model}" + `bodySmall` `textSecondary` "{year} · {color}" → trailing status pill (`verification_status`: approved success "Approved", pending warning "In review", rejected danger "Needs update"). 16 gap: plate pill (28 high, `surfaceAlt`, `numeric`, letter-spacing 0.5) `{license_plate}`.
2. 16 gap: **Licence Card** (grouped ListItems): "Licence number" `{license_number}` masked except last 4 (`•••• 6789`), "Expires" `{license_expiry_date}` formatted; if expiry < 30 days away: warning Banner inside the card "Your licence expires on {date}. Upload the renewed licence."; if expired: danger Banner "Your licence has expired. You can't go online until it's updated."
3. 24 gap: `overline` "Documents".
4. 8 gap: **Document rows** Card: ListItem 64 per document: leading 40×40 thumbnail (radius `sm`, image from the temporary URL, placeholder `file-document-outline`), title `title` document name, subtitle `caption` `textMuted` "Updated {date}" or the rejection reason in `danger` (2 lines), trailing status pill. Tap → full-screen image viewer (pinch zoom, close X 44).
5. 24 gap: `bodySmall` `textSecondary` "To change your vehicle or documents, contact support." + ghost Button `sm` "Contact support".

(Document re-upload from the app is out of scope until an endpoint exists; the spec does not show an upload button.)

## States
| State | Spec |
|---|---|
| Loading | Skeleton vehicle card (96 high), licence card (2 rows), 4 document rows. |
| Missing data (pre-BE-15) | EmptyState: icon `card-account-details-outline`, "Vehicle details aren't available yet", "Contact support if this doesn't update." Never show invented vehicle/licence values. |
| Error | ErrorState + Try again. |
| Image URL expired | Thumbnail shows placeholder; tap refetches the profile. |
