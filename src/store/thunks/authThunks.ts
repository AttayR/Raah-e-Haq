import { AppDispatch } from '../index';
import {
  sendPhoneVerification,
  verifyPhoneCode,
  createUserProfile,
  getUserByPhone,
  createAuthSession,
  signOutUser,
  listenAuth,
  getAuthSession,
  refreshAuthSession,
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
  setSession,
  clearError,
  updateUserProfile as updateUserProfileAction
} from '../slices/authSlice';

// Start authentication listener
export const startAuthListener = () => (dispatch: AppDispatch, _getState: () => any) => {
  console.log('startAuthListener - Starting...');
  
  // Set up Firebase auth state listener
  const unsubscribe = listenAuth(async (user) => {
    console.log('startAuthListener - Firebase auth state changed:', user ? user.uid : 'signed out');
    
    if (user) {
      // User is signed in, but we need to check if we have a valid session
      // The checkAuthStatusThunk will handle session validation
      console.log('startAuthListener - User signed in, session will be validated by checkAuthStatusThunk');
    } else {
      // User is signed out in Firebase, but check if we have a valid session in AsyncStorage
      console.log('startAuthListener - Firebase user signed out, checking for valid session...');
      
      const session = await getAuthSession();
      if (session) {
        console.log('startAuthListener - Valid session found in AsyncStorage, keeping authenticated state');
        // Don't sign out - we have a valid session
        return;
      } else {
        console.log('startAuthListener - No valid session found, signing out');
        dispatch(setSignedOut());
      }
    }
  });
  
  console.log('startAuthListener - Auth listener set up successfully');
  
  // Return the unsubscribe function
  return () => {
    console.log('startAuthListener - Unsubscribing from auth listener');
    if (unsubscribe) {
      unsubscribe();
    }
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
    
    // Use actual Firebase phone authentication
    const verificationId = await sendPhoneVerification(formattedPhone);
    dispatch(setVerificationId(verificationId));
    
    return verificationId;
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to send verification code';
    dispatch(setAuthError(errorMessage));
    throw error;
  }
};

// Verify phone code and sign in/sign up
export const verifyCodeThunk = (
  verificationCode: string,
  role?: 'driver' | 'passenger',
  displayName?: string,
  email?: string
) => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    console.log('verifyCodeThunk - Starting verification...');
    dispatch(setVerifying());
    dispatch(clearError());
    
    const { auth } = getState();
    const { verificationId, phoneNumber } = auth;
    
    console.log('verifyCodeThunk - Current auth state:', auth);
    
    if (!verificationId || !phoneNumber) {
      throw new Error('Verification ID or phone number not found');
    }
    
    // Verify the code using Firebase
    console.log('verifyCodeThunk - Verifying code with Firebase...');
    const userCredential = await verifyPhoneCode(verificationId, verificationCode);
    const user = userCredential.user;
    console.log('verifyCodeThunk - Firebase verification successful, user:', user.uid);
    
    // If no role provided, just authenticate the user without setting a role
    if (!role) {
      console.log('verifyCodeThunk - No role provided, authenticating user without role...');
      
      // Create a minimal session without role
      const session = await createAuthSession(user, {
        uid: user.uid,
        phoneNumber,
        role: undefined,
        isVerified: true,
        isActive: true,
      });
      
      // Set authenticated state without role
      dispatch(setAuthenticated({
        uid: user.uid,
        phoneNumber,
        role: undefined,
        userProfile: null,
        session
      }));
      
      dispatch(setSession(session));
      console.log('verifyCodeThunk - User authenticated without role, ready for role selection');
      return { user, userProfile: null, session };
    }
    
    // Check if user already exists
    let userProfile = await getUserByPhone(phoneNumber);
    
    if (userProfile) {
      console.log('verifyCodeThunk - Existing user found, updating role if needed...');
      // Existing user - sign in
      if (userProfile.uid !== user.uid) {
        // Phone number exists but with different UID (shouldn't happen with phone auth)
        throw new Error('Phone number already registered with different account');
      }
      
      // Update role if different
      if (userProfile.role !== role) {
        await updateUserProfile(user.uid, { role });
        userProfile = { ...userProfile, role };
      }
    } else {
      console.log('verifyCodeThunk - Creating new user profile...');
      // New user - create profile
      userProfile = await createUserProfile(user.uid, phoneNumber, role, displayName, email);
    }
    
    console.log('verifyCodeThunk - User profile ready:', userProfile);
    
    // Create session
    console.log('verifyCodeThunk - Creating auth session...');
    const session = await createAuthSession(user, userProfile);
    console.log('verifyCodeThunk - Session created:', session);
    
    // Set authenticated state
    console.log('verifyCodeThunk - Dispatching setAuthenticated...');
    dispatch(setAuthenticated({
      uid: user.uid,
      phoneNumber: userProfile.phoneNumber,
      role: userProfile.role,
      userProfile,
      session
    }));
    
    console.log('verifyCodeThunk - Dispatching setSession...');
    dispatch(setSession(session));
    
    console.log('verifyCodeThunk - Verification completed successfully');
    return { user, userProfile, session };
  } catch (error: any) {
    console.error('verifyCodeThunk - Error:', error);
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
export const checkAuthStatusThunk = () => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    console.log('checkAuthStatusThunk - Starting...');
    
    // Check if we have a persisted auth state first
    const { auth } = getState();
    console.log('checkAuthStatusThunk - Current persisted state:', auth);
    
    // If we already have an authenticated user with valid session, don't override it
    if (auth.status === 'authenticated' && auth.uid && auth.session) {
      console.log('checkAuthStatusThunk - User already authenticated, checking session validity...');
      
      // Check if the session is still valid
      const session = await getAuthSession();
      if (session && session.uid === auth.uid) {
        console.log('checkAuthStatusThunk - Valid session found, keeping authenticated state');
        return;
      } else {
        console.log('checkAuthStatusThunk - Session expired or invalid, signing out');
        dispatch(setSignedOut());
        return;
      }
    }
    
    // Check for existing session in AsyncStorage
    console.log('checkAuthStatusThunk - Checking AsyncStorage for existing session...');
    const session = await getAuthSession();
    
    if (session) {
      console.log('checkAuthStatusThunk - Found valid session:', session);
      
      // Restore authentication state from session
      dispatch(setAuthenticated({
        uid: session.uid,
        phoneNumber: session.phoneNumber,
        role: session.role || null,
        userProfile: null, // Will be loaded separately if needed
        session
      }));
      
      console.log('checkAuthStatusThunk - Authentication state restored from session');
    } else {
      console.log('checkAuthStatusThunk - No valid session found, setting signed out state');
      dispatch(setSignedOut());
    }
    
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
        dispatch(updateUserProfileAction({ ...auth.userProfile, ...updates }));
      }
    }
  } catch (error: any) {
    console.error('Profile update error:', error);
    dispatch(setAuthError('Failed to update profile'));
  }
};

// Legacy functions (keeping for backward compatibility)
export const signInThunk = (_email: string, _password: string, _role?: 'driver' | 'passenger' | 'admin') => 
  async (dispatch: AppDispatch) => {
    dispatch(setAuthError('Email authentication not supported. Please use phone authentication.'));
  };

export const signUpThunk = (_email: string, _password: string, _role: 'driver' | 'passenger') => 
  async (dispatch: AppDispatch) => {
    dispatch(setAuthError('Email authentication not supported. Please use phone authentication.'));
  };
