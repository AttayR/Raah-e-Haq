# Shared · Help & support, Invite friends, Delete account (both roles)

- **Tasks:** UI-R18 (absorbs T-619 and the app half of T-511's support / invite / deletion items). Backend: **BE-129** (account deletion, new), **BE-130** (support + legal contract, extends BE-17), **BE-131** (invite programme contract, new). Each block below says what ships before its BE task and what waits for it.
- **Routes (new, both stacks):** `Support` (Help & support) → `SupportRequests` (all requests) → `SupportTicket` (`{ id }`) and `SupportNewRequest` (`{ rideId?, category? }`); `Invite`; `DeleteAccount` → `DeleteAccountVerify`. Entry points: Account "Help" group (shared-settings §6), Profile "Delete account" (shared-profile §P6), ride details / trip receipt "Get help with this ride" (shared-ride-details 7, passenger-trip-complete 7) → `SupportNewRequest { rideId }`, a support-reply push (`type: support`, BE-130) → `SupportTicket`. Auth stack: `AccountRestore` (§D4).
- **Code (new):** `src/features/support/` (api, hooks, screens, copy), `src/features/invite/`, `src/features/account-deletion/`. Reuse `src/features/chat` bubble and composer components for the ticket thread (no fork).
- **Revision:** 2026-10-20 (UI-R18 spec; supersedes the 2026-10-08 version). Archetypes: Help = **List**, Requests = **List**, New request = **Form**, Ticket = chat-thread pattern (shared-chat-thread), Invite = **Detail**, Delete account = **Detail** then **Form**.
- **Before:** none of these screens exists in the app today (no route in `PassengerStack.tsx` / `DriverStack.tsx`). The only support surface is the account-status "Contact support" sheet (`SupportContactSheet.tsx`, email from `src/config/support.ts`, phone hidden "until GET /settings/public has one" although the server already sends `support_phone`).

## 0. Backend facts checked (2026-10-20, `~/My-Projects/Raah-e-Haq-backend` `fix/production-hardening`)

| Need | Today | Gap → task |
|---|---|---|
| Support contacts | `GET /settings/public` returns an **array of rows** `{ key, value, type }` incl. `support_email`, `support_phone` (seeded, public) | no `terms_url`, `privacy_url`, `support_whatsapp`, `support_hours`, `account_deletion_url` → **BE-130 (e)** |
| Tickets | `GET /support/tickets` (own only for non-admins, paginated 20), `GET /support/tickets/{id}` (replies, internal hidden), `POST /support/tickets` `{ subject ≤255, description, category?, priority?, metadata? }`, `POST …/{id}/reply` `{ message }`; statuses `open`, `in_progress`, `pending_customer`, `resolved`, `closed`; `TicketResource`: `id`, `ticket_number`, `subject`, `description`, `category`, `status`, `created_at`, `resolved_at`, `closed_at`, `replies[]` (`message`, `author_role`, `created_at`) | no `updated_at` / `last_reply_at` / who replied last / unread; no `ride_id` (only free `metadata`); `category` not validated; no length caps on description/message; no throttle on create/reply; reply allowed on a closed ticket; `assigned_to` returns the admin's full `UserResource` (email, phone) to the customer; no push on a support reply → **BE-130 (a)–(d), (g)** |
| Topics | `GET /support/categories` (active, `sort_order`): `name`, `slug` (`technical`, `billing`, `account`, `ride_issue`, `driver_issue`, `general`, `complaint`, `suggestion`), `description`, `icon`, `color` | names English only; no audience (riders see "Driver Issues") → **BE-130 (c)**; the app ignores `icon`/`color` (no server colours) and maps `slug` → glyph + i18n label |
| Referral code | `GET /referrals/code/mine` → `referral_code` (stable, `ensureReferralCode`), `referral_url` = `{api host}/register?ref=…` (the **web** admin-side register page, useless to a rider) | no programme/reward info, no share URL → **BE-131** |
| Referral stats | `GET /referrals/stats` → `total_referrals`, `completed_referrals`, `pending_referrals`, `total_rewards`, `level_1..3_referrals` | usable now; BE-131 confirms `total_rewards` is the credited amount |
| Redeem | `POST /auth/register` accepts `referral_code` (normalised, must exist on an active user) | the app's registration has **no field** for it → this task (§I4) |
| Delete account | **No self-service endpoint.** `DELETE /profile` (BE-15 plan) was never built; only admin `DELETE /api/users/{id}` and the web Breeze profile delete, both via `AccountDeletion` (hard delete, refused 409 when the user has wallet history) | no OTP re-auth, no cooling-off, no anonymisation (hard delete is refused for most real users), no restore, no web deletion page (Google Play requires one) → **BE-129** |

## H. Help & support

### H1. Help screen (`Support`)

`Screen` edges top+bottom · `Header standard` "Help & support" / "Madad aur support" · `ScrollView` with pull to refresh (re-reads requests and public settings) · padding 16 / 8 top / 32 bottom, sections 24 apart.

1. **Last trip** (both roles; hidden when the user has no rides): `overline` "GET HELP WITH A TRIP" / "TRIP KE BAARE MEIN MADAD" → 8 → pressable `Card` (padding 16) built from the newest ride of `useRecentRides(1)` (the existing Home hook, GET `/rides?page=1&per_page=1`, shared cache): top row `caption` `textMuted` date ("Today · 8:22 AM", §2 date rules) + status pill only when not completed (5.24); `AddressPair density="compact"` (M1 dropoff square); bottom row `numeric` fare `formatMoney` start + `chevronEnd` 20 end. Tap → `SupportNewRequest { rideId }`. Under the card, 8 gap, ghost Button `sm` start-aligned "Choose another trip" / "Koi aur trip chunein" → Activity › Rides (passenger) / `RideHistory` (driver) (each ride's details has "Get help with this ride").
2. **Topics**: `overline` "TOPICS" / "MAUZOO" → `ListGroup` of rows from `GET /support/categories` filtered by `audience` [BE-130 c; until then: hide `driver_issue` for passengers]: 40 tile glyph by slug (`ride_issue` `car`, `billing` `cash`, `account` `account`, `driver_issue` `steering`, `technical` `smartphone`, `complaint` `report`, `suggestion` `chat`, `general` `help`, unknown `help`), title `body` from i18n by slug, falling back to the server `name`; chevron. Tap → `SupportNewRequest { category: slug }`. Loading: 4 skeleton rows 64. Failed: the group is replaced by one row "Write to us" / "Humein likhein" (`chat`) → `SupportNewRequest` without a topic.
3. **Your requests**: header row: `overline` "YOUR REQUESTS" / "AAP KI REQUESTS" start + ghost Button `sm` "New request" / "Nayi request" end (`add` 16), aligned on the overline baseline. → 8 → `ListGroup` with the 3 newest tickets (rows §H2) and, when `total > 3`, a last row "See all requests" / "Saari requests dekhein" (no tile, `primaryText` `body`, chevron) → `SupportRequests`. Empty: compact EmptyState inside a Card (`chat` glyph, "No requests yet" / "Abhi koi request nahi", body "When you write to us, our replies show here." / "Jab aap humein likhenge, hamare jawab yahan aayenge.", no action: the header button is the action). Error: compact ErrorState "Couldn't load your requests" + "Try again".
4. **Contact us**: `overline` "CONTACT US" / "RABTA KAREIN" → `ListGroup`, rows only for values present in `GET /settings/public`:
   - "Call support" / "Support ko call karein" (`phone`), subtitle formatted `support_phone`, → `tel:` (digits only).
   - "WhatsApp" (`chat`), subtitle the number, → `https://wa.me/{digits}` [BE-130 e, `support_whatsapp`].
   - "Email support" / "Support ko email karein" (`email`), subtitle `support_email`, → `mailto:` with subject "Raah-e-Haq support" and no personal data in the URL.
   - `caption` `textSecondary` row helper under the group: `support_hours` text when sent [BE-130 e].
   - `src/config/support.ts` becomes the offline fallback only (email), used when public settings never loaded; the account-status sheet switches to the same hook so both show the phone.
5. **Emergency** (always, last, never hidden): `ListGroup` with one row: 40 tile `dangerSoft` + `police` glyph `danger`, title `body` "Emergency? Call Police 15" / "Emergency? Police 15 par call karein", subtitle `bodySmall` "Rescue 1122" / "Rescue 1122", trailing `phone` 20 `danger`. Tap → `tel:15` directly (no dialog; the OS call sheet confirms on iOS). Numbers from `FALLBACK_EMERGENCY_NUMBERS` (`src/config/safety.ts`).

Measurements (iPhone 17, Ali with rides and 2 tickets): header 62–118 · overline 126–142 · trip card 150–298 (padding 16 + meta 16 + 8 + compact AddressPair 2 × 32 + 8 + bottom row 20 + padding 16 = 148) · "Choose another trip" 306–342 · Topics overline 366–382, 8 rows × 64 = 512 → 390–902 (scrolls). Topics come before requests on purpose: a first-time user's next step is a topic; a returning user with an open ticket gets the push and lands on the ticket directly.

### H2. Ticket row (Help and Requests)

`ListItem variant="content"` (min 72): leading 40 tile glyph by `category` slug (same map), title `title` `subject` 1 line; subtitle `bodySmall` `textSecondary` 1 line: last message preview [BE-130 a `last_reply_preview`; until then `description`]; meta `caption` `textMuted` "#{ticket_number} · {updated relative date}" (`last_reply_at` [BE-130 a] else `created_at`); trailing status pill (Badge status 24):

| `status` | Pill en / ur-Latn | Tone |
|---|---|---|
| `open` | Open / Khuli | info |
| `in_progress` | In progress / Jari hai | info |
| `pending_customer` | Waiting for you / Aap ka jawab chahiye | warning |
| `resolved` | Solved / Hal ho gayi | success |
| `closed` | Closed / Band | neutral |
| unknown | the raw status, sentence case | neutral |

Unread support reply [BE-130 a `unread`]: title 600 → stays `title` (already 600) and an 8 `primary` dot before the pill (§12.4 unread rule). Tap → `SupportTicket { id }`.

### H3. All requests (`SupportRequests`)

`Header standard` "Your requests" / "Aap ki requests" with trailing IconButton `add` "New request". `FlatList` of §H2 rows inside one grouped card per page section (`ListGroup` styling, radius 16), paged by the server's 20 (`page`), `onEndReachedThreshold 0.5`, footer spinner row 56 while loading more, "That's all your requests." / "Ye aap ki saari requests hain." `caption` `textMuted` centred at the end. Pull to refresh. Empty / error as §H1.3 at full size (EmptyState §5.19 with "New request" `secondary` action).

### H4. New request (`SupportNewRequest`, Form)

`Screen keyboardAvoiding` + `KeyboardAwareScrollView` · `Header standard` "New request" / "Nayi request", back with discard Dialog when any field is filled ("Discard this request?" / "Ye request chhor dein?", "Keep writing" / "Likhte rahein", "Discard" / "Chhor dein") · sticky footer `primary lg` "Send request" / "Request bhejein" (disabled until valid; loading keeps width).

1. 8: `FieldLabel` "Topic" / "Mauzoo" → 6 → single-select Chip row (horizontal scroll, one line, §5.11) of categories (same filter and labels as H1.2), preselected from params; required.
2. 16 (when `rideId`): `FieldLabel` "Trip" / "Trip" → 6 → `Card` row: compact AddressPair + date `caption`, trailing IconButton `close` "Remove trip" / "Trip hata dein". Sent as `ride_id` [BE-130 b]; until BE-130 it goes in `metadata.ride_id` and the subject is prefixed by nothing (no ride ID text in the user's subject).
3. 16: TextField "Subject" / "Mauzoo ka unwan", max 120, counter hidden until 100.
4. 16: TextField multiline "What happened?" / "Kya hua?", placeholder "Tell us what happened and when. Don't share card numbers or passwords." / "Batayein kya hua aur kab. Card number ya password na likhein.", min 10, max 2000 [BE-130 d caps], counter `caption` `textMuted` "{n}/2000" end-aligned under the field, iOS `KeyboardDoneBar`.
5. Errors: server 422 per field under its control; network/500: danger Banner above the footer region with "Try again" (`actionPlacement below`); 429 [BE-130 d]: warning Banner "You've sent several requests. Try again in {minutes} min." / "Aap kai requests bhej chuke hain. {minutes} min baad koshish karein." from `retry_after`.
6. Success: `navigation.replace('SupportTicket', { id })` + Toast success "Request sent. We'll reply here." / "Request bhej di gayi. Hum yahin jawab denge." Haptic `notificationSuccess`.

### H5. Ticket thread (`SupportTicket`)

Same structure as shared-chat-thread (bubbles, day separators, composer, closed bar). Differences:
- `Header standard`: title = `subject` (1 line, tail ellipsis); no call action.
- **Summary card** at the top of the list (not sticky): `Card` padding 16: row 1 `caption` `textMuted` "#{ticket_number} · {created date}" + status pill end; row 2 (when a ride is linked) compact AddressPair, tap → RideDetails; row 3 `caption` `textSecondary` topic label.
- First bubble = the ticket `description` from me. Replies: `author_role` `admin`/`support` → support bubble (`surface`, leading 32 brand badge: logo on `surface` circle, sender line `caption` `textMuted` "Raah-e-Haq support" / "Raah-e-Haq support"); mine → `primary` bubble with `onPrimary` text. Never show an agent's email or phone (BE-130 g strips them server-side too).
- Composer while status is not `closed`; `resolved` shows an info Banner above the composer "Marked as solved. Reply if you still need help." / "Hal shuda. Agar ab bhi madad chahiye to jawab dein." (a reply reopens it, BE-130 b). `closed`: the closed bar "This request is closed. Start a new one if you need help." / "Ye request band hai. Madad ke liye nayi request banayein." with ghost `sm` "New request".
- Refresh: on focus, pull to refresh, and on a support push for this ticket. **No polling** (support replies are minutes apart; the push covers it).
- Send failure: the bubble stays with a `failed` glyph and "Tap to retry" `caption` `danger` (chat-thread pattern).

## I. Invite friends

### I1. Data

| Source | Field | Used for | Until the BE task ships |
|---|---|---|---|
| `GET /referrals/code/mine` | `referral_code` | Code row | — |
| **BE-131** same response | `share_url` (store/landing link, null until the owner sets it), `programme { active, referrer_reward, referee_reward, currency, reward_type, min_rides, expires_days }` | Card title/description, How it works step 3, share text link | No amounts anywhere; generic copy; no link in the share text |
| `GET /referrals/stats` | `total_referrals`, `completed_referrals`, `total_rewards` | Your invites strip | shown (endpoint exists); `total_rewards` cell hidden until BE-131 confirms it |

`programme.active === false` (BE-131): the screen shows the code and Share (friends can still be credited as referrers for later) but the card title becomes "Invite friends to Raah-e-Haq" and no reward line or step 3.

### I2. Layout (`Invite`, Detail)

`Screen` edges top+bottom · `Header standard` "Invite friends" / "Doston ko invite karein" · `ScrollView` padding 16 / 16 top / 32 bottom.

1. **Invite card** (kit `PromoCard kind="invite"`, M5): `accentSoft` fill, 40 `accent` disc with the `gift` 24 `onAccent` glyph, padding 16, radius 16.
   - Title `title` `textPrimary` (2 lines): with a reward: "Get {formatMoney(referrer_reward)} for each friend who rides" / "Har dost ki pehli ride par {amount} payein"; without: "Invite friends to Raah-e-Haq" / "Doston ko Raah-e-Haq par bulayein".
   - Description `bodySmall` `textSecondary`: with `referee_reward`: "Your friend gets {amount} off their first ride." / "Aap ke dost ko pehli ride par {amount} ki chhoot milegi."; without: "Share your code. Your friend enters it when they sign up." / "Apna code share karein. Dost sign up karte waqt ye code likhe."
   - `reward_type === 'ride_credit'` adds " Credit goes to your wallet." / " Raqam aap ke wallet mein aayegi." (cash-only rides: say where the reward lands, never "cash").
   - **Code row** (children), 12 below the text: height 56, radius 12, fill `surface`, 1 pt `border`, padding 16 start / 4 end, `flexDirection row`, `alignItems center`: code `numericL` (22/28/700) `textPrimary`, letter-spacing 2, `selectable` (long-press copy works without the clipboard module), `flex 1`; IconButton `tonal` `copy` (`content-copy`, add `copy` to `icons.ts`) 44, a11y "Copy code {code spelled}" → `@react-native-clipboard/clipboard` `setString` (new dependency, native, ~10 kB; add pods) → Toast success "Code copied" / "Code copy ho gaya", haptic `selection`. The glyph stays navy `primaryText` on `surfaceAlt` (DESIGN_SYSTEM §1.8: the disc is the card's one saffron element).
   - **Kit delta:** `PromoCard` without `onPress` sets `accessible` on its container, which hides the Copy button from VoiceOver. Add `accessible={false}` when `children` contain controls (prop `childrenInteractive`), and give the text block its own accessible group.
2. 16: `primary lg` Button "Share invite" / "Invite share karein" (`share` leading) → `Share.share({ message })`, message in the sender's locale:
   - en: "Ride with me on Raah-e-Haq: fixed fares, pay cash. Use my code {code} when you sign up.{ share_url ? ' ' + share_url : '' }"
   - ur-Latn: "Raah-e-Haq par sawari karein: tay shuda kiraya, cash payment. Sign up par mera code {code} likhein.{ link }"
   No haptic (opens a system sheet).
3. 24: **How it works**: `overline` "HOW IT WORKS" / "YE KAISE KAAM KARTA HAI" → 8 → `Card` with 2 or 3 numbered rows (min 56, padding 12/16): leading 32 circle `primarySoft` with `numericSmall` `onPrimarySoft` "1/2/3", 12 gap, `body` text:
   1. "Share your code with a friend." / "Apna code dost ko bhejein."
   2. "They sign up with your code." / "Dost aap ke code se sign up kare."
   3. (reward only) "After their first {min_rides > 1 ? '{n} rides' : 'ride'}, you get {referrer_reward}." / "Un ki pehli {ride / n rides} ke baad aap ko {amount} milenge." + `expires_days` → `caption` `textMuted` "Rewards expire after {n} days." / "Inaam {n} din baad khatam ho jata hai."
4. 24 (when `total_referrals > 0`): **Your invites**: `overline` "YOUR INVITES" / "AAP KE INVITES" → 8 → strip `Card` (same anatomy as shared-profile §P3, 78 high): "Joined" / "Shamil hue" `total_referrals` · "Took a ride" / "Ride ki" `completed_referrals` · "Earned" / "Kamaya" `formatMoney(total_rewards)` [BE-131; 2 cells until then]. Hidden at zero (no "0 · 0 · Rs 0" wall for a new user).

States: **loading** (code request): card with the real title/description skeleton (2 lines) and a 56 skeleton code row; Share disabled (`fillDisabled`). **Error**: the card is replaced by ErrorState "Couldn't get your code" / "Aap ka code nahi mil saka" + "Try again"; Share hidden. **Offline**: cached code shows (cache the code in storage after the first load: it never changes) and Share still works; without cache → ErrorState with the network glyph. **SE**: code row 375 − 32 − 32 − 40 − 16 = 255 wide content column → code text column ≈ 191, `numericL` 8 chars at letter-spacing 2 ≈ 140 pt: fits. **1.3x**: code `maxFontSizeMultiplier 1.2` (one line always, it is the thing people read aloud); title wraps.

### I3. Low literacy (invite)

- One big thing to press (Share), one code shown large with spacing, numbers in the steps. The reward amount is a money number, not a percent.
- The code is read out by VoiceOver character by character ("R, 7, K, …") via `accessibilityLabel` built from the spaced code.

### I4. Redeem at sign-up (patch to `auth-registration.md` Step 1)

At the end of Step 1 (both roles), 16 below the last field: ghost Button `sm` start-aligned "Have an invite code?" / "Invite code hai?" (`gift` 16). Tap reveals (250 ms height + fade; instant with Reduce Motion) a TextField "Invite code (optional)" / "Invite code (ikhtiyari)", `autoCapitalize characters`, `autoCorrect false`, max 20, sent as `referral_code`. 422 `referral_code` → field error "This invite code isn't valid. Check it, or leave it empty." / "Ye invite code sahi nahi. Check karein ya khaali chhor dein." Never blocks Continue when empty. (Deep links that prefill the code from `share_url?ref=` are out of scope until app links exist.)

## D. Delete account (store-compliant)

Store rules this meets: App Store Review Guideline 5.1.1(v) (in-app initiation of deletion, not just deactivation; easy to find), Google Play User Data policy (in-app path **and** a web link, data deletion explained, retained data disclosed). The web page and the Play Console "Data deletion" URL are BE-129 + an owner action (Play Console).

### D0. Contract (BE-129)

| Call | Returns / does |
|---|---|
| `GET /account/deletion` | `state` (`none` / `scheduled`), `scheduled_for` (ISO, null when none), `scheduled_for_if_now` (ISO: the date a request made now would get), `grace_days` (int, config, default 30), `retention_years` (int, config), `erase` (string keys, e.g. `profile`, `photo`, `phone_email`, `saved_places`, `emergency_contacts`, `documents`, `vehicle_photos`, `chats`, `devices`, `notifications`), `keep` (keys: `trips`, `payments`, `safety_reports`, `support_requests`, `ratings`), `blockers[]` (`{ code: 'ACTIVE_RIDE' }`, `{ code: 'COMMISSION_OWED', amount, currency }`), `wallet_balance` + `currency` (forfeited credit when > 0), `phone_masked` (`+92 3•• •••• 001`) |
| `POST /account/deletion/code` | sends a 6-digit OTP to the verified phone; `{ expires_in, retry_after, phone_masked }`; 429 with `retry_after` |
| `POST /account/deletion` `{ code, reason?, acknowledge_balance? }` | 200 `{ scheduled_for }`: revokes every token, sets a driver offline, hides the account from dispatch and booking for the grace period; 422 wrong/expired code; 409 `ACTIVE_RIDE` / `COMMISSION_OWED`; 422 `acknowledge_balance` required when `wallet_balance > 0` |
| `POST /account/deletion/cancel` | (signed in during grace) restores; 200 |
| Sign-in during grace | normal sign-in succeeds; `ProfileResource.deletion_scheduled_for` is set; the app shows §D4 before any tab |

The app renders the erase/keep lists **from these keys** (known keys → i18n line; unknown keys ignored), so the copy always matches what the server actually does. It never computes the deletion date itself.

### D1. "Delete account" (`DeleteAccount`, Detail)

`Screen` edges top+bottom · `Header standard` "Delete account" / "Account delete karein" · `ScrollView` padding 16 / 16 top · sticky footer (16 top padding, `max(insets.bottom + 8, 16)`): `destructive lg` "Continue" / "Aage barhein" (disabled `fillDisabled` while loading, blocked, or the balance box unchecked), 8 gap, `ghost lg` "Keep my account" / "Account rakhein" (pops).

1. Icon disc 64 `dangerSoft` with `accountRemove` 32 `danger`, start-aligned → 16 → `h2` "Delete your account?" / "Apna account delete karna hai?" → 8 → `body` `textSecondary`: "Your account closes now and is deleted for good on {scheduled date}. Sign in before then if you change your mind." / "Aap ka account abhi band ho jayega aur {date} ko hamesha ke liye delete ho jayega. Is se pehle sign in kar ke aap ise wapas la sakte hain." The date is the server's `scheduled_for_if_now`, formatted with the §2 date rules; the app never adds `grace_days` itself. The whole of §D needs BE-129: until it ships, the Profile row is not rendered (never a row that opens nothing).
2. 16: **Blockers** (each a Banner `actionPlacement below`, 8 apart): `ACTIVE_RIDE` danger "Finish or cancel your current ride first." / "Pehle apni maujooda ride khatam ya cancel karein." action "Go to ride" / "Ride par jayein"; `COMMISSION_OWED` warning "Pay the {amount} you owe before deleting your account." / "Account delete karne se pehle apna {amount} baqaya ada karein." action "Pay now" / "Abhi ada karein" → `PayCommission`. Any blocker disables Continue.
3. 24: `overline` "WHAT WE DELETE" / "HUM KYA DELETE KARENGE" → 8 → `Card` of rows (min 44, padding 12/16, leading 20 `delete` glyph `textSecondary`, 12 gap, `body` `textPrimary`) one per `erase` key:

| Key | en | ur-Latn |
|---|---|---|
| `profile` | Your name, photo and profile details | Aap ka naam, photo aur profile ki maloomat |
| `phone_email` | Your phone number and email | Aap ka phone number aur email |
| `saved_places` | Saved places | Save ki hui jaghein |
| `emergency_contacts` | Emergency contacts | Emergency contacts |
| `documents` | Your CNIC and licence photos | Aap ke CNIC aur licence ki photos |
| `vehicle_photos` | Vehicle photos and papers | Gaari ki photos aur kaghzaat |
| `chats` | Messages with drivers and riders | Drivers aur sawariyon se messages |
| `devices` / `notifications` | Notification settings and devices | Notification settings aur devices |

4. 24: `overline` "WHAT WE KEEP" / "HUM KYA RAKHENGE" → 8 → `Card` rows with leading `lock` 20: one per `keep` key (`trips` "Trip records", `payments` "Payment and wallet records", `safety_reports` "Safety reports", `support_requests` "Support requests", `ratings` "Ratings you gave and got"; ur-Latn "Trips ka record", "Payment aur wallet ka record", "Hifazati reports", "Support requests", "Di aur mili ratings"), then 8 → `caption` `textSecondary` row helper: "We keep these for {retention_years} years because the law requires it, without your name, number or photo." / "Qanoon ki wajah se hum inhein {n} saal tak rakhte hain, aap ke naam, number ya photo ke baghair."
5. 24 (when `wallet_balance > 0`): warning `Banner` "Your wallet balance of {formatMoney} will be lost." / "Aap ke wallet ka {amount} balance khatam ho jayega." → 8 → Checkbox row (§5.9.1) "I understand I'll lose this balance" / "Mujhe maloom hai ye balance khatam ho jayega" (sent as `acknowledge_balance: true`).
6. Driver only, 24: info `Banner` "You'll go offline and stop getting ride requests now." / "Aap abhi offline ho jayenge aur ride requests band ho jayengi."
7. 24: **Reason (optional)**: `overline` "WHY ARE YOU LEAVING? (OPTIONAL)" / "AAP KYUN JA RAHE HAIN? (IKHTIYARI)" → 8 → single-select Chip row (horizontal scroll): "I don't use it" / "Istemal nahi karta", "Too expensive" / "Bohat mehenga", "Safety" / "Hifazat", "Privacy" / "Privacy", "Another app" / "Doosri app", "Other" / "Kuch aur". Sent as `reason` slug. Never required.

States: **loading** (`GET /account/deletion`): disc + title render; the lists show 3 skeleton rows each; Continue disabled. **Error**: ErrorState "Couldn't check your account" / "Account check nahi ho saka" + "Try again" in place of the lists; Continue disabled (never let a user start a flow whose consequences we couldn't show). **Offline**: same as error with the network glyph. **Already scheduled** (`state: scheduled`, possible only during a race): replace the body with §D4 content.

### D2. "Confirm it's you" (`DeleteAccountVerify`, Form)

Continue in D1 calls `POST /account/deletion/code`, then pushes D2 (the button shows its loading state meanwhile; 429 → warning Banner in D1 with the wait time).
`Screen keyboardAvoiding` · `Header standard` "Confirm it's you" / "Tasdeeq karein" · content padding 16 / 16 top:
1. `body` `textSecondary` "Enter the 6-digit code we sent to {phone_masked}." / "{phone_masked} par bheja gaya 6 hindson ka code likhein."
2. 24: `OtpInput` (6 boxes 48×56, §5.6 otp, `textContentType oneTimeCode`, autofocus).
3. 16: resend row: `caption` `textMuted` "Resend code in {m:ss}" / "{m:ss} mein dobara code" counting down from `retry_after`, then ghost `sm` "Resend code" / "Code dobara bhejein".
4. Sticky footer above the keyboard: `destructive lg` "Delete my account" / "Mera account delete karein", enabled at 6 digits. Tap → Dialog (§5.15, stacked, destructive): title "Delete your account?" / "Account delete karein?", body "Your account closes now and is deleted on {date}. You'll be signed out." / "Aap ka account abhi band hoga aur {date} ko delete ho jayega. Aap sign out ho jayenge.", actions "Delete account" / "Account delete karein" (destructive, top) and "Cancel" / "Cancel".
5. Confirm → `POST /account/deletion` (button loading, inputs disabled) → 200: local sign-out without calling `/auth/logout` (tokens are already revoked; `useLogout` gets a `serverAlreadySignedOut` option), driver location watchers stop, caches cleared → auth stack; on the Login screen a Toast success (4 s) "Your account is closed. It will be deleted on {date}." / "Aap ka account band ho gaya. {date} ko delete ho jayega."
6. Errors: 422 wrong/expired code → boxes clear, error under the boxes "That code isn't right. Try again or resend it." / "Ye code sahi nahi. Dobara likhein ya naya mangwayein." (haptic `notificationError`); 409 blocker → pop to D1, which re-reads and shows the Banner; network → danger Banner "Couldn't delete your account. Check your connection and try again." / "Account delete nahi ho saka. Internet check kar ke dobara koshish karein."

### D3. Web deletion (BE-129, no app UI)

`https://{host}/account/delete`: phone number → OTP → the same consequences and the same `POST` logic. Its URL is the public setting `account_deletion_url` and goes in the Play Console data-deletion field (owner). Not linked from the app (the in-app path is the primary one).

### D4. Account restore at sign-in (`AccountRestore`, auth stack)

Shown right after a successful sign-in when `deletion_scheduled_for` is set, before tabs mount (same frame as auth-account-status: Illustration compact with `accountRemove` glyph and the `dangerFill` badge (refusal state), centred column, sticky bottom bar):
- `h2` "Your account is set to be deleted" / "Aap ka account delete hone wala hai"
- `body` `textSecondary` "It will be deleted on {date}. Keep it to carry on riding with Raah-e-Haq." (driver: "…carry on driving…") / "Ye {date} ko delete ho jayega. Raah-e-Haq istemal karte rehne ke liye ise rakhein."
- Bottom bar: `primary lg` "Keep my account" / "Mera account rakhein" → `POST /account/deletion/cancel` → tabs with Toast success "Welcome back. Your account is safe." / "Khush aamdeed. Aap ka account mehfooz hai."; `ghost lg` "Sign out" / "Sign out". Error → inline danger Banner in the bar with "Try again".

## X. Shared rules for all screens in this spec

- **Light/dark:** tokens only. Saffron appears only in the Invite card disc (M5) and the AddressPair dropoff square (M1). Destructive surfaces: `dangerFill` button with white 5.90 / 4.75; `dangerSoft` disc with `danger` glyph 5.14 / 6.42.
- **iPhone SE:** every sticky footer at `max(insets.bottom + 8, 16)` (SE inset 0 → 16); D1 scrolls with the footer pinned (two buttons = 16 + 56 + 8 + 56 + 16 = 152 pt footer; content area 667 − 20 − 56 − 152 = 439 pt); OTP boxes 6 × 48 + 5 × 8 = 328 ≤ 343.
- **1.3x text:** pills never truncate (they grow); ticket subjects 1 line with ellipsis; Banner copy wraps; OTP digits capped at 1.2 multiplier (box size fixed).
- **Roman Urdu:** all copy above ships in en and ur-Latn together under `support.*`, `invite.*`, `accountDeletion.*`; server-provided text (category names when no slug match, ticket messages, support hours) shows as sent.
- **RTL readiness:** `start`/`end`, mirrored chevrons, bubbles swap sides, the code row keeps LTR for the code itself (`writingDirection ltr`).
- **Accessibility:** every pill's word is in the row label ("Waiting for you"); the emergency row label "Call Police, 15"; OTP announced as "Code, 6 digits"; Dialogs per §5.15.

## Y. Low literacy

- Help leads with the user's own last trip (picture of the route, not words), then topics with glyphs; the emergency number is always visible at the bottom in red with a phone glyph.
- Ticket status is a coloured pill with a word; "Waiting for you" (warning) tells the user the ball is in their court.
- Delete account explains with two short lists (delete / keep) of 3–8 words each, a red disc, and asks for a code the user already knows how to enter from sign-in.

## Z. Performance

- Help opens with at most three requests in parallel: recent ride (shared cache, often warm from Home), tickets page 1, categories (cached 24 h in memory and storage: they change rarely); public settings once per session (shared with Account).
- Ticket thread: inverted `FlatList` from the chat module, memoised bubbles, no polling, refetch on focus and on push only.
- Invite: one request for the code (cached forever after the first success), one for stats (60 s); the clipboard module is the only new native dependency (≈ 10 kB).
- Deletion: `GET /account/deletion` once per D1 open; the OTP send only on Continue; no retries in a loop (the resend button is the only re-send, gated by `retry_after`).

## R. Review checklist (UI-R18)

Light and dark, iPhone 17 and iPhone SE, default and 1.3x, en and ur-Latn; Ali (passenger) and Bilal (driver) on the local backend; deletion only on a throwaway local account created for the run (QA_SCENARIOS), never Ali or Bilal:
1. Help: last-trip card (hidden for a fresh account), topics by audience with slug glyphs, 3 newest requests + See all, contact rows from public settings (phone visible), emergency row always last; pull to refresh.
2. New request: topic chips, ride prefill removable, counters, server errors under fields, success replaces with the thread and toasts.
3. Ticket: summary card, support vs mine bubbles, resolved Banner and reply, closed bar; no agent email/phone anywhere; no polling (network log).
4. Invite: M5 card with code row, Copy (Toast) and long-press copy, Share text per locale with/without `share_url`, steps 2 or 3 per programme, stats hidden at zero; VoiceOver reaches Copy.
5. Registration: "Have an invite code?" reveal, invalid code error, empty never blocks.
6. Delete: D1 lists from server keys, blockers disable Continue with working actions, balance checkbox, driver offline note, optional reason; D2 OTP with resend countdown, final Dialog, 422 clears boxes; success signs out to Login with the date toast; sign in again during grace shows D4 and "Keep my account" restores.
7. Account → Profile → Delete account in 3 taps on both roles.
8. Code greps clean; chat components reused for the thread; no `Alert.alert`.
