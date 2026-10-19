# Auth · Splash / bootstrap

- **Task:** T-612 (visual), behaviour from T-103 (auth bootstrap).
- **Route:** shown by `AuthFlow` while the stored session is restored (`GET /auth/profile`), before Login or the role home.
- **Replaces:** the blank/Login flash at launch (QA_SCENARIOS AUTH-E2E-01).
- **Data:** none displayed. Uses `GET /auth/profile` result only to route.

## Layout
Native launch screen (LaunchScreen.storyboard / Android splash theme) and the JS splash must be pixel-identical so there is no jump.

1. Full-screen background `navy-950` `#000D3B` in both modes (brand moment; status bar `light-content`).
2. Logo badge: 96×96 circle `#FFFFFF`, centred horizontally, vertical centre at **50 %** of the window height (exact centre) on every device; logo image 64×64 centred in it. **[UI-R8 review]** Was 45 % (42 % small devices); changed so the iOS storyboard, the Android window background / Android 12 splash (which can only centre) and the JS splash are pixel-identical.
3. Wordmark: "Raah-e-Haq", `h2`, `#FFFFFF`, centred, 16 below the badge, positioned out of the flow so the badge stays at the exact centre; does not scale with the text-size setting (`maxFontSizeMultiplier=1`, it matches the native launch screen). Android: the native splash cannot draw text, so the JS wordmark fades in over 150 ms.
4. Activity: appears only if bootstrap takes longer than 800 ms (counted from app start, not from each splash mount): 2pt indeterminate bar, 120 wide, radius `pill`, track `rgba(255,255,255,0.16)`, moving 40-wide segment `accent` (saffron-500 `#F75606`, [UI-R21]) (1100 ms cycle, ease-in-out; reduced motion: static centred segment), centred, bottom edge at `insets.bottom + 32`.

## States
| State | Behaviour |
|---|---|
| Restoring (≤800 ms) | Logo + wordmark only. |
| Restoring (>800 ms) | Progress bar fades in (150 ms). |
| Offline with cached session | Route to the role home immediately; the home shows the offline banner. Never log out because of the network (AUTH-E2E-01 step 4). |
| Offline, no session | Route to Login. |
| Server error with session | Route to role home with cached user; a Toast "Couldn't refresh your account. Some info may be out of date." |
| Account not active | Route to auth-account-status. |

## Interactions
- No tappable elements. Native → JS hand-off: the native splash is hidden one frame after the JS splash has laid out (no empty frame). **[UI-R8 review]** Transition out: no crossfade; the next screen replaces the splash directly (the splash is the fallback of several gates, so a crossfade would replay per gate). Revisit only if a cut is visibly harsh on device.

## Accessibility
- `accessibilityLabel="Raah-e-Haq is loading"` on the container; progress bar `accessibilityRole="progressbar"`.

## Small device
- Same layout; badge centre at 50 % like every other device (UI-R8 review).

## Known asset debt
- `src/assets/images/logo.png` (and the native SplashLogo / splash_badge renders made from it) carries a rounded square of `#FEFEFE` behind the mark. On the white badge it is 1.0:1 against `#FFFFFF` and invisible; replace with a transparent-background export when the brand asset is re-cut (UI-R19).
