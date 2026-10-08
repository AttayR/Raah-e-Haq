# Audit: Authentication & Onboarding

Audited on 2026-10-03 by reading the code, at commit `9047c5d`. Line numbers refer to that commit. Severity scale:
- **P0**: crash, data loss or security
- **P1**: broken feature
- **P2**: incorrect behaviour or poor UX
- **P3**: code quality

## Findings

### AUTH-01 · P0 · bug: the pending-approval screen is a dead end
`src/screens/Driver/DriverPendingApprovalScreen.tsx:17-18, 26, 44-45, 57-60`
- `AuthFlow.tsx:35-37` shows this screen for any API user whose `apiAuth.user.status !== 'active'`.
- **Sign Out** calls the Firebase `signOutUser()` and `setSignedOut()` from the Firebase `auth` slice. It never clears `apiAuth` or the `auth_token` in AsyncStorage.
- **Check Status** only increments a local counter. No API call is made.
- The status text reads Firebase `state.auth.userProfile.driverStatus`, which is always undefined on the API path, so it always says "pending". A `suspended` user is told "Under Review". Passengers see "Driver Application".
- **Impact:** a freshly registered user (backend status `pending`) who logs in is stuck on this screen permanently, and it survives a restart because the state is persisted. Reinstalling is the only way out.
- **Fix:** use the unified logout (see AUTH-09). Make "Check Status" call `getUserProfile()`. Read `apiAuth.user.status` and `role`, and show text per role and per status.

### AUTH-02 · P0 · security: OTP is returned by the API and shown in the UI
`PhoneAuthScreen.tsx:85, 92, 168, 175, 272-290`, `apiThunks.ts:172`, `apiAuthSlice.ts:135`
- `/auth/send-otp` returns `otp_code` (API_DOCUMENTATION.md:180).
- The screen shows it with a "Use This OTP" button, or the hardcoded "Test Code: 123456".
- `otpData` is in the persisted `apiAuth` slice, so it is written to AsyncStorage.
- **Impact:** anyone can log in as any phone number, because phone ownership is never proven.
- **Fix:**
  - **Backend (owner):** stop returning `otp_code` in production and send it by SMS only.
  - **App:** remove the OTP box and the test-code text, and exclude `otpData` from persistence.

### AUTH-03 · P0 · security: credentials, tokens and PII logged in plaintext
`api.ts:201, 215, 231`, `apiThunks.ts:10, 19, 57, 95`
- Login logs `{email, password}`.
- The login thunk logs the bearer token.
- The registration thunks log the full `userData`: password, CNIC and bank account number.
- There is no `transform-remove-console`, so these logs ship in release builds and appear in logcat and the device console.
- **Fix:** delete these logs. Add `babel-plugin-transform-remove-console` for production builds and a logger that redacts sensitive values.

### AUTH-04 · P1 · bug: cold-start validation leaves the user "authenticated" with no token
`apiThunks.ts:422-447`, `apiAuthSlice.ts:76-84`
- `initializeAuth` catches any `testAuth()` failure, including offline and timeouts. It then calls `clearAuthData()` and returns `null`.
- The fulfilled reducer only acts on a payload, so the persisted `isAuthenticated: true` and `user` survive.
- **Impact:** after an expired token, or simply when the app starts offline, the home screens render with no token. Every call returns 401, and the user is never sent to Login.
- **Fix:**
  - On a `null` payload, reset to the initial state (`isInitialized: true`).
  - Clear the token only on an actual 401, not on network errors.
  - Show a splash until `isInitialized` is true.

### AUTH-05 · P1 · bug: token refresh is dead code
`api.ts:77-101`, `apiThunks.ts:354`
- The interceptor reads `refresh_token`, which is never written anywhere, and posts `{refresh_token}`. According to the docs, `/auth/refresh` is a Bearer call with no body.
- When refresh fails, it wipes AsyncStorage but never updates Redux.
- The `refreshToken` thunk and `refreshAuthToken` are unused.
- `PassengerHomeScreen.tsx:151` pull-to-refresh calls the Firebase `refreshSessionThunk`, which does nothing because `currentUser` is null.
- **Fix:** pick one strategy (Bearer `/auth/refresh`, or treat 401 as logout). On a final 401, dispatch the unified logout through an injected store reference.

