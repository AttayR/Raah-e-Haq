Proposal: “Raah-e-Haq” Ride-Hailing Mobile Application
Tech stack: React Native (iOS & Android) • Firebase (Auth, Firestore/RTDB, Cloud Functions, Storage) • Google Maps Platform • Node.js micro-APIs (where needed) • FCM/APNs for push notifications

1) Project summary
Design and build a production-grade, Pakistan-focused ride-hailing app (“Raah-e-Haq”) with separate flows for Passengers and Drivers, managed from a single codebase. I will be the sole developer responsible for end-to-end development, deployments, store submissions, backend/Firebase setup, monitoring, and support.
Commercial agreement (agreed):
Fixed fee: Rs. 2,80,000 (PKR) for v1.0 build & launch
Revenue share: 5% of monthly profit (post-launch), paid monthly
Payment terms:
50% advance to start (Rs. 140,000)


50% on pre-launch sign-off (before app store submission)



2) Scope of work (v1.0)
2.1 Core passenger features
Phone/Email/Google sign-in (Firebase Auth)


Profile & KYC basics (photo, CNIC number capture)*


Request a ride: pickup, drop-off, optional stops, ride type


Live map (Google Maps): current location, ETA, route preview


Fare estimate (distance + time formula, surge configurable)


Driver assignment: nearest/available driver notified in real time


In-ride screen: driver info, vehicle, live route progress


Ride history: completed/cancelled, receipts


Favorite places: Home, Work, custom labels


Ratings & reviews of drivers


* KYC depth can be expanded later (see roadmap).
2.2 Core driver features
Registration & verification (documents upload to Storage)


Vehicle registration (make/model/year/color/plate, photos)


Go Online/Offline toggle; new ride request notifications


Accept/Reject ride; navigation via deep link to Maps app


Earnings summary (daily/weekly), ride history


Ratings & reviews of passengers


2.3 Shared/system features
Push notifications (FCM/APNs): ride requests, status changes, receipts


Cloud Functions for: dispatch, pricing, notifications, write validation


Real-time database (Firestore or RTDB) for offers/assignments/status


Cloud Storage buckets for images/docs (drivers, vehicles, receipts)


Trip ledger: distance, duration, fare breakdown, commission field


Basic admin views (in-app utility or protected web mini-console)*


Crash & analytics instrumentation (Firebase Crashlytics/Analytics)


* Admin scope for v1.0: verify drivers/vehicles, view rides, block/unblock users. A full web dashboard can be a phase-2 add-on.
2.4 Non-functional
Clean, accessible UI for Pakistani users (Urdu-friendly layouts possible)


Configurable fare formula and commission percentage


Secured reads/writes with Firebase security rules


Store-compliant builds & privacy disclosures



3) Out of scope (for v1.0, can be added later)
Surge automation by region/time; promo codes/coupons


Advanced fraud detection; facial recognition KYC


Multi-city pricing matrices with O/D zoning


Full web admin portal with role-based access


IVR/SMS gateways beyond essential OTPs



4) Deliverables
React Native app (iOS & Android) in your org stores


Firebase project (Auth, DB, Functions, Storage, Rules) configured


Minimal Node.js APIs (only where Functions aren’t ideal)


Release artifacts: signed builds, provisioning, keystores, env files


Documentation: environment setup, deployment steps, runbooks


One admin utility (verify drivers/vehicles, view rides, block users)



5) Project plan & milestones (sequence only)
Per your request for a “timeline,” I’ll provide a milestone sequence without time estimates. Dates can be finalized jointly during kickoff.
Kickoff & accounts handover → Apple Dev, Play Console, Firebase/Cloud, Maps keys


App foundation → project scaffolding, navigation, theme, auth skeleton


Maps & location → current location, autocomplete, routing, fare calc


Passenger flows → request ride, favorite places, trip view


Driver flows → registration, vehicle docs, go online, accept rides


Dispatch logic → nearby drivers, notifications, assignment, fallbacks


