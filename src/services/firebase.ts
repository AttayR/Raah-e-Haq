import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyAvsyP9TM3Ak1zCjQkiuvAi_ojy09SMsfw',
  authDomain: 'raah-e-haq.firebaseapp.com',
  projectId: 'raah-e-haq',
  storageBucket: 'raah-e-haq.firebasestorage.app',
  messagingSenderId: '19712791802',
  appId: '1:19712791802:ios:69e6492b2c3fe191b66543',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

export default app;