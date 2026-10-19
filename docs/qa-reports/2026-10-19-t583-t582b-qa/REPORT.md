# QA: T-583 (BE-113/BE-114 in the app) and T-582 part 2 (2026-10-19)

QA RESULT: FAIL (1 medium, 1 low-medium, 3 observations). Works: 409 opens the existing booking, No driver / No rider found with Try again + Close, history/receipt label, notification routing, choose-on-map addresses, pickup sliver, Done → Home, 15 s nearby poll, accept/complete/requeue. Failures: the 409 info toast never shows (2/2); an iOS edge swipe right after Request popped Booking once (1/3).
DEVICE: iPhone 17, iOS 26.5 — passenger FFD40F6E…, driver E375B9F1…, light. App a648374 on Metro 8081; local backend 7e6878a. No reseed. Run paused ~40 min (usage limit) between 9a and 9b.

## 1. 409 RIDE_ALREADY_ACTIVE (open ride created via the API with a temporary local token, revoked)
1a. Choose ride → Request with #260 open: lands on #260's finding state, no modal, no new ride (01a, 01). PASS
1b. "You already have a booking" toast not visible; yellow LogBox instead (01). FAIL (bug 1)
1c. Send parcel with #263 open: lands on #263, no parcel created; toast missing, LogBox (01b). Routing PASS, toast FAIL

## 2. Expiry with the app open (requested_at backdated, restored)
2a. Next poll: "No driver found … You were not charged.", pulse/bar gone, no fee, Try again + Close; DB cancelled/no_driver, fee 0 (02). PASS
2b. Try again double tap → exactly one new ride #261, one idempotency row (02b). PASS
2c. Close → Home peek. PASS
2d. Roman Urdu "Koi driver nahi mila…", "Dobara koshish karein" / "Band karein" (02c). PASS
2e. Try again after a 409-opened ride expired re-booked that ride's trip (#264). PASS (note)
2f. Parcel #265 → "No rider found"; Try again double tap → one parcel #266; Close → Home (02d). PASS

## 3. no_driver notification
3a. Tap while Booking shows the outcome → No driver state (03). PASS
3b. After Close → Ride details (03a). PASS

## 4. History and receipt
4a–4c. Rows "No driver found · No charge" without pill; details, cancellation text and shared receipt match; Roman Urdu (04–04d). PASS

## 5. iOS edge swipe on Booking
5a. Settled finding state: blocked 3/3 (05a, 05c). PASS
5b. Swipe immediately after Request: popped to Home once (#262 kept searching, Home "Apni ride par wapas jayein"); blocked 2/3 (05b, 05d). FAIL (bug 2)
5c. Choose ride: swipe back to planner. PASS
5d. After the outcome: swipe back to Home. PASS

## 6. Choose on map
6a. Destination: address within ~1 s, never "Pinned on map" (06a). PASS
6b–6d. Two quick taps on destination, pickup and stop end on the second point's address (06b–06d). PASS
6e. Panning sends nothing to the backend (Google calls not observable). PASS (UI only)

## 7. Planner typing: no pickup sliver (07). PASS
## 8. Done → Home for cancelled #264 and completed #268 (08a, 08b). PASS
## 9. Nearby drivers
9a. Online → "1 driver nearby" next poll (09, 09a). PASS
9b. Offline → "No drivers nearby right now" by +12 s (09b, 09c). PASS
9c. GET /rides/nearby-drivers every 15 s, no bursts. PASS

## 10. Regression
10a. Accept → on the way, PersonCard, "Fare locked: Rs 80", PIN (10a). PASS
10b. Driver cancel → "Finding another driver", server requeues (10b). PASS
10c. #268 full trip → completed Rs 80 → Done → Home; driver commission 20% −Rs 16, net Rs 64 (10c). PASS

## LogBox
Yellow "Open debugger to view warnings." on both 409s (passenger) and once on the driver sim at a ride offer. No red errors.

## Observations
- Home chip → choose ride framed the route 3/3 (T-584 item 3).
- T-584 "Ride cancelled" panel after Cancel request unchanged on this build (fixed in T-584).
- Offer not re-sent to the driver who cancelled #267 (intended).
- Passenger briefly still "On the way" right after "I've arrived" (one shot; not followed up).

## New bugs (filed as T-585)
1. MEDIUM — 409 info toast never visible on Booking (ride and parcel); check the toast host above the native-stack Booking screen (active-ride/hooks.ts openActiveBooking). 409 log → debug (done in T-584).
2. LOW-MED — iOS swipe-back right after Request can pop Booking (gestureEnabled set in an effect after busy changes). Block synchronously in the press handler or use a beforeRemove guard.
3. OBS — yellow LogBox on the driver sim when a ride offer arrives.

## Local data
#260–#263, #265, #266 cancelled no_driver fee 0 (#260/#263 via API; #265/#266 parcels, parcel rows 17/18); #264 passenger-cancelled fee 0; #267 accepted → driver-cancelled (requeued, one driver_strikes row kept) → passenger-cancelled fee 0; #268 completed Rs 80, unrated. requested_at restored. 7 idempotency rows. Restored: parcel tier inactive, temporary token 46 deleted, passenger locale en, driver offline, driver sim location 31.5119, 74.3473. Passenger appearance set to System (shows light). No active ride.