### AUTH-06 · P1 · bug: driver documents are collected but never uploaded
`RegistrationScreen.tsx:165-167, 294-333`, `api.ts:303-344`
- The Documents step requires a driver photo, a CNIC photo, at least 4 vehicle photos, and license front and back. None of them are added to `registrationData`.
- `registerWithImages` only attaches files when `user_type === 'passenger'`.
- **Impact:** drivers upload 6+ photos that are silently thrown away, and admins have nothing to review.
- **Fix:** add the driver file fields to the FormData. Confirm the backend field names first.

### AUTH-07 · P1 · bug: wrong field mapping in the driver payload
`RegistrationScreen.tsx:318`
- `license_number: formData.vehicleNumber` sends the vehicle number as the license number.
- No license-number input exists in the form.
- **Fix:** add a license-number input and map it correctly.

### AUTH-08 · P1 · bug: login succeeds but routing depends on a `role` field that may be missing (backend check needed)
`AuthFlow.tsx:27, 41-44`, `RootNavigation.tsx:31-42`
- Routing needs `user.role`.
- The documented login, verify-otp and `/user` responses have no `role`. Register returns `user_type`.
- No code maps `user_type` or `roles[]` to `role`.
- **Impact:** if the backend omits `role`, the user sees "Login successful!" and stays on Login.
- **Fix:** check the live response. Normalise `role = user.role ?? user.user_type ?? user.roles?.[0]` in a single `normalizeUser()`.

### AUTH-09 · P1 · bug: logout is incomplete everywhere
- `DriverHomeScreen.tsx:387` "Sign Out" calls the Firebase `signOutThunk`. The API session survives.
- `logoutUser` (`apiAuthSlice.ts:202-224`) only clears `apiAuth`. The persisted `auth`, `user` and `trip` state survive, and `persistor.purge()` is never called.
- **Fix:** write one `logout` thunk that:
  - calls the API
  - clears AsyncStorage
  - signs out of Firebase (if still used)
  - dispatches a root `RESET`
  - purges the persistor
  
  Use it everywhere.

### AUTH-10 · P2 · bug: server validation errors (e.g. "has already been taken") are not shown on the fields
`PersonalInfoStep.tsx:399-587`, `RegistrationScreen.tsx:360-373`
- Only `address`, `date_of_birth`, `gender`, `password` and the relation field show server errors.
- `email`, `phone`, `cnic`, `name`, `password_confirmation` and `emergency_contact` errors never appear on the field.
- The `summary` built in `apiThunks.ts:134-141` is unused.
- Commit `aed14ad` removed the inline error block instead of fixing the double display.
- **Fix:** render `apiErrors[field]` for every input, and show `summary` in the toast.

### AUTH-11 · P2 · bug: per-step validation can be bypassed
`RegistrationScreen.tsx:144-148, 220-232`
- Step 1 only checks that fields are non-empty. The format validators only run on blur.
- Phone isn't required. An empty phone is sent as `'+'`.
- The password rules are only checked at final submit, and a failure there doesn't send the user back to step 1.
- `src/schemas/registrationSchema.ts` is imported nowhere.
- **Fix:** validate each step against the schema before allowing Next.

### AUTH-12 · P2 · bug: the vehicle year limit is hardcoded to 2025
`VehicleInfoStep.tsx:92`, `RegistrationScreen.tsx:275`
- It is now 2026, so 2026 vehicles are rejected.
- **Fix:** use `new Date().getFullYear() + 1`, or the backend rule.

### AUTH-13 · P2 · ui: keyboard and safe-area handling
- `LoginScreen` and `RegistrationScreen` have no `KeyboardAvoidingView` and no `keyboardShouldPersistTaps`. On iOS the keyboard covers the lower inputs.
- Every screen uses the `SafeAreaView` from `react-native`, which does nothing on Android. Use `react-native-safe-area-context`, which is already installed.
- `DocumentsStep.tsx:259-261` (passenger branch) puts a vertical `ScrollView` inside a `ScrollView`.

