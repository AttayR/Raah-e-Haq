import { createAsyncThunk, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import {
  apiService,
  LoginRequest,
  RegisterRequest,
  RegisterWithImagesRequest,
  RegistrationPhoneVerification,
  VerifyOtpRequest,
  VerifyPhoneRequest,
  ResendPhoneCodeRequest,
  ResetPasswordRequest,
  OtpSentInfo,
  User,
} from '../../services/api';
import { authStorage } from '../../services/authStorage';
import { unwrap, toApiError, toThunkRejection, ThunkRejection, ApiError } from '../../core/api/errors';
import {
  mergeServerUser,
  normalizeUser,
  routesHome,
  UNKNOWN_STATUS,
  withRefusedStatus,
} from '../../core/auth/normalizeUser';
import { logApiFailure } from '../../core/api/logApiFailure';
import {
  bumpSessionEpoch,
  currentSessionEpoch,
  isStaleSession,
  STALE_SESSION_MESSAGE,
} from '../sessionEpoch';
import { logger } from '../../core/logging/logger';
import { LOGOUT_REQUEST_TIMEOUT_MS, stopLiveServices } from './sessionThunks';

/**
 * Every thunk rejects with a ThunkRejection: a display-safe `message` plus `fieldErrors`
 * (and kind/status/retryAfter). Use rejectionMessage() to show it.
 */
type ThunkConfig = { rejectValue: ThunkRejection };

/** A result dropped because the session ended while the request ran (T-103). */
export const staleSessionRejection = (): ThunkRejection => ({
  message: STALE_SESSION_MESSAGE,
  kind: 'cancelled',
  fieldErrors: {},
});

export const isStaleSessionRejection = (payload: ThunkRejection | undefined): boolean =>
  payload?.kind === 'cancelled' && payload.message === STALE_SESSION_MESSAGE;

/**
 * A signed-in result. The bearer token is not part of it: it lives only in the Keychain
 * (services/authStorage), never in Redux or an action payload (T-104, T-107).
 */
export interface AuthSession {
  user: User;
}

/**
 * Every user the app ingests goes through normalizeUser (AUTH-08), so Redux and storage only
 * ever hold the normalised `role` and `status`. A payload that is not a user is a bad response.
 */
const requireUser = (raw: unknown): User => {
  const user = normalizeUser(raw);
  if (!user) {
    throw new ApiError({ kind: 'unknown', message: 'Invalid response format from server' });
  }
  return user;
};

/** For endpoints whose success body has only a message (no data). */
const messageOf = (body: { success: boolean; message?: string }, fallback: string): string => {
  if (body.success === false) {
    throw new Error(body.message || fallback);
  }
  return body.message || fallback;
};

/**
 * A token the server issued for a session that ended before it was kept (a logout while the
 * login ran): the logout could not revoke it (it read no token, or an older one), so it would
 * stay valid in personal_access_tokens. Revoked here, best effort and in the background, with
 * the logout timeout (T-114).
 */
const revokeDiscardedToken = (token: unknown): void => {
  if (typeof token !== 'string' || token === '') {
    return;
  }
  apiService.revokeToken(token, { timeout: LOGOUT_REQUEST_TIMEOUT_MS }).catch((error: unknown) => {
    logger.warn('could not revoke a discarded login token', { status: toApiError(error).status });
  });
};

/**
 * Stores the token (Keychain) and the cached user from a login/verify-otp/register response,
 * unless the session ended while the request ran. Returns false when nothing was stored.
 * A stored token starts a new session epoch, so nothing tied to an earlier token (its late
 * results, the 401 single-flight latch in services/api.ts) can apply to this one.
 */
const storeNewSession = async (
  data: { user: User; token: string; expires_at?: string | null },
  startedIn: number,
): Promise<boolean> => {
  const stored = await authStorage.saveSession(
    { token: data.token, expiresAt: data.expires_at, user: data.user },
    startedIn,
  );
  if (!stored || isStaleSession(startedIn)) {
    revokeDiscardedToken(data.token);
    return false;
  }
  bumpSessionEpoch();
  return true;
};

// Auth Thunks
export const loginUser = createAsyncThunk<AuthSession, LoginRequest, ThunkConfig>(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      logger.debug('🔄 Redux Thunk - Starting user login...');
      const data = unwrap(await apiService.login(credentials));
      const user = requireUser(data.user);

      // A logout while this ran wins: nothing is stored and the state stays signed out.
      if (!(await storeNewSession({ ...data, user }, startedIn))) {
        return rejectWithValue(staleSessionRejection());
      }
      logger.debug('✅ Redux Thunk - Login successful');

      return { user };
    } catch (error) {
      logApiFailure('loginUser failed', error);
      return rejectWithValue(toThunkRejection(error, 'Login failed'));
    }
  }
);

