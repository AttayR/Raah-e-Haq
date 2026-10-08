import { createTransform, type MigrationManifest, type PersistedState } from 'redux-persist';
import type { AuthState } from './slices/apiAuthSlice';
import { toStoredUser } from '../core/auth/storedUser';

/**
 * OTP state is per-session and must never reach AsyncStorage (AUTH-02, INF-05).
 * Inbound: dropped before apiAuth is written. Outbound: anything an older build stored is
 * discarded on rehydrate.
 */
const withoutOtp = (state: AuthState): AuthState =>
  state ? { ...state, otpData: null, isOtpSent: false } : state;

export const stripOtpTransform = createTransform<AuthState, AuthState>(withoutOtp, withoutOtp, {
  whitelist: ['apiAuth'],
});

/**
 * The bearer token lives only in the Keychain/Keystore (services/authStorage, INF-20, T-104),
 * and the persisted user carries no CNIC, contacts, licence or bank fields. Inbound: never
 * written. Outbound: a token or those fields an older build stored are dropped on rehydrate
 * (the token itself is migrated by authStorage from its own legacy key).
 */
const withoutSecrets = (state: AuthState): AuthState => {
  if (!state) {
    return state;
  }
  // apiAuth has no token field any more (T-107); an older build's persisted copy may.
  const next: AuthState & { token?: unknown } = { ...state, user: toStoredUser(state.user) };
  delete next.token;
  return next;
};

export const stripApiAuthSecretsTransform = createTransform<AuthState, AuthState>(
  withoutSecrets,
  withoutSecrets,
  { whitelist: ['apiAuth'] },
);

/**
 * Transient auth state must not survive a restart (AUTH-16, T-103): a stale error or a
 * "loading" status would show on Login, and a persisted `isInitialized: true` would skip the
 * splash and flash Login/home before initializeAuth has checked the token.
 * redux-persist runs transforms per slice key, so these whitelist the real keys (the old
 * `whitelist: ['root']` never ran). Applied both ways: nothing transient is written, and
 * whatever an older build wrote is cleaned on rehydrate.
 */
const withoutTransientApiAuth = (state: AuthState): AuthState =>
  state
    ? {
        ...state,
        error: null,
        status: state.status === 'loading' || state.status === 'failed' ? 'idle' : state.status,
        isInitialized: false,
      }
    : state;

export const clearApiAuthTransientTransform = createTransform<AuthState, AuthState>(
  withoutTransientApiAuth,
  withoutTransientApiAuth,
  { whitelist: ['apiAuth'] },
);

/**
 * Persisted-state version. Bumped when a persisted slice is removed or reshaped, so the
 * matching migration below runs once on the first launch of the new build.
 */
export const PERSIST_VERSION = 1;

type LegacyRoot = Exclude<PersistedState, undefined> & Record<string, unknown>;

/**
 * v1 (T-107): the Firebase `auth` slice (session with an ID token, phone, uid, a profile with
 * CNIC) and the `user` slice are gone. An older build's copy is dropped before rehydrate, so
 * it never reaches Redux (and combineReducers never sees keys it has no reducer for); the
 * next persist write no longer contains it.
 */
export const persistMigrations: MigrationManifest = {
  1: (state: PersistedState): PersistedState => {
    if (!state) {
      return state;
    }
    const next: LegacyRoot = { ...state };
    delete next.auth;
    delete next.user;
    return next;
  },
};
