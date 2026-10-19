# Driver · Vehicle & documents

- **Tasks:** UI-R17 (absorbs T-616). Built on T-203 (documents list + upload, BE-66), T-514 (vehicle card, BE-42), BE-22 (private document URLs).
- **Route:** `Account → Vehicle & documents` (`DriverDocuments`, stack). Code: `src/features/driverDocuments/screens/DriverDocumentsScreen.tsx`, `components/DriverDocumentsList.tsx`, `src/features/driver-profile/components/VehicleCard.tsx`.
- **Revision:** 2026-10-20 (UI-R17 refresh, normative). Supersedes the 2026-10-08 version, which assumed thumbnails, an image viewer and no upload; the shipped T-203 screen has uploads and deliberately keeps no image URLs.
- **Current shots (Bilal, after bf07ab0):** `docs/design/audit/driver-vehicle-documents-r2-dark.png`, `-r2-light.png`, `-r2-scrolled-light.png`.

## 0. Data (real fields only)

| Source | Field | Used for |
|---|---|---|
| `GET /driver/documents` (BE-66) | `documents[]`: `type`, `required`, `status` (approved / pending / rejected / missing), `rejection_reason`, `can_upload`, `updated_at`; `all_required_approved` | Summary (§2.1), document rows (§2.4) |
| | `url`, `expires_in` | **Not used.** T-203 keeps no signed URL (no thumbnails, no image cache of CNIC or licence photos). This refresh keeps that rule |
| `GET /profile/documents` (BE-42) | `vehicles[]`: `id`, `make`, `model`, `license_plate`, `verification_status`, `rejection_reason` | Vehicle rows (§2.2). `rejection_reason` is sent today but the app drops it: read it (`DriverVehicle.rejectionReason`) |
| **BE-126 (new)** | `vehicles[].vehicle_type`, `year`, `color` | Per-vehicle glyph and the "{year} · {colour}" line. Until it ships: no year/colour line; glyph rule in §2.2 |
| Profile (Redux `apiAuth.user`, `GET /profile`) | `license_number`, `license_expiry_date` (`YYYY-MM-DD`), `vehicle_type` | Licence rows (§2.3) |
| `POST /driver/documents/{type}` | same body as the GET | Upload result replaces the list (unchanged) |

The app never invents a vehicle, year, colour, licence number or date. Counts in the summary are counts of the server's statuses.

## 1. Defects today (from the shots)

| # | Where (pt, iPhone 17) | Defect |
|---|---|---|
| V1 | Header (y 80–110) | Hand-built back + `h2` title that scrolls away with the content (`-r2-scrolled-light`); every other pushed screen uses Header `standard` (56 bar, `title` 17/22, pinned, hairline on scroll) |
| V2 | Vehicle rows (y 190–320) | "Honda CD 70" (a bike) shows the car glyph: the glyph comes from the account's `vehicle_type`, not the vehicle's |
| V3 | Vehicle rows | Rejected vehicle reason is sent by the server but never shown |
| V4 | Documents card (y 360–) | Different grammar from the vehicle group above it: `h3` title inside the card vs `overline` outside; eight identical rows with no glyphs; "Required" printed under 4 rows as noise |
| V5 | Whole screen | No overall answer to "am I OK to drive?": the only summary is a small green line inside the card |
| V6 | Licence | Licence number and expiry exist on the profile (registration requires them, owner decision 2026-10-11) but are not shown; an expiring licence is not flagged |
| V7 | Whole screen | No pull to refresh; loading is a centred spinner + text (no skeleton), so the layout jumps |
| V8 | Bottom | No way forward for things the driver cannot change here (vehicle make/model/plate) |

## 2. Layout (top to bottom)

`Screen` with a `FlatList`-free `ScrollView` (≤ 20 rows), background `background`, `RefreshControl` (§3). Content padding: `layout.gutter` 16 horizontal, 8 top, 32 bottom + bottom inset.

0. **Header `standard`**: back IconButton, title "Vehicle & documents" (same in ur-Latn: the Account row and the Vehicle AC copy already use this name), pinned, hairline after 4pt of scroll. `testID driver-documents`.

