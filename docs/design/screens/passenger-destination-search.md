# Passenger · Destination search (pickup, dropoff, stops)

- **Task:** T-604 (visual) after T-303 (debounce, session token, PK bias), T-309 (remove Advanced panel), T-301 (single booking route).
- **Route:** `PassengerBooking/Search` (full screen, pushed from Home; tab bar hidden).
- **Audit:** `audit/passenger-map-*`, `passenger-search-*` (Map defects 1-4).
- **Data:** Google Places Autocomplete (session token, `components=country:pk`, location bias = device location) → `description`, `structured_formatting.main_text`, `secondary_text`, `place_id`; Place Details → lat/lng + `formatted_address`. Saved places `GET /saved-places` [BE-14]; recent destinations from `GET /rides`.

## Layout
> **[UI-R9 review, 2026-10-19]** Per DESIGN_SYSTEM v1.1 §12.5 the search is the first state ("Where to") of the Booking sheet over the booking map, not a separate pushed screen with a standard Header: sheet `surface`, handle, title "Plan your trip" (`h3`, existing copy key `BOOKING_COPY.planTitle`) at x 16, 24 below the handle top; the dropoff field is focused on mount when opened from "Where to?" and the keyboard drives the sheet to `full` (§5.14). Back/close is the booking map's top-start floating control (UI-R10 trims the map to back + locate). Stage chips are not shown on the search steps (home/pickup/destination); UI-R10 removes them everywhere.

`Screen` background `surface`, edges top+bottom, keyboard open on mount (dropoff focused).

1. **Header**: superseded by the sheet title above.
2. **Route editor card** (no shadow, `surface`), x 16..386, padding 0:
   - Raah line rail (5.23) at x 16..36.
   - Row "Pickup": TextField-like row 48 high, fill `surfaceAlt`, radius `md`, text `body`; default value "Current location" (`primaryText`, `crosshairs-gps` 16 leading) until the user edits it, then the reverse-geocoded street address.
   - 8 gap. Row "Where to?": same style; focused on mount.
   - Stops (0-3 extra, server allows up to 5; UI caps at 3 to keep the card under 4 rows): rows inserted between pickup and dropoff, each with a trailing IconButton `close` 20 (remove).
   - Right column (x 346..386): IconButton `plus` (add stop, hidden at max) and IconButton `swap-vertical` (swap pickup/dropoff), vertically centred on the card.
3. 8 gap. **Quick row** **[UI-R9 review]**: kit Chips `tone="primary"`, 8 gap, start-aligned: "Use current location" (`crosshairs-gps`, only while the pickup is not the current location) and "Choose on map" (`map-marker-outline`); the swap IconButton `tonal` 44 sits at the row end. Saved-place chips are dropped here because block 4 lists them as rows. The chips may wrap to a second line (two action chips only; Roman Urdu labels are long), the swap button stays on the first line at the end.
4. 8 gap. **Results list** (FlatList, keyboard-dismiss on drag):
   - When the focused field has no typed text (empty, or holding a label such as "Current location"): section `overline` `textMuted` "Saved places" (kit `ListItem` `content`, 72 high, leading 40 kit tile `surfaceAlt` radius `md` with 24 glyph `home-outline`/`briefcase-outline`/`map-marker-outline`, title = label, subtitle = full address 1 line, no chevron, dividers inset 72), 16 gap, then `overline` "Recent" (same rows, `history` glyph, title = address before the first comma, subtitle = the rest), up to 5, derived only from the passenger's completed rides (`GET /rides`, same rule as passenger-home block 4.4; reuses Home's read made within 60 s). A section with no rows is omitted; with neither, only the quick row shows. First read of saved places: 2 skeleton list rows. **[UI-R9 review]** The kit tile (rounded square) replaces the 40 circle in this spec; autocomplete rows below move to the same kit tile and inset 72 (today `LocationSearch` draws a 40 circle with inset 52: follow-up UI-R9b).
   - Typing hides this saved/recent list and hands the room to the Places suggestions.
   - When typing: autocomplete rows (min 64): leading 40×40 `surfaceAlt` circle with `map-marker-outline` 20 `textSecondary`; title `title` = `main_text` (matched substring in 700 weight); subtitle `bodySmall` `textSecondary` = `secondary_text`, 1 line; trailing distance `caption` `textMuted` if `distance_meters` is returned. Dividers inset 72.
   - Footer row (always last while typing): "Set location on map" (`map-marker-radius-outline`).
5. **Choose on map mode** **[UI-R9 review: interim]** Today: the chip/footer turns on a tap-to-pick mode on the booking map, announced by a kit `Banner` `info` (`map-marker-outline`, "Tap the map to set your {pickup|drop-off}", trailing action "Cancel") at the top of the sheet. The full-screen centre-pin picker below is the target and is built in UI-R9b. Target (from the chip or footer): the list is replaced by the map full screen with a centre pin (5.21, motion §6.6); bottom card (padding 16, `elevation.3`, radius `xl` top): `caption` "Pickup"/"Drop-off" + address `title` (reverse geocode, 1-2 lines, skeleton while moving) + Button `lg primary` "Confirm pickup" / "Confirm drop-off".

When both pickup and dropoff are set, the screen pushes passenger-vehicle-fare automatically (no extra button).

## States
| State | Spec |
|---|---|
| Typing (debounced 300 ms, T-303) | Trailing spinner 20 in the focused field; previous results stay until new ones arrive. |
| No results | Row: icon `map-search-outline`, `title` "No places found", `bodySmall` "Check the spelling or choose on the map." + the "Set location on map" row. |
| Places error / quota | Inline Banner danger "Search isn't working right now." + "Set location on map" row (map pick still works). |
| Offline | Offline banner; saved and recent still listed; autocomplete disabled with helper "Search needs internet. Pick a saved place or choose on the map." |
| Location denied | Pickup row empty with placeholder "Enter pickup"; Banner from shared-permissions. |
| Selecting a result | Row shows a 20 spinner trailing while Place Details loads; field fills with the address (not coordinates, PAX-E2E-01 step 4). |
| Same pickup and dropoff | Field error on dropoff: "Pick a different drop-off." |
| Long addresses | 1 line ellipsis in fields; full address in a tooltip on long-press. |

## Interactions
- Swap animates the two rows crossing (250 ms) and swaps values. **[UI-R9 review: today an instant swap; animation in UI-R9b]**
- Drag handle (left of a stop row, 24 `drag-vertical`) reorders stops. **[deferred to UI-R9b; stops move into the sheet in UI-R10]**
- Back with values entered keeps them in the booking draft (Home → "Where to?" restores the draft for 10 min). **[deferred to UI-R9b]**
- A saved or recent row tap fills the focused field (or the dropoff when none is focused) exactly like picking a suggestion; the route and the next step follow.

## Small device
- **[UI-R9 review]** Route rows stay 48 on every device (one field height in the kit). The quick row (block 3) is hidden while the focused field holds typed text **on every device**, not only SE: the "Set location on map" footer row covers choose-on-map while typing, and the suggestions get the room above the keyboard. The swap button hides with it and returns when typing stops or a result is picked.
