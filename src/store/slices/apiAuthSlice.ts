import { createSlice } from '@reduxjs/toolkit';
import { User, OtpSentInfo } from '../../services/api';
import {
  loginUser,
  registerUser,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  initializeAuth,
  isStaleSessionRejection,
} from '../thunks/apiThunks';
import { logout } from '../thunks/sessionThunks';
import { accountStatusRefused, resetApp } from '../actions';
import { rejectionMessage } from '../../core/api/errors';
import { accountRefusalMessage } from '../../core/auth/accountRefusal';
import { withRefusedStatus } from '../../core/auth/normalizeUser';

/**
 * The API session in Redux. There is no token here: the bearer token lives only in the
 * Keychain/Keystore (services/authStorage), read by the axios interceptor (T-104, T-107).
 */
export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  /** Phone and TTL of the last code sent. Never the code; never persisted (see store/persistTransforms). */
  otpData: OtpSentInfo | null;
  isOtpSent: boolean;
  isOtpVerified: boolean;
  profileCompleted: boolean;
  isInitialized: boolean;
  /**
   * The server answered GET /auth/profile with something that is not a profile, so nothing
   * confirmed the account's status (initializeAuth); `user.status` is UNKNOWN_STATUS then and
   * the account-status screen says "couldn't confirm" instead of "deactivated". Cleared by any
   * answer that states the status (a profile or a 403 ACCOUNT_*).
   */
  statusUnverified: boolean;
};

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  status: 'idle',
  error: null,
  otpData: null,
  isOtpSent: false,
  isOtpVerified: false,
  profileCompleted: false,
  isInitialized: false,
  statusUnverified: false,
};

const authSlice = createSlice({
  // Matches its store key (AUTH-16): actions are apiAuth/*, never shared with another slice.
  name: 'apiAuth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearOtpData: (state) => {
      state.otpData = null;
      state.isOtpSent = false;
      state.isOtpVerified = false;
    },
    setProfileCompleted: (state) => {
      state.profileCompleted = true;
    },
    clearProfileCompleted: (state) => {
      state.profileCompleted = false;
    },
    resetAuthState: () => {
      return { ...initialState, isInitialized: true };
    },
  },
  extraReducers: (builder) => {
    // Initialize Auth (AUTH-04): a null result means signed out, whatever was rehydrated.
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        if (!action.payload) {
          return { ...initialState, isInitialized: true };
        }
        state.status = 'succeeded';
        state.isInitialized = true;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.statusUnverified = action.payload.statusUnverified === true;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        // Logged out while it ran: logout has already reset this slice (initialised).
        if (isStaleSessionRejection(action.payload)) {
          return;
        }
        // Storage could not be read: start signed out; the token stays for the next launch.
        return {
          ...initialState,
          isInitialized: true,
          status: 'failed',
          error: rejectionMessage(action.payload, action.error.message || 'Something went wrong'),
        };
      });

    // Login User
    builder
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.statusUnverified = false;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        // Logged out while it ran (T-104): logout already reset this slice.
        if (isStaleSessionRejection(action.payload)) {
          return;
        }
        state.status = 'failed';
        // A 403 ACCOUNT_* refusal shows the server's message plus the rejection reason (BE-32).
        state.error = accountRefusalMessage(action.payload, action.error.message || 'Something went wrong');
        state.isAuthenticated = false;
      });

    // Register User
    builder
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
        state.isAuthenticated = false; // User needs to verify phone
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
      });

    // Send OTP
    builder
      .addCase(sendOtp.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(sendOtp.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.otpData = { phone: action.payload.phone, expires_in: action.payload.expires_in };
        state.isOtpSent = true;
        state.error = null;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
        state.isOtpSent = false;
      });

    // Verify OTP
    builder
      .addCase(verifyOtp.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.statusUnverified = false;
        state.isOtpVerified = true;
        state.otpData = null;
        state.isOtpSent = false;
        state.error = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        if (isStaleSessionRejection(action.payload)) {
          return;
        }
        state.status = 'failed';
        state.error = accountRefusalMessage(action.payload, action.error.message || 'Something went wrong');
        state.isOtpVerified = false;
      });

    // Forgot Password
    builder
      .addCase(forgotPassword.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
      });

    // Reset Password
    builder
      .addCase(resetPassword.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
      });

    // Logout (store/thunks/sessionThunks.ts). The root reducer has already reset this slice
    // when resetApp arrives; the app stays initialised so no splash/bootstrap runs again.
    builder
      .addCase(logout.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(resetApp, () => ({ ...initialState, isInitialized: true }))
      // 403 ACCOUNT_* on any request of this session (store/thunks/sessionThunks accountRefused).
      .addCase(accountStatusRefused, (state, action) => {
        if (!state.isAuthenticated) {
          return;
        }
        state.user = action.payload;
        state.statusUnverified = false;
      });

    // Get User Profile
    builder
      .addCase(getUserProfile.pending, (state) => {
        // Signed out: the result will be dropped, so the signed-out screens never show a spinner.
        if (!state.isAuthenticated) {
          return;
        }
        state.status = 'loading';
        state.error = null;
      })
      .addCase(getUserProfile.fulfilled, (state, action) => {
        // Never re-write the user after logout (the thunk also checks the session epoch).
        if (!state.isAuthenticated) {
          return;
        }
        state.status = 'succeeded';
        state.user = action.payload;
        state.statusUnverified = false;
        state.error = null;
      })
      .addCase(getUserProfile.rejected, (state, action) => {
        // Dropped because the session ended (T-103): the signed-out state stays untouched.
        if (isStaleSessionRejection(action.payload)) {
          return;
        }
        // 403 ACCOUNT_* (BE-32): the account is blocked; AuthFlow routes on the merged status.
        const refused = state.isAuthenticated && state.user ? withRefusedStatus(state.user, action.payload) : null;
        if (refused) {
          state.user = refused;
          state.statusUnverified = false;
        }
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
      });

    // Update User Profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        if (!state.isAuthenticated) {
          return;
        }
        state.status = 'succeeded';
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        if (isStaleSessionRejection(action.payload)) {
          return;
        }
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
      });
  },
});

export const {
  clearError,
  clearOtpData,
  setProfileCompleted,
  clearProfileCompleted,
  resetAuthState,
} = authSlice.actions;

export default authSlice.reducer;
