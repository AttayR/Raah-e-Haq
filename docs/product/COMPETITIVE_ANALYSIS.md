# Competitive analysis: ride-hailing in Pakistan (2026-10-13)

Purpose: list what passengers and drivers complain about in inDrive, Yango, Bykea, Careem, Uber (and Swvl), and turn each complaint into something Raah-e-Haq can build. Sources are listed at the end, referenced as `[S#]`. Anything marked **(unverified)** comes from a single weak source or a search summary I could not open in full.

## 1. Market snapshot

| Player | Status in Pakistan (Oct 2026) | Model | Notes |
|---|---|---|---|
| **inDrive** | Market leader. Top ride-hailing app on Google Play / App Store PK [S23]. 2M+ DAU in mid-2024 [S7] | Passenger offers a fare, drivers accept or counter | Low commission (around 10% reported, waived in Karachi Nov–Dec 2025) [S22]. Also courier, freight, intercity (200+ cities) [S9][S23] |
| **Yango** | No. 2 (about 730k DAU mid-2024 [S7]) | Fixed upfront fare | 6 fare revisions in 2026: up to 19–20% in KHI/LHE, up to 35% in ISB/RWP [S30] **(unverified)**. Safety report: masked numbers, selfie checks, link to Punjab Safe City 15 [S12] |
| **Bykea** | Strong for bikes, parcels, cash services in KHI/LHE/ISB [S16][S31] | Fixed price; bikes, rickshaws, cars | Parcel delivery, cash-on-delivery / send-money and bill pay at the door [S31] |
| **Careem** | **Ride-hailing stopped 18 Jul 2025** [S19] | Fixed upfront fare | Exit reasons: economy, competition, capital [S19]. Had 12M users and 820k captains [S8] |
| **Uber** | **Exited 30 Apr 2024** [S20][S16] | n/a | Reference for safety features (PIN, RideCheck, share trip) [S27] |
| **Swvl** | Shut down Pakistan in Jun–Nov 2022 [S21] | Bus pooling | Cash burn; no lasting gap filled since |
| **Drivver** (Jazz + iTecknologi) | Launched Sep 2026 [S25] | Fixed fee instead of % commission; zero-rated data on Jazz; JazzCash | New direct competitor on our exact pitch (cars, bikes, rickshaws, wallet) |
| **SheDrives** | Lahore only, since Sep 2024 [S28] | Women and trans people only, drivers and passengers | Shows demand for women-only rides |

Other context:
- Market shares in summer 2025 of about inDrive 60–65%, Yango 30%, Careem under 5% (from an analyst blog) **(unverified)** [S33].
- Ride-hailing reaches only about 5% of the population vs about 20% globally. The main limit is the supply of cars and car financing [S9].
- Fuel shock in 2026: petrol rose by Rs55 overnight to Rs321/L (Mar 2026), then reached Rs378/L by April. Drivers' daily fuel went from Rs1,600 to over Rs2,000. A 15–17 km commute went from Rs900 to Rs1,700–2,000 [S8][S10].
- Regulation is coming:
  - Islamabad bill (Senate 2025): permits, background checks, vehicle fitness, insurance, a real-time driver/vehicle database, and ride data shared with authorities [S17].
  - Punjab Section 44B (2025): route permit per district and per platform. Industry is pushing back [S18].
  - Sindh: amendment planned [S18].

## 2. Pain points and how Raah-e-Haq answers them

Columns:
- **Freq**: how often it shows up across sources (H = in many sources or the top theme in reviews, M = several, L = one or two).
- **Who**: P = passenger, D = driver.
- **Side**: BE = backend, App = mobile app, Ops = admin/ops.
- **Effort**: S/M/L.
- **Today**: our state per CLAUDE.md and docs/TASKS.md.

### 2.1 Passenger pain points

