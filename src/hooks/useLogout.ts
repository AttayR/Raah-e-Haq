import { useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { confirm, dialog } from '../core/dialog';
import { t } from '../i18n';
import { logout, type LogoutOptions, type SessionThunkExtra } from '../store/thunks/sessionThunks';

// Typed locally (not useAppDispatch) so this hook does not import the store singleton.
type LogoutDispatch = ThunkDispatch<unknown, SessionThunkExtra, UnknownAction>;

/** English sign-out dialog text (tests and the dev gallery); the dialog itself reads `t()` when shown. */
export const LOGOUT_CONFIRM_TITLE = t('signOut.title');
export const LOGOUT_CONFIRM_MESSAGE = t('signOut.body');
export const LOGOUT_CONFIRM_BUTTON = t('signOut.confirm');

/**
 * Every Sign Out / Logout button uses this (T-102). `confirmLogout` asks first with the themed
 * kit Dialog (UI-R3, destructive confirm), then runs the single `logout` thunk; AuthFlow switches
 * to the auth stack once the session is cleared. Any dialog still queued is dismissed on sign-out
 * so nothing from the old session shows over the auth screens.
 */
export const useLogout = () => {
  const dispatch = useDispatch<LogoutDispatch>();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const inFlight = useRef(false);

  const performLogout = useCallback(async (options?: LogoutOptions) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsLoggingOut(true);
    dialog.dismissAll();
    try {
      await dispatch(logout(options));
    } finally {
      // The screen is usually unmounted by now (auth stack); the ref keeps a double tap out.
      inFlight.current = false;
      setIsLoggingOut(false);
    }
  }, [dispatch]);

  const confirmLogout = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    const confirmed = await confirm({
      // Read at tap time, so the dialog follows a language switch (T-523).
      title: t('signOut.title'),
      body: t('signOut.body'),
      confirmLabel: t('signOut.confirm'),
      destructive: true,
    });
    if (confirmed) {
      await performLogout();
    }
  }, [performLogout]);

  /**
   * Signs out without asking. BE-129: after POST /account/deletion pass
   * `{ serverAlreadySignedOut: true }` (the tokens are already revoked; /auth/logout is not called).
   */
  const signOut = useCallback((options?: LogoutOptions) => performLogout(options), [performLogout]);

  return { confirmLogout, signOut, isLoggingOut };
};
