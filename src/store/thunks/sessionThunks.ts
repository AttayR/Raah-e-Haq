import { createAsyncThunk } from '@reduxjs/toolkit';
import auth from '@react-native-firebase/auth';
import { apiService, cancelAllRequests } from '../../services/api';
import { clearAuthSession } from '../../services/firebaseAuth';
import webSocketService from '../../services/webSocketService';
import locationTrackingService from '../../services/locationTrackingService';
import notificationService from '../../services/notificationService';
import { resetApp } from '../actions';
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
 * 3. sign out of Firebase if a Firebase user is still present
 * 4. clear the token, user and cached per-user data in AsyncStorage
 * 5. reset every slice (root RESET) and purge redux-persist
 * AuthFlow then renders the auth stack because apiAuth.isAuthenticated is false.
 * It never rejects.
 */
export const logout = createAsyncThunk<void, LogoutOptions | void, { extra: SessionThunkExtra }>(
  'session/logout',
  async (options, { dispatch, extra }) => {
    const allDevices = !!options && options.allDevices === true;
    try {
      await step('server revoke', () =>
        allDevices
          ? apiService.logoutAll({ timeout: LOGOUT_REQUEST_TIMEOUT_MS })
          : apiService.logout({ timeout: LOGOUT_REQUEST_TIMEOUT_MS }),
      );
      await step('close sockets', () => webSocketService.closeAll());
      await step('stop location tracking', () => locationTrackingService.stopTracking());
      await step('cancel requests', () => cancelAllRequests());
      await step('firebase sign out', async () => {
        await clearAuthSession();
        const firebaseAuth = auth();
        if (firebaseAuth.currentUser) {
          await firebaseAuth.signOut();
        }
      });
      await step('clear auth storage', () => apiService.clearAuthData());
      await step('clear cached notifications', () => notificationService.clearStoredNotifications());
    } finally {
      dispatch(resetApp());
      await step('purge persisted state', () => extra.purgePersistedState());
    }
  },
);
