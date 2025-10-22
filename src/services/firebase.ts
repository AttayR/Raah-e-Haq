// React Native Firebase imports
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import messaging from '@react-native-firebase/messaging';

// Export React Native Firebase services
export { auth };
export const db = firestore();
export { storage };
export { messaging };