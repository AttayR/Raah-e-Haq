import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';


export const emailSignIn = (email: string, password: string) =>
signInWithEmailAndPassword(auth, email, password);


export const emailSignUp = (email: string, password: string) =>
createUserWithEmailAndPassword(auth, email, password);


export const signOutUser = () => signOut(auth);


export const listenAuth = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);