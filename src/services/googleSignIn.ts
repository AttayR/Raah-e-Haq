import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';

// Configure Google Sign-In
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: '611201086305-076gcaq4ab16gndcg0sth8ib4b35lpkc.apps.googleusercontent.com',
    offlineAccess: true,
    hostedDomain: '',
    forceCodeForRefreshToken: true,
  });
};

// Google Sign-In function
export const signInWithGoogle = async () => {
  try {
    // Check if your device supports Google Play
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Get the users ID token
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;
    
    // Create a Google credential with the token
    const googleCredential = GoogleAuthProvider.credential(idToken);
    
    // Sign-in the user with the credential
    const result = await signInWithCredential(auth, googleCredential);
    
    return {
      success: true,
      user: result.user,
    };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return {
        success: false,
        error: 'User cancelled the login flow',
      };
    } else if (error.code === statusCodes.IN_PROGRESS) {
      return {
        success: false,
        error: 'Sign in is in progress already',
      };
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return {
        success: false,
        error: 'Play services not available',
      };
    } else {
      return {
        success: false,
        error: error.message || 'Something went wrong with Google Sign-In',
      };
    }
  }
};

// Google Sign-Out function
export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
    return { success: true };
  } catch (error: any) {
    console.error('Google Sign-Out Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign out from Google',
    };
  }
};

// Check if user is signed in with Google
export const isSignedInWithGoogle = async () => {
  try {
    const userInfo = await GoogleSignin.getCurrentUser();
    return userInfo !== null;
  } catch (error) {
    console.error('Error checking Google sign-in status:', error);
    return false;
  }
};

// Get current Google user
export const getCurrentGoogleUser = async () => {
  try {
    const userInfo = await GoogleSignin.getCurrentUser();
    return userInfo;
  } catch (error) {
    console.error('Error getting current Google user:', error);
    return null;
  }
};
