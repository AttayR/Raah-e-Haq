import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface UserProfile {
  uid: string;
  phoneNumber: string;
  role: 'driver' | 'passenger' | 'admin';
  fullName?: string;
  displayName?: string;
  email?: string;
  cnic?: string;
  address?: string;
  createdAt: any;
  updatedAt: any;
  isVerified: boolean;
  isActive: boolean;
}

export interface AuthSession {
  uid: string;
  phoneNumber: string;
  role: 'driver' | 'passenger' | 'admin' | undefined;
  token: string;
  expiresAt: number;
}

// Constants
const SESSION_KEY = '@auth_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Phone Authentication
export const sendPhoneVerification = async (phoneNumber: string): Promise<{ verificationId: string; isExistingUser: boolean; userProfile?: UserProfile }> => {
  try {
    // Check if user already exists
    const existingUser = await getUserByPhone(phoneNumber);
    
    // Send verification code using React Native Firebase
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    
    return {
      verificationId: confirmation.verificationId || '',
      isExistingUser: !!existingUser,
      userProfile: existingUser || undefined
    };
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    throw new Error(error.message || 'Failed to send verification code');
  }
};

export const verifyPhoneCode = async (
  verificationId: string, 
  verificationCode: string
): Promise<FirebaseAuthTypes.UserCredential> => {
  try {
    // Create credential and sign in
    const credential = auth.PhoneAuthProvider.credential(verificationId, verificationCode);
    const result = await auth().signInWithCredential(credential);
    return result;
  } catch (error: any) {
    console.error('Error verifying code:', error);
    throw new Error(error.message || 'Invalid verification code');
  }
};

// User Management
export const createUserProfile = async (
  uid: string, 
  phoneNumber: string, 
  role: 'driver' | 'passenger',
  displayName?: string,
  email?: string
): Promise<UserProfile> => {
  try {
    console.log('createUserProfile - Input values:', { uid, phoneNumber, role, displayName, email });
    
    const userProfile: UserProfile = {
      uid,
      phoneNumber,
      role,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      isVerified: true,
      isActive: true
    };

    // Only add optional fields if they have values
    if (displayName) {
      userProfile.displayName = displayName;
    }
    if (email) {
      userProfile.email = email;
    }

    console.log('createUserProfile - Final userProfile:', userProfile);

    await firestore().collection('users').doc(uid).set(userProfile);
    return userProfile;
  } catch (error: any) {
    console.error('Error creating user profile:', error);
    throw new Error(error.message || 'Failed to create user profile');
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await firestore().collection('users').doc(uid).get();
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting user profile:', error);
    throw new Error(error.message || 'Failed to get user profile');
  }
};

export const getUserByPhone = async (phoneNumber: string): Promise<UserProfile | null> => {
  try {
    const querySnapshot = await firestore()
      .collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .get();
    
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting user by phone:', error);
    throw new Error(error.message || 'Failed to get user by phone');
  }
};

export const updateUserProfile = async (
  uid: string, 
  updates: Partial<UserProfile>
): Promise<void> => {
  try {
    await firestore().collection('users').doc(uid).update({
      ...updates,
      updatedAt: firestore.FieldValue.serverTimestamp()
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message || 'Failed to update user profile');
  }
};

// Session Management
export const createAuthSession = async (user: FirebaseAuthTypes.User, profile: UserProfile | { uid: string; phoneNumber: string; role?: 'driver' | 'passenger'; isVerified: boolean; isActive: boolean }): Promise<AuthSession> => {
  try {
    const token = await user.getIdToken();
    const session: AuthSession = {
      uid: user.uid,
      phoneNumber: profile.phoneNumber,
      role: profile.role || undefined,
      token,
      expiresAt: Date.now() + SESSION_DURATION
    };

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (error: any) {
    console.error('Error creating auth session:', error);
    throw new Error(error.message || 'Failed to create auth session');
  }
};

export const getAuthSession = async (): Promise<AuthSession | null> => {
  try {
    const sessionData = await AsyncStorage.getItem(SESSION_KEY);
    if (sessionData) {
      const session: AuthSession = JSON.parse(sessionData);
      
      // Check if session is expired
      if (session.expiresAt > Date.now()) {
        return session;
      } else {
        // Session expired, remove it
        await AsyncStorage.removeItem(SESSION_KEY);
      }
    }
    return null;
  } catch (error: any) {
    console.error('Error getting auth session:', error);
    return null;
  }
};

export const clearAuthSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error: any) {
    console.error('Error clearing auth session:', error);
  }
};

export const refreshAuthSession = async (user: FirebaseAuthTypes.User): Promise<AuthSession | null> => {
  try {
    const profile = await getUserProfile(user.uid);
    if (profile) {
      return await createAuthSession(user, profile);
    }
    return null;
  } catch (error: any) {
    console.error('Error refreshing auth session:', error);
    return null;
  }
};

