# Auth · Phone code (OTP)

- **Task:** T-603 (visual); behaviour T-101 (never show/persist OTP), BE-16.
- **Route:** `AuthStack/PhoneAuth` with param `phone` (E.164, from Login phone segment). If opened without a phone (deep link), it shows the phone entry block from auth-login Phone segment first.
- **Audit:** `audit/auth-phone-*` (no back button, keyboard hides "Send Code", "+92" editable).
- **Data:** `POST /auth/send-otp` {phone} → `{message, expires_in?, resend_after?}`; `POST /auth/verify-otp` {phone, otp} → user + token, or 422 `errors.otp[]`. The response's `otp_code` (debug only) is **never rendered** (T-101).

## Layout
`Screen scroll keyboardAvoiding`, background `surface`.

1. **Header** (5.2) with back button only, no title.
2. 8 gap. **Title:** "Enter the code", `h1`, x = 16.
3. 8 gap. **Subtitle:** "Sent by SMS to {formatted phone}" `body` `textSecondary`; the phone number in `bodyStrong` `textPrimary`; trailing ghost Button `sm` "Edit" (goes back to Login with the number prefilled).
4. 32 gap. **OTP field** (`TextField variant="otp"`, 6 boxes 48×56, 8 gap, row centred; total 336 wide; on screens <360 wide boxes are 44×52 with 6 gap). Auto-focus on mount; `textContentType="oneTimeCode"` / Android SMS Retriever autofill.
5. 16 gap. **Helper line** (16 high, reserved): error text in `danger` when present, otherwise empty.
6. 24 gap. **Resend row**, centred: while cooling down "Resend code in 0:{ss}" `bodySmall` `textMuted` (counts from `resend_after` or 30 s); afterwards ghost Button `sm` "Resend code".
7. Flexible spacer.
8. **Primary button** `lg` "Verify", full width, pinned above the keyboard (`insets.bottom + 16` without keyboard; 16 above keyboard). Disabled until 6 digits. Auto-submits on the 6th digit; the button shows `loading` during verify.

## States
| State | Spec |
|---|---|
| Sending (first load) | Boxes visible but disabled; subtitle shows "Sending code to {phone}…"; small 16pt spinner after the text. |
| Send failed | ErrorState inline replaces boxes: title "Couldn't send the code", body = server `message` or "Check the number and try again.", button "Try again". |
| Entering | Active box: 2pt `focusRing` border; filled boxes `surfaceAlt` with `numericL` digit. |
| Verifying | All boxes disabled, button loading. |
| Wrong code (422) | All boxes get 2pt `danger` border, shake 3× ±6 pt over 300 ms (reduced motion: no shake), helper "That code isn't right. Check the SMS and try again.", boxes clear and focus returns to box 1; haptic `notificationError`. |
| Expired | helper "This code has expired. Request a new one." and the resend button becomes available immediately. |
| Too many attempts (429) | helper with server message; resend disabled for `retry_after`. |
| Success | Button shows a 20pt check icon for 300 ms, then AuthFlow routes. |
| Offline | Offline banner; Verify shows network toast. |

## Accessibility
- The 6 boxes are one accessible element: "Verification code, {n} of 6 digits entered". Resend countdown is not announced every second (announce only when available).

## Small device
- Title `h2`; boxes 44×52.

## Must never appear
- Any OTP value, "Test Code", "Use This OTP" (AUTH-OTP-01).
