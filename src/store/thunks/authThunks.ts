import { AppDispatch } from '../index';
import {
  emailSignIn,
  emailSignUp,
  signOutUser,
  listenAuth,
} from '../../services/auth';
import {
  setAuthError,
  setAuthLoading,
  setAuthenticated,
  setSignedOut,
} from '../slices/authSlice';
import { setRole, resetUser } from '../slices/userSlice';

export const startAuthListener = () => (dispatch: AppDispatch) => {
  listenAuth(user => {
    if (user) {
      dispatch(setAuthenticated({ uid: user.uid, email: user.email }));
      // TODO: fetch role from Firestore users/{uid}.role
    } else {
      dispatch(setSignedOut());
      dispatch(resetUser());
    }
  });
};

export const signInThunk =
  (email: string, password: string, role?: 'driver' | 'passenger' | 'admin') =>
  async (dispatch: AppDispatch) => {
    try {
      dispatch(setAuthLoading());
      await emailSignIn(email, password);
      if (role) dispatch(setRole(role));
    } catch (e: any) {
      dispatch(setAuthError(e.message ?? 'Sign in failed'));
    }
  };

export const signUpThunk =
  (email: string, password: string, role: 'driver' | 'passenger') =>
  async (dispatch: AppDispatch) => {
    try {
      dispatch(setAuthLoading());
      await emailSignUp(email, password);
      dispatch(setRole(role));
      // TODO: write role to Firestore users collection
    } catch (e: any) {
      dispatch(setAuthError(e.message ?? 'Sign up failed'));
    }
  };

export const signOutThunk = () => async (dispatch: AppDispatch) => {
  try {
    await signOutUser();
  } catch {}
};
