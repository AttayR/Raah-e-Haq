# Passenger · Saved places (list + add/edit)

- **Tasks:** UI-R16 (absorbs the rest of T-618). Built on T-516/T-509 (saved places from the API), BE-14, T-581 (Home chips), T-303 (places search).
- **Routes:** `FavoriteLocations` (Account → Saved places; Home chip "Save ki hui jaghein"), `SavedPlaceEditor` (`{ place?, taken, otherFull }`; Home chips "Add home/work" open it with a preset label). Code: `src/features/saved-places/screens/{SavedPlacesScreen,SavedPlaceEditorScreen}.tsx`, `components/SavedPlaceRow.tsx`, `hooks.ts`.
- **Revision:** 2026-10-20 (UI-R16; supersedes the 2026-10-08 version). Archetypes: list = **List**, editor = **Form**.
- **Before shots:** `docs/qa-reports/2026-10-13-t-515-qa/h01-saved-places-empty.png`, `h02-add-home-place-selected.png`; list with places: `docs/design/audit/2026-10-11-prod-audit/passenger-saved-places-light.png`, `-dark.png` (legacy) and the current row anatomy from code (`SavedPlaceRow.tsx`).

## S0. What is wrong today

| # | Defect | Where |
|---|---|---|
| S-1 | **Two filled buttons under every row** ("Set as pickup" `secondary` + "Set as destination" **`primary`**), so a list of 5 places shows 5 navy primary buttons (DESIGN_SYSTEM §12.2: one primary per screen) and every row is ≈ 120 high | `SavedPlaceRow.tsx` actions |
| S-2 | Inline Edit (pencil) and red **trash** IconButtons on every row: a destructive control one tap from the list, two 44 targets crowding the text column (text column on SE ≈ 167 pt) | `SavedPlaceRow.tsx` trailing |
| S-3 | Home and Work are not slots: with no places the whole screen is an EmptyState (`h01`, y 400–700) and the user has to discover that "Add place" then "Home" segment is the way to save home | `h01` |
| S-4 | Refresh failure is a bare `danger` text line above the list (no icon, no retry) | `SavedPlacesScreen.tsx` `saved-places-refresh-error` |
| S-5 | Editor: "Save place" floats under the form (y 397–451) instead of a sticky footer; the location card truncates the address to 2 lines with an ellipsis and offers no way to read it in full | `h02` |
| S-6 | Count caption "{n} of {max}" and an outline "Add place" button both sit under the list while the header also has "+": three add affordances | code |

## S1. Data (real fields only)

| Source | Field | Used for |
|---|---|---|
| `GET /saved-places` → `data.places[]` (`SavedPlaceResource`) | `id`, `label` (`home` / `work` / `other`), `name` (other only), `address`, `lat`, `lng`, `sort_order` | Rows |
| | `data.max_other` | Other-places cap (caption, add disabled at cap) |
| `POST /saved-places`, `PUT /saved-places/{id}` | response `place`, `replaced` (bool), `outside_service_area` (bool) | Save toast / warning |
| `DELETE /saved-places/{id}` | — | Delete |
| Places search (T-303, existing session tokens) | prediction → details `lat`/`lng`/`address` | Editor location |

Server rules shown as UI: one home and one work per account (422 `label` message shown on the segment), name required for `other` (max 40), cap `max_other` (422 message).

## S2. List: order and anatomy

`Screen` edges top+bottom · `Header standard` "Saved places" / "Save ki hui jaghein", tone `background`, trailing IconButton `add` (a11y "Add a place" / "Jagah add karein") shown when loaded **and** below the cap (S-6) · `ScrollView` with pull to refresh (tint `primary`) · padding 16 horizontal, 8 top, 32 bottom.

