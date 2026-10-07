# Auth · Splash / bootstrap

- **Task:** T-612 (visual), behaviour from T-103 (auth bootstrap).
- **Route:** shown by `AuthFlow` while the stored session is restored (`GET /auth/profile`), before Login or the role home.
- **Replaces:** the blank/Login flash at launch (QA_SCENARIOS AUTH-E2E-01).
- **Data:** none displayed. Uses `GET /auth/profile` result only to route.

## Layout
Native launch screen (LaunchScreen.storyboard / Android splash theme) and the JS splash must be pixel-identical so there is no jump.

1. Full-screen background `navy-950` `#000D3B` in both modes (brand moment; status bar `light-content`).
2. Logo badge: 96×96 circle `#FFFFFF`, centred horizontally, vertical centre at 45 % of the window height; logo image 64×64 centred in it.
3. Wordmark: "Raah-e-Haq", `h2`, `#FFFFFF`, centred, 16 below the badge.
4. Activity: appears only if bootstrap takes longer than 800 ms: 2pt indeterminate bar, 120 wide, radius `pill`, track `rgba(255,255,255,0.16)`, bar `saffron-500`, centred, 32 above `insets.bottom + 32`.

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
- No tappable elements. Transition out: crossfade 250 ms to the next screen (reduced motion: 150 ms fade).

## Accessibility
- `accessibilityLabel="Raah-e-Haq is loading"` on the container; progress bar `accessibilityRole="progressbar"`.

## Small device
- Same; badge centre at 42 % height on screens under 700 pt tall.