export const registerUser = createAsyncThunk<User, RegisterRequest, ThunkConfig>(
  'auth/registerUser',
  async (userData, { rejectWithValue }) => {
    try {
      logger.debug('🔄 Redux Thunk - Starting user registration...');
      const data = unwrap(await apiService.register(userData));
      logger.debug('✅ Redux Thunk - Registration successful');
      return requireUser(data.user);
    } catch (error) {
      logApiFailure('registerUser failed', error);
      return rejectWithValue(toThunkRejection(error, 'Registration failed'));
    }
  }
);

/**
 * What registration leaves for the phone step (BE-35/BE-38). `verificationToken` is a bearer
 * secret: the screen keeps it in memory only; it is never stored, persisted or logged.
 * `refusal` is set when no code went out yet (`code_sent: false`): resend after retryAfter.
 */
export interface PendingPhoneVerification {
  phone: string;
  codeSent: boolean;
  expiresIn: number;
  verificationToken: string;
  refusal?: { code?: string; message?: string; retryAfter?: number };
}

/**
 * - `verify_phone`: BE-35/BE-38 backend. Nothing is stored: the account has no token yet and
 *   the response no user id; POST /auth/phone/verify returns both (verifyPhone).
 * - `registered`: a backend from before BE-35 (user with id, token null for a pending
 *   driver). Stored as before, so the app works with either backend while they roll out.
 */
export type RegistrationOutcome =
  | { kind: 'verify_phone'; message?: string; role: User['role']; phoneVerification: PendingPhoneVerification }
  | { kind: 'registered'; user: User };

const toPendingPhoneVerification = (raw: unknown): PendingPhoneVerification | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const pv = raw as Partial<RegistrationPhoneVerification>;
  if (typeof pv.verification_token !== 'string' || pv.verification_token === '' || typeof pv.phone !== 'string') {
    return null;
  }
  // An echoed otp_code (local backend) is dropped here, as in sendOtp (AUTH-02).
  const pending: PendingPhoneVerification = {
    phone: pv.phone,
    codeSent: pv.code_sent !== false,
    expiresIn: typeof pv.expires_in === 'number' ? pv.expires_in : 0,
    verificationToken: pv.verification_token,
  };
  if (pv.code_sent === false) {
    pending.refusal = {
      ...(typeof pv.code === 'string' ? { code: pv.code } : {}),
      ...(typeof pv.message === 'string' && pv.message ? { message: pv.message } : {}),
      ...(typeof pv.retry_after === 'number' ? { retryAfter: pv.retry_after } : {}),
    };
  }
  return pending;
};

const registrationRole = (raw: Record<string, unknown>): User['role'] => {
  const role = typeof raw.role === 'string' ? raw.role : raw.user_type;
  return role === 'driver' || role === 'passenger' ? role : null;
};

