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
  updateUserProfile,
  emailSignUp,
  emailSignIn,
  resetPassword,
  createUserProfileWithDetails,
  createDriverProfileWithDetails,
  googleSignIn,
  getUserByEmail,
  getUserByCnic,
} from '../../services/firebaseAuth';
import firestore from '@react-native-firebase/firestore';
import { errorToastMessage, toast } from '../../core/toast';
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
  updateUserProfile as updateUserProfileAction,
  setUserStatus,
  clearUserStatus,
  setProfileCompleted
} from '../slices/authSlice';
import authModule from '@react-native-firebase/auth';
import { logger } from '../../core/logging/logger';

// Start authentication listener
export const startAuthListener = () => (dispatch: AppDispatch, _getState: () => any) => {
  logger.debug('startAuthListener - Starting...');
  
  // Set up Firebase auth state listener
  const unsubscribe = listenAuth(async (user) => {
    logger.debug('startAuthListener - Firebase auth state changed:', user ? user.uid : 'signed out');
    
    if (user) {
      // User is signed in, but we need to check if we have a valid session
      // The checkAuthStatusThunk will handle session validation
      logger.debug('startAuthListener - User signed in, session will be validated by checkAuthStatusThunk');
    } else {
      // User is signed out in Firebase, but check if we have a valid session in AsyncStorage
      logger.debug('startAuthListener - Firebase user signed out, checking for valid session...');
      
      const session = await getAuthSession();
      if (session) {
        logger.debug('startAuthListener - Valid session found in AsyncStorage, keeping authenticated state');
        // Don't sign out - we have a valid session
        return;
      } else {
        logger.debug('startAuthListener - No valid session found, signing out');
        dispatch(setSignedOut());
      }
    }
  });
  
  logger.debug('startAuthListener - Auth listener set up successfully');
  
  // Return the unsubscribe function
  return () => {
    logger.debug('startAuthListener - Unsubscribing from auth listener');
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
    dispatch(clearUserStatus());
    
    // Format phone number (add + if not present)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    dispatch(setPhoneNumber(formattedPhone));
    
    // Use actual Firebase phone authentication
    const result = await sendPhoneVerification(formattedPhone);
    dispatch(setVerificationId(result.verificationId));
    
    // Set user status based on whether user exists
    dispatch(setUserStatus({
      isExistingUser: result.isExistingUser,
      userStatus: result.isExistingUser ? 'existing' : 'new',
      userProfile: result.userProfile
    }));
    toast.success('Verification code sent');
    
    return result;
  } catch (error: any) {
    const errorMessage = errorToastMessage(error, 'Failed to send verification code') ?? 'Failed to send verification code';
    dispatch(setAuthError(errorMessage));
    toast.fromError(error, 'Failed to send verification code');
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
    logger.debug('verifyCodeThunk - Starting verification...');
    dispatch(setVerifying());
    dispatch(clearError());
    
    const { auth } = getState();
    const { verificationId, phoneNumber, isExistingUser, userProfile: existingUserProfile } = auth;
    
    logger.debug('verifyCodeThunk - Current auth state:', {
      hasVerificationId: !!verificationId,
      hasPhone: !!phoneNumber,
      isExistingUser,
    });
    
    if (!verificationId || !phoneNumber) {
      throw new Error('Verification ID or phone number not found');
    }
    
    // Verify the code using Firebase
    logger.debug('verifyCodeThunk - Verifying code with Firebase...');
    const userCredential = await verifyPhoneCode(verificationId, verificationCode);
    const user = userCredential.user;
    logger.debug('verifyCodeThunk - Firebase verification successful, user:', user.uid);
    
    // Handle existing user flow
    if (isExistingUser && existingUserProfile) {
      logger.debug('verifyCodeThunk - Existing user detected, signing in...');
      
      // Update last login time
      await updateUserProfile(user.uid, { 
        updatedAt: firestore.FieldValue.serverTimestamp() 
      });
      
      // Create session for existing user
      const session = await createAuthSession(user, existingUserProfile);
      
      // Set authenticated state for existing user with profileCompleted = true
      dispatch(setAuthenticated({
        uid: user.uid,
        phoneNumber: existingUserProfile.phoneNumber,
        role: existingUserProfile.role,
        userProfile: existingUserProfile,
        session,
        profileCompleted: true
      }));
      
      dispatch(setSession(session));
      logger.debug('verifyCodeThunk - Existing user signed in successfully');
      toast.success('Signed in successfully');
      return { user, userProfile: existingUserProfile, session, isExistingUser: true };
    }
    
    // Handle new user flow
    logger.debug('verifyCodeThunk - New user detected...');
    
    // If no role provided, just authenticate the user without setting a role
    if (!role) {
      logger.debug('verifyCodeThunk - No role provided, authenticating user without role...');
      
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
        session,
        profileCompleted: false
      }));
      
      dispatch(setSession(session));
      logger.debug('verifyCodeThunk - User authenticated without role, ready for role selection');
      toast.success('Phone verified successfully');
      return { user, userProfile: null, session, isExistingUser: false };
    }
    
    // Create new user profile
    logger.debug('verifyCodeThunk - Creating new user profile...');
    const userProfile = await createUserProfile(user.uid, phoneNumber, role, displayName, email);
    
    
    // Create session
    logger.debug('verifyCodeThunk - Creating auth session...');
    const session = await createAuthSession(user, userProfile);
    
    // Set authenticated state
    logger.debug('verifyCodeThunk - Dispatching setAuthenticated...');
    dispatch(setAuthenticated({
      uid: user.uid,
      phoneNumber: userProfile.phoneNumber,
      role: userProfile.role,
      userProfile,
      session,
      profileCompleted: true
    }));
    
    logger.debug('verifyCodeThunk - Dispatching setSession...');
    dispatch(setSession(session));
    
    logger.debug('verifyCodeThunk - Verification completed successfully');
    toast.success('Account created successfully');
    return { user, userProfile, session, isExistingUser: false };
  } catch (error: any) {
    logger.error('verifyCodeThunk - Error:', error);
    const errorMessage = errorToastMessage(error, 'Failed to verify code') ?? 'Failed to verify code';
    dispatch(setAuthError(errorMessage));
    toast.fromError(error, 'Failed to verify code');
    throw error;
  }
};

