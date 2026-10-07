import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile, AuthSession } from '../../services/firebaseAuth';
import { logger } from '../../core/logging/logger';

export type AuthState = {
  uid: string | null;
  phoneNumber: string | null;
  role: 'driver' | 'passenger' | 'admin' | null;
  status: 'idle' | 'loading' | 'verifying' | 'authenticated' | 'error';
  error?: string | null;
  userProfile: UserProfile | null;
  session: AuthSession | null;
  isPhoneVerified: boolean;
  verificationId: string | null;
  profileCompleted: boolean;
  isExistingUser: boolean;
  userStatus: 'new' | 'existing' | 'unknown';
};

const initialState: AuthState = {
  uid: null,
  phoneNumber: null,
  role: null,
  status: 'idle',
  error: null,
  userProfile: null,
  session: null,
  isPhoneVerified: false,
  verificationId: null,
  profileCompleted: false,
  isExistingUser: false,
  userStatus: 'unknown',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setIdle: (state) => {
      logger.debug('authSlice - setIdle called');
      state.status = 'idle';
    },
    setAuthLoading: (state) => {
      logger.debug('authSlice - setAuthLoading called');
      state.status = 'loading';
      state.error = null;
    },
    setVerifying: (state) => {
      logger.debug('authSlice - setVerifying called');
      state.status = 'verifying';
      state.error = null;
    },
    setAuthenticated: (state, action: PayloadAction<{ 
      uid: string; 
      phoneNumber: string; 
      role: 'driver' | 'passenger' | 'admin' | undefined;
      userProfile: UserProfile | null;
      session: AuthSession;
      profileCompleted?: boolean;
    }>) => {
      state.uid = action.payload.uid;
      state.phoneNumber = action.payload.phoneNumber;
      state.role = action.payload.role || null;
      state.status = 'authenticated';
      state.userProfile = action.payload.userProfile;
      state.session = action.payload.session;
      state.isPhoneVerified = true;
      state.error = null;
      
      // Set profileCompleted if provided, otherwise keep current value
      if (action.payload.profileCompleted !== undefined) {
        state.profileCompleted = action.payload.profileCompleted;
      }
    },
    setSignedOut: (state) => {
      logger.debug('authSlice - setSignedOut called');
      state.uid = null;
      state.phoneNumber = null;
      state.role = null;
      state.status = 'idle';
      state.userProfile = null;
      state.session = null;
      state.isPhoneVerified = false;
      state.verificationId = null;
      state.profileCompleted = false;
      state.error = null;
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      logger.debug('authSlice - setAuthError called with:', action.payload);
      state.error = action.payload;
      state.status = 'error';
    },
    setVerificationId: (state, action: PayloadAction<string>) => {
      state.verificationId = action.payload;
    },
    setPhoneNumber: (state, action: PayloadAction<string>) => {
      state.phoneNumber = action.payload;
    },
    setUserRole: (state, action: PayloadAction<'driver' | 'passenger' | 'admin'>) => {
      logger.debug('authSlice - setUserRole called with:', action.payload);
      state.role = action.payload;
    },
    setProfileCompleted: (state) => {
      logger.debug('authSlice - setProfileCompleted called');
      logger.debug('authSlice - Before: profileCompleted =', state.profileCompleted);
      state.profileCompleted = true;
      logger.debug('authSlice - After: profileCompleted =', state.profileCompleted);
    },
    setUserProfile: (state, action: PayloadAction<UserProfile>) => {
      state.userProfile = action.payload;
    },
    clearProfileCompleted: (state) => {
      logger.debug('authSlice - clearProfileCompleted called');
      state.profileCompleted = false;
    },
    updateUserProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.userProfile) {
        state.userProfile = { ...state.userProfile, ...action.payload };
      }
    },
    clearError: (state) => {
      logger.debug('authSlice - clearError called');
      state.error = null;
    },
    setSession: (state, action: PayloadAction<AuthSession>) => {
      state.session = action.payload;
    },
    setUserStatus: (state, action: PayloadAction<{ isExistingUser: boolean; userStatus: 'new' | 'existing' | 'unknown'; userProfile?: UserProfile }>) => {
      logger.debug('authSlice - setUserStatus called with:', action.payload);
      state.isExistingUser = action.payload.isExistingUser;
      state.userStatus = action.payload.userStatus;
      if (action.payload.userProfile) {
        state.userProfile = action.payload.userProfile;
      }
    },
    clearUserStatus: (state) => {
      logger.debug('authSlice - clearUserStatus called');
      state.isExistingUser = false;
      state.userStatus = 'unknown';
    }
  },
});

export const {
  setIdle,
  setAuthLoading,
  setVerifying,
  setAuthenticated,
  setSignedOut,
  setAuthError,
  setVerificationId,
  setPhoneNumber,
  setUserRole,
  updateUserProfile,
  clearError,
  setSession,
  setProfileCompleted,
  clearProfileCompleted,
  setUserProfile,
  setUserStatus,
  clearUserStatus
} = authSlice.actions;

export default authSlice.reducer;