### 2.1 Summary card (8 below the header)
One `Card` (radius 16, padding 16, no shadow), `flexDirection row`, gap 12, `alignItems flex-start`; leading circle 40 with a 24 glyph; text column: `title` (17/22/600) + 2 + `bodySmall`. `accessibilityRole summary`, one element. `testID driver-documents-summary`.

Let **action items** = documents with `status === 'rejected'`, or `status === 'missing' && required`, plus vehicles with `verification_status === 'rejected'`. **In review** = documents and vehicles with status `pending`.

| Case (first match wins) | Fill | Circle / glyph | Title en / ur-Latn | Body en / ur-Latn |
|---|---|---|---|---|
| action items ≥ 1 | `dangerSoft` | `surface` / `alertTriangle` `danger` | "{n} item(s) need your action" / "{n} cheezon par aap ka kaam baqi hai" | "Upload them again below. Our team checks each photo." / "Neeche dobara upload karein. Hamari team har photo check karti hai." |
| in review ≥ 1 | `warningSoft` | `surface` / `pending` `warning` | "{n} item(s) in review" / "{n} cheezein review mein hain" | "Our team is checking them. You don't need to do anything." / "Hamari team check kar rahi hai. Aap ko kuch nahi karna." |
| `all_required_approved` and no vehicle pending/rejected | `successSoft` | `surface` / `verified` `success` | "All documents approved" / "Saare documents manzoor" | "Nothing to do here." / "Yahan kuch karna baqi nahi." |
| otherwise (e.g. list empty) | not shown | | | |

Text colours: title `textPrimary`, body `textSecondary` (both ≥ 6.4:1 on the soft fills in both modes). The glyph sits in a `surface` circle so its tone colour is measured on `surface` (danger 5.90 / 6.89, warning 5.86 / 9.42, success 5.78 / 8.37).

### 2.2 Vehicle (24 gap, then `ListGroup` title "Vehicle" / "Gaari")
One row per `vehicles[]` item, `ListItem` two/three-line (min 72):
- Leading tile 40 (`surfaceAlt`, radius `md`), glyph 24 `textSecondary`: `vehicleIconName(vehicle.vehicle_type)` (BE-126). Until BE-126: the account `vehicle_type` glyph **only when the driver has exactly one vehicle**; with two or more, glyph `steering` for all (never a car glyph on a bike).
- Title `title` (17/22/600) `textPrimary`: "{make} {model}" (`vehicleTitle`), one line, ellipsis.
- Line 2 (BE-126, when `year` or `color` is sent): `bodySmall` `textSecondary` "{year} · {color}"; omitted otherwise.
- Line 3: **plate chip**: height 24, paddingHorizontal 8, radius `sm` (8), fill `surfaceAlt`, text `numericSmall` (13/16/600, tabular) `textPrimary`, letterSpacing 0.5, the plate as sent ("LHR-QA-2026-5610"); `numberOfLines 1`. No plate: `caption` `textMuted` "No plate on file" / "Plate darj nahi". 4 above.
- Rejected: `bodySmall` `danger` under the plate (4 gap), up to 3 lines: "Reason: {rejection_reason}" / "Wajah: {rejection_reason}", or "No reason given." / "Koi wajah nahi batai gayi."
- Trailing: status `Badge` (§5.12): approved success "Approved" / "Manzoor"; pending warning "In review" / "Review mein"; rejected danger "Needs update" / "Tabdeeli zaroori"; none when the server sends no status. Badge top-aligned with the title.
- Rows are not pressable (no chevron): vehicle details change only through support (§2.6).
- Divider inset 72. Accessibility per row: "{title}, plate {plate}, {status}{, reason …}".

