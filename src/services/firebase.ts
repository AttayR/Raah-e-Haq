import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyDL3DQ9VgCY8nwHCZNFwLk1DjbDTyCwxaE',
  authDomain: 'raah-e-haq.firebaseapp.com',
  projectId: 'raah-e-haq',
  storageBucket: 'raah-e-haq.firebasestorage.app',
  messagingSenderId: '19712791802',
  appId: '1:19712791802:android:08fc36d1e8dbb1e1b66543',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

export default app;