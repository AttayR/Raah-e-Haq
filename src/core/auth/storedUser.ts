import type { User } from '../../services/api';
import { normalizeUser } from './normalizeUser';

/**
 * What of the signed-in user may be written to device storage (INF-20, T-104, SEC-29 / T-114).
 *
 * The cached user (AsyncStorage `user_data` and the redux-persist `apiAuth.user`) is only
 * there so an offline cold start can route to the right screen (AuthFlow: `role`/`status`)
 * and greet the user by name (home screens, account status). It is an allowlist: phone,
 * email, address, gender, CNIC, contacts, licence, bank details, rejection_reason and any
 * field the server adds later stay in Redux memory only, and come again from
 * GET /auth/profile.
 */
export const STORED_USER_FIELDS = [
  'id',
  'name',
  'role',
  'roles',
  'status',
  'phone_verified_at',
] as const;

type StoredUserField = (typeof STORED_USER_FIELDS)[number];

/**
 * The cached user: only the allowlisted fields (phone_verified_at only when the server sent
 * it). No other verified flag is listed: nothing in the app reads one, and normalizeUser
 * does not keep them.
 */
export type StoredUser = Pick<User, 'id' | 'name' | 'role' | 'roles' | 'status'> &
  Partial<Pick<User, 'phone_verified_at'>>;

const ALLOWED = new Set<string>(STORED_USER_FIELDS);

export const isStoredUserField = (key: string): key is StoredUserField => ALLOWED.has(key);

/** A shallow copy of `user` with only the fields that may reach device storage. */
export function toStoredUser(user: object): StoredUser;
export function toStoredUser(user: object | null | undefined): StoredUser | null;
export function toStoredUser(user: object | null | undefined): StoredUser | null {
  if (!user) {
    return null;
  }
  const out: Record<string, unknown> = {};
  Object.entries(user).forEach(([key, value]) => {
    if (isStoredUserField(key) && value !== undefined) {
      out[key] = value;
    }
  });
  return out as StoredUser;
}

/**
 * A user from device storage (or about to be written there), as a `User`: normalised first so
 * a legacy shape (`user_type` only, `roles` as objects) keeps its derived role, cut down to the
 * allowlist, then normalised again. Null when it is not a user at all.
 */
export const toCachedUser = (raw: unknown): User | null => {
  const user = normalizeUser(raw);
  return user ? normalizeUser(toStoredUser(user)) : null;
};