export const registerUserWithImages = createAsyncThunk<RegistrationOutcome, RegisterWithImagesRequest, ThunkConfig>(
  'auth/registerUserWithImages',
  async (userData, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const body = await apiService.registerWithImages(userData);
      const data = unwrap(body);

      // BE-38: no token and no user id; the phone step finishes the registration. This
      // response is the same whether or not the email already had an account.
      const phoneVerification = toPendingPhoneVerification(data.phone_verification);
      if (phoneVerification) {
        return {
          kind: 'verify_phone',
          ...(typeof body.message === 'string' && body.message ? { message: body.message } : {}),
          role: registrationRole(data.user ?? {}),
          phoneVerification,
        };
      }

      // Before BE-35: drivers get no token until an admin approves them (token is null).
      const user = requireUser(data.user);
      const stored = data.token
        ? await storeNewSession({ ...data, user, token: data.token }, startedIn)
        : await authStorage.saveUser(user, startedIn);
      if (!stored) {
        return rejectWithValue(staleSessionRejection());
      }
      return { kind: 'registered', user };
    } catch (error) {
      logApiFailure('registerUserWithImages failed', error);
      return rejectWithValue(toThunkRejection(error, 'Registration failed'));
    }
  }
);

export const sendOtp = createAsyncThunk<OtpSentInfo, string, ThunkConfig>(
  'auth/sendOtp',
  async (phone, { rejectWithValue }) => {
    try {
      logger.debug('🔄 Redux Thunk - Starting OTP send process...');
      const body = await apiService.sendOtp(phone);
      const data = unwrap(body);
      logger.debug('✅ Redux Thunk - OTP sent; expires in', data.expires_in, 'seconds');
      // The local backend may echo otp_code (APP_ENV=local + debug). It is dropped here so
      // it never reaches Redux, redux-persist, the UI or the logs (AUTH-02, INF-05).
      // The message is kept: it is the same for every number and never claims a code was sent.
      return {
        phone: data.phone,
        expires_in: data.expires_in,
        ...(typeof body.message === 'string' && body.message ? { message: body.message } : {}),
      };
    } catch (error) {
      logApiFailure('sendOtp failed', error);
      // 429 carries retryAfter (seconds) from the body or the Retry-After header (BE-16).
      return rejectWithValue(toThunkRejection(error, 'Failed to send OTP'));
    }
  }
);

export const verifyOtp = createAsyncThunk<AuthSession, VerifyOtpRequest, ThunkConfig>(
  'auth/verifyOtp',
  async (otpData, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      logger.debug('🔄 Redux Thunk - Starting OTP verification process...');
      const data = unwrap(await apiService.verifyOtp(otpData));
      const user = requireUser(data.user);

      if (!(await storeNewSession({ ...data, user }, startedIn))) {
        return rejectWithValue(staleSessionRejection());
      }
      logger.debug('✅ Redux Thunk - OTP verification successful');

      return { user };
    } catch (error) {
      logApiFailure('verifyOtp failed', error);
      return rejectWithValue(toThunkRejection(error, 'OTP verification failed'));
    }
  }
);

/** POST /auth/phone/verify: the user, and whether a session was stored (a token came back). */
export interface VerifiedPhone {
  user: User;
  signedIn: boolean;
}

/**
 * BE-35/BE-38 registration phone step (used by T-201). The returned user is merged into the
 * one already held (registration's), so a missing or null role never nulls it, and the
 * proven number is no longer pending. With a token the session is stored like a login
 * (Keychain, new session epoch); a driver pending approval gets no token, so nothing is
 * stored and the user stays signed out.
 */
export const verifyPhone = createAsyncThunk<
  VerifiedPhone,
  VerifyPhoneRequest,
  ThunkConfig & { state: { apiAuth: { user: User | null } } }
>(
  'auth/verifyPhone',
  async (request, { rejectWithValue, getState }) => {
    const startedIn = currentSessionEpoch();
    try {
      const data = unwrap(await apiService.verifyPhone(request));
      const merged = mergeServerUser(getState().apiAuth.user, data.user);
      if (!merged) {
        throw new ApiError({ kind: 'unknown', message: 'Invalid response format from server' });
      }
      const user: User = { ...merged, pending_phone: null };

      if (!data.token) {
        if (isStaleSession(startedIn)) {
          return rejectWithValue(staleSessionRejection());
        }
        return { user, signedIn: false };
      }
      if (!(await storeNewSession({ user, token: data.token, expires_at: data.expires_at }, startedIn))) {
        return rejectWithValue(staleSessionRejection());
      }
      return { user, signedIn: true };
    } catch (error) {
      logApiFailure('verifyPhone failed', error);
      return rejectWithValue(toThunkRejection(error, 'Phone verification failed'));
    }
  }
);