// Sign out
export const signOutThunk = () => async (dispatch: AppDispatch) => {
  try {
    await signOutUser();
    dispatch(setSignedOut());
  } catch (error: any) {
    logger.error('Sign out error:', error);
    // Force sign out even if there's an error
    dispatch(setSignedOut());
  }
};

// Check authentication status on app start
export const checkAuthStatusThunk = () => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    logger.debug('checkAuthStatusThunk - Starting...');
    
    // Check if we have a persisted auth state first
    const { auth } = getState();
    logger.debug('checkAuthStatusThunk - Current persisted state:', auth);
    
    // If we already have an authenticated user with valid session, don't override it
    if (auth.status === 'authenticated' && auth.uid && auth.session) {
      logger.debug('checkAuthStatusThunk - User already authenticated, checking session validity...');
      
      // Check if the session is still valid
      const session = await getAuthSession();
      if (session && session.uid === auth.uid) {
        logger.debug('checkAuthStatusThunk - Valid session found, keeping authenticated state');
        return;
      } else {
        logger.debug('checkAuthStatusThunk - Session expired or invalid, signing out');
        dispatch(setSignedOut());
        return;
      }
    }
    
    // Check for existing session in AsyncStorage
    logger.debug('checkAuthStatusThunk - Checking AsyncStorage for existing session...');
    const session = await getAuthSession();
    
    if (session) {
      
      // Restore authentication state from session
      dispatch(setAuthenticated({
        uid: session.uid,
        phoneNumber: session.phoneNumber,
        role: session.role || null,
        userProfile: null, // Will be loaded separately if needed
        session,
        profileCompleted: true // If there's a valid session, profile must be completed
      }));
      
      logger.debug('checkAuthStatusThunk - Authentication state restored from session');
    } else {
      logger.debug('checkAuthStatusThunk - No valid session found, setting signed out state');
      dispatch(setSignedOut());
    }
    
    logger.debug('checkAuthStatusThunk - Completed');
  } catch (error: any) {
    logger.error('checkAuthStatusThunk - Error:', error);
    dispatch(setSignedOut());
  }
};

