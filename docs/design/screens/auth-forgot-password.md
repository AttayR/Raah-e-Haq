# Auth · Forgot password (sheet)

- **Task:** T-603.
- **Route:** modal BottomSheet over Login (not a stack screen).
- **Data:** `POST /auth/forgot-password` {email} → `{message}`. The reset itself happens on the web link in the email (no in-app reset screen exists; FEATURES Auth row 2).

## Layout
BottomSheet modal (scrim `overlay`), single snap = content height, keyboard-aware.

1. Handle (5.14).
2. 24 from sheet top: **Title** "Reset your password", `h2`, x = 16.
3. 8 gap: body "Enter the email you signed up with. We'll send a link to reset your password." `bodySmall` `textSecondary`.
4. 24 gap: TextField "Email" (prefilled with the Login email if typed).
5. 24 gap: Button `lg primary` "Send reset link".
6. 8 gap: Button `lg ghost` "Cancel".
7. Bottom padding `insets.bottom + 16`.

## States
| State | Spec |
|---|---|
| Invalid email | Field error "Enter a valid email, like name@example.com." |
| Sending | Primary loading. |
| Sent | Sheet content swaps (250 ms crossfade) to: icon circle 64 `successSoft` with `email-check-outline` 32 `success` → 16 → `h3` "Check your email" → 8 → `bodySmall` "If an account exists for {email}, you'll get a reset link in a few minutes." → 24 → Button `lg primary` "Done". (Same message whether or not the account exists.) |
| Error | Toast error with server `message` or "Couldn't send the link. Try again." |

## Interactions
- Swipe down or scrim tap closes (not while sending). Android back closes.
