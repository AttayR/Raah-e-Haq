import { AppDispatch } from '../index';
import {
  sendPhoneVerification,
  verifyPhoneCode,
  createUserProfile,
  getUserProfile,
  getUserByPhone,
  createAuthSession,
  signOutUser,
  listenAuth,
  getAuthSession,
  refreshAuthSession,
  clearAuthSession,
  isAuthenticated,
  updateUserProfile
} from '../../services/firebaseAuth';
import {
  setAuthError,
  setAuthLoading,
  setVerifying,
  setAuthenticated,
  setSignedOut,
  setVerificationId,
  setPhoneNumber,
  setUserRole,
  setSession,
  clearError
} from '../slices/authSlice';
import { resetUser } from '../slices/userSlice';

// Start authentication listener
export const startAuthListener = () => (dispatch: AppDispatch) => {
  console.log('startAuthListener - Starting...');
  // For now, just set signed out to show auth screens
  // Firebase phone auth will be implemented later
  console.log('startAuthListener - Setting signed out state');
  dispatch(setSignedOut());
  console.log('startAuthListener - Completed');
  
  // Return a dummy unsubscribe function
  return () => {
    console.log('startAuthListener - Unsubscribing');
  };
};

// Send phone verification code
export const sendVerificationCodeThunk = (phoneNumber: string) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setAuthLoading());
    dispatch(clearError());
    
    // Format phone number (add + if not present)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    dispatch(setPhoneNumber(formattedPhone));
    
    // For now, simulate sending verification code
    const mockVerificationId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    dispatch(setVerificationId(mockVerificationId));
    
    return mockVerificationId;
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to send verification code';
    dispatch(setAuthError(errorMessage));
    throw error;
  }
};

// Verify phone code and sign in/sign up
export const verifyCodeThunk = (
  verificationCode: string,
  role: 'driver' | 'passenger',
  displayName?: string,
  email?: string
) => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    dispatch(setVerifying());
    dispatch(clearError());
    
    const { auth } = getState();
    const { verificationId, phoneNumber } = auth;
    
    if (!verificationId || !phoneNumber) {
      throw new Error('Verification ID or phone number not found');
    }
    
    // For now, simulate verification with mock code '123456'
    if (verificationCode !== '123456') {
      throw new Error('Invalid verification code. Use 123456 for testing.');
    }
    
    // Create mock user data for testing
    const mockUser = {
      uid: `user_${Date.now()}`,
      phoneNumber,
      role,
      displayName,
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
      isVerified: true,
      isActive: true
    };
    
    // Create mock session
    const mockSession = {
      uid: mockUser.uid,
      phoneNumber: mockUser.phoneNumber,
      role: mockUser.role,
      token: 'mock_token_' + Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    // Set authenticated state
    dispatch(setAuthenticated({
      uid: mockUser.uid,
      phoneNumber: mockUser.phoneNumber,
      role: mockUser.role,
      userProfile: mockUser,
      session: mockSession
    }));
    
    dispatch(setSession(mockSession));
    
    return { user: mockUser, userProfile: mockUser, session: mockSession };
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to verify code';
    dispatch(setAuthError(errorMessage));
    throw error;
  }
};

// Sign out
export const signOutThunk = () => async (dispatch: AppDispatch) => {
  try {
    await signOutUser();
    dispatch(setSignedOut());
  } catch (error: any) {
    console.error('Sign out error:', error);
    // Force sign out even if there's an error
    dispatch(setSignedOut());
  }
};

// Check authentication status on app start
export const checkAuthStatusThunk = () => async (dispatch: AppDispatch) => {
  try {
    console.log('checkAuthStatusThunk - Starting...');
    // For now, always set to signed out to show auth screens
    // This will be updated by the auth listener when Firebase initializes
    console.log('checkAuthStatusThunk - Setting signed out state');
    dispatch(setSignedOut());
    console.log('checkAuthStatusThunk - Completed');
  } catch (error: any) {
    console.error('checkAuthStatusThunk - Error:', error);
    dispatch(setSignedOut());
  }
};

// Refresh session
export const refreshSessionThunk = () => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    const { auth } = getState();
    if (auth.uid) {
      const session = await refreshAuthSession({ uid: auth.uid } as any);
      if (session) {
        dispatch(setSession(session));
        return session;
      }
    }
  } catch (error: any) {
    console.error('Session refresh error:', error);
    dispatch(setAuthError('Session refresh failed'));
  }
  return null;
};

// Update user profile
export const updateProfileThunk = (updates: any) => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    const { auth } = getState();
    if (auth.uid) {
      await updateUserProfile(auth.uid, updates);
      if (auth.userProfile) {
        dispatch(updateUserProfile({ ...auth.userProfile, ...updates }));
      }
    }
  } catch (error: any) {
    console.error('Profile update error:', error);
    dispatch(setAuthError('Failed to update profile'));
    throw error;
  }
};

// Legacy functions (keeping for backward compatibility)
export const signInThunk = (email: string, password: string, role?: 'driver' | 'passenger' | 'admin') => 
  async (dispatch: AppDispatch) => {
    dispatch(setAuthError('Email authentication not supported. Please use phone authentication.'));
  };

export const signUpThunk = (email: string, password: string, role: 'driver' | 'passenger') => 
  async (dispatch: AppDispatch) => {
    dispatch(setAuthError('Email authentication not supported. Please use phone authentication.'));
  };
