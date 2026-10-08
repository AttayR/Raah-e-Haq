// React Native Firebase is used for Firestore, Storage and FCM only. Sign-in is the Laravel
// API (Firebase Auth was removed in T-107).
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import messaging from '@react-native-firebase/messaging';

// Export React Native Firebase services
export const db = firestore();
export { storage };
export { messaging };