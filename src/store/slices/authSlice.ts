import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile, AuthSession } from '../../services/firebaseAuth';

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
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading: (state) => {
      console.log('authSlice - setAuthLoading called');
      state.status = 'loading';
      state.error = null;
    },
    setVerifying: (state) => {
      console.log('authSlice - setVerifying called');
      state.status = 'verifying';
      state.error = null;
    },
    setAuthenticated: (state, action: PayloadAction<{ 
      uid: string; 
      phoneNumber: string; 
      role: 'driver' | 'passenger' | 'admin' | undefined;
      userProfile: UserProfile | null;
      session: AuthSession;
    }>) => {
      console.log('authSlice - setAuthenticated called with:', action.payload);
      state.uid = action.payload.uid;
      state.phoneNumber = action.payload.phoneNumber;
      state.role = action.payload.role || null;
      state.status = 'authenticated';
      state.userProfile = action.payload.userProfile;
      state.session = action.payload.session;
      state.isPhoneVerified = true;
      state.error = null;
    },
    setSignedOut: (state) => {
      console.log('authSlice - setSignedOut called');
      state.uid = null;
      state.phoneNumber = null;
      state.role = null;
      state.status = 'idle';
      state.userProfile = null;
      state.session = null;
      state.isPhoneVerified = false;
      state.verificationId = null;
      state.error = null;
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      console.log('authSlice - setAuthError called with:', action.payload);
      state.error = action.payload;
      state.status = 'error';
    },
    setVerificationId: (state, action: PayloadAction<string>) => {
      console.log('authSlice - setVerificationId called with:', action.payload);
      state.verificationId = action.payload;
    },
    setPhoneNumber: (state, action: PayloadAction<string>) => {
      console.log('authSlice - setPhoneNumber called with:', action.payload);
      state.phoneNumber = action.payload;
    },
    setUserRole: (state, action: PayloadAction<'driver' | 'passenger' | 'admin'>) => {
      console.log('authSlice - setUserRole called with:', action.payload);
      state.role = action.payload;
    },
    setProfileCompleted: (state) => {
      console.log('authSlice - setProfileCompleted called');
      console.log('authSlice - Before: profileCompleted =', state.profileCompleted);
      state.profileCompleted = true;
      console.log('authSlice - After: profileCompleted =', state.profileCompleted);
      console.log('authSlice - Full state after setProfileCompleted:', state);
    },
    setUserProfile: (state, action: PayloadAction<UserProfile>) => {
      console.log('authSlice - setUserProfile called with:', action.payload);
      state.userProfile = action.payload;
    },
    clearProfileCompleted: (state) => {
      console.log('authSlice - clearProfileCompleted called');
      state.profileCompleted = false;
    },
    updateUserProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      console.log('authSlice - updateUserProfile called with:', action.payload);
      if (state.userProfile) {
        state.userProfile = { ...state.userProfile, ...action.payload };
      }
    },
    clearError: (state) => {
      console.log('authSlice - clearError called');
      state.error = null;
    },
    setSession: (state, action: PayloadAction<AuthSession>) => {
      console.log('authSlice - setSession called with:', action.payload);
      state.session = action.payload;
    }
  },
});

export const {
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
  setUserProfile
} = authSlice.actions;

export default authSlice.reducer;