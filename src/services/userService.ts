import firestore from '@react-native-firebase/firestore';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export interface UserBasicInfo {
  fullName: string;
  email: string;
  cnic: string;
  address: string;
  role: 'driver' | 'passenger';
  phoneNumber: string;
}

export interface UserProfile {
  uid: string;
  phoneNumber: string;
  role: 'driver' | 'passenger';
  fullName: string;
  email: string;
  cnic: string;
  address: string;
  createdAt: any;
  updatedAt: any;
  isVerified: boolean;
  isActive: boolean;
}

// Save user basic information to Firestore
export const saveUserBasicInfo = async (userInfo: UserBasicInfo, uid: string): Promise<UserProfile> => {
  try {
    console.log('saveUserBasicInfo - Saving user info:', userInfo, 'with UID:', uid);
    
    // Use the current user's UID instead of generating a new one
    const userRef = firestore().collection('users').doc(uid);
    
    const userProfile: UserProfile = {
      uid: uid, // Use the provided UID
      phoneNumber: userInfo.phoneNumber,
      role: userInfo.role,
      fullName: userInfo.fullName,
      email: userInfo.email,
      cnic: userInfo.cnic,
      address: userInfo.address,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      isVerified: true,
      isActive: true,
    };

    console.log('saveUserBasicInfo - User profile to save:', userProfile);

    await userRef.set(userProfile);
    
    console.log('saveUserBasicInfo - User profile saved successfully with UID:', uid);
    
    // Return the created profile so it can be used to update the auth state
    return userProfile;
  } catch (error: any) {
    console.error('saveUserBasicInfo - Error saving user info:', error);
    throw new Error(error.message || 'Failed to save user information');
  }
};

// Get user profile by UID
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await firestore().collection('users').doc(uid).get();
    if (userDoc.exists) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error: any) {
    console.error('getUserProfile - Error getting user profile:', error);
    throw new Error(error.message || 'Failed to get user profile');
  }
};

// Update user profile
export const updateUserProfile = async (
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> => {
  try {
    await firestore().collection('users').doc(uid).update({
      ...updates,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error('updateUserProfile - Error updating user profile:', error);
    throw new Error(error.message || 'Failed to update user profile');
  }
};

// Get user by phone number
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
    console.error('getUserByPhone - Error getting user by phone:', error);
    throw new Error(error.message || 'Failed to get user by phone number');
  }
};

// Get all users by role
export const getUsersByRole = async (role: 'driver' | 'passenger'): Promise<UserProfile[]> => {
  try {
    const querySnapshot = await firestore()
      .collection('users')
      .where('role', '==', role)
      .where('isActive', '==', true)
      .get();
    
    return querySnapshot.docs.map(doc => doc.data() as UserProfile);
  } catch (error: any) {
    console.error('getUsersByRole - Error getting users by role:', error);
    throw new Error(error.message || 'Failed to get users by role');
  }
};

// Delete user profile
export const deleteUserProfile = async (uid: string): Promise<void> => {
  try {
    await firestore().collection('users').doc(uid).delete();
  } catch (error: any) {
    console.error('deleteUserProfile - Error deleting user profile:', error);
    throw new Error(error.message || 'Failed to delete user profile');
  }
};