// Authentication State
export const listenAuth = (cb: (user: FirebaseAuthTypes.User | null) => void) => {
  return auth().onAuthStateChanged(cb);
};

// Sign Out
export const signOutUser = async () => {
  try {
    await clearAuthSession();
    await auth().signOut();
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const session = await getAuthSession();
    return session !== null && session.expiresAt > Date.now();
  } catch (error) {
    return false;
  }
};

// Get current user
export const getCurrentUser = (): FirebaseAuthTypes.User | null => {
  return auth().currentUser;
};

// Check if phone number is verified
export const isPhoneNumberVerified = (): boolean => {
  const user = auth().currentUser;
  return user ? user.phoneNumber !== null : false;
};

// Helper function to create a test user for demonstration
export const createTestUser = async (phoneNumber: string, role: 'driver' | 'passenger' = 'passenger'): Promise<UserProfile> => {
  try {
    const testUid = `test_${Date.now()}`;
    const userProfile: UserProfile = {
      uid: testUid,
      phoneNumber,
      role,
      displayName: 'Test User',
      fullName: 'Test User',
      email: 'test@example.com',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      isVerified: true,
      isActive: true
    };

    await firestore().collection('users').doc(testUid).set(userProfile);
    console.log('Test user created:', userProfile);
    return userProfile;
  } catch (error: any) {
    console.error('Error creating test user:', error);
    throw new Error(error.message || 'Failed to create test user');
  }
};

// Email/Password Authentication
export const emailSignUp = async (
  email: string, 
  password: string, 
  role: 'driver' | 'passenger',
  displayName?: string
): Promise<{ user: FirebaseAuthTypes.User; userProfile: UserProfile; session: AuthSession }> => {
  try {
    console.log('emailSignUp - Starting email signup...', { email, role, displayName });
    
    // Create user with email and password
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // Update user profile with display name
    if (displayName) {
      await user.updateProfile({ displayName });
    }
    
    // Send email verification
    await user.sendEmailVerification();
    
    // Create user profile in Firestore
    const userProfile = await createUserProfile(user.uid, email, role, displayName, email);
    
    // Create session
    const session = await createAuthSession(user, userProfile);
    
    console.log('emailSignUp - Email signup successful:', { uid: user.uid, email });
    
    return { user, userProfile, session };
  } catch (error: any) {
    console.error('emailSignUp - Error:', error);
    throw new Error(error.message || 'Failed to create account with email');
  }
};

export const emailSignIn = async (
  email: string, 
  password: string
): Promise<{ user: FirebaseAuthTypes.User; userProfile: UserProfile | null; session: AuthSession; isExistingUser: boolean }> => {
  try {
    console.log('emailSignIn - Starting email signin...', { email });
    
    // Sign in with email and password
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // Get user profile from Firestore
    const userProfile = await getUserProfile(user.uid);
    
    if (userProfile) {
      // Update last login time
      await updateUserProfile(user.uid, { 
        updatedAt: firestore.FieldValue.serverTimestamp() 
      });
      
      // Create session for existing user
      const session = await createAuthSession(user, userProfile);
      
      console.log('emailSignIn - Email signin successful for existing user:', { uid: user.uid, email });
      return { user, userProfile, session, isExistingUser: true };
    } else {
      // User exists in Firebase Auth but not in Firestore (incomplete profile)
      console.log('emailSignIn - User exists in auth but not in Firestore, needs profile completion');
      
      // Create a minimal session without role
      const session = await createAuthSession(user, {
        uid: user.uid,
        phoneNumber: email, // Use email as identifier
        role: undefined,
        isVerified: user.emailVerified,
        isActive: true,
      });
      
      return { user, userProfile: null, session, isExistingUser: false };
    }
  } catch (error: any) {
    console.error('emailSignIn - Error:', error);
    throw new Error(error.message || 'Failed to sign in with email');
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    console.log('resetPassword - Sending password reset email...', { email });
    await auth().sendPasswordResetEmail(email);
    console.log('resetPassword - Password reset email sent successfully');
  } catch (error: any) {
    console.error('resetPassword - Error:', error);
    throw new Error(error.message || 'Failed to send password reset email');
  }
};

export const updateEmail = async (newEmail: string): Promise<void> => {
  try {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    
    console.log('updateEmail - Updating email...', { newEmail });
    await user.updateEmail(newEmail);
    await user.sendEmailVerification();
    console.log('updateEmail - Email updated successfully');
  } catch (error: any) {
    console.error('updateEmail - Error:', error);
    throw new Error(error.message || 'Failed to update email');
  }
};

export const updatePassword = async (newPassword: string): Promise<void> => {
  try {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    
    console.log('updatePassword - Updating password...');
    await user.updatePassword(newPassword);
    console.log('updatePassword - Password updated successfully');
  } catch (error: any) {
    console.error('updatePassword - Error:', error);
    throw new Error(error.message || 'Failed to update password');
  }
};