Trip lifecycle → start/complete/cancel, logs, receipts, ratings


Admin utility → verify drivers/vehicles, user management


Hardening → rules, tests, analytics, crash fixes, store compliance


UAT & content → policies, screenshots, store listings


Submission → App Store + Play Store review


Launch → production config, monitoring



6) Commercials & third-party costs (client-owned)
These are typical charges; actual billing depends on your usage and region. You will own and pay these vendors directly.
Apple Developer Program: ~USD 99/year


Google Play Console: USD 25 one-time


Google Maps Platform: pay-as-you-go (monthly free credits, then per-call; budgeting & quotas will be set to prevent surprises)


Firebase:


Free tier covers a lot; Blaze pay-as-you-go recommended for production


Cloud Functions, Firestore/RTDB, Storage billed per usage


Auth (OTP/email) may incur SMS/email costs via provider (if used)


Domain/Email (if needed for admin portal/support): per your registrar


Crash/analytics (Firebase included); optional extras (e.g., Sentry) if desired



7) Engagement model
Single developer (me) handling: architecture, coding, infra, CI/CD, provisioning, submissions, and production monitoring.


Communication: WhatsApp/Slack + weekly check-ins; shared Kanban board.


Code repo: Your private GitHub/Bitbucket (client-owned).


Environments: Dev → Staging → Production.



8) Payment schedule
50% advance (Rs. 140,000) to begin


50% pre-launch upon UAT sign-off & store submission


5% monthly profit share after launch (payable within 10 days of month-end; simple report of revenue − direct platform fees = profit)



9) Acceptance criteria (samples)
Registration & KYC: Driver submits required documents; admin can approve/reject; approved drivers can go online.


Ride request: Passenger selects pickup/drop; receives fare estimate; on confirm, a nearby online driver receives a push notification.


Assignment: First driver to accept is locked; passenger sees driver ETA and live map; others get auto-cancel.


Trip ledger: Distance/time captured; fare computed by configured formula; receipt saved; both parties can rate each other.


Favorite places: Passenger can add/edit/delete; quick select works on request screen.


History: Both roles can view past trips with details and receipts.



10) Assumptions
You will provide store accounts, legal policies (Terms/Privacy), and brand assets (logo/colors). I can draft basic policies if needed.


CNIC/vehicle verification in v1.0 is document-based (manual admin review).


Google Maps keys, Firebase project, billing accounts will be client-owned.


Profit calculation basis and proof will be mutually defined (simple monthly sheet).



11) Change requests & enhancements
Any feature not listed in the v1.0 scope will be handled via a change request with a fixed mini-quote. Post-launch roadmap can include digital payments, promo codes, city zoning, and a full web admin portal.



12) Maintenance & support
30 days post-launch warranty: bug fixes for v1.0 scope.


Optional monthly support retainer (recommended): incident response, OS/SDK updates, monitoring, and minor enhancements (quote on request).



13) Data protection & security
Firebase Security Rules enforcing least privilege


Secure storage of tokens; no secrets in client app


Encrypted transport (HTTPS/TLS)


Role-based admin actions; audit logs for critical ops



14) Intellectual property
On full payment, source code and IP for the v1.0 deliverables transfer to the client, excluding open-source libraries and my generic internal templates/boilerplate.



15) Risks & mitigations
Store review rejections: Mitigated via compliance checklist, accurate privacy disclosures, realistic demo accounts.


Maps/usage overruns: Quotas and budget alerts configured from day one.


Device/location variance: Broad device testing and graceful fallbacks.


Single-developer bandwidth: Clear milestone plan, frequent demos, and code in your repo to ensure transparency.



Acceptance
If this proposal meets your expectations, I’ll share an MoU/SoW reflecting the above (scope, deliverables, payment, IP, profit share) and we’ll begin immediately after the advance is received and the required accounts/keys are provisioned.
Would you like me to also draft the MoU/SoW and a basic Terms/Privacy set tailored for the stores?

