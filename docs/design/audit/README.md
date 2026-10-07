# UI audit: current app (before Phase 6)

**Date:** 2026-10-08 · **Device:** iPhone 17 simulator (iOS 26.5, 402×874 pt, 3x) · **Build:** Debug, local backend `127.0.0.1:8000`, Metro 8088 · **Accounts:** local seeded passenger and driver (QA_SCENARIOS.md).
**Method:** each screen was captured after relaunching the app in the target appearance (the app doesn't follow appearance changes while running, see G-01). Coordinates are in points, origin top-left, measured from the screenshots. Files: `<role>-<screen>-<light|dark>.png` in this folder.

**Not captured live (specified from source instead):**
- Finding driver, driver assigned, ride in progress, trip complete and rating (passenger) and incoming request, to-pickup, trip (driver). Creating a ride request from the simulator was blocked by the session's permission policy, so no ride was created.
- Pending approval (the keyboard covered the login field while typing the pending account; not retried blind).
- Registration steps 2-4 (need valid personal data in step 1).
- iPhone SE: no small-device simulator is installed on this Mac (`xcrun simctl list devices available` has no SE/mini). Small-device behaviour is specified, and must be checked in `review` once an SE simulator exists.

## Global defects (all screens)

| ID | Defect | Evidence |
|---|---|---|
| G-01 | Dark mode is broken app-wide. The theme is resolved once from `Appearance.getColorScheme()` with no listener (`ThemeProvider.tsx`), so toggling while the app runs leaves screens in the old mode. When launched in dark, screens are a mix: black cards with navy icons and navy text (1.17:1), white section titles on a light illustrated background, black text fields on white cards. 6 screens ignore dark completely (chat thread, wallet, history, saved places, profile, map sheet). | `passenger-home-dark`, `passenger-home-scroll2-dark`, `auth-login-email-dark`, `passenger-wallet-dark` |
| G-02 | Decorative illustrated pattern (`background_raahe_haq.png`/`bg.png`) behind content on 17 screens; section titles, timestamps and empty areas sit directly on it. | `passenger-home-light` (y 460-660), `driver-chat-thread-light` |
| G-03 | Off-brand palette: 40+ distinct hex values (960 hex literals in `src/screens`, `src/components`, `src/app`), orange CTA (white on `orange` 1.97:1), periwinkle `#667EEA` CTA/prices (3.66:1), blue/green/purple quick-action tiles, coral/teal promo cards. | `auth-login-email-scrolled-light` y 745, `passenger-fare-light` y 735 |
| G-04 | Typography is ad hoc: 13 font sizes (10-32), weights 400/500/600/700/800/`bold` mixed; `'SF Pro Display'` family string. | code grep |
| G-05 | Emoji used as icons and in copy: greeting, section titles, stage chips, vehicle tiles, fare labels, request button, search placeholder. | `passenger-home-light` y 60, 473, 634; `passenger-map-light` y 519-555 |
| G-06 | Icon chaos: 13 vector-icon families; missing glyphs render as "?" boxes. | `passenger-saved-places-light` (27, 366); `driver-chat-thread-light` (362, 92) and (347, 797); `driver-profile-light` (326, 413) |
| G-07 | Safe-area handling is inconsistent: content under the status bar (Home header text at y 60 overlapping the status-bar row; map buttons at y 32 overlapping the clock/battery), a 62 pt blank band where scrolled content is clipped (Settings, Profile, Chat list), opaque navy band over the home indicator on auth screens (y 840-874). | `passenger-home-light`, `passenger-map-light` (268/320/368, 32), `passenger-settings-scrolled-light` y 62 |
| G-08 | Status bar style is wrong on several screens: white text on light background (passenger chat list, settings, profile), dark text on dark background (driver notifications dark). | `passenger-settings-light` y 32, `driver-notifications-dark` y 32 |
| G-09 | Three back-button styles (circle-on-navy arrow, bare chevron, none) and back buttons on tab roots. | `passenger-notifications-light` (36, 93), `passenger-wallet-light` (36, 94), `auth-phone-light` (no back) |
| G-10 | No keyboard avoidance: the software keyboard covers the focused field and the primary button. | `auth-login-keyboard-light` (email field at y 616 hidden under keyboard from y 545), `auth-phone-light` (Send Code at y 594 hidden) |
| G-11 | No loading, empty, error or offline states anywhere data appears (all lists show static demo data). | all list screens |
| G-12 | Invented numbers on every data screen (stats, trends, offers, wallet, chats, vehicle, licence) and wrong currency (`$` on driver side and Home activity). | `passenger-home-light`, `driver-home-scroll1-light` (330, 472) |
| G-13 | Hero headers take 30-37 % of the screen and don't scroll (Login 270 pt, Home 248 pt, Registration 322 pt), leaving a small scroll area. | `auth-signup-personal-light` y 0-322 |
| G-14 | Text fields have no focus state, and error state only adds red text (no border change). | `auth-login-email-light` (200, 616), `auth-login-error-light` y 650 |

## Auth

### Login (`auth-login-*`, `auth-login-email-*`, `auth-login-error-*`, `auth-login-keyboard-light`)
1. Hero (y 0-270) uses navy with translucent bubbles; title "Welcome to RaaH-E-Haq" (32 pt 800) uses wrong brand casing. → plain surface header with logo badge, `h1`.
2. The card stack slides under the fixed hero when scrolled; the card top is clipped at y 270 (`auth-login-email-scrolled-light`).
3. "Create New Account" orange button (49-353, 721-770) has white-on-orange text at 1.97:1; on first view its top edge (y 809) shows and the label is cut by the navy bottom band at y 840 (`auth-login-light`).
4. Phone/Email switch (55-347, 325-373) is a navy pill tab, not a segmented control; Phone tab content is just a second "Sign in with Phone" button that duplicates the title (y 535 and y 619).
5. Decorative 90 pt icon circle (156-246, 407-497) adds no information; pushes the form below the fold.
6. "Continue with Google" button (49-353, 476-526) is a dead control (shows "not available"; T-204 removes it).
7. Inline errors (y 650, 730) shift the layout by 17 pt each and the field border stays grey.
8. Dark: fields become `#1A1A1A` black on a white card (`auth-login-email-dark`).
9. Keyboard covers the email field (`auth-login-keyboard-light`).
10. No loading state visible on "Sign in with Email" after tap (no spinner, button stays enabled; double-submit possible).

### Phone verification (`auth-phone-*`)
1. No back button (only edge swipe).
2. Field auto-focuses and the number pad hides "Send Code" (y 570-619 under the keyboard from y 566).
3. "+92" is typed into the editable text, not a fixed prefix; no formatting.
4. Same 270 pt hero and bubbles; dark mode turns the field black on white.

### Registration wizard, step 1 (`auth-signup-personal-*`)
1. 322 pt fixed header with step pills (labels 10 pt, `caption` too small, white at 60 % on navy).
2. Passenger flow still shows "Vehicle Info" and "Documents" steps (Step 1 of 4) that don't apply to passengers.
3. Account-type cards use stock clip-art figures (passenger/driver illustrations) on navy/white tiles.
4. Date of birth is a free-text field "YYYY-MM-DD" (y 632); no date picker.
5. Developer text leaks: "(API accepts only these values)" (y 403, `auth-signup-personal-bottom-light`).
6. "Preferred Payment Method: Cash / Card / Wallet" contradicts the cash-only decision.
7. Disabled "Next" (40-362, 752-800) is grey with white text (2.54:1) and floats over the illustration.
8. Dark: inputs black on white cards.
9. Gender/relationship chips wrap to two rows with uneven widths.

### Pending approval (not captured; source `DriverPendingApprovalScreen.tsx`)
1. Reads Firebase `state.auth` and calls `signOutUser` (T-106 rebuilds); uses illustrated background; copy hardcodes "Review Time: 24-48 hours".

## Passenger

### Home (`passenger-home-*`, `passenger-home-scroll1-*`, `passenger-home-scroll2-*`)
1. Greeting row at y 60 sits inside the status-bar row (clock at y 32, battery at x 352); notification bell (283-322, 55-100) and avatar (333-382, 50-100) collide with the battery icon area.
2. "Good Morning" shown at 1:22 AM; hand-wave emoji.
3. Address line (G9C5+5F5, Block N Gulberg III, Lahore, Pak…) runs past the right edge at x 402 with no ellipsis (y 130).
4. Weather "28°C · Sunny" is invented (no source).
5. "Active User" green pill (20-140, 155-187) has no meaning to a rider.
6. Stats grid (16-386, 263-449): invented values and "+12 %" trend chips; dark mode: black cards with navy icons (invisible).
7. Section titles "Special Offers", "Quick Actions", "Recent Rides", "Recent Activity", "Account" sit on the illustration (y 473, 634, 481, 264, 501); white in dark mode on a light pattern (unreadable).
8. Promo cards in coral and teal (16-216, 517-606); second card clipped at x 386 without a peek affordance; "Valid until Dec 31, 2024" stale.
9. Quick actions: 5 tiles in blue/green/orange/purple with an orphan "Support" tile (16-186, 318-436); "Location Active" tile is a status, not an action.
10. Recent Activity shows `$24.50`; navy amount on black in dark mode (1.17:1).
11. Account rows duplicate Settings tab rows.
12. The whole Home has no map and no "Where to?" entry; booking lives on a separate tab.

### Map / booking (`passenger-map-*`, `passenger-search-*`, `passenger-route-vehicle-*`, `passenger-fare-*`, `passenger-discard-dialog-*`)
1. Floating map buttons (locate 268,32; refresh 268,32; add 368,32) overlap the status bar and the battery.
2. Stage chips row with emoji (16-318, 506-568) wraps to two rows and acts as a debug stepper.
3. "Plan your trip" sheet is a flat white block; pickup shows a Plus Code ("G9C5+5F5, …") instead of a street address.
4. Search placeholder contains an emoji; results list mixes Lahore, Amritsar, Arizona and Dublin (no Pakistan bias, T-303); result icons are red-pin emoji on grey circles.
5. Vehicle step: the sheet covers the map from y 45 to the tab bar; the route is not visible. "Trip Details" row clips the "Swap" button at x 386. Vehicle tiles are emoji on navy squares (48-108); prices in periwinkle (3.66:1).
6. Fare step: periwinkle CTA with bell emoji (32-370, 712-758); rate strings ("@ Rs 30/km") invented client-side; "Fare Breakdown" card inside another card.
7. Resetting before a ride exists opens "Cancel Ride / Are you sure you want to cancel this ride?" (`passenger-discard-dialog-light`); wrong copy for discarding a draft.
8. Dark mode: map, sheet and dialog stay light; only the tab bar turns dark.

### Notifications tab (`passenger-notifications-*`)
1. Back arrow on a tab root (36, 93).
2. "Mark all" wraps to two lines (346-380, 80-108).
3. Filter chips wrap to two rows (16-343, 127-192).
4. Demo items ("Driver Arriving Soon", "WEEKEND20", "Wallet Top-up") despite cash-only.
5. Dark: active chip "All" navy on black (invisible), inactive chips white on black, "Mark all" navy on black.

### Chat list / thread (`passenger-chat-list-*`, `passenger-chat-thread-*`)
1. Status bar white over the light pattern (y 0-60); header starts at y 62 leaving a band.
2. Demo conversations (stock photos).
3. Thread: "Hello developer" seeded bot message; message input (10-392, 785-830) has no send button and sits over the home indicator; huge empty pattern area.
4. Dark mode ignored entirely.

### Settings tab (`passenger-settings-*`)
1. 4 hardcoded stars under the name (156-246, 211) with no rating value.
2. Status bar white on light pattern.
3. Mixed icon styles (outline and filled in one list).
4. Custom navy switches 60×28 (oversized); off state nearly invisible in dark (`passenger-settings-scrolled-dark` 312-374, 428).
5. Scrolled content clips at y 62 (`passenger-settings-scrolled-light`).
6. "DANGER ZONE" label for logout is alarming copy; no account deletion row.

### Wallet (`passenger-wallet-*`)
1. "Add Funds" and "Payment Methods" (cash-only: remove); "Add Funds" black button on navy card.
2. "Rs 1200" without thousands separator; demo transactions.
3. Different header style (plain chevron) from the rest of the app; no dark mode.

### Ride history (`passenger-history-*`)
1. Demo rides; "Details" navy buttons (281-372) on every card do nothing.
2. Cancelled ride shows a red "Cancelled" pill and a fare (Rs 880) as if charged.
3. No dark mode, no empty/loading state.

### Favourite locations (`passenger-saved-places-*`)
1. "Work" icon renders as "?" (27, 366).
2. Demo addresses; "Edit" and "Set Pickup" do nothing; Add field accepts free text without geocoding.
3. Red trash icon on every card (363, 233) invites accidental deletes.

### Profile (`passenger-profile-*`)
1. 374 pt navy hero; "( passenger )" raw role string next to the name (240-359, 265).
2. Invented "4.8 / 24 / 2y" stats.
3. Section titles on the pattern; content clipped at y 62 when scrolled; back button scrolls away.
4. "Location: Not provided" row with a chevron that does nothing.

## Driver

### Home (`driver-home-*`, `driver-home-scroll1-*`, `driver-home-scroll2-*`)
1. Header card (20-382, 112-303) starts 112 pt down, with a navy band above (0-62) and the pattern between; avatar button clipped at the right edge (352-402, 162-212).
2. "Performance Overview" stat tiles are broken: values and labels clipped ("PKR 24", "Total Rides" cut at y 458, "Online Hou…" cut), tiles are translucent over the pattern (y 400-575).
3. Vehicle row says "Car / Car" (duplicate) with a "Verified" pill partly off-screen (315-382, 268).
4. Recent rides: `$25.50`; a full-width green "Completed" button with red text (40-362, 614-646, 1.48:1) duplicates the green "Completed" pill above it.
5. Quick action rows with coloured left borders (orange/green/red) and inconsistent icon circles.
6. Sign out on Home uses the Firebase thunk (FEATURES: BROKEN).

### Drive map (`driver-map-offline-*`, `driver-map-online-dark`)
1. Opens on Karachi (Sarafa Bazaar) instead of the driver's location or Lahore.
2. Status banner (20-382, 50-98) uses a green pin icon for "Offline", same styling online and offline; sits under the status bar row (y 50).
3. Go-online control is an unlabeled play icon in a 56 pt white circle (322-380, 702-760); when online it becomes a tiny red pause icon with no background (343-358, 731).
4. No earnings, no "you're online, finding trips" feedback, no request preview.

### Notifications (`driver-notifications-*`)
1. Static text "Driver notifications will be displayed here" centered; dark: status bar text invisible.

### Chat list / thread (`driver-chat-list-*`, `driver-chat-thread-*`)
1. Empty grey avatar for "Sarah Ahmed" (36-86, 197-247).
2. Thread design differs from the passenger thread (different header, bubbles, composer).
3. Call and send icons render "?" (362, 92) and (347, 797); timestamps sit on the pattern (y 221, 322, 424).

### Settings (`driver-settings-*`)
1. Layout collapsed: the settings list is a 120 pt-wide column (141-261, 566-750) with icons only, no labels; profile card shrink-wrapped (104-298, 196-412).
2. "Driver Settings" title and subtitle sit on the pattern (y 447-513).
3. Logout row is an unlabeled red icon (181, 714).

### Profile (`driver-profile-*`)
1. "( driver )" raw role; "$2.4k" earnings with a "?" glyph (326, 413).
2. "Toyota Corolla 2020" / "DL-123456789" invented vehicle and licence.
3. Green switches here vs navy switches on passenger Settings; "Auto Accept Rides" has no product decision.
4. "Delete Account" row does nothing.
