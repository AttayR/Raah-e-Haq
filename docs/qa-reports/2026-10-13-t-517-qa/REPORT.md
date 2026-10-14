# QA: T-517 live vehicle animation + T-519 (2026-10-13)

Build 49f2805 / b77be75, Debug, local backend. Passenger FFD40F6E, driver E375B9F1 (iPhone 17, iOS 26.5). Rides #208 (car), #209 (bike). Driver moved with `simctl location start` at 7–8 m/s.

| Scenario | Result | Evidence |
|---|---|---|
| (a) Vehicle art per type, smooth glide, no spin when standing, no snap before pickup, follows route on trip | PASS except a ~90° sideways turn for ~1.5 s right after Start trip (2/2) | a1–a12 (bug a8, a12) |
| (b) Driver own marker on Drive; camera fits pickup / drop-off; recentre | FAIL: driver ~700 m away → pickup hidden under the panel, recentre same; OK at 250–450 m | b0–b7 (bug b3) |
| (c) Nearby drivers | Booking map PASS; passenger Home shows none (spec asks for them) | c1–c3 |
| (d) Dark mode markers | PASS | d1 |
| (e) T-519 keyboard, first name, no Resume ride | PASS (passenger keyboard N/A on sim) | e1–e9 |
| (f) Cancel sheet / Where to? regression | PASS | f1–f2 |

Bugs → T-524: driver ride camera doesn't zoom out far enough with the tall panel; sideways heading on the lead-in to the route at trip start; passenger Home missing nearby drivers; Activity row shows a car icon for a bike ride; driver card vehicle line wraps awkwardly; offline Drive map doesn't follow the driver; place search suggests foreign places (check Pakistan bias). Star taps on a freshly opened rating sheet feel slow (>0.5 s) → performance audit.