| # | Pain point | Competitors | Freq | Evidence | Raah-e-Haq solution | Side | Effort | Today |
|---|---|---|---|---|---|---|---|---|
| P1 | **Driver accepts, then demands more money** (before pickup or mid-trip, "petrol price") | inDrive (main), Yango | **H** | Top 1-star theme for inDrive, about 30% of low reviews [S14]. PK reviews say "99% of drivers ask for extra" [S14]. Yango: Rs175 overcharge, promo fare refused [S15][S1] | **Fare lock.** The server fare is shown to both sides and printed on the receipt. The driver's app cannot change it. "Driver asked for more" is a one-tap report during and after the ride, sent to Ops, with strikes on the driver. Push-to-passenger copy: "Pay only Rs X" | BE+App+Ops | M | Server fare exists (BE-04/05). No lock badge, no overcharge report |
| P2 | **Long waits, then the driver cancels**; drivers accept from far away | inDrive, Yango | **H** | About 25% of inDrive low reviews [S14]. Yango "arrives at wrong location" [S15] | Dispatch radius cap and ETA-based matching. Driver cancel-after-accept rate kept and penalised. Passenger is auto re-matched with priority. Show the driver's live ETA honestly (tracking exists) | BE+App | M | Live tracking done (T-517). No cancel-rate scoring |
| P3 | **Harassment, women's safety**: driver messages or calls after the ride, shares the address, indecent conduct | inDrive (many cases), Yango, Bykea (doxxing) | **H** | Lok Sujag cases (WhatsApp after the ride, contact shared) [S2]. Islamabad/Lahore cases 2025 [S4][S5]. Bykea doxxing [S31]. Women abandoned mid-ride (Yango) [S1] | (a) **Number masking.** In-app chat only, plus proxied calls. Chat and call close X minutes after the ride. (b) Show first name only (done). (c) Zero-tolerance policy with a fast-track women's-safety report and suspension pending review. (d) Optional "female passenger" preference: high-rated, verified drivers only. Women drivers later | BE+App+Ops | M (masking via VoIP/proxy vendor: L) | Chat done (T-510). Call button opens `tel:` with the real number → **gap** |
| P4 | **No real-time emergency help**; support is slow or a form only | inDrive, Yango, Bykea | **H** | inDrive: no real-time emergency support, only a lost-item form [S3]. Text-only support [S2]. Yango: "endless redirect loops" [S15] | **SOS button** on the ride screen: calls 15 and sends the trip and location to emergency contacts and Ops. 24/7 urgent line with a response-time target (Yango claims 5 min for 90% [S12]). In-app tickets with status | BE+App+Ops | M | Support tickets planned (UI-R tasks). No SOS |
| P5 | **Lost items and theft**, no recovery path | inDrive | M | Passport/CNIC/iPhone lost, no response [S3]. Driver vanished with Rs45k of goods [S6] | "I lost an item" on the ride receipt opens a masked contact to the driver for 72h, plus a ticket with SLA. Driver gets a return fee. Repeat offenders are deactivated | BE+App+Ops | S–M | Receipt exists (T-501) |
| P6 | **AC promised, not working; old or run-down cars** | Yango, inDrive | M | AC Comfort ride without working AC; a 35-year-old Mehran [S1]. Wrong vehicle type sent [S15] | AC as its own category with a declared vehicle year. "AC not working" report gives the passenger a fare cut to the non-AC rate and a strike for the driver. Vehicle photos and year checked at approval | BE+App+Ops | S–M | Vehicle approval exists. No AC flag |
| P7 | **Wrong pickup pin / no proper addresses** | All | M | Delays and cancellations from wrong pins [S32]. Yango drivers at the wrong location [S15] | Drag-to-adjust pin with a reverse-geocoded landmark. Pickup note ("gate 2, near mosque") shown to the driver. Saved places. Pre-arrival chat | App+BE | S | Search and choose-on-map partly done (T-604) |
| P8 | **Fares unpredictable**: haggling, surge, doubled after the fuel shock | inDrive (haggling), Yango (6 hikes) | **H** | Passengers prefer transparent fixed fares [S7]. Commute fares doubled [S10]. Yango +19–35% [S30] | Upfront fare with a visible breakdown (base, per km, per min). Fare changes announced in-app in advance. No hidden surge; any peak multiplier is shown and capped | BE+App | S–M | Breakdown planned (T-306, T-609) |
| P9 | **Cash disputes / no change** | inDrive, Yango | M | About 15% of inDrive low reviews are cash disputes [S14]. Card often missing in Yango [S16] | Exact fare rounded to Rs10. "Pay difference to wallet": driver credits the change to the passenger's wallet in-app. Wallet balance can pay part of the fare later | BE+App | M | Wallet + top-up (T-515/BE-74). Rides cash only |
| P10 | **Driver identity doesn't match the app** (plate, person) | Bykea, inDrive | M | Mismatched vehicles and missing plates [S15b]. Advice to match face, name and plate [S16] | **Ride PIN**: the passenger tells a 4-digit code and the driver can't start without it (Uber [S27]). Driver selfie check when going online (Yango [S12]). Large plate and photo on the tracker | BE+App | M | Driver photo/plate shown. No PIN or selfie |
| P11 | **Abandoned mid-ride / wrong route** | Yango | M | Dropped far from the destination; deserted road [S1] | Route deviation and long-stop detection (RideCheck-style [S27]) with an in-app "Are you OK?" and an SOS shortcut. Server checks completion location vs the drop point | BE+App | M | GPS path stored (BE-24) |
| P12 | **Unsafe / reckless driving** | Bykea, Yango | M | Accidents, reckless riders [S15b]. Yango monitors driving style [S12] | Speed telemetry from the existing tracker. Flag drivers over X km/h. Speed shown in post-ride rating reasons | BE | M | Tracker exists |

