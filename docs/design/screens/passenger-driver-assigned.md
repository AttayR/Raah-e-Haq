# Passenger · Driver on the way / Driver arrived

- **Task:** T-614 (visual) after T-307 (driver-assigned card + tracking screen), T-510 (message), BE-04 (`arrived` exposed), BE-06 (`GET /rides/{id}/driver-location`).
- **Route:** states `accepted` and `arrived` of `PassengerBooking/Trip`.
- **Current source:** `components/passenger/DriverAssignedCard.tsx` (ETA default "5 min", Call/Message not wired, PAX-12). Not captured live.
- **Data:** `GET /rides/{id}`: `status`, `driver` (`name`, `profile_image`, `rating` [BE-15]), `vehicle` (`make`, `model`, `color`, `license_plate`, `vehicle_type`) [BE-15/BE-03 sets `vehicle_id`], `pickup_address`, `dropoff_address`, `total_fare`, `accepted_at`, `arrived_at`, `estimated_arrival`. Driver position: `GET /rides/{id}/driver-location` or `DriverLocationUpdated` [BE-12] → lat, lng, heading. Unread messages: chat unread count [BE-13].

## Layout
Map full screen: pickup pin, driver marker (5.21, animated), route from driver to pickup (`routeLine`), camera fits both with sheet padding. Tab bar hidden.

**On the map:** IconButton `floating` `shield-check-outline` top-right at (338, `insets.top + 8`) → safety sheet (Share trip status via the OS share sheet with pickup/dropoff text; Call emergency 15). Recenter IconButton `floating` `crosshairs-gps` above the sheet's top-right (16 inset, 16 above sheet).

**Sheet** snaps `peek` (through block 4) and `half`:
1. Handle; 20 from top.
2. **Status line:** `accepted`: `h2` "{eta} min away" where `eta` = minutes from `estimated_arrival` (or computed from driver-location route duration); if neither exists: `h2` "Driver on the way". `arrived`: `h2` "Your driver is here" + Badge status pill warning "Arrived" trailing.
3. 4 gap: `bodySmall` `textSecondary`: `accepted` "Meet at {pickup short}"; `arrived` "Meet your driver at the pickup point." 
4. 16 gap: **Ride status timeline** (5.24, horizontal) with step 2 or 3 current.
5. 16 gap: **Driver card** (5.27): Avatar 56, name, rating, vehicle line, plate pill; actions "Call" and "Message" (Message shows unread Badge count).
6. 16 gap (half state): **Trip summary card**: Raah line pickup/dropoff; row "Cash · {total_fare}" (`numeric`).
7. 16 gap: Button `lg ghost` (danger text colour) "Cancel ride".
8. Bottom padding `insets.bottom + 8`.

## States
| State | Spec |
|---|---|
| Accepted, no driver location yet | Driver marker hidden; status "Driver on the way"; recenter fits pickup only. |
| Driver location stale (>60 s) | `caption` `textMuted` under the status line: "Location updated {n} min ago". |
| Arrived | Haptic `notificationWarning`; push notification (BE-04/BE-11) if backgrounded; status line swap 250 ms; plate pill gets 2pt `primary` ring to help spotting the car. |
| Ongoing | Crossfade to passenger-trip-in-progress. |
| Driver cancelled | Toast warning "Your driver cancelled. Finding you another driver." and return to passenger-finding-driver if the server re-queues (`requested`), else Dialog "Your ride was cancelled" + "Book again". |
| Cancel ride | Dialog: "Cancel ride?" / body: "Your driver is already on the way." (+ fee line only if the API returns a cancellation fee) / "Keep ride" / "Cancel ride" (destructive). |
| Call | Opens the dialer with the number the API provides for the ride (masked/proxy number per BE-20 policy); if no number is provided the Call button is hidden, Message stays. |
| Message | Pushes shared-chat-thread for this ride. |
| Offline | Offline banner; last known driver position kept, stale line shown. |
| Missing fields | No rating → "New"; no vehicle → vehicle line hidden and plate pill hidden; no photo → initials. |

## Small device
- Peek shows status line, timeline and driver card only; trip summary in half.

---

## UI-R12 (2026-10-20): driver on the way / driver arrived

**Anatomy:** `shared-trip-sheet.md` (TS1–TS12) — read it first; this section gives only what is specific to the passenger's `driver_en_route` and `driver_arrived` stages. **Supersedes** the Layout and the safety/recenter lines above. **Keeps what ships:** the stage machine (T-304), PIN card (BE-81/T-520), fare lock (BE-82, now shown as the FareTag), waiting timer (BE-85, shipped `WaitingTimer`), SOS sheet and live share (T-520/BE-80), masked call (BE-78), chat with unread count (T-510), T-588 arrived snap, driver-cancelled re-queue (T-546), the cancel rules and the **T-589 live cancel dialog** (request question turns into the ride question in place; re-read before cancelling).

