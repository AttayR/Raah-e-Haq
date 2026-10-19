import { createAsyncThunk, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';
import { apiService, cancelAllRequests } from '../../services/api';
import webSocketService from '../../services/webSocketService';
import locationTrackingService from '../../services/locationTrackingService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsApi } from '../../features/notifications/api';
import { getRegisteredDeviceToken, resetPushDevice } from '../../features/notifications/push';
import { accountStatusRefused, resetApp } from '../actions';
import { bumpSessionEpoch, currentSessionEpoch } from '../sessionEpoch';
import { authStorage } from '../../services/authStorage';
import { withRefusedStatus, type RefusalLike } from '../../core/auth/normalizeUser';
import type { User } from '../../services/api';
import { logger } from '../../core/logging/logger';
import { safetyApi } from '../../features/safety/api';
import { isRecord, readId } from '../../core/api/read';
import { resetOtpSendHold } from '../../features/auth/otpSendHold';

/** Injected by the store (thunk extraArgument) so this file never imports the store itself. */
export interface SessionThunkExtra {
  purgePersistedState: () => Promise<unknown>;
}

/**
 * The ride whose live trip link the passenger shared (activeRide.shareLink, T-520), read without
 * typing the thunk's state, so every dispatcher of `logout` keeps working.
 */
export const sharedTripRideIdOf = (state: unknown): number | null => {
  if (!isRecord(state) || !isRecord(state.activeRide) || !isRecord(state.activeRide.shareLink)) return null;
  return readId(state.activeRide.shareLink.rideId);
};

export interface LogoutOptions {
  /** Revoke every token of the user (POST /auth/logout-all) instead of only this device's. */
  allDevices?: boolean;
}

/** AsyncStorage key of the notification cache older builds kept per user. */
export const LEGACY_NOTIFICATIONS_CACHE_KEY = 'notifications';

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
 * 0. revoke a live trip link the passenger shared (T-520, BE-80): the next user of this phone
 *    must not keep someone else's trip public (best effort, needs the token)
 * 1. ask the server to revoke the token (best effort, needs the token, so it goes first),
 *    with this device's push token so it is unregistered too (T-502)
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
  async (options, { dispatch, extra, getState }) => {
    const allDevices = !!options && options.allDevices === true;
    // Results of requests started before this point belong to the old session (T-103).
    bumpSessionEpoch();
    // This device's FCM token (T-502): sent with the revoke so the server stops pushing to it.
    const deviceToken = getRegisteredDeviceToken();
    const sharedRideId = sharedTripRideIdOf(getState());
    try {
      if (sharedRideId !== null) {
        await step('revoke live trip link', () => safetyApi.stopShare(sharedRideId, LOGOUT_REQUEST_TIMEOUT_MS));
      }
      await step('server revoke', async () => {
        if (allDevices) {
          // logout-all also removes every device of the user (BE-11).
          await apiService.logoutAll({ timeout: LOGOUT_REQUEST_TIMEOUT_MS });
          return;
        }
        try {
          await apiService.logout(
            { timeout: LOGOUT_REQUEST_TIMEOUT_MS },
            deviceToken ? { device_token: deviceToken } : undefined,
          );
        } catch (error) {
          // The revoke failed (offline, 5xx): still try to drop the push device so this phone
          // stops getting the old user's notifications, then report the original failure.
          if (deviceToken) {
            await notificationsApi.unregisterDevice(deviceToken, LOGOUT_REQUEST_TIMEOUT_MS).catch(() => undefined);
          }
          throw error;
        }
      });
      await step('close sockets', () => webSocketService.closeAll());
      // Stop and forget the last position and listeners, so user A's location is never
      // posted under user B (T-104).
      await step('reset location tracking', () => locationTrackingService.reset());
      await step('reset push device', () => resetPushDevice());
      await step('cancel requests', () => cancelAllRequests());
      await step('clear auth storage', () => apiService.clearAuthData());
      // Pre-T-502 builds cached the notification list under this key.
      await step('clear cached notifications', () => AsyncStorage.removeItem(LEGACY_NOTIFICATIONS_CACHE_KEY));
    } finally {
      // T-570: the phone-code send hold (in memory) belongs to this user's sign-in.
      resetOtpSendHold();
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
    // T-582: the account's state (a suspended account's cold start lands here), shown on the
    // account status screen; not a warning (it raised the dev LogBox, QA 2026-10-19 obs 7).
    logger.debug('Account refused by the server; routing to account status', { status: refused.status });
    dispatch(accountStatusRefused(refused));
    // The cache gets the status too (never rejection_reason), so an offline cold start does
    // not route home; skipped if the session ends meanwhile.
    authStorage.saveUser(refused, currentSessionEpoch()).catch((error: unknown) => {
      logger.warn('accountRefused - could not cache the refused status', {
        name: error instanceof Error ? error.name : typeof error,
      });
    });
    if (wasActive) {
      stopLiveServices('accountRefused');
    }
    return true;
  };

/**
 * An active user just lost access (blocked by the server, T-106/T-531): live sockets close and
 * location tracking is reset (last position dropped) right away, instead of waiting for the
 * home screens to unmount. Never throws.
 */
export const stopLiveServices = (caller: string): void => {
  try {
    webSocketService.closeAll();
    // reset, not stop: the last position and listeners are dropped right away.
    locationTrackingService.reset();
  } catch (error) {
    logger.warn(`${caller} - could not stop live services`, {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
};
