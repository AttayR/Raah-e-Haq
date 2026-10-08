import type { AccountStatus, User, UserRole } from '../../services/api';
import type { AccountRefusal } from '../api/errors';

/**
 * The one place a user from the server (or from device storage) becomes a `User` (AUTH-08).
 *
 * Every response that carries a user has its own shape:
 * - login and verify-otp: `role` plus `roles[]` (BE-29)
 * - register: `user_type`, `role`, `roles[]`, `phone: null` + `pending_phone` (BE-35)
 * - GET /auth/profile, GET /user, GET|PUT /profile: `role`, `roles[]`, `languages[]` (BE-29)
 * - users cached by older builds: maybe no `role` at all, or `roles` as `{ name }` objects
 *
 * The result always has a known `role` (or null) and a known `status`, and routing reads
 * only those two fields.
 */

const APP_ROLES: readonly UserRole[] = ['driver', 'passenger', 'admin'];
const ACCOUNT_STATUSES: readonly AccountStatus[] = ['active', 'inactive', 'pending', 'suspended', 'rejected'];

/**
 * A status the app does not recognise (or a missing one) is treated as not active, so an
 * unexpected payload can never open the home screens.
 */
export const UNKNOWN_STATUS: AccountStatus = 'inactive';

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toRole = (value: unknown): UserRole | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const role = value.trim().toLowerCase();
  return APP_ROLES.find(known => known === role) ?? null;
};

/** A server status string as an AccountStatus; anything unrecognised is UNKNOWN_STATUS. */
export const toStatus = (value: unknown): AccountStatus => {
  if (typeof value !== 'string') {
    return UNKNOWN_STATUS;
  }
  const status = value.trim().toLowerCase();
  return ACCOUNT_STATUSES.find(known => known === status) ?? UNKNOWN_STATUS;
};

/** Role names from `roles: ['driver']` or the raw relation `roles: [{ name: 'driver' }]`. */
const toRoleNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(entry => (isRecord(entry) ? entry.name : entry))
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
};

const toId = (value: unknown): number | null => {
  const id = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
};

const toStringList = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

const OPTIONAL_STRING_FIELDS = [
  'cnic',
  'address',
  'country',
  'bio',
  'gender',
  'date_of_birth',
  'profile_image_url',
  'emergency_contact',
  'emergency_contact_name',
  'emergency_contact_relation',
  'license_number',
  'license_type',
  'license_expiry_date',
  'vehicle_type',
  'preferred_payment',
  'created_at',
  'updated_at',
] as const;

type OptionalStringField = (typeof OPTIONAL_STRING_FIELDS)[number];

const NULLABLE_STRING_FIELDS = ['pending_phone', 'phone_verified_at', 'rejection_reason'] as const;

type NullableStringField = (typeof NULLABLE_STRING_FIELDS)[number];

/**
 * Derives `role` as `role ?? user_type ?? roles[0]` (only roles the app knows count) and
 * `status` (unknown or missing: UNKNOWN_STATUS). Returns null when the payload is not a user
 * at all (not an object, or no valid id).
 */
export function normalizeUser(raw: unknown): User | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = toId(raw.id);
  if (id === null) {
    return null;
  }

  const roles = toRoleNames(raw.roles);
  const role =
    toRole(raw.role) ?? toRole(raw.user_type) ?? roles.map(toRole).find((r): r is UserRole => r !== null) ?? null;

  const user: User = {
    id,
    name: typeof raw.name === 'string' ? raw.name : '',
    email: typeof raw.email === 'string' ? raw.email : '',
    phone: typeof raw.phone === 'string' && raw.phone !== '' ? raw.phone : null,
    status: toStatus(raw.status),
    role,
    roles: roles.length > 0 ? roles : role ? [role] : [],
  };

  const languages = toStringList(raw.languages);
  if (languages) {
    user.languages = languages;
  }
  OPTIONAL_STRING_FIELDS.forEach((field: OptionalStringField) => {
    const value = raw[field];
    if (typeof value === 'string') {
      user[field] = value;
    }
  });
  NULLABLE_STRING_FIELDS.forEach((field: NullableStringField) => {
    const value = raw[field];
    if (typeof value === 'string' || value === null) {
      user[field] = value;
    }
  });
  return user;
}

/** The status each BE-25 refusal code stands for (the body's `data.status` may refine it). */
const statusForRefusalCode = (code: string | undefined): AccountStatus | null => {
  switch (code) {
    case 'ACCOUNT_PENDING':
      return 'pending';
    case 'ACCOUNT_INACTIVE':
      return 'inactive';
    case 'ACCOUNT_SUSPENDED':
      return 'suspended';
    case 'ACCOUNT_REJECTED':
      return 'rejected';
    default:
      return null;
  }
};

/** An ApiError or ThunkRejection: the fields that identify a 403 ACCOUNT_* refusal. */
export interface RefusalLike {
  status?: number;
  code?: string;
  account?: AccountRefusal;
}

/**
 * The account status a 403 ACCOUNT_* refusal states (BE-25/BE-32), or null for any other
 * error. The server is authoritative here: the token still works but the account is blocked.
 * A refusal never means `active`, so a body status that is missing, unknown or `active` falls
 * back to the code's status.
 */
export function refusedAccountStatus(error: RefusalLike | null | undefined): AccountStatus | null {
  if (!error || error.status !== 403) {
    return null;
  }
  const byCode = statusForRefusalCode(error.code);
  if (!byCode) {
    return null;
  }
  const byBody = error.account?.status === undefined ? null : toStatus(error.account.status);
  return byBody && byBody !== 'active' && byBody !== UNKNOWN_STATUS ? byBody : byCode;
}

/**
 * `user` with the status of a 403 ACCOUNT_* refusal merged in, or null when `error` is not
 * such a refusal. `rejection_reason` is taken when the body has it; it is a sensitive field
 * (core/auth/storedUser), so it lives in Redux memory only and is never cached.
 */
export function withRefusedStatus(user: User, error: RefusalLike | null | undefined): User | null {
  const status = refusedAccountStatus(error);
  if (!status) {
    return null;
  }
  const merged: User = { ...user, status };
  const reason = error?.account?.rejectionReason;
  if (reason !== undefined) {
    merged.rejection_reason = reason;
  }
  return merged;
}

/** Where the signed-in state sends the user (AuthFlow). */
export type AuthRoute = 'splash' | 'auth' | 'account-status' | 'driver' | 'passenger';

/**
 * Routing from the normalised fields only:
 * - not initialised yet: splash
 * - signed out (or no user): auth screens
 * - any status other than `active` (pending, inactive, suspended, rejected): account status
 * - active driver / passenger: their home stack
 * - active but no role the app serves (admin, or none): account status, which can sign out
 */
export function resolveAuthRoute(state: {
  isInitialized: boolean;
  isAuthenticated: boolean;
  user: Pick<User, 'role' | 'status'> | null;
}): AuthRoute {
  if (!state.isInitialized) {
    return 'splash';
  }
  if (!state.isAuthenticated || !state.user) {
    return 'auth';
  }
  if (state.user.status !== 'active') {
    return 'account-status';
  }
  if (state.user.role === 'driver') {
    return 'driver';
  }
  if (state.user.role === 'passenger') {
    return 'passenger';
  }
  return 'account-status';
}