**Before:** `docs/qa-reports/2026-10-19-t583-t582b-qa/10a-accepted-passenger.png`, `docs/qa-reports/2026-10-16-t-551-t-552-qa/2-02-passenger-accepted.png`, `docs/design/audit/2026-10-11-prod-audit/ref-passenger-driver-assigned.png`, `docs/qa-reports/2026-10-13-UI-R5/design-trip-driver-assigned-light.png`.

### PA1. Peek group (iPhone 17)

| # | Block | Height | Gap after |
|---|---|---|---|
| Z0 | Handle area | 24 | — |
| Z1 | Status header (PA2) with ETA tile | 56 | 12 |
| Z2 | Progress, step 2 (on the way) / 3 (arrived), no labels | 4 | 16 |
| Z4 | PersonCard: identity (Avatar 56, name, rating, vehicle line 2 lines, plate pill) + action row Call · Message · Share | 128 | 16 |
| Z5a | **PIN card** (shipped `RidePinCard`: `primarySoft`, padding 12, title "Your ride PIN" + hint, four 36 × 48 digit tiles) — only while the server sends `pin` | 72 | 12 |
| Z5b | **Waiting timer** (arrived only; shipped `WaitingTimer`, only when fees are on and the arrival is verified) | 64 | 12 |
| Z5c | **Fare row** (TS6.2): `cash` + amount + "cash" + FareTag "Fixed fare" | 32 | — |
| — | bottom `max(insets.bottom + 8, 16)` | 42 | |

- **Peek, on the way:** 24 + 56 + 12 + 4 + 16 + 128 + 16 + 72 + 12 + 32 + 42 = **414** (47 %; map above 460). Without a PIN: 330.
- **Peek, arrived with the waiting timer:** 414 + 64 + 12 = **490** (56 %).
- **Compact (< 700, SE, bottom 16):** the fare row moves to the details; on the way 24 + 56 + 12 + 4 + 16 + 128 + 16 + 72 + 16 = **344** (52 %); arrived: progress hidden (−16), timer + 12 → **404** (61 %; the map only needs the pickup at this point).
- **No footer** in these stages: there is no primary action for the passenger. Cancel lives at the end of the details (TS8).

### PA2. Status header copy

| Stage / condition | Title (`h2`) | Subtitle (`bodySmall`) | Tile |
|---|---|---|---|
| On the way, ETA known | "Driver is on the way" / "Driver aa raha hai" | "Meet at {pickup short}" / "{pickup short} par milein" | `eta.minutes` "min" |
| On the way, no ETA (TS10 not shipped / stale) | same | same | hidden |
| Driver location older than 60 s | same | `textMuted` "Location updated {n} min ago" / "Location {n} minute pehle update hui" | hidden |
| Arrived | "Your driver is here" / "Aap ka driver pohanch gaya" | "Meet your driver at {pickup short}" / "{pickup short} par apne driver se milein" | hidden |
| Parcel (BE-88) | shipped `parcelStatusText` | shipped hand-over line ("Hand over the parcel and pay {fare}") | as above |
| Offline (NetInfo) | unchanged | `warning` + `wifi-off` 16: "You're offline. Showing the last update." / "Aap offline hain. Aakhri update dikha rahe hain." | hidden |

Copy keys (`ACTIVE_RIDE_COPY`): `driverEnRouteTitle` "Your driver is on the way" → "Driver is on the way" (ur "Aap ka driver aa raha hai" → "Driver aa raha hai"), so the title fits one line beside the tile on iPhone 17 (302 pt); `driverArrivedTitle` "Your driver has arrived" → "Your driver is here" (ur unchanged); new `meetAt`, `meetDriverAt`, `locationStale`, `offlineLastUpdate`.

`{pickup short}` = the first comma-separated part of `pickup_address` (same helper as the booking summary, UI-R10). Badges (AC, Parcel) sit at the subtitle row start (TS3).

### PA3. Details (`expanded`, 24 below the peek group, 16 between)

1. Fare row (compact only, moved here).
2. **Trip card**: Card `outlined` radius `lg` padding 16 with `AddressPair` `density="regular"` (labels "Pickup", "Stop {n}", "Drop-off"; M1 orange drop-off square with edge).
3. **Live share row** (only while a share link is live): ListItem 56, leading `share-variant` 24 `success`, title "Sharing your trip live" / "Aap ki trip live share ho rahi hai", trailing Button `sm ghost` "Stop" / "Band karein" (shipped `share.stop`).
4. Women-mode block (shipped; only while searching, so normally absent here).
5. **Cancel ride** `md destructiveGhost` (TS8), leading `close-circle-outline`, label "Cancel ride" / "Ride cancel karein"; while `canPassengerCancel(stage)`.

