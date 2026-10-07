# Auth · Registration wizard

- **Task:** T-611 (visual), on top of T-201 (per-step validation), T-202 (server field errors), T-203 (documents upload).
- **Route:** `AuthStack/Signup` → `RegistrationForm` → `RegistrationScreen` with steps in `steps/*`.
- **Audit:** `audit/auth-signup-personal-*` (Registration defects 1-9).
- **Data:** `POST /auth/register` multipart. Fields (from `RegistrationScreen.tsx` payload): `name`, `email`, `password`, `password_confirmation`, `user_type`, `phone`, `cnic`, `address`, `emergency_contact`, `date_of_birth`, `gender`; passenger: `passenger_cnic_front_image`, `passenger_cnic_back_image`, `passenger_profile_image`, `passenger_emergency_contact`, `passenger_emergency_contact_name`, `passenger_emergency_contact_relation`; driver: `vehicle_type`, `license_number`, `license_type`, `license_expiry_date`, `license_plate`, `registration_number`, `driving_experience`, `vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_color`, `bank_name`, `bank_branch`, `bank_account_number`, plus document images (T-203). `preferred_payment` / `passenger_preferred_payment` is always sent as `cash` and is **not shown** (cash-only decision).

## Step structure
| Role | Steps (progress label) |
|---|---|
| Choose role | step 0, not counted |
| Passenger | 1 About you · 2 Identity · 3 Review |
| Driver | 1 About you · 2 Vehicle & licence · 3 Documents · 4 Payout · 5 Review |

Passengers never see vehicle or document steps (today "Step 1 of 4" with Vehicle Info for passengers).

## Shared frame (every step)
`Screen scroll keyboardAvoiding`, background `surface`.

1. **Header** (5.2): back (step 0: back to Login; later steps: previous step, keeping values), title empty, trailing text action none.
2. **Progress:** directly under the header, x = 16..386, a segmented bar: one segment per step, 4pt high, 4 gap, radius `pill`; done/current `primary`, upcoming `surfaceAlt`. 12 below: "Step {n} of {total}" `caption` `textMuted`.
3. 8 gap: **Step title** `h2` `textPrimary` (see per step); 4 gap: step description `bodySmall` `textSecondary`.
4. 24 gap: **Form body** (fields stacked, 16 gap between fields, 32 gap between groups; group titles `title` `textPrimary` with 12 below).
5. **Sticky action bar** (`surface`, top hairline `border` when content scrolls under it, padding 16, bottom `insets.bottom + 8`): Button `lg primary` "Continue" (last step: "Create account"). Disabled until the step's required fields are valid; never grey-on-grey (disabled = 0.4 opacity of the primary button).

## Step 0 · Choose how you'll use Raah-e-Haq
- Title "How will you use Raah-e-Haq?"; description "You can't switch later from the app."
- Two **selectable Cards** stacked (not side-by-side), each 88 high, 12 gap: leading 48×48 `primarySoft` circle with icon 24 (`account-outline` "Ride", `steering` "Drive") → 16 → title `title` ("I want to ride" / "I want to drive") + `bodySmall` `textSecondary` ("Book rides around your city." / "Earn by giving rides. Needs your licence, vehicle and documents.") → trailing radio 24 (`radiobox-blank` / `radiobox-marked` in `primary`). Selected = `Card selected`.
- No clip-art figures. Continue enabled once a role is selected.

## Step 1 · About you (both roles)
Fields in order: Full name (`name`) · Email (`email`) · Mobile number (`phone`, phone variant) · Password (`password`, helper "At least 8 characters.") · Confirm password · CNIC (`cnic`, numeric keypad, auto-format `00000-0000000-0`) · Date of birth (`date_of_birth`, **read-only field that opens the native date picker** in a modal sheet, display `15 Jan 1990`, stored `YYYY-MM-DD`, max date = today − 18 years) · Gender (`gender`: SegmentedControl Male | Female | Other, full width) · Address (`address`, multiline, min 96).
Passenger only, group "Emergency contact": Name (`passenger_emergency_contact_name`) · Mobile number (`passenger_emergency_contact`) · Relationship (`passenger_emergency_contact_relation`): horizontal single-select Chip row on one line, scrollable: Father, Mother, Spouse, Brother, Sister, Friend, Other. No developer helper text.