/** BE-35: resend the registration code. Like sendOtp, an echoed otp_code is dropped here. */
export const resendPhoneCode = createAsyncThunk<OtpSentInfo, ResendPhoneCodeRequest, ThunkConfig>(
  'auth/resendPhoneCode',
  async (request, { rejectWithValue }) => {
    try {
      const data = unwrap(await apiService.resendPhoneCode(request));
      return { phone: data.phone, expires_in: data.expires_in };
    } catch (error) {
      logApiFailure('resendPhoneCode failed', error);
      // 429/503 carry code and retryAfter (BE-28), as for sendOtp.
      return rejectWithValue(toThunkRejection(error, 'Failed to resend code'));
    }
  }
);

export const forgotPassword = createAsyncThunk<string, string, ThunkConfig>(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      return messageOf(await apiService.forgotPassword(email), 'Password reset email sent');
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Failed to send reset email'));
    }
  }
);

export const resetPassword = createAsyncThunk<string, ResetPasswordRequest, ThunkConfig>(
  'auth/resetPassword',
  async (resetData, { rejectWithValue }) => {
    try {
      return messageOf(await apiService.resetPassword(resetData), 'Password reset successful');
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Password reset failed'));
    }
  }
);

// User Profile Thunks
export const getUserProfile = createAsyncThunk<
  User,
  void,
  ThunkConfig & { state: { apiAuth: { user: User | null } } }
>(
  'auth/getUserProfile',
  async (_, { rejectWithValue, getState }) => {
    const startedIn = currentSessionEpoch();
    try {
      const user = requireUser(unwrap(await apiService.getProfile()).user);
      // Signed out (or in again as someone else) while this was in flight: drop it. The
      // storage write re-checks the epoch, so a logout during the write also wins (T-104).
      if (!(await authStorage.saveUser(user, startedIn)) || isStaleSession(startedIn)) {
        return rejectWithValue(staleSessionRejection());
      }
      return user;
    } catch (error) {
      const rejection = toThunkRejection(error, 'Failed to get profile');
      // 403 ACCOUNT_* (BE-32): the reducer merges the refused status into the user; the cache
      // gets it too (without rejection_reason), so an offline cold start does not route home.
      const current = getState().apiAuth.user;
      const refused = current ? withRefusedStatus(current, rejection) : null;
      if (refused && !isStaleSession(startedIn)) {
        await authStorage.saveUser(refused, startedIn);
      }
      if (isStaleSession(startedIn)) {
        return rejectWithValue(staleSessionRejection());
      }
      return rejectWithValue(rejection);
    }
  }
);

export const updateUserProfile = createAsyncThunk<User, Partial<User>, ThunkConfig>(
  'auth/updateUserProfile',
  async (userData, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      // BE-29: PUT /profile returns the profile itself as `data` (not `{ user }`).
      const user = requireUser(unwrap(await apiService.updateProfile(userData)));
      if (!(await authStorage.saveUser(user, startedIn)) || isStaleSession(startedIn)) {
        return rejectWithValue(staleSessionRejection());
      }
      return user;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Profile update failed'));
    }
  }
);

/**
 * How long the cold-start check waits for GET /auth/profile when it has to wait at all (no
 * cached user, or one that is not active). A slow or captive network then falls into the
 * "keep the stored session" path within seconds instead of the 30 s axios default (PERF-01).
 */
export const BOOT_PROFILE_TIMEOUT_MS = 5000;

