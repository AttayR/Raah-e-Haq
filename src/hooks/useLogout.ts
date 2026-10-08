import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { logout, type SessionThunkExtra } from '../store/thunks/sessionThunks';

// Typed locally (not useAppDispatch) so this hook does not import the store singleton.
type LogoutDispatch = ThunkDispatch<unknown, SessionThunkExtra, UnknownAction>;

export const LOGOUT_CONFIRM_TITLE = 'Sign Out';
export const LOGOUT_CONFIRM_MESSAGE = 'Are you sure you want to sign out?';
export const LOGOUT_CONFIRM_BUTTON = 'Sign Out';

/**
 * Every Sign Out / Logout button uses this (T-102). `confirmLogout` asks first, then runs the
 * single `logout` thunk; AuthFlow switches to the auth stack once the session is cleared.
 */
export const useLogout = () => {
  const dispatch = useDispatch<LogoutDispatch>();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inFlight = useRef(false);

  const performLogout = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsLoggingOut(true);
    try {
      await dispatch(logout());
    } finally {
      // The screen is usually unmounted by now (auth stack); the ref keeps a double tap out.
      inFlight.current = false;
      setIsLoggingOut(false);
    }
  }, [dispatch]);

  const confirmLogout = useCallback(() => {
    if (inFlight.current) {
      return;
    }
    Alert.alert(LOGOUT_CONFIRM_TITLE, LOGOUT_CONFIRM_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: LOGOUT_CONFIRM_BUTTON, style: 'destructive', onPress: () => { performLogout(); } },
    ]);
  }, [performLogout]);

  return { confirmLogout, isLoggingOut };
};
