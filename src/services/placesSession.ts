/** T-534 (PERF-10): no lookup for fewer characters than this. */
export const MIN_AUTOCOMPLETE_CHARS = 3;

/**
 * One Places session (T-534, PERF-10): the autocomplete requests of one search and the details
 * request of the picked place share a token, so Google bills them as one session. A billing
 * token only, not a secret: Math.random is enough.
 */
export const newPlacesSessionToken = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    // The `y` digit is the RFC 4122 variant: 8, 9, a or b.
    const r = ch === 'x' ? Math.floor(Math.random() * 16) : 8 + Math.floor(Math.random() * 4);
    return r.toString(16);
  });
