import { createAsyncThunk, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { apiService, cancelAllRequests } from '../../services/api';
import webSocketService from '../../services/webSocketService';
import locationTrackingService from '../../services/locationTrackingService';
import notificationService from '../../services/notificationService';
import { accountStatusRefused, resetApp } from '../actions';
import { bumpSessionEpoch, currentSessionEpoch } from '../sessionEpoch';
import { authStorage } from '../../services/authStorage';
import { withRefusedStatus, type RefusalLike } from '../../core/auth/normalizeUser';
import type { User } from '../../services/api';
import { logger } from '../../core/logging/logger';

/** Injected by the store (thunk extraArgument) so this file never imports the store itself. */
export interface SessionThunkExtra {
  purgePersistedState: () => Promise<unknown>;
}

export interface LogoutOptions {
  /** Revoke every token of the user (POST /auth/logout-all) instead of only this device's. */
  allDevices?: boolean;
}

/** An offline logout must not leave the user waiting for the 30 s default timeout. */
export const LOGOUT_REQUEST_TIMEOUT_MS = 8000;

/** Runs one cleanup step; a failure is logged and never stops the remaining steps. */
const step = async (name: string, fn: () => unknown): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    logger.warn(`logout - ${name} failed; continuing`, error);
  }
};

/**
 * The one logout (AUTH-09). Always ends signed out, even offline or on a 401:
 * 1. ask the server to revoke the token (best effort, needs the token, so it goes first)
 * 2. stop sockets, location tracking and in-flight requests of this user
 * 3. clear the token (Keychain), the cached user, any legacy session keys and cached per-user
 *    data in AsyncStorage
 * 4. reset every slice (root RESET) and purge redux-persist
 * There is no Firebase sign-out step: Firebase Auth is not used (T-107). The old step called
 * the namespaced `auth()` API, whose deprecation console.warn raised the yellow dev LogBox
 * after every sign-out.
 * AuthFlow then renders the auth stack because apiAuth.isAuthenticated is false.
 * It never rejects.
 */
export const logout = createAsyncThunk<void, LogoutOptions | void, { extra: SessionThunkExtra }>(
  'session/logout',
  async (options, { dispatch, extra }) => {
    const allDevices = !!options && options.allDevices === true;
    // Results of requests started before this point belong to the old session (T-103).
    bumpSessionEpoch();
    try {
      await step('server revoke', () =>
        allDevices
          ? apiService.logoutAll({ timeout: LOGOUT_REQUEST_TIMEOUT_MS })
          : apiService.logout({ timeout: LOGOUT_REQUEST_TIMEOUT_MS }),
      );
      await step('close sockets', () => webSocketService.closeAll());
      // Stop and forget the last position and listeners, so user A's location is never
      // posted under user B (T-104).
      await step('reset location tracking', () => locationTrackingService.reset());
      await step('reset notifications', () => notificationService.reset());
      await step('cancel requests', () => cancelAllRequests());
      await step('clear auth storage', () => apiService.clearAuthData());
      await step('clear cached notifications', () => notificationService.clearStoredNotifications());
    } finally {
      dispatch(resetApp());
      await step('purge persisted state', () => extra.purgePersistedState());
    }
  },
);

/**
 * The server rejected the current session's token (401, see setUnauthorizedHandler in
 * services/api.ts). Once the app is bootstrapped this always logs out, signed in or not: a
 * token the server refuses is dead, and logout clears it and everything tied to it. During
 * the cold-start check initializeAuth handles its own 401. Returns true when it started a
 * logout, so the API layer latches its single-flight guard only then.
 */
export const sessionExpired =
  (): ThunkAction<boolean, { apiAuth: { isInitialized: boolean } }, SessionThunkExtra, UnknownAction> =>
  (dispatch, getState) => {
    if (!getState().apiAuth.isInitialized) {
      return false;
    }
    logger.warn('Session expired (401); signing out');
    dispatch(logout());
    return true;
  };

type AccountRefusedState = {
  apiAuth: { isInitialized: boolean; isAuthenticated: boolean; user: User | null };
};

/**
 * A request of the current session got 403 ACCOUNT_* (setAccountRefusedHandler in
 * services/api.ts, T-106). The server is authoritative: the refused status (and a
 * rejection_reason, memory only) is merged into the signed-in user, so AuthFlow routes to the
 * account-status screen. The session is kept, as on cold start (initializeAuth): a blocked
 * token answers 403 for a while and then 401, which T-104 turns into a normal sign-out; Sign
 * Out clears the local session even though /auth/logout also answers 403.
 * Ignored before bootstrap (initializeAuth handles its own 403) and when signed out (the
 * login screens show the refusal). When an active user is blocked, live sockets close and
 * location tracking is reset (last position dropped) right away instead of waiting for the
 * home screens to unmount.
 */
export const accountRefused =
  (refusal: RefusalLike): ThunkAction<boolean, AccountRefusedState, SessionThunkExtra, UnknownAction> =>
  (dispatch, getState) => {
    const { isInitialized, isAuthenticated, user } = getState().apiAuth;
    if (!isInitialized || !isAuthenticated || !user) {
      return false;
    }
    const refused = withRefusedStatus(user, refusal);
    if (!refused) {
      return false;
    }
    const wasActive = user.status === 'active';
    if (refused.status === user.status && refused.rejection_reason === user.rejection_reason) {
      return false;
    }
    logger.warn('Account refused by the server; routing to account status', { status: refused.status });
    dispatch(accountStatusRefused(refused));
    // The cache gets the status too (never rejection_reason), so an offline cold start does
    // not route home; skipped if the session ends meanwhile.
    authStorage.saveUser(refused, currentSessionEpoch()).catch((error: unknown) => {
      logger.warn('accountRefused - could not cache the refused status', {
        name: error instanceof Error ? error.name : typeof error,
      });
    });
    if (wasActive) {
      try {
        webSocketService.closeAll();
        // reset, not stop: the last position and listeners are dropped right away.
        locationTrackingService.reset();
      } catch (error) {
        logger.warn('accountRefused - could not stop live services', {
          name: error instanceof Error ? error.name : typeof error,
        });
      }
    }
    return true;
  };
