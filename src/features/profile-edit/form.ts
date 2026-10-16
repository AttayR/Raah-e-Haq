import type { ProfileUpdateRequest, User } from '../../services/api';
import { firstFieldMessages, type ThunkRejection } from '../../core/api/errors';
import { isIsoDate, latestBirthDateForAge, MIN_BIRTH_YEAR, MIN_DRIVER_AGE } from '../../schemas/registrationSchema';
import { t, type TranslationKey } from '../../i18n';

/**
 * The Edit profile form (T-504b), pure: what PUT /profile may change and how. The rules follow
 * ProfileController::update (name ≤ 255, email, gender male|female|other, a past date of birth
 * that is 18+ for a driver (BE-68), address ≤ 500 or empty (BE-101), bio ≤ 500 or empty). The phone is not here:
 * it changes through POST /profile/phone (BE-35).
 */

export type Gender = 'male' | 'female' | 'other';

export const GENDERS: readonly Gender[] = ['male', 'female', 'other'];

export interface ProfileForm {
  name: string;
  email: string;
  /** Only asked for (and sent) when the email changes to a new address (BE-38). */
  currentPassword: string;
  gender: Gender | '';
  /** YYYY-MM-DD */
  dateOfBirth: string;
  address: string;
  bio: string;
}

export type ProfileField = keyof ProfileForm;

export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const NAME_MAX = 255;
export const EMAIL_MAX = 255;
export const ADDRESS_MAX = 500;
export const BIO_MAX = 500;

const toGender = (value: string | undefined): Gender | '' => {
  const lower = value?.trim().toLowerCase();
  return GENDERS.find((g) => g === lower) ?? '';
};

/** "1990-01-15" from "1990-01-15" or "1990-01-15T00:00:00Z"; '' otherwise. */
const toIsoDay = (value: string | undefined): string => {
  const match = value ? /^(\d{4}-\d{2}-\d{2})/.exec(value) : null;
  return match ? match[1] : '';
};

/** The form as the signed-in user's profile fills it. The email field starts on the current email. */
export const toProfileForm = (user: User | null): ProfileForm => ({
  name: user?.name ?? '',
  email: user?.email ?? '',
  currentPassword: '',
  gender: toGender(user?.gender),
  dateOfBirth: toIsoDay(user?.date_of_birth),
  address: user?.address ?? '',
  bio: user?.bio ?? '',
});

const normalizeEmail = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

const changed = (form: ProfileForm, initial: ProfileForm, field: Exclude<ProfileField, 'currentPassword'>): boolean =>
  field === 'email'
    ? normalizeEmail(form.email) !== normalizeEmail(initial.email)
    : form[field].trim() !== initial[field].trim();

const EDITABLE: ReadonlyArray<Exclude<ProfileField, 'currentPassword'>> = [
  'name',
  'email',
  'gender',
  'dateOfBirth',
  'address',
  'bio',
];

/** Any field differs from the profile (the password alone is not a change). */
export const isProfileDirty = (form: ProfileForm, initial: ProfileForm): boolean =>
  EDITABLE.some((field) => changed(form, initial, field));

/**
 * The new email starts a change, so the current password is needed (BE-38 retry): it is neither
 * the current email nor the one already waiting for its link.
 */
export const emailNeedsPassword = (form: ProfileForm, initial: ProfileForm, user: User | null): boolean => {
  const email = normalizeEmail(form.email);
  return (
    email !== '' &&
    changed(form, initial, 'email') &&
    email !== normalizeEmail(user?.email) &&
    email !== normalizeEmail(user?.pending_email)
  );
};

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pad = (n: number) => String(n).padStart(2, '0');
const todayIso = (now: Date): string => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const dateOfBirthError = (value: string, isDriver: boolean, now: Date): TranslationKey | null => {
  if (!value) return 'profileEdit.dobRequired';
  if (!isIsoDate(value)) return 'profileEdit.dobFormat';
  if (value >= todayIso(now)) return 'profileEdit.dobFuture';
  if (Number(value.slice(0, 4)) < MIN_BIRTH_YEAR) return 'profileEdit.dobYear';
  if (isDriver && value > latestBirthDateForAge(MIN_DRIVER_AGE, now)) return 'profileEdit.dobDriverAge';
  return null;
};

/**
 * Field errors for the changed fields (unchanged ones are not sent, so they are not checked).
 * A field the server cannot clear (name, email, date of birth) may not be emptied; the address
 * and bio may (BE-101).
 */
