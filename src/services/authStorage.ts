import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isStaleSession } from '../store/sessionEpoch';
import { toStoredUser } from '../core/auth/storedUser';
import { normalizeUser } from '../core/auth/normalizeUser';
import { logger } from '../core/logging/logger';
import type { User } from './api';

/**
 * Where the session lives on the device (INF-20, AUTH-05, T-104).
 *
 * - The bearer token (and its `expires_at`) is in the iOS Keychain / Android Keystore via
 *   react-native-keychain, never in AsyncStorage or redux-persist.
 * - One in-memory copy of it is what the axios interceptor reads, so a request does not hit
 *   the Keychain every time.
 * - The cached user (`user_data`) stays in AsyncStorage, without CNIC, contacts, licence or
 *   bank fields (see core/auth/storedUser).
 * - Every write goes through one serial queue and can carry the session epoch it belongs
 *   to. A write whose session ended (logout bumped the epoch) is skipped, and logout's clear
 *   is queued behind any write that already started, so a late login/profile result can
 *   never re-write the token or the user after a logout.
 */

const KEYCHAIN_SERVICE = 'com.raahehaq.auth.session';
const KEYCHAIN_ACCOUNT = 'session';
/** Pre-T-104 builds kept the token here in plain text. Migrated once, then deleted. */
const LEGACY_TOKEN_KEY = 'auth_token';
const LEGACY_REFRESH_KEY = 'refresh_token';
const USER_KEY = 'user_data';
/**
 * AsyncStorage is wiped on uninstall but the iOS Keychain is not. A Keychain session found
 * while this marker is missing belongs to an earlier install and is discarded.
 */
const INSTALL_MARKER_KEY = 'auth_storage_installed';
/**
 * Set while a clear() is wiping the Keychain and left in place if that wipe failed. While it
 * is set, the Keychain entry is treated as gone (and the wipe retried), so a failed wipe can
 * never bring a signed-out token back. A newly stored session removes it.
 */
const WIPE_PENDING_KEY = 'auth_storage_wipe_pending';

export interface StoredSession {
  token: string;
  /** ISO 8601 from login/verify-otp `data.expires_at`; null when the server sent none. */
  expiresAt: string | null;
}

/** undefined = not read from the Keychain yet; null = read, no session. */
let cache: StoredSession | null | undefined;
/** The Keychain could not be read this launch: warned once, then treated as no session. */
let readFailureLogged = false;
let queue: Promise<unknown> = Promise.resolve();

const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
  const run = queue.then(op, op);
  queue = run.catch(() => undefined);
  return run;
};

const errorName = (error: unknown): string => (error instanceof Error ? error.name : typeof error);

const parseSession = (raw: string): StoredSession | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const { token, expiresAt } = parsed as Record<string, unknown>;
      if (typeof token === 'string' && token) {
        return { token, expiresAt: typeof expiresAt === 'string' ? expiresAt : null };
      }
    }
  } catch {
    // Not JSON: unreadable entry, treated as no session.
  }
  return null;
};

const writeKeychain = async (session: StoredSession): Promise<void> => {
  const result = await Keychain.setGenericPassword(KEYCHAIN_ACCOUNT, JSON.stringify(session), {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (result === false) {
    throw new Error('Secure storage refused the session');
  }
};

/** Reads the Keychain, migrating a legacy AsyncStorage token once. Runs inside the queue. */
const load = async (): Promise<StoredSession | null> => {
  if (cache !== undefined) {
    return cache;
  }
  const [[, legacyToken], [, installed], [, wipePending]] = await AsyncStorage.multiGet([
    LEGACY_TOKEN_KEY,
    INSTALL_MARKER_KEY,
    WIPE_PENDING_KEY,
  ]);
  if (wipePending) {
    // An earlier clear() could not wipe the Keychain: whatever is there is signed out.
    try {
      await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
      await AsyncStorage.removeItem(WIPE_PENDING_KEY);
    } catch (error) {
      logger.warn('authStorage - Keychain wipe retry failed', { name: errorName(error) });
    }
    await AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_REFRESH_KEY]);
    cache = null;
    return null;
  }

  let credentials: Awaited<ReturnType<typeof Keychain.getGenericPassword>>;
  try {
    credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  } catch (error) {
    // Not retried on every request: this launch runs without a stored session.
    if (!readFailureLogged) {
      readFailureLogged = true;
      logger.warn('authStorage - Keychain read failed; continuing signed out', { name: errorName(error) });
    }
    cache = null;
    return null;
  }
  let session = credentials ? parseSession(credentials.password) : null;

  if (legacyToken) {
    // One-time migration from the plain-text key.
    session = { token: legacyToken, expiresAt: null };
    await writeKeychain(session);
  } else if (session && !installed) {
    // Left in the Keychain by an earlier install of the app.
    await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    session = null;
  }
  await AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_REFRESH_KEY]);
  if (!installed) {
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, '1');
  }
  cache = session;
  return session;
};

