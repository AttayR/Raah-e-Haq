/**
 * Session generation counter (T-103). `logout` bumps it before it clears anything, so a
 * request that started in an earlier session can tell, when it settles, that its result
 * belongs to a user who has since signed out and must not reach Redux or AsyncStorage.
 * T-104 replaces this with a full session epoch + AbortController.
 */
let epoch = 0;

export const currentSessionEpoch = (): number => epoch;

export const bumpSessionEpoch = (): number => {
  epoch += 1;
  return epoch;
};

export const isStaleSession = (startedIn: number): boolean => startedIn !== epoch;

/** Rejection message for a result dropped because the session ended; reducers never show it. */
export const STALE_SESSION_MESSAGE = 'Session ended before the request finished';
