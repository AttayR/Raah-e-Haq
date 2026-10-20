import { createAction } from '@reduxjs/toolkit';
import type { User } from '../services/api';

/**
 * Root reset: the root reducer answers it by returning every slice to its initial state.
 * Dispatched only by the `logout` thunk (store/thunks/sessionThunks.ts), never by screens.
 */
export const resetApp = createAction('app/reset');

/**
 * A request of the current session got 403 ACCOUNT_* (BE-25/BE-32): the payload is the
 * signed-in user with the refused status merged in (core/auth/normalizeUser withRefusedStatus).
 * Dispatched only by the `accountRefused` thunk (store/thunks/sessionThunks.ts); AuthFlow then
 * routes to the account-status screen. The session (token) is kept: Check Status and Sign Out
 * work from there.
 */
export const accountStatusRefused = createAction<User>('app/accountStatusRefused');

/**
 * BE-129: POST /account/deletion/cancel succeeded ("Keep my account"): the signed-in user's
 * `deletion_scheduled_for` is cleared, so AuthFlow leaves AccountRestore for the role's tabs.
 */
export const accountDeletionCancelled = createAction('app/accountDeletionCancelled');
