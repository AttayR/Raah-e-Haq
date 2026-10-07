# Passenger · Destination search (pickup, dropoff, stops)

- **Task:** T-604 (visual) after T-303 (debounce, session token, PK bias), T-309 (remove Advanced panel), T-301 (single booking route).
- **Route:** `PassengerBooking/Search` (full screen, pushed from Home; tab bar hidden).
- **Audit:** `audit/passenger-map-*`, `passenger-search-*` (Map defects 1-4).
- **Data:** Google Places Autocomplete (session token, `components=country:pk`, location bias = device location) → `description`, `structured_formatting.main_text`, `secondary_text`, `place_id`; Place Details → lat/lng + `formatted_address`. Saved places `GET /saved-places` [BE-14]; recent destinations from `GET /rides`.

## Layout
`Screen` background `surface`, edges top+bottom, keyboard open on mount (dropoff focused).

1. **Header** (5.2): back (→ Home), title "Plan your ride" `title`.
2. **Route editor card** (no shadow, `surface`), x 16..386, padding 0:
   - Raah line rail (5.23) at x 16..36.
   - Row "Pickup": TextField-like row 48 high, fill `surfaceAlt`, radius `md`, text `body`; default value "Current location" (`primaryText`, `crosshairs-gps` 16 leading) until the user edits it, then the reverse-geocoded street address.
   - 8 gap. Row "Where to?": same style; focused on mount.
   - Stops (0-3 extra, server allows up to 5; UI caps at 3 to keep the card under 4 rows): rows inserted between pickup and dropoff, each with a trailing IconButton `close` 20 (remove).
   - Right column (x 346..386): IconButton `plus` (add stop, hidden at max) and IconButton `swap-vertical` (swap pickup/dropoff), vertically centred on the card.
3. 16 gap. **Quick row** (horizontal, 8 gap, inset 16): Chip "Choose on map" (`map-marker-outline`), Chip per saved place (Home/Work) when a field is focused.
4. 8 gap. **Results list** (FlatList, keyboard-dismiss on drag):
   - When the focused field is empty: section `overline` "Saved places" (ListItem rows, leading 40 circle icon `home-outline`/`briefcase-outline`/`star-outline`), then `overline` "Recent" (leading `history`), max 5.
   - When typing: autocomplete rows (min 64): leading 40×40 `surfaceAlt` circle with `map-marker-outline` 20 `textSecondary`; title `title` = `main_text` (matched substring in 700 weight); subtitle `bodySmall` `textSecondary` = `secondary_text`, 1 line; trailing distance `caption` `textMuted` if `distance_meters` is returned. Dividers inset 72.
   - Footer row (always last while typing): "Set location on map" (`map-marker-radius-outline`).
5. **Choose on map mode** (from the chip or footer): the list is replaced by the map full screen with a centre pin (5.21, motion §6.6); bottom card (padding 16, `elevation.3`, radius `xl` top): `caption` "Pickup"/"Drop-off" + address `title` (reverse geocode, 1-2 lines, skeleton while moving) + Button `lg primary` "Confirm pickup" / "Confirm drop-off".

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
- Swap animates the two rows crossing (250 ms) and swaps values.
- Drag handle (left of a stop row, 24 `drag-vertical`) reorders stops.
- Back with values entered keeps them in the booking draft (Home → "Where to?" restores the draft for 10 min).

## Small device
- Route card rows 44 high; quick row hidden while typing to save space.
