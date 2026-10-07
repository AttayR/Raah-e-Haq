# Shared · Help & support, Invite friends, Delete account

- **Task:** T-619 after T-511, BE-15 (`DELETE /profile`), BE-17 (referral code, public settings).
- **Routes:** `Support` (tickets list) → `SupportTicket` (thread / new); `Invite`; `DeleteAccount`. All pushed from shared-settings; Support also from ride details / trip complete with a ride id.
- **Data:** `GET /settings/public` → `support_email`, `support_phone`, terms/privacy URLs [BE-17]; `GET/POST /support/tickets`, ticket replies (`TicketResource`, `TicketReplyResource`: subject, status, messages, created_at); `GET /referrals/code/mine` [BE-17] → code (+ reward text if provided); `DELETE /profile` {password or OTP}.

## Help & support
`Screen scroll`, Header (back, "Help & support"), background `background`.
1. 8 gap: **Contact Card**: ListItem "Call support" (`phone-outline`, subtitle `{support_phone}`) → dialer; "Email support" (`email-outline`, `{support_email}`) → mail composer. Rows hidden when absent.
2. 24 gap: header row `overline` "Your requests" + trailing ghost Button `sm` "New request".
3. 8 gap: Card with ticket rows (ListItem 72): title `title` subject, subtitle `caption` `textMuted` "Updated {date}", trailing status pill (open → info "Open", pending → warning "Waiting for you", closed → neutral "Closed").
4. Empty: compact EmptyState "No requests yet" + "New request".

**New request** (push): Header (back, "New request", trailing "Send" disabled until valid). Fields: Topic (Chip single-select: Ride issue, Payment, Account, Safety, Other) · Ride (prefilled read-only ListItem "Ride on {date}" when opened from a ride, removable) · Subject TextField (max 120) · Description multiline (max 2000, min 10). Send → loading → Toast "Request sent. We'll reply here." → ticket thread.

**Ticket thread:** same bubble pattern as shared-chat-thread (mine = `primary`, support = `surface`), composer to reply while not closed; closed shows the closed bar "This request is closed."

## Invite friends
`Screen`, Header (back, "Invite friends").
1. Illustration 160 centred (gift + route), 24 gap, `h2` centred "Invite friends to Raah-e-Haq", 8 gap, `body` `textSecondary` centred: reward text from the API if provided, else "Share your code with friends."
2. 24 gap: **Code box**: 64 high, dashed 1.5pt `borderStrong`, radius `md`, `numericL` code letter-spacing 2 centred, trailing IconButton `content-copy` (Toast "Code copied").
3. 16 gap: Button `lg primary` "Share invite" (`share-variant-outline`) → OS share: "Join me on Raah-e-Haq. Use my code {code} when you sign up."
States: loading skeleton for the code box; error ErrorState "Couldn't get your code"; the same code each time (BE-17).

## Delete account
`Screen scroll keyboardAvoiding`, Header (back, "Delete account").
1. Icon circle 64 `dangerSoft` with `account-remove-outline` 32 `danger`, 16 gap, `h2` "Delete your account?".
2. 8 gap: `body` `textSecondary`: "This permanently removes your profile, saved places and messages. Ride records are kept for accounting with your name removed. This can't be undone."
3. 16 gap: Banner warning when a ride is active: "Finish or cancel your current ride first." (and the action is disabled).
4. 24 gap: TextField `password` "Enter your password to confirm" (or OTP field when the account has no password, per BE-15).
5. 24 gap: Button `lg destructive` "Delete account" (disabled until the field is filled) → Dialog "Delete account permanently?" / "Delete" (destructive) / "Cancel" → loading → Login with Toast "Your account was deleted."
6. 8 gap: Button `lg ghost` "Keep my account".
Errors: wrong password field error; 409 active ride → banner.