### 2.2 Driver pain points

| # | Pain point | Competitors | Freq | Evidence | Raah-e-Haq solution | Side | Effort | Today |
|---|---|---|---|---|---|---|---|---|
| D1 | **Fares don't follow fuel prices**; earnings fell by half | inDrive, Yango, Bykea | **H** | "Rates not adjusted since 2018", earnings Rs100k → Rs50k/month [S10]. No fare change after a 70% fuel rise [S9]. Rs300 for 30 min in traffic [S1] | **Fuel-indexed rate card.** Admin-editable per-type rates (BE-60) with a fuel index: a published formula, reviewed with each OGRA price change. Driver app shows "rates updated on <date> because petrol is Rs X" | BE+Ops+App | S–M | BE-60 todo |
| D2 | **Race-to-the-bottom pricing**; bidding is "a trap" | inDrive | M | [S7] | No open bidding. Server fare with a floor. If we add offers, keep them to a ±% band around the server fare (see §3) | BE | S | Fixed fare |
| D3 | **Commission and fees not transparent / too high** | Careem (15–25% historically [S29]), Yango | M | Careem cut from 25% to 15% under pressure [S29]. inDrive wins drivers with about 10% [S22]. Drivver uses a fixed fee [S25] | Low, published commission (or a fixed daily/ride fee option). Every ride shows fare → commission → net in Earnings. Monthly statement | BE+App | S (display) / M (fee plans) | Wallet ledger + commission (priority 1) |
| D4 | **Nothing when the passenger cancels**; unpaid waiting | inDrive, Yango | M | "Drivers receive nothing when passengers cancel" [S9] | Cancellation fee after the driver arrives or after N minutes en route, credited to the driver's wallet (deducted from the passenger's next fare or wallet). Free waiting 3 min, then per-minute waiting | BE+App | M | Cancel reasons exist. No fee |
| D5 | **Slow driver support (30–40 min waits)** | inDrive | M | [S11a search summary] **(unverified)** | Driver support queue with priority for on-ride issues. In-app ticket status | Ops+App | M | Tickets planned |
| D6 | **Strict penalties, unexplained blocks / deactivation** | Yango, Bykea | M | Yango drivers cite strict penalties [S1]. Bykea deactivated a witness driver (judicial commission intervened) [S34] | Transparent strike ledger: reason, date, expiry. Warning before a block. Appeal flow with human review and an SLA. Account-status screen shows the reason (T-106 has the screen) | BE+App+Ops | M | Account-status screen done |
| D7 | **Fraud targeting drivers / couriers** (fake "Captain/Major" customers asking for JazzCash transfers) | inDrive | M | 80k accounts blocked, losses up to Rs30k [S11] | Never require a driver to send money. Block rank titles and suspicious names at signup. In-app warning when chat contains a JazzCash/Easypaisa number. Verified-passenger badge (phone OTP done) | BE+App | S | Phone OTP done (BE-35) |
| D8 | **Slow payouts / multi-day settlement** | General PK | M | Vendor blog [S26] (vendor content) | Cash-first means drivers mostly hold money. For wallet credits (top-ups, cancel fees), offer same-day withdrawal to JazzCash/Easypaisa once a gateway exists. Show a clear "you owe / we owe" balance | BE+Ops | M (gateway is the owner's) | Settlements exist (priority 1) |
| D9 | **No cover for illness or accidents** | inDrive (now advertises insurance [S24]) | L | [S9] | Ride-time accident insurance through a local insurer (an owner item). The bill requires it [S17] | Ops | L (commercial) | None |
| D10 | **High data use / Jazz-only free data** | Drivver advantage | L | Drivver zero-rates data on Jazz [S25] | Light map styles, fewer polls, small payloads, image compression. Ask the owner about a telco zero-rating deal | App+Ops | M | Polling 5–8 s today |

### 2.3 Cross-cutting

| # | Pain point | Evidence | Solution | Side | Effort |
|---|---|---|---|---|---|
| X1 | **Regulatory compliance** (permits, background checks, insurance, data sharing) | [S17][S18] | Driver record fields for permit no. and police verification. Ride-history export for authorities on lawful request. Annual vehicle inspection reminder | BE+Ops | M |
| X2 | **Urdu / Roman Urdu** | No hard source found; inferred from market. inDrive and Yango ship Urdu UIs **(unverified)** | Full Urdu (RTL) and Roman-Urdu copy. i18n scaffold exists (UI-R1) | App | M |
| X3 | **Trust erosion from social-media scandals** | Yango "rapid fall" coverage [S1][S13] | Public safety page with quarterly numbers (complaints per 1k rides, response times). Quick public response policy | Ops | S |

## 3. Table stakes: what competitors do well that we must match

| Feature | Who does it | Why it matters in PK | Raah-e-Haq status / plan |
|---|---|---|---|
| **Passenger-proposed fare ("offer your price")** | inDrive [S7][S23] | The reason inDrive leads. Users feel in control of price | Gap. Proposal: optional "Offer fare" within −15%/+30% of the server fare. Drivers see it and accept; no open counter-bidding (avoids P1/D2). BE+App, M |
| **Upfront fixed fare** | Yango, Careem, Bykea [S16] | Many passengers prefer it over haggling [S7] | Have (server fare). Add fare lock (P1) |
| **Bike + rickshaw + car (AC/non-AC tiers)** | inDrive, Yango, Bykea [S16] | Bikes and rickshaws are the volume in PK cities | Have bike/rickshaw/car. Add AC tier (P6) |
| **Parcel / courier and COD** | Bykea (parcel, cash, bill pay) [S31], inDrive courier (+57%) [S23] | Big second use case. Bykea's moat | Gap. Phase-2 product: parcel ride type with recipient phone, photo proof, COD amount. BE+App, L |
| **Intercity rides** | inDrive (200+ cities) [S9] | Long trips such as LHE–ISB | Gap. Later: scheduled intercity with seats. L |
| **SOS + 15 / Safe City integration** | Yango (Punjab Safe Cities) [S12], inDrive SOS + 5 emergency contacts [S35] | Women's safety, regulators | Gap (P4). M |
| **Share live trip link** | Uber, inDrive [S27][S35] | Families track rides; very common ask | Gap. Public web link with a short-lived token. BE+App, M |
| **Ride PIN** | Uber [S27] | Stops wrong-car pickups | Gap (P10). S–M |
| **Number masking / in-app calls** | Yango (31% fewer post-trip contacts) [S12], inDrive secure calls [S24] | Harassment after the ride is the top women's complaint | Partial: chat done, calls use real number (P3) |
| **Driver selfie / identity re-check** | Yango [S12] | Account sharing, fake drivers | Gap. M |
| **Ride insurance** | inDrive [S24] | Required by the proposed law [S17] | Gap (owner/commercial) |
| **AI moderation / auto-bans for abusive users** | inDrive (30-day bans) [S24] | Driver safety too | Gap. Rule-based strikes first. M |
| **Two-way rating** | All | Basic | Have (T-505) |
| **In-ride chat** | All | Basic | Have (T-510) |
| **Live tracking** | All | Basic | Have (T-517) |
| **Wallet top-up (JazzCash/Easypaisa)** | inDrive drivers [S36] | Paying commission dues | In progress (T-515/BE-74) |
| **Promos, referrals** | All | Acquisition | Partial (banners BE-10, referrals exist) |
| **Scheduled rides** | Careem (historically) **(unverified)** | Airport and early-morning trips | Gap. M |
| **Women-only option** | SheDrives [S28] | Real demand | Gap. Start with a "female passenger safety mode" (P3d). Women drivers later. L |

## 4. Top 15 for a Pakistan launch (ranked by impact)

Ranking weighs how often the pain shows up, how much it drives switching, and our ability to ship it with today's stack (fixed server fare, cash, wallet, chat, tracking, rating).

| Rank | Item | Solves | Who | Side | Effort |
|---|---|---|---|---|---|
| 1 | **Fare lock + "asked for more" one-tap report + strikes** | P1, P8 | P+D | BE+App+Ops | M |
| 2 | **Number masking: in-app/proxied calls, contact closes after the ride** | P3, P5 | P+D | BE+App | M–L |
| 3 | **SOS (15 + emergency contacts + Ops alert) and share-live-trip link** | P4, P11 | P | BE+App+Ops | M |
| 4 | **Fuel-indexed, admin-editable rate card (BE-60) with in-app notice** | D1, P8 | D+P | BE+Ops+App | S–M |
| 5 | **Transparent low commission: per-ride fare → commission → net, statements, grace on dues** | D3, D8 | D | BE+App | S–M |
| 6 | **Cancellation fairness: driver cancel fee + waiting fee; driver cancel-rate penalties + auto re-match** | P2, D4 | P+D | BE+App | M |
| 7 | **Ride PIN + driver selfie check on going online** | P10, P3 | P | BE+App | M |
| 8 | **24/7 support with SLA: urgent line, in-app tickets, lost-item flow** | P4, P5, D5 | P+D | Ops+App+BE | M |
| 9 | **Offer-your-fare within a band (inDrive parity without haggling)** | Table stakes | P+D | BE+App | M |
| 10 | **Women's safety mode + zero-tolerance fast-track reports** | P3 | P | BE+App+Ops | M |
| 11 | **AC tier + "AC not working" refund + vehicle year/photo checks** | P6 | P+D | BE+App+Ops | S–M |
| 12 | **Transparent strike ledger + appeal flow for drivers** | D6 | D | BE+App+Ops | M |
| 13 | **Pickup accuracy: pin adjust, landmark/pickup note, saved places** | P7, P2 | P | App+BE | S |
| 14 | **Urdu (RTL) + Roman Urdu, light data mode for low-end Android** | X2, D10 | P+D | App | M |
| 15 | **Anti-fraud: rank-title blocks, money-request warnings in chat, route deviation and speed flags** | D7, P11, P12 | P+D | BE+App | S–M |

Next after launch: parcel/COD (Bykea parity), intercity, scheduled rides, ride insurance, women drivers, regulatory compliance fields (permit no., police verification, data export, X1). Build X1 before any province enforces Section 44B-style permits.

## 5. Positioning summary

- **Against inDrive:** "Fair price, no haggling, no surprises." Fare lock, plus an optional offer within a band.
- **Against Yango:** "The price you see is the price you pay, and someone answers when you call." Overcharge reports and a support SLA.
- **Against Bykea:** match on bikes and rickshaws now, and on parcel/COD later.
- **Against Drivver:** compete on safety and driver fairness (strikes, appeals, fuel-indexed fares). Ask the owner about telco data deals.
- **For drivers:** fuel-indexed rates, published low commission, paid cancellations, fair appeals.

## 6. Sources

Dates are publication dates as shown on the page. "n.d." means no date found.

| ID | Source | Date |
|---|---|---|
| S1 | APP, "Pakistan's ride hailing services: A cycle of promises and disappointments", https://www.app.com.pk/?p=1021861 | 2026-06-21 |
| S2 | Lok Sujag, "Rising concerns: Women's safety and accountability in Pakistan's ride-hailing landscape", https://loksujag.com/story/online-cab-service-women-safety | 2023-08-30 |
| S3 | Daily Pakistan, inDrive passenger loses passport/cash, https://en.dailypakistan.com.pk/29-Dec-2025/indrive-ride-turns-nightmare-as-passenger-reports-missing-passport-cash | 2025-12-29 |
| S4 | Daily Pakistan, inDrive rider arrested for harassing schoolgirl in Lahore, https://en.dailypakistan.com.pk/03-Dec-2025/indrive-safety-in-question-as-rider-arrested-for-harassing-schoolgirl-in-lahore | 2025-12-03 |
| S5 | TechJuice, inDrive sexual misconduct case, Islamabad, https://www.techjuice.pk/indrive-sexual-misconduct-case-sparks-outrage-after-islamabad-incident/ | n.d. (2025, unverified) |
| S6 | Daily Pakistan, inDrive rider disappears with food worth Rs45,000, https://en.dailypakistan.com.pk/09-Aug-2025/indrive-rider-disappears-with-food-worth-rs45000-in-lahore | 2025-08-09 |
| S7 | Rest of World, Careem vs inDrive in Pakistan, https://restofworld.org/2024/careem-indrive-pakistan/ | 2024-06-04 |
| S8 | Daily Pakistan, inDrive/Bykea fares jump amid petrol price hike, https://en.dailypakistan.com.pk/04-Apr-2026/indrive-bykea-fares-jump-higher-as-riders-struggle-to-survive-amid-petrol-price-hike | 2026-04-04 |
| S9 | Express Tribune, "Car shortage stifles ride-hailing", https://tribune.com.pk/story/2627651/car-shortage-stifles-ride-hailing | 2026-09-06 |
| S10 | Asia News Network, rising fuel costs and Karachi ride-hailing captains, https://asianews.network/?p=266161 | 2026-04-02 |
| S11 | ProPakistani, inDrive scam warning, 80,000 accounts blocked, https://propakistani.pk/2026/02/18/indrive-scam-warning-victims-lost-over-rs-30000-as-80000-accounts-get-blocked/amp/ ; Profit, https://profit.pakistantoday.com.pk/2026/02/17/action-taken-against-scammers-impersonating-military-officers-to-defraud-indriver-courier-delivery-riders/ | 2026-02-17/18 |
| S11a | Search summary on inDrive driver support waits of 30–40 min (source page not opened) | unverified |
| S12 | ProPakistani, Yango Ride safety report (31% fewer post-trip contacts in PK), https://propakistani.pk/2026/09/05/yango-ride-reports-global-safety-progress-including-31-decline-in-post-trip-contacts-in-pakistan/amp/ | 2026-09-05 |
| S13 | Daily Pakistan, Yango's response to recent complaints, https://en.dailypakistan.com.pk/11-Mar-2025/yangos-response-to-recent-complaints | 2025-03-11 |
| S14 | Unstar.app, "Is inDrive legit & safe? What reviews say (2026)", https://unstar.app/blog/is-indrive-legit-safe-ride-hailing-app-reviews-2026 (editorial rough shares of 1–3 star store reviews) | 2026-07-10 |
| S15 | Trustpilot, Yango reviews (PK reviews 2026-09-04, 2026-09-19), https://nl.trustpilot.com/review/yango.com | 2026-09 |
| S15b | Trustpilot, Bykea reviews (13 reviews, small sample), https://nz.trustpilot.com/review/bykea.com | 2023–2026 |
| S16 | Bento Travel, ride-hailing in Pakistan guide, https://www.bento.travel/pakistan/ride-hailing | n.d. (post Jul 2025) |
| S17 | Digital Rights Monitor, Pakistan ride-hailing regulation bill 2025, https://digitalrightsmonitor.pk/pakistan-ride-hailing-regulation-bill-2025/ | 2025-07-30 |
| S18 | ProPakistani, ride-hailing companies reject district-based permits in Punjab, https://propakistani.pk/2026/07/28/ride-hailing-companies-reject-district-based-permit-system-in-punjab/ | 2026-07-28 |
| S19 | Daily Pakistan, Careem suspends ride-hailing in Pakistan, https://en.dailypakistan.com.pk/18-Jun-2025/careem-suspends-ride-hailing-service-in-pakistan ; Dawn, https://www.dawn.com/news/amp/1917884 | 2025-06-18 |
| S20 | Express Tribune, "Uber quits Pakistani market", https://tribune.com.pk/story/2464707/uber-quits-pakistani-market | 2024 |
| S21 | Profit, Swvl shuts Pakistan operations, https://profit.pakistantoday.com.pk/2022/11/24/mobility-startup-swvl-shuts-operations-in-pakistan-its-second-biggest-market/ | 2022-11-24 |
| S22 | Synergyzer, inDrive waives commission in Karachi, https://synergyzer.com/indrive-waives-commission-in-karachi-as-part-of-its-people-first-business-model/ | late 2025 |
| S23 | ProPakistani, inDrive top-ranked ride-hailing app on Google Play, https://propakistani.pk/2025/06/25/indrive-becomes-pakistans-top-ranked-ride-hailing-app-on-google-play-store/amp/ ; The News, https://www.thenews.pk/print/1411733-indrive-tops-ride-hailing-app-rankings-across-pakistan | 2025-06-25 |
| S24 | The News, inDrive safety workshop for Karachi drivers (insurance, AI moderation), https://www.thenews.pk/print/1424787-indrive-holds-safety-workshop-for-karachi-drivers | 2026-07-09 |
| S25 | ProPakistani, Jazz and iTecknologi launch Drivver, https://propakistani.pk/2026/09/01/jazz-and-itecknologi-partner-to-launch-drivver-a-modern-game-changing-ride-hailing-platform/amp/ | 2026-09-01 |
| S26 | Simpaisa blog, how PK ride-hailing companies pay drivers (vendor content), https://www.simpaisa.com/blogs/how-ride-hailing-companies-in-pakistan-pay-their-drivers-and-how-to-do-it-better | 2026-07-29 |
| S27 | Uber safety pages (PIN verification, RideCheck, Share My Trip), https://www.uber.com/en-AU/ride/safety/ | n.d. |
| S28 | NBC News, Pakistan's trans community gets a ride-sharing service (SheDrives), https://www.nbcnews.com/nbc-out/out-news/pakistans-transgender-community-gets-ride-sharing-service-safety-rcna170609 | 2024-09 |
| S29 | ProPakistani, Careem slashes bike commission to 15%, https://propakistani.pk/2021/11/15/careem-slashes-its-bike-commission-to-15/amp/ | 2021-11-15 |
| S30 | Search summary: Yango six-phase fare revisions in 2026 (+19–20% KHI/LHE, up to +35% ISB/RWP); source page not opened | 2026, unverified |
| S31 | ProPakistani Lens, Bykea fires riders for doxxing a Karachi client, https://propakistani.pk/lens/bykea-fires-riders-for-doxing-karachi-client-on-gay-app/ (plus Bykea service descriptions from the same search) | n.d. |
| S32 | Zameen blog, things to know before using ride-hailing apps (pickup pins), https://www.zameen.com/blog/things-know-before-using-ride-hailing-apps.html | n.d. |
| S33 | Ali Mehdi Substack, Careem Pakistan exit (market share estimates), https://alimehdi.substack.com/p/careem-pakistan-exit | 2025, unverified |
| S34 | ARY News, judicial commission directs restoration of a Bykea driver's job (Mir Raza case), https://arynews.tv/witness-penalized-for-helping-commission-directs-police-to-restore-bykea-drivers-job-and-home | n.d. |
| S35 | Search summary of inDrive safety features (safety button, up to 5 emergency contacts, trip sharing); inDrive PK app pages | n.d. |
| S36 | ProPakistani, dLocal and inDrive payments partnership in Pakistan (driver wallet top-up via JazzCash/Easypaisa), https://propakistani.pk/2024/11/05/dlocal-strengthens-partnership-with-indrive-to-redefine-payment-access-in-the-ride-hailing-sector-in-pakistan/amp/ | 2024-11-05 |

### Gaps in this research
- I did not read Reddit threads (r/pakistan, r/karachi, r/lahore, r/islamabad) or Facebook driver groups directly; search returned no usable threads. The themes above match what news and review aggregators report, but Reddit-specific frequency is not measured.
- I could not scrape Play Store and App Store reviews directly. Review themes come from the Unstar analysis [S14] and Trustpilot (small samples).
- I found no direct source on Urdu UI or data use as complaints. X2 and D10 are inferred.