// Refresh session
export const refreshSessionThunk = () => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    const currentUser = authModule().currentUser;
    if (!currentUser) return null;
    const session = await refreshAuthSession();
    if (session) {
      dispatch(setSession(session));
      return session;
    }
  } catch (error: any) {
    logger.error('Session refresh error:', error);
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
    logger.error('Profile update error:', error);
    dispatch(setAuthError('Failed to update profile'));
  }
};

// Email/Password Authentication Thunks
export const emailSignUpThunk = (
  email: string, 
  password: string, 
  role: 'driver' | 'passenger',
  displayName?: string,
  phoneNumber?: string
) => async (dispatch: AppDispatch) => {
  try {
    logger.debug('emailSignUpThunk - Starting email signup...');
    dispatch(setAuthLoading());
    dispatch(clearError());
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Optional phone validations
    if (phoneNumber && phoneNumber.trim().length > 0) {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      const phoneExists = await getUserByPhone(formattedPhone);
      if (phoneExists) throw new Error('Phone number already exists');
    }

    // Uniqueness checks
    const [emailExists] = await Promise.all([
      getUserByEmail(email.trim()),
    ]);
    if (emailExists) {
      throw new Error('An account with this email already exists');
    }
    
    // Sign up with email and password
    const result = await emailSignUp(email.trim(), password, role, displayName?.trim(), phoneNumber);
    const { user, userProfile, session } = result;
    
    // Set authenticated state
    dispatch(setAuthenticated({
      uid: user.uid,
      phoneNumber: userProfile.phoneNumber,
      role: userProfile.role,
      userProfile,
      session,
      profileCompleted: true
    }));
    
    dispatch(setSession(session));
    logger.debug('emailSignUpThunk - Email signup successful');
    return { user, userProfile, session };
  } catch (error: any) {
    logger.error('emailSignUpThunk - Error:', error);
    const errorMessage = error.message || 'Failed to create account';
    dispatch(setAuthError(errorMessage));
    throw error;
  }
};

export const emailSignInThunk = (email: string, password: string) => async (dispatch: AppDispatch) => {
  try {
    logger.debug('emailSignInThunk - Starting email signin...');
    dispatch(setAuthLoading());
    dispatch(clearError());
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    // Sign in with email and password
    const result = await emailSignIn(email.trim(), password);
    const { user, userProfile, session, isExistingUser } = result;
    
    if (isExistingUser && userProfile) {
      // Existing user with complete profile
      dispatch(setAuthenticated({
        uid: user.uid,
        phoneNumber: userProfile.phoneNumber,
        role: userProfile.role,
        userProfile,
        session,
        profileCompleted: true
      }));
    } else {
      // User needs to complete profile
      dispatch(setAuthenticated({
        uid: user.uid,
        phoneNumber: email, // Use email as identifier
        role: undefined,
        userProfile: null,
        session,
        profileCompleted: false
      }));
    }
    
    dispatch(setSession(session));
    logger.debug('emailSignInThunk - Email signin successful');
    toast.success('Signed in successfully');
    return { user, userProfile, session, isExistingUser };
  } catch (error: any) {
    logger.error('emailSignInThunk - Error:', error);
    const errorMessage = errorToastMessage(error, 'Failed to sign in') ?? 'Failed to sign in';
    dispatch(setAuthError(errorMessage));
    toast.fromError(error, 'Failed to sign in');
    throw error;
  }
};

