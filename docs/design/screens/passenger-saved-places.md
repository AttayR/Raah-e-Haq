# Passenger · Saved places

- **Task:** T-618 after T-509 (saved places from API), BE-14, T-303 (search).
- **Route:** `Account → Saved places` (stack); also the "Add Home" shortcut on Home.
- **Audit:** `audit/passenger-saved-places-*` (Favourites defects 1-3).
- **Data:** `GET/POST/PUT/DELETE /saved-places` → `id`, `label`, `type` (home|work|other), `address`, `latitude`, `longitude`. At most one home and one work (server rule).

## Layout
`Screen` Header (back, title "Saved places", trailing IconButton `plus` "Add place"), background `background`.

1. 8 gap: **Home and Work Card** (grouped list, always 2 rows):
   - Row "Home" (leading 40 circle `home-outline`), subtitle = address or `primaryText` "Add home" when not set.
   - Row "Work" (`briefcase-outline`), same pattern.
   - Trailing: `dots-horizontal` IconButton (when set) → action sheet "Edit", "Use as pickup", "Remove" (destructive); when not set: chevron.
2. 24 gap: `overline` "Other places" (only when any `other` exists).
3. 8 gap: Card with rows for `other` places: leading `star-outline`, title = `label`, subtitle = `address` (2 lines max), trailing `dots-horizontal` (same actions).
4. Tap a row (set): opens booking with that place as **drop-off** (most common). "Use as pickup" from the menu opens booking with it as pickup (PAX-DATA-02 step 3).

**Add / edit flow** (push `SavedPlaceEdit`):
- Header (back, title "Add place"/"Edit place", trailing text action "Save" disabled until valid).
- Type SegmentedControl Home | Work | Other (Home/Work segments disabled when already used by another place).
- Label TextField (only for Other, required, max 30).
- Address: tap row → reuses passenger-destination-search results list in a modal; selected address shows as a ListItem with a 160-high static map preview (radius `lg`) with the pin.

## States
| State | Spec |
|---|---|
| Loading | Home/Work rows with skeleton subtitles; 2 skeleton rows for others. |
| Empty | Home/Work rows show "Add home"/"Add work"; below: `bodySmall` `textSecondary` centred "Save places you go often to book faster." |
| Saving | Header "Save" shows a 20 spinner; on success Toast "Place saved" and pop. |
| Remove | Dialog "Remove {label}?" / "You can add it again any time." / "Cancel" / "Remove" (destructive). Row fades out 200 ms. |
| Error | Toast with server message (e.g. home already exists). |
| Offline | Offline banner; add/edit/remove disabled ("You're offline"). |

Removed: inline red trash icons on every card, "?" icon, free-text add field without geocoding.
