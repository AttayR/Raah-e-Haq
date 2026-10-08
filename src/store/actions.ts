import { createAction } from '@reduxjs/toolkit';

/**
 * Root reset: the root reducer answers it by returning every slice to its initial state.
 * Dispatched only by the `logout` thunk (store/thunks/sessionThunks.ts), never by screens.
 */
export const resetApp = createAction('app/reset');
