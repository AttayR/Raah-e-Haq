import { auth, db } from './firebase';
import { 
  PhoneAuthProvider, 
  signInWithCredential, 
  signOut, 
  onAuthStateChanged, 
  User,
  signInWithPhoneNumber,
  UserCredential,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  query,
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface PhoneAuthData {
  phoneNumber: string;
  verificationId: string;
  verificationCode: string;
}

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  role: 'driver' | 'passenger' | 'admin';
  displayName?: string;
  email?: string;
  createdAt: any;
  updatedAt: any;
  isVerified: boolean;
  isActive: boolean;
}

export interface AuthSession {
  uid: string;
  phoneNumber: string;
  role: 'driver' | 'passenger' | 'admin';
  token: string;
  expiresAt: number;
}

// Constants
const SESSION_KEY = '@auth_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Phone Authentication
export const sendPhoneVerification = async (phoneNumber: string): Promise<string> => {
  try {
    // Check if user already exists
    const existingUser = await getUserByPhone(phoneNumber);
    
    // For React Native, we need to use a different approach
    // The verification will be handled by the native Firebase SDK
    // We'll simulate the verification process for now
    console.log('Sending verification code to:', phoneNumber);
    
    // In a real implementation, this would trigger the native Firebase phone auth
    // For now, we'll return a mock verification ID
    const mockVerificationId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return mockVerificationId;
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    throw new Error(error.message || 'Failed to send verification code');
  }
};

export const verifyPhoneCode = async (
  verificationId: string, 
  verificationCode: string
): Promise<UserCredential> => {
  try {
    // For React Native, we need to implement this differently
    // This is a mock implementation - in production, you'd use the actual Firebase phone auth
    
    if (verificationCode === '123456') { // Mock verification code
      // Create a mock user credential
      const mockUser = {
        uid: `user_${Date.now()}`,
        phoneNumber: '+1234567890', // This should come from the actual auth state
        emailVerified: false,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => 'mock_token',
        getIdTokenResult: async () => ({ authTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null, expirationTime: '', token: 'mock_token', claims: {} }),
        reload: async () => {},
        toJSON: () => ({}),
        displayName: null,
        email: null,
        photoURL: null,
        providerId: 'phone',
      } as User;
      
      const mockCredential = {
        user: mockUser,
        operationType: 'signIn',
        providerId: 'phone',
        additionalUserInfo: null,
      } as UserCredential;
      
      return mockCredential;
    } else {
      throw new Error('Invalid verification code');
    }
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
    const userProfile: UserProfile = {
      uid,
      phoneNumber,
      role,
      displayName,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isVerified: true,
      isActive: true
    };

    await setDoc(doc(db, 'users', uid), userProfile);
    return userProfile;
  } catch (error: any) {
    console.error('Error creating user profile:', error);
    throw new Error(error.message || 'Failed to create user profile');
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
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
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
    const querySnapshot = await getDocs(q);
    
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
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message || 'Failed to update user profile');
  }
};

// Session Management
export const createAuthSession = async (user: User, profile: UserProfile): Promise<AuthSession> => {
  try {
    const token = await user.getIdToken();
    const session: AuthSession = {
      uid: user.uid,
      phoneNumber: profile.phoneNumber,
      role: profile.role,
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

export const refreshAuthSession = async (user: User): Promise<AuthSession | null> => {
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
export const listenAuth = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);

// Sign Out
export const signOutUser = async () => {
  try {
    await clearAuthSession();
    await signOut(auth);
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

// Google Sign-In function
export const googleSignIn = async (): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const { signInWithGoogle } = await import('./googleSignIn');
    const result = await signInWithGoogle();
    
    if (result.success && result.user) {
      // Check if user profile exists, if not create one
      let userProfile = await getUserProfile(result.user.uid);
      
      if (!userProfile) {
        // Create user profile for Google sign-in
        userProfile = await createUserProfile(
          result.user.uid,
          result.user.phoneNumber || '', // Google users might not have phone
          'passenger', // Default role, can be changed later
          result.user.displayName || undefined,
          result.user.email || undefined
        );
      }
      
      return {
        success: true,
        user: result.user,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Google Sign-In failed',
      };
    }
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    return {
      success: false,
      error: error.message || 'Google Sign-In failed',
    };
  }
};

// Legacy email functions (keeping for backward compatibility)
export const emailSignIn = async (email: string, password: string) => {
  // This would need to be implemented with email/password if needed
  throw new Error('Email authentication not implemented. Please use phone authentication.');
};

export const emailSignUp = async (email: string, password: string) => {
  // This would need to be implemented with email/password if needed
  throw new Error('Email authentication not implemented. Please use phone authentication.');
};