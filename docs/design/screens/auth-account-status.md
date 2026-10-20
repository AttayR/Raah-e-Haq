# Auth · Account status (pending / rejected / suspended)

- **Task:** T-612 (visual); behaviour T-106 (rebuilt on REST, no Firebase).
- **Route:** rendered by `AuthFlow` when `user.status !== 'active'`.
- **Data:** `GET /auth/profile` → `status` (`pending`, `rejected`, `suspended`, others), `name`, `roles`; driver document statuses from BE-15 (`vehicle.verification_status`, document statuses) when available. Support contact: `SUPPORT_EMAIL` from `src/config/support.ts` (documented config); a support phone row appears only once a phone exists in config or `GET /settings/public` (none today).

## Layout
`Screen scroll refreshing onRefresh` (pull = Check status), background `surface`.

1. Header (`tone="background"`): no back; trailing text action "Sign out" (Header `trailingText`, 44 target).
2. 24 gap: **Status illustration** 160×160 duotone (pending: clipboard with clock; rejected: document with cross; suspended: shield), centred.
3. 24 gap: **Title** `h1` centred, max width 320:
   - pending: "We're reviewing your application"
   - rejected: "Your application wasn't approved"
   - suspended: "Your account is on hold"
4. 8 gap: **Body** `body` `textSecondary` centred:
   - pending driver: "Hi {first name}. Our team checks your documents and vehicle before you can start driving." (**[UI-R8 review]** no "We'll notify you" and no review time: the server sends no approval notification.)
   - pending passenger: title "We're reviewing your account", body "Hi {first name}. You can book rides as soon as it is approved."
   - rejected / suspended: "Contact support to find out why and what to do next."; when the server sends a reason (Reason card shown): "Contact support if you have questions." (UI-R8 re-review)
   - inactive: "Your account is deactivated" / "Contact support to turn your account back on."; unverified and unsupported role: copy in `features/auth/copy/accountStatus.ts`.
   - Illustration (UI-R8 Illustration component): 160 box, 128 `primarySoft` disc, 64 `onPrimarySoft` glyph, 48 badge with a 3pt `background` ring on the disc's bottom-end; on windows under 700 pt tall: 120 / 96 / 48 / 36 (ring 2). Badge: pending `accent` + clock; rejected `dangerFill` + close-circle; suspended `dangerFill` + pause.
   - Rejected / suspended with a server reason: 24 gap, outlined Card (full width): `label` `textSecondary` "Reason", 4, `body` reason.
5. 32 gap: **Documents Card** (pending driver only): **[UI-R8 review]** the shared `DriverDocumentsList` (T-203, `GET /driver/documents`): `h3` "Documents", summary line, then one row per document (label `bodyStrong`, required/optional `caption`, status Badge: approved success, pending warning, rejected danger, missing neutral; rejection reason `bodySmall` danger; Upload / Re-upload `sm outline` when `can_upload`). Loading: spinner + "Loading…" centred. Error: centred column (text `body` centred, then `sm outline` "Try again" **centred under the text**). Empty: `bodySmall` `textSecondary`.
6. **Sticky action bar** **[UI-R8 review]** (replaces in-scroll buttons; §3.2 thumb reach): hairline `border` top, `background` fill, padding 12 top / gutter sides, bottom `layout.bottomActionOffset` above the home indicator (min 16 without one), gap 12: optional danger Banner (check error) → Button `lg primary` "Check status" (calls `GET /auth/profile`; loading state) → Button `lg outline` with `support` icon "Contact support" → modal BottomSheet: `h3` "Contact support", ListItem "Email {SUPPORT_EMAIL}" (opens mail; on failure Toast "Couldn't open your email app. Write to {email}."). Phone row hidden until a support phone exists. **[UI-R18, superseded]** Contacts come from `GET /settings/public` through the Help hook (shared-support-invite §H1.4), config email only as the offline fallback; rows use the Help anatomy: tile `phone` "Call support" + formatted `support_phone` subtitle (→ `tel:`), then tile `email` "Email support" + address subtitle (→ `mailto:`); each row only when its value exists.

Removed: hardcoded "Review Time: 24-48 hours", the 3 fake process steps, illustrated background.

## States
| State | Spec |
|---|---|
| Checking | Button loading; pull-to-refresh spinner. |
| Became active | Toast success "You're approved. Welcome to Raah-e-Haq!" then AuthFlow routes to the role home. |
| Still pending | Toast info "Still in review. Please check again later." (driver) / "Your account is not approved yet. Please check again later." (passenger). |
| Error | **[UI-R8 review]** danger Banner at the top of the sticky action bar "Couldn't check right now. Try again." (stays until the next check), instead of a Toast. |
| Sign out | Dialog "Sign out? / You can sign in again any time. / Cancel / Sign out" → Login. |
