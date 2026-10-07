# Auth · Account status (pending / rejected / suspended)

- **Task:** T-612 (visual); behaviour T-106 (rebuilt on REST, no Firebase).
- **Route:** rendered by `AuthFlow` when `user.status !== 'active'`.
- **Data:** `GET /auth/profile` → `status` (`pending`, `rejected`, `suspended`, others), `name`, `roles`; driver document statuses from BE-15 (`vehicle.verification_status`, document statuses) when available. Support contact from `GET /settings/public` (`support_email`, `support_phone`).

## Layout
`Screen scroll refreshing onRefresh` (pull = Check status), background `surface`.

1. Header: no back; trailing ghost Button `sm` "Sign out".
2. 24 gap: **Status illustration** 160×160 duotone (pending: clipboard with clock; rejected: document with cross; suspended: shield), centred.
3. 24 gap: **Title** `h1` centred, max width 320:
   - pending: "We're reviewing your application"
   - rejected: "Your application wasn't approved"
   - suspended: "Your account is on hold"
4. 8 gap: **Body** `body` `textSecondary` centred:
   - pending: "Hi {first name}. Our team checks your documents before you can start driving. We'll notify you when it's done."
   - rejected / suspended: "Contact support to find out why and what to do next."
5. 32 gap: **Checklist Card** (pending only, driver): title `title` "Your documents", then ListItem rows (56 high) per document/vehicle item from BE-15 with a status pill (pending → warning "In review", approved → success "Approved", rejected → danger "Needs update"). Without BE-15 data the card shows a single row "Documents submitted" with warning "In review".
6. 24 gap: Button `lg primary` "Check status" (calls `GET /auth/profile`; loading state).
7. 12 gap: Button `lg outline` "Contact support" → opens a sheet with "Email {support_email}" and "Call {support_phone}" rows (hidden rows when absent).
8. Bottom padding `insets.bottom + 16`.

Removed: hardcoded "Review Time: 24-48 hours", the 3 fake process steps, illustrated background.

## States
| State | Spec |
|---|---|
| Checking | Button loading; pull-to-refresh spinner. |
| Became active | Toast success "You're approved. Welcome to Raah-e-Haq!" then AuthFlow routes to the role home. |
| Still pending | Toast info "Still in review. We'll let you know." |
| Error | Toast error "Couldn't check right now. Try again." |
| Sign out | Dialog "Sign out? / You can sign in again any time. / Cancel / Sign out" → Login. |