/** Skips the write when it belongs to a session that has ended. */
const isCurrent = (sessionEpoch?: number): boolean =>
  sessionEpoch === undefined || !isStaleSession(sessionEpoch);

export const authStorage = {
  /** The stored session, from memory after the first read. */
  getSession(): Promise<StoredSession | null> {
    return cache !== undefined ? Promise.resolve(cache) : enqueue(load);
  },

  async getToken(): Promise<string | null> {
    return (await authStorage.getSession())?.token ?? null;
  },

  /**
   * Stores the token (and the user, if given). Returns false, writing nothing, when
   * `sessionEpoch` is given and that session has ended.
   */
  saveSession(
    session: { token: string; expiresAt?: string | null; user?: User },
    sessionEpoch?: number,
  ): Promise<boolean> {
    return enqueue(async () => {
      if (!isCurrent(sessionEpoch)) {
        return false;
      }
      const next: StoredSession = { token: session.token, expiresAt: session.expiresAt ?? null };
      await writeKeychain(next);
      cache = next;
      // The Keychain now holds this session, so a pending wipe of an older one is done.
      await AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_REFRESH_KEY, WIPE_PENDING_KEY]);
      // This install wrote the entry, so it is not a leftover of an earlier install.
      await AsyncStorage.setItem(INSTALL_MARKER_KEY, '1');
      if (session.user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(toStoredUser(session.user)));
      }
      return true;
    });
  },

  /** Stores the cached user. Same epoch rule as saveSession. */
  saveUser(user: User, sessionEpoch?: number): Promise<boolean> {
    return enqueue(async () => {
      if (!isCurrent(sessionEpoch)) {
        return false;
      }
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(toStoredUser(user)));
      return true;
    });
  },

  async getUser(): Promise<User | null> {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      // user_data may have been written by an older build (no `role`, other shapes).
      return raw ? normalizeUser(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },

  /**
   * Removes the token (Keychain and any legacy copy) and the cached user. Queued behind any
   * write already in progress, so nothing written before it survives.
   */
  clear(): Promise<void> {
    // Stop sending the token right away.
    cache = null;
    return enqueue(async () => {
      cache = null;
      let wiped = false;
      try {
        await AsyncStorage.setItem(WIPE_PENDING_KEY, '1');
        await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
        wiped = true;
      } finally {
        await AsyncStorage.multiRemove(
          wiped
            ? [LEGACY_TOKEN_KEY, LEGACY_REFRESH_KEY, USER_KEY, WIPE_PENDING_KEY]
            : [LEGACY_TOKEN_KEY, LEGACY_REFRESH_KEY, USER_KEY],
        );
        // Wiped: the next read goes back to the (empty) Keychain. Not wiped: stay signed out
        // in memory; the pending flag makes the next launch ignore and re-wipe the entry.
        cache = wiped ? undefined : null;
      }
    });
  },
};

/** Test-only: drop the in-memory copy, as a new app launch would. */
export const __forgetAuthCacheForTests = (): void => {
  cache = undefined;
  readFailureLogged = false;
};

export default authStorage;