1. **Slots group** (`ListGroup`, no title), always two rows, Home then Work:
   - Set: `ListItem variant="content"` (min 72): leading 40 tile glyph `home` / `work` (`surfaceAlt`, `textSecondary`), title `title` "Home" / "Ghar", "Work" / "Daftar", subtitle `bodySmall` `textSecondary` `address` (2 lines max), trailing IconButton `more` (`dots-vertical`, plain, 44, a11y "More options for {title}"). Row tap = **"Ride here"**: opens `Booking` with the place as the **destination** (`bookingParamsFor(place, 'destination')`).
   - Not set: same row, subtitle in `primaryText` "Add home" / "Ghar add karein", "Add work" / "Daftar add karein", leading tile glyph `homeAdd` / `work`, trailing chevron; tap opens the editor with the label preset and the search open.
2. 24: **"Other places"** (`overline` "OTHER PLACES" / "DOOSRI JAGHEIN"), shown when ≥ 1 `other` place: `ListGroup` of the same content rows, leading tile `bookmark`, title `name`, subtitle `address`, trailing `more`. Sorted by `sort_order`, then `id`.
3. 8 below the last group: row helper `caption` `textSecondary` at x = 16:
   - With room: "{n} of {max} other places saved" / "{max} mein se {n} doosri jaghein save hain".
   - At cap: "You've saved {max} other places. Delete one to add another." / "Aap ne {max} doosri jaghein save kar li hain. Nayi ke liye ek delete karein." (the header "+" is hidden).
   - `max_other` null: no caption.
4. With no places at all: the slots group still shows (both "Add" rows), then 16 gap and a centred `bodySmall` `textSecondary` (max width 280) "Save places you go often to book them in one tap." / "Jahan aksar jate hain woh jaghein save karein, ek tap mein booking." plus a `secondary` Button `md` `fullWidth={false}` centred "Add another place" / "Koi aur jagah add karein" (opens the editor with `other` preset). No full-screen EmptyState (S-3).

**Row menu** (`more`): modal `BottomSheet` (content snap, scrim) with title `title` = the place title and `caption` `textMuted` address (1 line), then action rows (ListItem settings, 24 plain glyph, 56 high):
1. "Ride here" / "Yahan jayein" (`pin`) → Booking, destination.
2. "Set as pickup" / "Pickup banayein" (`origin`) → Booking, pickup.
3. "Edit" / "Edit karein" (`edit`) → editor.
4. "Delete" / "Delete karein" (`delete`, destructive row) → confirm Dialog (existing copy `savedPlaces.deleteTitle/Body/delete`), then optimistic removal: row fades out over `motion.exit` 200 ms and the list closes the gap with a 250 ms layout transition (instant with Reduce Motion); failure puts it back with Toast error (server message).

Footer padding `max(insets.bottom + 8, 16)`.

## S3. Editor (Form)

`Screen keyboardAvoiding` + `KeyboardAwareScrollView` · `Header standard` "Add place" / "Jagah add karein" or "Edit place" / "Jagah edit karein", back with discard Dialog when dirty · sticky footer `primary lg` "Save place" / "Jagah save karein" (disabled = `fillDisabled` until a location is chosen and, for other, a name is entered; loading keeps width).

1. 8: `FieldLabel` "Location" / "Jagah" → 6 → either the search field (TextField `search` 40, autofocus when no location, results list below in a `ListGroup` of content rows: `pinOutline` glyph, main text `title` 1 line, secondary `bodySmall` 1 line; "Powered by Google" attribution `caption` `textMuted` end-aligned under the results as the Places policy requires) or the chosen location as a `Card` row: 40 tile `pin`, address `body` **full text** (`numberOfLines 0`, S-5), trailing ghost `sm` "Change" / "Badlein".
2. 24: `FieldLabel` "Save as" / "Is naam se save karein" → 6 → SegmentedControl Home | Work | Other ("Ghar | Daftar | Doosri"). A label taken by another place is still selectable when editing that place; for a new place a taken slot shows its segment disabled with the row helper under the control: "You already saved Home. Edit it from the list." / "Ghar pehle se save hai. List se edit karein." (`caption` `textSecondary`). Other is hidden when `otherFull` and the place isn't already other (existing rule).
3. 16 (Other only): TextField "Name" / "Naam", placeholder "e.g. Gym, Mum's house" / "Maslan Gym, Ammi ka ghar", max 40 with counter `caption` `textMuted` "{n}/40", `autoCapitalize words`.
4. Form error (server, network): `Banner` danger `actionPlacement below` 16 above the footer region inside the scroll, never a Toast for a field error; `label` / `name` 422 messages go under their control.
5. Save success: Toast success "Place saved" / "Jagah save ho gayi" ("Place updated" / "Jagah update ho gayi" when editing or `replaced`), pop. `outside_service_area`: Toast warning "Saved. This place is outside our service area for now." / "Save ho gayi. Ye jagah abhi hamare service area se bahar hai." (existing keys `outsideTitle/Body`).

