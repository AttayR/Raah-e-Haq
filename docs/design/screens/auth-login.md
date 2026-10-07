# Auth · Login

- **Task:** T-603 (visual) on top of T-204 (keyboard, safe area, remove Google) and T-008 (toast).
- **Route:** `AuthStack/Login` (initial route when signed out).
- **Audit:** `audit/auth-login-*`, `auth-login-email-*`, `auth-login-error-*`, `auth-login-keyboard-light` (defects Login 1-10, G-10, G-14).
- **Data:** `POST /auth/login` {email, password} → user + token; errors from Laravel validation (`errors.email[]`, `errors.password[]`, `message`).

## Layout (top → bottom)
`Screen scroll keyboardAvoiding`, background `surface` (not `background`; auth is a single-surface flow), status bar from theme.

1. Top spacer: `insets.top + 32`.
2. **Logo badge:** 72×72 circle, `surface` fill, 1pt `border`, `elevation.1` (light only); logo 48×48 centred. Left-aligned at gutter (x = 16). Top-to-top gap to title: 72 + 24.
3. **Title:** "Sign in to Raah-e-Haq", `h1`, `textPrimary`, x = 16, max 2 lines.
4. 8 gap. **Subtitle:** "Ride or drive with Raah-e-Haq.", `body`, `textSecondary`.
5. 32 gap. **SegmentedControl** (full width − 32, height 40): "Phone" | "Email". Default segment: **Phone** (most Pakistani users sign in by phone); remember the last used segment in AsyncStorage.
6. 24 gap. **Segment content:**
   - **Phone:** `TextField variant="phone"` label "Mobile number", placeholder "3xx xxxxxxx", helper "We'll text you a 6-digit code." → 24 → Button `lg primary` "Continue" (disabled until 10 digits) → navigates to auth-phone-otp with the number (the number is entered here, not on a second screen; PhoneAuth then shows the code step directly).
   - **Email:** TextField label "Email", `keyboardType="email-address"`, `autoComplete="email"`, `textContentType="username"` → 16 → TextField `password` label "Password", `textContentType="password"` → 8 → right-aligned ghost Button `sm` "Forgot password?" (opens auth-forgot-password sheet) → 24 → Button `lg primary` "Sign in".
7. Flexible spacer (min 32).
8. **Footer** (bottom-pinned when content is shorter than the screen, otherwise after content), centered row: "New to Raah-e-Haq?" `bodySmall` `textSecondary` + 4 + ghost Button `sm` "Create account" (`primaryText`) → Signup. Bottom padding `insets.bottom + 16`.
9. **Legal line** 8 above the footer: "By continuing you agree to our Terms and Privacy Policy." `caption` `textMuted`, centred, "Terms" and "Privacy Policy" are links (`primaryText`) to the URLs from `GET /settings/public` (BE-17); if absent the sentence is hidden.

Removed: navy hero with bubbles, illustrated background, the 90 pt decorative icon circle, the duplicated "Sign in with Phone" heading/button, "Continue with Google", the separate "New to RaaH-E-Haq?" card and orange button.

## States
| State | Spec |
|---|---|
| Default | As above, Phone segment. |
| Field focus | TextField focus style (2pt `focusRing`). Keyboard pushes content so the focused field and the primary button are both visible (KeyboardAwareScrollView, `bottomOffset` 24). |
| Client validation | On submit: empty email "Enter your email.", bad format "Enter a valid email, like name@example.com.", empty password "Enter your password." Error style on the field; focus moves to the first invalid field; no layout jump beyond the helper line (helper line space is reserved, 16 high, when any error is possible). |
| Submitting | Primary button `loading`; both fields `editable={false}`; segment disabled. |
| Server 422 / wrong credentials | Field-level messages from `errors.*`; generic 401 → error helper under password: "Email or password is incorrect." |
| Network error | Toast error "Couldn't connect. Check your internet and try again." Fields keep values. |
| Offline | Offline banner under the status bar; primary button stays enabled (it shows the network toast on tap). |
| Account pending/suspended | Navigates to auth-account-status (handled by AuthFlow). |
| Long text (font 1.3×) | Title wraps to 2-3 lines; footer moves below content (scroll). |

## Interactions
- Return key: email → password (`returnKeyType="next"`), password → submit (`"go"`).
- Segment switch: content crossfade 150 ms; preserves typed values per segment.
- Haptic `notificationError` on failed sign-in.

## Accessibility
- Segments: `accessibilityRole="tab"` with selected state. Errors are announced (`accessibilityLiveRegion="polite"` / `AccessibilityInfo.announceForAccessibility`).

## Small device (iPhone SE)
- Top spacer `insets.top + 16`; logo 56×56; title `h2`. Everything else unchanged; with the keyboard up, the title scrolls off and the field + button remain visible.

## Dark
- Background `surface` (#141A2A), fields `surfaceAlt` (#1D2438). Logo badge keeps a white circle (logo artwork needs a light ground).
