import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


const firebaseConfig = {
apiKey: 'YOUR_API_KEY',
authDomain: 'YOUR_PROJECT.firebaseapp.com',
projectId: 'YOUR_PROJECT',
storageBucket: 'YOUR_PROJECT.appspot.com',
messagingSenderId: 'SENDER_ID',
appId: 'APP_ID',
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);