### 2.3 Driving licence (24 gap, `ListGroup` title "Driving licence" / "Driving licence")
1. Row "Licence number" / "Licence number": `body` `textPrimary` label, trailing value `numeric` `textSecondary` masked to the last 4 characters "•••• 6789" (U+2022 ×4 + space). Null: trailing `bodySmall` `textMuted` "Not added" / "Darj nahi". Not pressable. Never shown in full (privacy, screenshots).
2. Row "Expires" / "Expiry": trailing `bodySmall` `textSecondary` "12 Mar 2028" (day, short month, year, `format.monthsShort`). Null: "Not added".
3. The `license` document row (§2.4 anatomy) lives here, not in Identity: one place for everything about the licence.
4. Expiry banner inside the group, under row 2, margin 12 / 16 (Banner §5.17, compact): expiry date − today (date strings, the device's date) ≤ 30 days and ≥ 0: tone `warning` "Your licence expires on {date}. Upload the renewed licence." / "Aap ka licence {date} ko khatam ho raha hai. Naya licence upload karein."; < 0: tone `danger` "Your licence has expired. Upload the renewed licence." / "Aap ka licence khatam ho chuka hai. Naya licence upload karein." (The upload button only appears when the server's `can_upload` allows it; the banner never promises a button that is not there: without `can_upload` the second sentence is "Contact support to update it." / "Update ke liye support se rabta karein.")

### 2.4 Identity (24 gap, `ListGroup` "Identity" / "Shanakht") and Vehicle photos (24 gap, `ListGroup` "Vehicle photos" / "Gaari ki photos")
Identity: `profile`, `cnic_front`, `cnic_back`. Vehicle photos: `vehicle_front`, `vehicle_back`, `vehicle_left`, `vehicle_right`. Server order within each group. A type the app does not know is dropped (as today).

**Document row** (`ListItem`, min 72, paddingVertical 12):
- Leading tile 40 `surfaceAlt`, glyph 24 `textSecondary`: profile `account`, CNIC `idCard`, licence `idCard`, vehicle photos `camera`.
- Title `body` (16/24/400) `textPrimary`: the type name (`DRIVER_DOCUMENTS_COPY.types`); 2 lines max.
- Subtitle, `bodySmall`, by status:
  - approved: `textSecondary` "Approved · {date}" / "Manzoor · {date}" from `updated_at` (short date); no date when null.
  - pending: `textSecondary` "Sent {date} · in review" / "{date} ko bheja · review mein".
  - rejected: `danger`, up to 3 lines, "Reason: {reason}" / "No reason given." (server text as sent).
  - missing: `textSecondary` "Not uploaded yet" / "Abhi upload nahi hua"; when `required` is false add " · Optional" / " · Ikhtiyari". ("Required" is not printed: it is the default.)
- Trailing: status Badge: approved success "Approved"; pending warning "In review"; rejected danger "Rejected" / "Mustarad"; missing neutral "Not uploaded" / "Upload nahi".
- Action (only when `can_upload`): 8 under the subtitle, aligned with the text start (x = 72 in the card): Button `sm` `outline`, leading `upload`, "Re-upload" / "Dobara upload" (rejected) or "Upload" / "Upload" (missing), hugging; `loading` while this type uploads; other upload buttons `disabled` meanwhile (one at a time, as today). 44pt target (sm + hit slop).
- Rows are not pressable otherwise (no viewer: no URLs are kept). Divider inset 72.
- Upload success: Toast success "Uploaded. It will be reviewed again." (existing copy); the row switches to pending from the POST body, the summary recounts. Upload errors: existing Toast copy (too large, wrong type, rate limited, 409 refreshed).

### 2.5 Ordering rule
Groups keep the order Vehicle, Driving licence, Identity, Vehicle photos. Inside a group, server order (no re-sorting: the summary card already points at what needs action, and stable order helps low-literacy users find "their" row).

### 2.6 Footer (24 gap)
`caption` `textSecondary`, x = 16 inside the gutter: "To change your vehicle or licence details, contact support." / "Gaari ya licence ki tafseel badalne ke liye support se rabta karein." No button until the driver support screen exists (T-511); then a `ghost` `sm` "Contact support" goes 8 under it.

## 3. States and interactions