// Initialize Auth State (AUTH-04, INF-08, PERF-01)
/**
 * Restores the stored session on cold start.
 * - no stored token: null (signed out)
 * - a cached user who routes home (status `active`, a role this app serves): that session at
 *   once, with `revalidate: true` and no request (T-531). bootstrapAuth then checks it with
 *   revalidateSession in the background; a 401 there ends the session (T-104 logout) and a
 *   403 ACCOUNT_* or a non-active profile routes to account status (T-106).
 * Otherwise it checks the session with GET /auth/profile (BOOT_PROFILE_TIMEOUT_MS) first:
 * - 200: the session with the fresh user from the server
 * - 401: the token is invalid, so it is cleared: null
 * - 403 ACCOUNT_* (BE-25/BE-32): the server is authoritative. The session is kept (a blocked
 *   account's token answers 403, not 401) and the refused status is merged into the cached
 *   user and saved, so AuthFlow routes to account status instead of home.
 * - a 2xx that is not a valid profile: the token is kept, but the cached user is not trusted
 *   to be active; it routes to account status (status UNKNOWN_STATUS, `statusUnverified`).
 * - offline, timeout, 5xx, other 4xx: the stored session is kept and routed from the cache.
 *   Only a 401 ends a session.
 * If a logout happens while it runs, it rejects with staleSessionRejection() and the
 * reducer leaves the signed-out state alone.
 */
export const initializeAuth = createAsyncThunk<
  { user: User; statusUnverified?: boolean; revalidate?: boolean } | null,
  void,
  ThunkConfig & { state: { apiAuth: { user: User | null } } }
>(
  'auth/initializeAuth',
  async (_, { rejectWithValue, getState }) => {
    const startedIn = currentSessionEpoch();
    try {
      const token = await apiService.getAuthToken();
      if (!token) {
        return null;
      }
      // The cached user, or the one redux-persist rehydrated (both without sensitive fields).
      // Either may come from an older build without `role`, so it is normalised again.
      const storedUser =
        (await apiService.getUserData()) ?? normalizeUser(getState().apiAuth.user) ?? null;

      if (storedUser && routesHome(storedUser)) {
        // The server confirmed this account active before; route now and check it after.
        return { user: storedUser, revalidate: true };
      }

      let session: AuthSession | null;
      let serverAnswered = false;
      try {
        const body = await apiService.getProfile({ timeout: BOOT_PROFILE_TIMEOUT_MS });
        serverAnswered = true;
        const user = requireUser(unwrap(body).user);
        if (!(await authStorage.saveUser(user, startedIn)) || isStaleSession(startedIn)) {
          return rejectWithValue(staleSessionRejection());
        }
        session = { user };
      } catch (error) {
        if (isStaleSession(startedIn)) {
          return rejectWithValue(staleSessionRejection());
        }
        const apiError = toApiError(error);
        if (apiError.status === 401) {
          // The stored session is dead: end its epoch so nothing of it applies later.
          bumpSessionEpoch();
          await apiService.clearAuthData();
          return null;
        }
        const refused = storedUser ? withRefusedStatus(storedUser, apiError) : null;
        if (refused) {
          // Blocked account (BE-32): keep the session, route to account status. The storage
          // write drops rejection_reason, which stays in Redux memory only.
          if (!(await authStorage.saveUser(refused, startedIn)) || isStaleSession(startedIn)) {
            return rejectWithValue(staleSessionRejection());
          }
          return { user: refused };
        }
        if (serverAnswered) {
          // The server answered 2xx but not with a profile (bad deploy, proxy or captive
          // portal page). Signing out would throw away a session that may be fine, so the
          // token stays; but nothing confirmed the account is active, so the cached user is
          // not let into the home screens. Account status says the status could not be
          // confirmed and offers Check Status and Sign Out (T-106). This status is not
          // written to user_data, but redux-persist does write it to persist:root with the
          // rest of apiAuth. That is harmless and fails closed: the next launch prefers
          // user_data, routes nowhere until this check runs again, and a cached active
          // status never wins over an unconfirmed one in this launch.
          logger.warn('initializeAuth - invalid profile response; routing to account status');
          return storedUser
            ? { user: { ...storedUser, status: UNKNOWN_STATUS }, statusUnverified: true }
            : null;
        }
        logger.warn('initializeAuth - profile check failed; keeping the stored session', {
          kind: apiError.kind,
          status: apiError.status,
        });
        // Without a cached user there is nothing to route on; stay signed out but keep the
        // token so the next launch can try again.
        session = storedUser ? { user: storedUser } : null;
      }
      return session;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Failed to initialize auth'));
    }
  }
);