### AUTH-14 · P2 · ui: no splash, theme ignored, odd controls
- `AuthFlow` ignores `isInitialized`, so Login flashes before the session is restored.
- The auth screens hardcode colours and force `light-content`. Only `SignupScreen` uses `useAppTheme`.
- Login trims the password (`LoginScreen.tsx:104`).
- The Google button only shows an "unavailable" toast (`:163-171`), while `App.tsx` still configures GoogleSignIn.

### AUTH-15 · P3 · dead-code: the old Firebase onboarding is unreachable
- `RoleSelection`, `BasicInfo` and `DriverRegistration` are registered in `AuthStack.tsx:27-29`, but nothing navigates to them.
- Unused or near-unused: `authThunks.ts` (except two stray imports), `services/auth.ts`, `firebaseAuth.ts`, `googleSignIn.ts`, `authSlice`, `userSlice`, and `useAuthListener.ts` (0 bytes).
- `RegistrationForm` ignores its `initialRole` and `onSuccess` props.
- **Fix:** remove the Firebase auth path. Firebase stays only for FCM, if needed.

### AUTH-16 · P3 · architecture: two slices share the name `'auth'`; the persist transform never runs
`authSlice.ts:35`, `apiAuthSlice.ts:48`, `store/index.ts:48`
- Both slices are named `'auth'`, so their action types collide: `auth/clearError`, `auth/setProfileCompleted`, and so on.
- The transform has `whitelist: ['root']`. redux-persist applies transforms per slice key, so it never runs and stale errors are persisted.
- **Fix:** rename the slice to `apiAuth` and whitelist the real keys.

### AUTH-17 · P3 · bug: registration may store a token without logging in
`apiThunks.ts:109-110`
- `registerUserWithImages` stores `response.data.token` if present. On the next launch, `initializeAuth` would silently log the user in.
- There is no reducer case for this thunk, so `status` and `error` never update during registration.

### AUTH-18 · P3 · bug: phone OTP refusal polish (T-111 QA)
`src/screens/Auth/PhoneAuthScreen.tsx`, `src/core/api/logApiFailure.ts`
- Expected refusals (429 otp limits, 503 sms_unavailable) go to logger.error, which shows a red LogBox in dev.
- Global refusals (sms_unavailable, otp_ip_limit) only block the number that was typed; changing one digit re-enables Send.
- Send success copy claims a code was sent, even for unknown numbers.
- The email fallback opens the Phone tab.
- Keyboard covers Send/Verify with no way to dismiss it, and disabled Verify looks enabled.

## Current flow

**Passenger:**
1. Login → "Create New Account" → `Signup`, which shows a 4-step `RegistrationScreen`. The Vehicle step is skipped.
2. POST `/auth/register` (multipart) → toast → back to Login.
3. Email login, or phone OTP (with the OTP shown on screen).
4. If the account is `pending`, the user gets stuck on `DriverPendingApprovalScreen` (AUTH-01).
5. Once activated, the user gets in only if the response includes `role` (AUTH-08).

**Driver:** the same, except the photos are thrown away (AUTH-06). Signing out from Driver Home doesn't end the API session (AUTH-09).

## Target flow

1. **One auth system:** the Laravel API. Firebase is used only for FCM.
2. **Splash screen:** wait for persist rehydration and an offline-tolerant `initializeAuth`.
3. **Choose your role first:** passengers get 2 steps, drivers get 4 steps.
4. **Validate and upload properly:** validate each step against the schema, verify the phone with a real SMS OTP, upload all documents in one multipart request, and map server errors back to their fields.
5. **A working pending screen:** it refreshes `/auth/profile`, shows the real reason for `pending` or `suspended`, and has a real logout.
6. **Normalised user:** `normalizeUser()` provides `role` and `status`, and routing depends only on those.
7. **One logout:** a single `logout` thunk, plus a single 401 handler that calls it.