| State | Spec |
|---|---|
| First load | Skeleton mirroring the layout (static with reduced motion): summary 72 (radius 16); 24; overline 60×10; group with 1 row 88; 24; overline; group 3 rows 72; 24; overline; group 3 rows 72; 24; overline; group 4 rows 72. Replaces the centred spinner + "Loading your documents…". |
| Pull to refresh | `RefreshControl` (tint light `primary`, dark `primaryText`) refetches `/driver/documents`, `/profile/documents` and the profile (the same profile refresh the Account tab uses), in parallel, once each; content stays visible. |
| Documents failed, no data | The three document groups are replaced by one `ErrorState size="compact"` in a `surface` card: "Couldn't load your documents." / "Documents load nahi ho sake." + `sm` `secondary` "Try again". Vehicle and licence groups still render from their own sources. Summary hidden. |
| Vehicles failed | Vehicle group shows one row: icon `networkError`, "Couldn't load your vehicle" / "Gaari load nahi ho saki", trailing "Try again" (as `VehicleCard` today). |
| Refresh failed with data | Toast warning "Couldn't refresh. Showing the last saved status." / "Refresh nahi ho saka. Pichla status dikh raha hai."; content kept. |
| No vehicle | Vehicle group row: glyph `carOff`, "No vehicle on file" / "Koi gaari darj nahi", subtitle "Contact support to add one." / "Shamil karne ke liye support se rabta karein." Vehicle-photo upload errors keep the 409 NO_VEHICLE copy. |
| Uploading | Button loading on that row only; pull to refresh disabled until the upload settles (prevents a stale list overwriting the POST result). |
| Offline | Global offline banner; uploads show the API layer's offline toast; nothing is queued. |
| Pending driver (not approved) | Same screen; the summary card carries the message. The account-status screen (`AccountStatusLayout`) keeps its own layout and is out of this task. |

## 4. Light, dark, SE, 1.3x, Roman Urdu, low literacy, performance

- **Tokens only**; contrast: titles `textPrimary` 18.37 / 15.76, subtitles `textSecondary` 7.44 / 9.39, rejection reason `danger` 5.90 / 6.89 on `surface`; plate chip `textPrimary` on `surfaceAlt` (≥ 12:1 both modes); Badges per §5.12.
- **iPhone SE (375)**: card inner 343; row text column = 343 − 32 − 40 − 16 − 8 − badge (≈ 96 "Not uploaded") ≈ 151: titles like "Vehicle (right side)" / "Gaari (daain taraf)" wrap to 2 lines, allowed. Plate chip `numberOfLines 1` with ellipsis only if longer than the column (plates are ≤ 16 characters).
- **1.3x**: Badge may move under the title when the row is narrower than 280 (`flexWrap` on the title row, Badge `alignSelf flex-start`); upload button grows in height, never truncates; Header title ellipsises ("Vehicle & docu…") rather than wrapping.
- **Roman Urdu**: all copy keys under `driverDocuments.*` / `driverProfile.*`; strings above. Type names in ur-Latn: Profile photo "Profile photo", CNIC (front) "CNIC (saamne)", CNIC (back) "CNIC (peeche)", Driving licence "Driving licence", Vehicle (front) "Gaari (saamne)", Vehicle (back) "Gaari (peeche)", Vehicle (left side) "Gaari (baain taraf)", Vehicle (right side) "Gaari (daain taraf)". `start`/`end` styles only.
- **Low literacy**: every row has a glyph; status is glyph-free text + colour + Badge words, and the summary card's coloured circle tells the story before any reading; one action verb ("Upload") everywhere.
- **Performance**: plain `ScrollView` (≤ 20 rows), no images (vector glyphs only, no signed URLs fetched), rows `React.memo`; three requests on focus at most once per 60 s (query cache), no polling.

## 5. Review checklist
Light and dark, iPhone 17 and SE, default and 1.3x, en and ur-Latn, Bilal (two approved vehicles, all documents approved) plus one seeded driver with a rejected and a missing item: Header `standard` pinned; summary card in the right case; per-vehicle glyph rule (no car glyph on the CD 70); plate chip; rejected reasons visible for documents and vehicles; licence group with masked number, expiry and the licence photo row; Identity and Vehicle photos groups with glyphs; upload button only where `can_upload`; skeleton and pull to refresh; no hex literals, raw font sizes or magic spacing in touched files.