export const resetPasswordThunk = (email: string) => async (dispatch: AppDispatch) => {
  try {
    logger.debug('resetPasswordThunk - Starting password reset...');
    dispatch(setAuthLoading());
    dispatch(clearError());
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    await resetPassword(email.trim());
    logger.debug('resetPasswordThunk - Password reset email sent');
    toast.success('Password reset email sent');
    return true;
  } catch (error: any) {
    logger.error('resetPasswordThunk - Error:', error);
    const errorMessage = errorToastMessage(error, 'Failed to send password reset email') ?? 'Failed to send password reset email';
    dispatch(setAuthError(errorMessage));
    toast.fromError(error, 'Failed to send password reset email');
    throw error;
  }
};

// Detailed Registration Thunk
export const detailedRegistrationThunk = (
  email: string,
  password: string,
  role: 'driver' | 'passenger',
  profileData: {
    fullName: string;
    cnic: string;
    address: string;
    vehicleType?: 'car' | 'bike' | 'van' | 'truck';
    vehicleInfo?: {
      number: string;
      brand: string;
      model: string;
      year?: string;
      color?: string;
    };
    driverPictureUri?: string;
    cnicPictureUri?: string;
    vehiclePictureUris?: string[];
    phoneNumber?: string;
  }
) => async (dispatch: AppDispatch) => {
  try {
    logger.debug('detailedRegistrationThunk - Starting detailed registration...');
    dispatch(setAuthLoading());
    dispatch(clearError());
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }
    
    // Validate password strength
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Uniqueness checks: email + CNIC + optional phone
    const checks: Array<Promise<any>> = [getUserByEmail(email.trim()), getUserByCnic(profileData.cnic.trim())];
    if (profileData.phoneNumber && profileData.phoneNumber.trim().length > 0) {
      const formattedPhone = profileData.phoneNumber.startsWith('+') ? profileData.phoneNumber : `+${profileData.phoneNumber}`;
      checks.push(getUserByPhone(formattedPhone));
    }
    const results = await Promise.all(checks);
    const emailExists = results[0];
    const cnicExists = results[1];
    const phoneExists = results[2];
    if (emailExists) throw new Error('Email already exists');
    if (cnicExists) throw new Error('CNIC already exists');
    if (phoneExists) throw new Error('Phone number already exists');
    
    // Create user with email and password
    const userCredential = await emailSignUp(email.trim(), password, role, profileData.fullName, profileData.phoneNumber);
    const user = userCredential.user;
    
    // Create detailed profile with images
    const userProfile = await createUserProfileWithDetails(user.uid, email, role, profileData);
    
    // Create session
    const session = await createAuthSession(user, userProfile);
    
    // Set authenticated state
    dispatch(setAuthenticated({
      uid: user.uid,
      phoneNumber: userProfile.phoneNumber,
      role: userProfile.role,
      userProfile,
      session,
      profileCompleted: true
    }));
    
    dispatch(setSession(session));
    logger.debug('detailedRegistrationThunk - Detailed registration successful');
    toast.success('Account created successfully');
    return { user, userProfile, session };
  } catch (error: any) {
    logger.error('detailedRegistrationThunk - Error:', error);
    const errorMessage = errorToastMessage(error, 'Failed to create account') ?? 'Failed to create account';
    dispatch(setAuthError(errorMessage));
    toast.fromError(error, 'Failed to create account');
    throw error;
  }
};

