/**
 * What of the signed-in user may be written to device storage (INF-20, T-104).
 *
 * The cached user (AsyncStorage `user_data` and the redux-persist `apiAuth.user`) is only
 * there so an offline cold start can route to the right home screen. Identity documents,
 * emergency contacts, licence and bank details are never needed for that, so they stay in
 * memory only and are fetched again from GET /auth/profile.
 */
const SENSITIVE_USER_FIELD =
  /^(cnic|passenger_cnic|emergency_contact|passenger_emergency_contact|license|licence|bank_|date_of_birth|dob$|rejection_reason)/i;

export const isSensitiveUserField = (key: string): boolean => SENSITIVE_USER_FIELD.test(key);

/** A shallow copy of `user` without the fields that must not reach device storage. */
export function toStoredUser<T extends object>(user: T): T;
export function toStoredUser<T extends object>(user: T | null): T | null;
export function toStoredUser<T extends object>(user: T | null): T | null {
  if (!user) {
    return user;
  }
  const out: Record<string, unknown> = {};
  Object.entries(user).forEach(([key, value]) => {
    if (!isSensitiveUserField(key)) {
      out[key] = value;
    }
  });
  return out as T;
}
