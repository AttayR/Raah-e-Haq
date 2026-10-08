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
import { unwrap, toApiError, toThunkRejection, ThunkRejection } from '../../core/api/errors';
import { currentSessionEpoch, isStaleSession, STALE_SESSION_MESSAGE } from '../sessionEpoch';
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

/** For endpoints whose success body has only a message (no data). */
const messageOf = (body: { success: boolean; message?: string }, fallback: string): string => {
  if (body.success === false) {
    throw new Error(body.message || fallback);
  }
  return body.message || fallback;
};

// Auth Thunks
export const loginUser = createAsyncThunk<AuthSession, LoginRequest, ThunkConfig>(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      logger.debug('🔄 Redux Thunk - Starting user login...');
      const data = unwrap(await apiService.login(credentials));

      await apiService.setAuthToken(data.token);
      await apiService.setUserData(data.user);
      logger.debug('✅ Redux Thunk - Login successful');

      return { user: data.user, token: data.token, tokenType: data.token_type };
    } catch (error) {
      logger.error('💥 Redux Thunk - Login error');
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
      return data.user;
    } catch (error) {
      logger.error('💥 Redux Thunk - Registration error');
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
    try {
      logger.debug('🔄 Redux Thunk - Starting user registration with images...');
      const data = unwrap(await apiService.registerWithImages(userData));

      // Drivers get no token until an admin approves them (token is null).
      await apiService.setAuthToken(data.token);
      await apiService.setUserData(data.user);
      logger.debug('✅ Redux Thunk - Registration with images successful');

      return { user: data.user, token: data.token, tokenType: data.token_type };
    } catch (error) {
      logger.error('💥 Redux Thunk - Registration with images error');
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
      logger.error('💥 Redux Thunk - OTP send error');
      // 429 carries retryAfter (seconds) from the body or the Retry-After header (BE-16).
      return rejectWithValue(toThunkRejection(error, 'Failed to send OTP'));
    }
  }
);

export const verifyOtp = createAsyncThunk<AuthSession, VerifyOtpRequest, ThunkConfig>(
  'auth/verifyOtp',
  async (otpData, { rejectWithValue }) => {
    try {
      logger.debug('🔄 Redux Thunk - Starting OTP verification process...');
      const data = unwrap(await apiService.verifyOtp(otpData));

      await apiService.setAuthToken(data.token);
      await apiService.setUserData(data.user);
      logger.debug('✅ Redux Thunk - OTP verification successful');

      return { user: data.user, token: data.token, tokenType: data.token_type };
    } catch (error) {
      logger.error('💥 Redux Thunk - OTP verification error');
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

export const refreshToken = createAsyncThunk<string, void, ThunkConfig>(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const data = unwrap(await apiService.refreshToken());
      await apiService.setAuthToken(data.token);
      return data.token;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Token refresh failed'));
    }
  }
);

// User Profile Thunks
export const getUserProfile = createAsyncThunk<User, void, ThunkConfig>(
  'auth/getUserProfile',
  async (_, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const data = unwrap(await apiService.getProfile());
      // Signed out (or in again as someone else) while this was in flight: drop it (T-103).
      if (isStaleSession(startedIn)) {
        return rejectWithValue(staleSessionRejection());
      }
      await apiService.setUserData(data.user);
      return data.user;
    } catch (error) {
      return rejectWithValue(toThunkRejection(error, 'Failed to get profile'));
    }
  }
);

export const updateUserProfile = createAsyncThunk<User, Partial<User>, ThunkConfig>(
  'auth/updateUserProfile',
  async (userData, { rejectWithValue }) => {
    try {
      const user = unwrap(await apiService.updateProfile(userData));
      await apiService.setUserData(user);
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
 * - offline, timeout, 5xx, 403 ACCOUNT_* (BE-25; account-status routing is T-106): the stored
 *   session is kept and the user stays signed in. Only a 401 ends a session.
 * If a logout happens while it runs, it rejects with staleSessionRejection() and the
 * reducer leaves the signed-out state alone.
 */
export const initializeAuth = createAsyncThunk<{ user: User; token: string } | null, void, ThunkConfig>(
  'auth/initializeAuth',
  async (_, { rejectWithValue }) => {
    const startedIn = currentSessionEpoch();
    try {
      const token = await apiService.getAuthToken();
      if (!token) {
        return null;
      }
      const storedUser = await apiService.getUserData();

      let session: { user: User; token: string } | null;
      try {
        const data = unwrap(await apiService.getProfile());
        if (isStaleSession(startedIn)) {
          return rejectWithValue(staleSessionRejection());
        }
        await apiService.setUserData(data.user);
        session = { user: data.user, token };
      } catch (error) {
        if (isStaleSession(startedIn)) {
          return rejectWithValue(staleSessionRejection());
        }
        const apiError = toApiError(error);
        if (apiError.status === 401) {
          await apiService.clearAuthData();
          return null;
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