/**
 * Background check of a session that initializeAuth routed from the cache (T-531, PERF-01).
 * The reducer only touches `user` and `statusUnverified` (no loading status, no error), so
 * the home screens do not flicker while it runs. It uses the short boot timeout: home is
 * already shown, and an unanswered check keeps the cached session. Same rules as the
 * cold-start check:
 * - 200 with a profile: the fresh user replaces the cached one; a previously active user who
 *   no longer routes home has sockets and location stopped at once (stopLiveServices, as
 *   accountRefused) and routes to account status.
 * - 401: the API layer's session-expired handler runs the unified logout (T-104), because the
 *   app is initialised by now; this thunk only rejects.
 * - 403 ACCOUNT_*: the refused status is merged into the user and cached (T-106), as the API
 *   layer's account-refused handler also does.
 * - a 2xx that is not a profile: nothing confirmed the account is active, so the user routes
 *   to account status ("couldn't confirm", UNKNOWN_STATUS, `statusUnverified`; T-106). The
 *   status is not written to user_data.
 * - offline, timeout, 5xx, other 4xx: the cached session stays, as on an offline cold start.
 *   Any later request still meets the 401/403 handlers.
 */
export const revalidateSession = createAsyncThunk<
  { user: User; statusUnverified?: boolean },
  void,
  ThunkConfig & { state: { apiAuth: { user: User | null } } }
>('auth/revalidateSession', async (_, { rejectWithValue, getState }) => {
  const startedIn = currentSessionEpoch();
  let serverAnswered = false;
  try {
    const body = await apiService.getProfile({ timeout: BOOT_PROFILE_TIMEOUT_MS });
    serverAnswered = true;
    const user = requireUser(unwrap(body).user);
    if (!(await authStorage.saveUser(user, startedIn)) || isStaleSession(startedIn)) {
      return rejectWithValue(staleSessionRejection());
    }
    if (getState().apiAuth.user?.status === 'active' && !routesHome(user)) {
      // Lost access since the cache was written: stop sockets and location now, as a 403
      // ACCOUNT_* does (accountRefused), instead of waiting for home to unmount.
      stopLiveServices('revalidateSession');
    }
    return { user };
  } catch (error) {
    if (isStaleSession(startedIn)) {
      return rejectWithValue(staleSessionRejection());
    }
    const rejection = toThunkRejection(error, 'Failed to check the session');
    const current = getState().apiAuth.user;
    const refused = current ? withRefusedStatus(current, rejection) : null;
    if (refused) {
      await authStorage.saveUser(refused, startedIn);
      if (isStaleSession(startedIn)) {
        return rejectWithValue(staleSessionRejection());
      }
      return rejectWithValue(rejection);
    }
    if (serverAnswered && current) {
      logger.warn('revalidateSession - invalid profile response; routing to account status');
      return { user: { ...current, status: UNKNOWN_STATUS }, statusUnverified: true };
    }
    logger.warn('revalidateSession - profile check failed; keeping the cached session', {
      kind: rejection.kind,
      status: rejection.status,
    });
    return rejectWithValue(rejection);
  }
});

/**
 * App start: initializeAuth, then the background revalidateSession when it routed from the
 * cache. Resolves once both are done (AuthProvider does not wait; tests do).
 */
export const bootstrapAuth =
  (): ThunkAction<Promise<void>, { apiAuth: { user: User | null } }, unknown, UnknownAction> =>
  async (dispatch) => {
    const result = await dispatch(initializeAuth());
    if (initializeAuth.fulfilled.match(result) && result.payload?.revalidate) {
      await dispatch(revalidateSession());
    }
  };