## Step 2 (passenger) · Identity
- Title "Verify your identity"; description "We use your CNIC to keep riders and drivers safe."
- **Photo upload tiles** (component `UploadTile`): full width, 120 high, radius `lg`, dashed 1.5pt `borderStrong` border, `surfaceAlt` fill; centred icon 28 `camera-outline` `primaryText` + 8 + `label` "Add CNIC front" + `caption` `textMuted` "JPG or PNG, clear and readable". Filled: image cover with radius `lg`, a 32×32 floating IconButton `pencil-outline` top-right (8 inset) to replace, and a `caption` filename row. Tiles: CNIC front, CNIC back, Profile photo (profile tile is a 96 Avatar with camera badge instead of a wide tile, centred).
- Tapping opens an action sheet: "Take photo" / "Choose from library" / "Cancel".

## Driver steps
- **Vehicle & licence:** group "Vehicle": Vehicle type (`vehicle_type`, 4 selectable cards in a 2×2 grid, each 88 high: vehicle glyph 32 + name; values from BE-05 `GET /vehicle-types` when available, else car/bike/rickshaw/van as the server accepts), Make (`vehicle_make`), Model (`vehicle_model`), Year (`vehicle_year`, numeric, 4 digits), Colour (`vehicle_color`), Number plate (`license_plate`, placeholder "LEA-1234", auto uppercase), Registration number (`registration_number`). Group "Driving licence": Licence number (`license_number`), Licence type (`license_type`, Chip row), Expiry date (`license_expiry_date`, date picker, min today), Driving experience in years (`driving_experience`, numeric stepper −/+ with 44 targets).
- **Documents:** UploadTiles for each document T-203 defines (driver photo, CNIC front/back, licence front/back, vehicle photos ×2). A "Photo tips" Banner (info tone) at the top: "Use good light, keep all text readable, no glare." Replaces the 4-bullet guidelines block.
- **Payout:** Bank name (`bank_name`, searchable picker), Branch (`bank_branch`), Account number or IBAN (`bank_account_number`, `secureTextEntry` off, masked after blur to `•••• 1234`). Description "We pay your earnings here. Only you and the admin team can see this."

## Review (last step)
- Title "Check your details". Grouped list Cards per step (ListItem rows: label `caption` `textMuted` above value `body` `textPrimary`; CNIC masked `•••••-•••••••-4`; bank masked); each group has a trailing ghost Button `sm` "Edit" in its header that jumps to that step. Document thumbnails 64×64 radius `sm` in a wrapping row, 8 gap.
- Legal line above the action bar: "By creating an account you agree to the Terms and Privacy Policy." (links from `GET /settings/public`).
- Action: "Create account" (loading while uploading; for multi-MB uploads show a determinate progress bar 4pt in the action bar top edge, `primary` on `surfaceAlt`).

## States
| State | Spec |
|---|---|
| Field validation (T-201) | On Continue: invalid fields get error style and messages; the screen scrolls to the first error; Continue stays enabled (tapping shows errors) so users learn what's missing. |
| Server errors (T-202) | Map `errors.<field>` to the field; navigate to the step that owns the first errored field; Toast "Some details need fixing." |
| Uploading | Action bar progress + disabled back. |
| Upload failed | Toast error; the failed tile shows a `danger` 1.5pt border + "Upload failed. Tap to retry." |
| Success, passenger | Route to passenger home (AuthFlow). |
| Success, driver | Route to auth-account-status (pending). |
| Leave mid-way | Back from step 1 asks Dialog "Discard sign-up? / Your details won't be saved. / Keep going / Discard". |
| Offline | Offline banner; "Create account" shows network toast. |

## Small device
- Vehicle type grid stays 2×2 with 76-high cards; upload tiles 104 high.

## Dark
- Same tokens (fields `surfaceAlt`, tiles dashed `borderStrong`). No black fields on white cards.