### PA4. Cancel (T-589 kept, copy fixed)

- Tap → the shipped `usePassengerCancel` flow (themed Dialog, server preview, live swap from request to ride question, re-read before cancelling, toast on failure). Only the copy changes (DESIGN_SYSTEM §7 voice):

| Key (`ACTIVE_RIDE_COPY`) | English (was) | English (now) | Roman Urdu (now) |
|---|---|---|---|
| `cancelConfirmTitle` | "Cancel Ride" | "Cancel ride?" | "Ride cancel karein?" |
| `cancelConfirmMessage` | "Are you sure you want to cancel this ride?" | on the way: "Your driver is already on the way." · arrived: new key `cancelConfirmMessageArrived` "Your driver is waiting for you." | "Aap ka driver raste mein hai." · "Aap ka driver aap ka intezar kar raha hai." |
| `keepRide` | "Keep Ride" | "Keep ride" | "Ride rakhein" |
| `cancelRide` | "Cancel ride" | unchanged | unchanged |

  The server preview sentence (BE-85: "Free to cancel until 6:05 PM." / "Cancelling now costs Rs 50…") is still appended after the question. Dialog action order per §5.15 (ghost "Keep ride" start, `destructive` "Cancel ride" end).
- Outcome: shipped (cancelled panel → receipt state "Ride cancelled", PR section in `passenger-trip-complete.md`).

### PA5. Map

TS2 chrome: back (48) top-start, **Safety shield** (48) top-end → `SosSheet` (replaces the SOS button of the old safety row), recentre after a pan. TS2.1: on the way = pickup pin + assigned vehicle (48, halo) + vehicle → pickup route when fetched; arrived = pickup pin + snapped vehicle, no route, zoom 17. The drop-off pin is not drawn in these stages (focus on the meeting point).

### PA6. States

| State | Spec |
|---|---|
| Driver found (from finding driver) | content swap TS7 inside the same sheet container; haptic `notificationSuccess` (shipped); camera fits vehicle + pickup (600 ms) |
| No driver location yet | vehicle hidden; tile hidden; camera fits the pickup |
| Arrived | haptic `notificationWarning`; plate ring (TS7); progress → 3; waiting timer appears when the server says the arrival is verified and fees are on |
| Driver cancelled, re-queued | back to the finding-driver sheet with the shipped re-queue copy (UI-R10) |
| Driver cancelled, not re-queued / system cancel | receipt state "Ride cancelled" (`passenger-trip-complete.md` PR6) |
| Started | content swap to `passenger-trip-in-progress.md` UI-R12 |
| No call permission (`contact.can_call` false) | Call cell absent; Message and Share split the width |
| Share unavailable | Share cell absent |
| Missing fields | rating → "New"; no vehicle → vehicle line and plate absent; no photo → initials |
| 1.3× text | title 2 lines allowed (header grows from 56 to 78); vehicle line 2 lines; the peek is measured |
| Dark | `surface` sheet, `surfaceAlt` action cells, `primarySoft` #1C2850 PIN card and ETA tile, FareTag `accentSoft` #3A1A0C with `accentStrong` #FF9B66 glyph |

### PA7. Accessibility

Announce on entry "Driver found. {name}, {vehicle line}, plate {plate}. {n} minutes away." / "Driver mil gaya. …"; on arrival "Your driver is here. Plate {plate}." Focus order: back → safety → header → progress → person (name, rating, vehicle, plate as one element) → Call → Message → Share → PIN (digits read one by one, shipped) → timer → fare → details. All action cells 56 high.

### PA8. Performance

Ride poll and driver-location reads unchanged (T-588 pace); ETA and the stale check come from those reads; the PIN card and FareTag are static; the waiting timer ticks inside itself; the vehicle marker never re-renders the sheet.

### PA9. Design review evidence (UI-R12, this file)

Signed-in screens on the local backend (two sims: local test passenger + online test driver or the BE-117 driver bot; **no gallery previews**, REFRESH_PLAN UI-R5 ruling): on the way light/dark (with PIN; with the ETA tile once TS10 ships, else without), arrived light/dark with the plate ring and the waiting timer (local fee policy on), expanded with Cancel, the cancel Dialog in en and ur-Latn, sharing state (Sharing cell + details row), Safety sheet from the shield, Roman Urdu peek, 1.3×, iPhone SE on the way + arrived light/dark. Side-by-side pairs with UI-R13 (on the way ↔ to pickup).