No static map preview (it would need the Static Maps API and an image per row; the address text is enough and cheaper on data).

## S4. States

| State | Spec |
|---|---|
| Loading (first load) | Slots group with two 72 skeleton rows (40 tile circle-square, title 120×16, subtitle 200×14), then the overline skeleton 96×12 and two more rows. Same heights as loaded (no jump). Header "+" hidden. |
| Error (nothing cached) | `ErrorState` (network glyph or server glyph per error) 64 from the top: "Couldn't load your places" / "Aap ki jaghein load nahi ho sakin", body = the error message, "Try again" (loading while retrying). |
| Refresh failed (cached) | Warning `Banner` at the top of the content: "Couldn't refresh. Showing saved places." / "Refresh nahi ho saka. Save ki hui jaghein dikh rahi hain." with "Retry" (`actionPlacement end`). Replaces S-4. |
| Offline | Offline Banner under the Header; list from cache; row menu "Edit"/"Delete" and header "+" disabled (0.4) with Toast "You're offline" on tap; "Ride here"/"Set as pickup" still work (booking handles offline). |
| Long address / long name | List subtitle 2 lines then ellipsis; menu header 1 line; the full address shows in the editor. Name is 1 line in the list title and wraps to 2 at 1.3x. |
| SE (375) | Text column 375 − 32 − 16 − 40 − 16 − 8 − 44 − 16 = 203 pt (today 167 with two trailing buttons). |
| 1.3x | Rows grow; `more` stays vertically centred; segment labels shrink to 0.85 then fit ("Daftar"). |
| Dark | Same tokens; menu sheet `surface` dark, destructive row `danger` dark 6.89. |

## S5. Low literacy

- Home and Work are always in the same two places with their own glyphs; the user recognises the house and the briefcase before reading.
- One tap on a place = go there (the commonest intent); everything else is behind one clearly labelled menu.
- The empty slots say exactly what to do ("Add home").

## S6. Performance

- At most one `GET /saved-places` per focus (the existing quiet refresh on focus), shared with the Home chips; mutations update the shared store so Home updates without a refetch.
- Rows `React.memo` keyed by `id`; the menu sheet is one instance for the screen (not one per row), mounted on first open.
- Places search keeps the existing T-303 session token and debounce; the redesign adds no requests.

## S7. Review checklist (UI-R16, Saved places)

Light and dark, iPhone 17 and SE, default and 1.3x, en and ur-Latn; Ali with Home + Work + 2 others, a fresh account with none, and an account at the cap:
1. Home and Work slots always visible; unset slots say "Add home/work"; no full-screen empty state.
2. No buttons under rows; one `more` per set row; row tap opens booking with the place as destination; menu has Ride here, Set as pickup, Edit, Delete (destructive) and Delete confirms.
3. Count caption and cap behaviour; header "+" hidden at cap; no outline "Add place" button under a non-empty list.
4. Refresh failure Banner with Retry; skeleton heights match.
5. Editor: sticky "Save place" footer above the keyboard on SE; full address visible; taken-slot helper; name counter; server errors under their controls.
6. Code greps clean; one menu sheet; components from `src/components/ui`.
