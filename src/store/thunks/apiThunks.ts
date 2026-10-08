import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  apiService,
  LoginRequest,
  RegisterRequest,
  VerifyOtpRequest,
  ResetPasswordRequest,
  OtpSentInfo,
  User,
} from '../../services/api';
import { authStorage } from '../../services/authStorage';
import { unwrap, toApiError, toThunkRejection, ThunkRejection, ApiError } from '../../core/api/errors';
import { normalizeUser, UNKNOWN_STATUS, withRefusedStatus } from '../../core/auth/normalizeUser';
import { logApiFailure } from '../../core/api/logApiFailure';
import {
  bumpSessionEpoch,
  currentSessionEpoch,
  isStaleSession,
  STALE_SESSION_MESSAGE,
} from '../sessionEpoch';
import { logger } from '../../core/logging/logger';

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

export interface AuthSession {
  user: User;
  token: string;
  tokenType: string;
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

      return { user, token: data.token, tokenType: data.token_type };
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

export const registerUserWithImages = createAsyncThunk<
  { user: User; token: string | null; tokenType: string | null },
  RegisterRequest & {
    passenger_cnic_front_image?: string;
    passenger_cnic_back_image?: string;
  },
  ThunkConfig
>(
  'auth/registerUserWithImages',
  async (userData, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      logger.debug('🔄 Redux Thunk - Starting user registration with images...');
      const data = unwrap(await apiService.registerWithImages(userData));
      const user = requireUser(data.user);

      // Drivers get no token until an admin approves them (token is null). Whether a token
      // should be kept at all after registration is AUTH-17 (T-202).
      const stored = data.token
        ? await storeNewSession({ ...data, user, token: data.token }, startedIn)
        : await authStorage.saveUser(user, startedIn);
      if (!stored) {
        return rejectWithValue(staleSessionRejection());
      }
      logger.debug('✅ Redux Thunk - Registration with images successful');

      return { user, token: data.token, tokenType: data.token_type };
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
      const data = unwrap(await apiService.sendOtp(phone));
      logger.debug('✅ Redux Thunk - OTP sent; expires in', data.expires_in, 'seconds');
      // The local backend may echo otp_code (APP_ENV=local + debug). It is dropped here so
      // it never reaches Redux, redux-persist, the UI or the logs (AUTH-02, INF-05).
      return { phone: data.phone, expires_in: data.expires_in };
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

      return { user, token: data.token, tokenType: data.token_type };
    } catch (error) {
      logApiFailure('verifyOtp failed', error);
      return rejectWithValue(toThunkRejection(error, 'OTP verification failed'));
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

// Initialize Auth State (AUTH-04, INF-08)
/**
 * Restores the stored session on cold start and checks it with GET /auth/profile.
 * - no stored token: null (signed out)
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
  { user: User; token: string; statusUnverified?: boolean } | null,
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

      let session: { user: User; token: string } | null;
      let serverAnswered = false;
      try {
        const body = await apiService.getProfile();
        serverAnswered = true;
        const user = requireUser(unwrap(body).user);
        if (!(await authStorage.saveUser(user, startedIn)) || isStaleSession(startedIn)) {
          return rejectWithValue(staleSessionRejection());
        }
        session = { user, token };
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
          return { user: refused, token };
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
            ? { user: { ...storedUser, status: UNKNOWN_STATUS }, token, statusUnverified: true }
            : null;
        }
        logger.warn('initializeAuth - profile check failed; keeping the stored session', {
          kind: apiError.kind,
          status: apiError.status,
        });
        // Without a cached user there is nothing to route on; stay signed out but keep the
        // token so the next launch can try again.
        session = storedUser ? { user: storedUser, token } : null;
      }
      return session;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Failed to initialize auth'));
    }
  }
);
