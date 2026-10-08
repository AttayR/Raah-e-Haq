import { createSlice } from '@reduxjs/toolkit';
import { User, OtpSentInfo } from '../../services/api';
import {
  loginUser,
  registerUser,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  logoutUser,
  logoutAllDevices,
  refreshToken,
  getUserProfile,
  updateUserProfile,
  initializeAuth,
} from '../thunks/apiThunks';
import { rejectionMessage } from '../../core/api/errors';

export type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  /** Phone and TTL of the last code sent. Never the code; never persisted (see store/persistTransforms). */
  otpData: OtpSentInfo | null;
  isOtpSent: boolean;
  isOtpVerified: boolean;
  profileCompleted: boolean;
  isInitialized: boolean;
};

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  status: 'idle',
  error: null,
  otpData: null,
  isOtpSent: false,
  isOtpVerified: false,
  profileCompleted: false,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
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
    // Initialize Auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isInitialized = true;
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.isAuthenticated = true;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.status = 'failed';
        state.isInitialized = true;
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
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
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
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
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.isOtpVerified = true;
        state.otpData = null;
        state.isOtpSent = false;
        state.error = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
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

    // Logout User
    builder
      .addCase(logoutUser.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status = 'succeeded';
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.otpData = null;
        state.isOtpSent = false;
        state.isOtpVerified = false;
        state.profileCompleted = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
        // Still clear auth data even if API call fails
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.otpData = null;
        state.isOtpSent = false;
        state.isOtpVerified = false;
        state.profileCompleted = false;
      });

    // Logout All Devices
    builder
      .addCase(logoutAllDevices.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(logoutAllDevices.fulfilled, (state) => {
        state.status = 'succeeded';
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.otpData = null;
        state.isOtpSent = false;
        state.isOtpVerified = false;
        state.profileCompleted = false;
        state.error = null;
      })
      .addCase(logoutAllDevices.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
        // Still clear auth data even if API call fails
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.otpData = null;
        state.isOtpSent = false;
        state.isOtpVerified = false;
        state.profileCompleted = false;
      });

    // Refresh Token
    builder
      .addCase(refreshToken.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload;
        state.error = null;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.status = 'failed';
        state.error = rejectionMessage(action.payload, action.error.message || 'Something went wrong');
        // If refresh fails, logout user
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      });

    // Get User Profile
    builder
      .addCase(getUserProfile.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(getUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
        state.error = null;
      })
      .addCase(getUserProfile.rejected, (state, action) => {
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
        state.status = 'succeeded';
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
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