// Google Sign-In Thunk
export const googleSignInThunk = () => async (dispatch: AppDispatch) => {
  try {
    logger.debug('googleSignInThunk - Starting Google sign-in...');
    dispatch(setAuthLoading());
    dispatch(clearError());
    
    const result = await googleSignIn();
    
    if (result.success && result.user) {
      // Get user profile
      const userProfile = await getUserProfile(result.user.uid);
      
      if (userProfile) {
        // Create session
        const session = await createAuthSession(result.user, userProfile);
        
        // Set authenticated state
        dispatch(setAuthenticated({
          uid: result.user.uid,
          phoneNumber: userProfile.phoneNumber,
          role: userProfile.role,
          userProfile,
          session,
          profileCompleted: true
        }));
        
        dispatch(setSession(session));
        logger.debug('googleSignInThunk - Google sign-in successful');
        toast.success('Signed in with Google successfully');
        return { user: result.user, userProfile, session };
      } else {
        // User profile not found, create one
        const newUserProfile = await createUserProfile(
          result.user.uid,
          result.user.phoneNumber || '',
          'passenger', // Default role
          result.user.displayName || undefined,
          result.user.email || undefined
        );
        
        const session = await createAuthSession(result.user, newUserProfile);
        
        dispatch(setAuthenticated({
          uid: result.user.uid,
          phoneNumber: newUserProfile.phoneNumber,
          role: newUserProfile.role,
          userProfile: newUserProfile,
          session,
          profileCompleted: true
        }));
        
        dispatch(setSession(session));
        logger.debug('googleSignInThunk - Google sign-in successful with new profile');
        toast.success('Signed in with Google successfully');
        return { user: result.user, userProfile: newUserProfile, session };
      }
    } else {
      throw new Error(result.error || 'Google Sign-In failed');
    }
  } catch (error: any) {
    logger.error('googleSignInThunk - Error:', error);
    const errorMessage = errorToastMessage(error, 'Failed to sign in with Google') ?? 'Failed to sign in with Google';
    dispatch(setAuthError(errorMessage));
    toast.fromError(error, 'Failed to sign in with Google');
    throw error;
  }
};

// Legacy functions (keeping for backward compatibility)
export const signInThunk = (email: string, password: string, role?: 'driver' | 'passenger' | 'admin') => 
  async (dispatch: AppDispatch) => {
    return dispatch(emailSignInThunk(email, password));
  };

export const signUpThunk = (email: string, password: string, role: 'driver' | 'passenger') => 
  async (dispatch: AppDispatch) => {
    return dispatch(emailSignUpThunk(email, password, role));
  };

// Driver-specific registration thunk for phone authentication
export const driverRegistrationThunk = (
  phoneNumber: string,
  profileData: {
    fullName: string;
    cnic: string;
    address: string;
    vehicleType: 'car' | 'bike' | 'van' | 'truck';
    vehicleInfo: {
      number: string;
      brand: string;
      model: string;
      year?: string;
      color?: string;
    };
    driverPictureUri?: string;
    cnicPictureUri?: string;
    vehiclePictureUris?: string[];
  }
) => async (dispatch: AppDispatch, getState: () => any) => {
  try {
    logger.debug('driverRegistrationThunk - Starting driver registration...');
    dispatch(setAuthLoading());
    
    const { auth } = getState();
    const { uid } = auth;
    
    if (!uid) {
      throw new Error('User must be authenticated to complete driver registration');
    }
    
    // Create driver profile with details
    const userProfile = await createDriverProfileWithDetails(uid, phoneNumber, profileData);
    
    // Create session
    const session = await createAuthSession({ uid } as any, userProfile);
    
    // Update auth state
    dispatch(setAuthenticated({
      uid: userProfile.uid,
      phoneNumber: userProfile.phoneNumber,
      role: userProfile.role,
      userProfile,
      session,
      profileCompleted: true
    }));
    
    dispatch(setSession(session));
    
    logger.debug('driverRegistrationThunk - Driver registration completed successfully');
    toast.success('Driver registration submitted for approval');
    
    return { userProfile, session };
  } catch (error: any) {
    logger.error('driverRegistrationThunk - Error:', error);
    dispatch(setAuthError(errorToastMessage(error, 'Driver registration failed') ?? 'Driver registration failed'));
    toast.fromError(error, 'Driver registration failed');
    throw error;
  }
};