export const validateProfileForm = (
  form: ProfileForm,
  initial: ProfileForm,
  user: User | null,
  now: Date = new Date(),
): ProfileErrors => {
  const errors: Partial<Record<ProfileField, TranslationKey>> = {};
  const name = form.name.trim();
  if (changed(form, initial, 'name')) {
    if (!name) errors.name = 'profileEdit.nameRequired';
    else if (name.length > NAME_MAX) errors.name = 'profileEdit.nameTooLong';
  }
  const email = form.email.trim();
  if (changed(form, initial, 'email')) {
    if (!email) errors.email = 'profileEdit.emailRequired';
    else if (email.length > EMAIL_MAX || !EMAIL_FORMAT.test(email)) errors.email = 'profileEdit.emailInvalid';
    else if (emailNeedsPassword(form, initial, user) && !form.currentPassword) {
      errors.currentPassword = 'profileEdit.passwordRequired';
    }
  }
  if (changed(form, initial, 'dateOfBirth')) {
    const issue = dateOfBirthError(form.dateOfBirth.trim(), user?.role === 'driver', now);
    if (issue) errors.dateOfBirth = issue;
  }
  if (changed(form, initial, 'address')) {
    // An empty address clears the saved one (BE-101: `address: nullable|string|max:500`).
    if (form.address.trim().length > ADDRESS_MAX) errors.address = 'profileEdit.addressTooLong';
  }
  if (form.bio.trim().length > BIO_MAX) errors.bio = 'profileEdit.bioTooLong';

  const messages: ProfileErrors = {};
  (Object.keys(errors) as ProfileField[]).forEach((field) => {
    const key = errors[field];
    if (key) messages[field] = t(key);
  });
  return messages;
};

/**
 * PUT /profile with only the changed fields. The email is sent only when the user changed it,
 * so saving a name never cancels a pending email change (sending the current email does, BE-38);
 * `current_password` only when that change needs it. A cleared address or bio is sent as null
 * (BE-101). The phone is never sent (BE-35).
 */
export const buildProfileUpdate = (form: ProfileForm, initial: ProfileForm, user: User | null): ProfileUpdateRequest => {
  const update: ProfileUpdateRequest = {};
  if (changed(form, initial, 'name')) update.name = form.name.trim();
  if (changed(form, initial, 'email')) {
    update.email = form.email.trim();
    if (emailNeedsPassword(form, initial, user)) update.current_password = form.currentPassword;
  }
  if (changed(form, initial, 'gender') && form.gender) update.gender = form.gender;
  if (changed(form, initial, 'dateOfBirth')) update.date_of_birth = form.dateOfBirth.trim();
  if (changed(form, initial, 'address')) update.address = form.address.trim() || null;
  if (changed(form, initial, 'bio')) update.bio = form.bio.trim() || null;
  return update;
};

const SERVER_FIELDS: Record<string, ProfileField> = {
  name: 'name',
  email: 'email',
  current_password: 'currentPassword',
  gender: 'gender',
  date_of_birth: 'dateOfBirth',
  address: 'address',
  bio: 'bio',
};

/**
 * A refused save as field errors plus one line for the rest. 422 `errors.*` go under their field
 * (never read as "email taken": BE-38 answers the same for any address); the wrong-password
 * limit (429 on `current_password`, BE-42) names the wait under the password field.
 */
export const profileSaveErrors = (
  rejection: ThunkRejection | undefined,
): { fields: ProfileErrors; form: string | null } => {
  const fields: ProfileErrors = {};
  let other: string | null = null;
  Object.entries(firstFieldMessages(rejection?.fieldErrors)).forEach(([key, message]) => {
    const field = SERVER_FIELDS[key];
    if (field) fields[field] = message;
    else other = other ?? message;
  });
  if (rejection?.status === 429 || rejection?.kind === 'rate_limited') {
    const seconds = rejection.retryAfter;
    fields.currentPassword =
      seconds && seconds > 0
        ? t('profileEdit.passwordLimited', { minutes: Math.max(1, Math.ceil(seconds / 60)) })
        : t('profileEdit.passwordLimitedNoTime');
    return { fields, form: null };
  }
  if (Object.keys(fields).length > 0) return { fields, form: other };
  return { fields, form: other ?? rejection?.message ?? t('profileEdit.saveFailed') };
};
