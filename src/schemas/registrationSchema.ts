import * as yup from 'yup';
import { toPkMobileE164 } from '../services/otpService';
import {
  INITIAL_REGISTRATION_FORM,
  VEHICLE_PHOTO_SLOTS,
  VEHICLE_TYPE_IDS,
  filledVehiclePhotoCount,
  type RegistrationFormData,
  type RegistrationRole,
  type RegistrationStep,
} from '../features/auth/registration/registrationForm';
import { REGISTRATION_ERRORS as E } from '../features/auth/copy/registrationErrors';

/**
 * Per-step validation of the registration form (T-201, AUTH-11, AUTH-12). Each step is
 * validated before Next, and every step again before Create Account, so nothing the server
 * would refuse with 422 for a format reason gets that far. The rules follow the backend's
 * AuthController::register (BE-27/BE-28/BE-29); a few are stricter on purpose (password
 * strength, CNIC format). Errors are keyed by the form field name.
 *
 * T-575: every message is a function, so yup reads it from REGISTRATION_ERRORS when a rule fails,
 * in the language active at that moment (the schemas themselves are built once, at load).
 */

/** The backend's oldest accepted model year (App\Support\VehicleYear::MIN). */
export const MIN_VEHICLE_YEAR = 1980;

/** Next year's models go on sale this year (VehicleYear::max): computed on every call. */
export const maxVehicleYear = (now: Date = new Date()): number => now.getFullYear() + 1;

/** Oldest accepted year of birth (app-side typo guard; the backend only needs a past date). */
export const MIN_BIRTH_YEAR = 1900;

/** Drivers must be at least this old on the day they register (owner decision, T-207/BE-68). */
export const MIN_DRIVER_AGE = 18;

/** The driver age message in the active language (T-575: read when shown, never at load). */
export const driverAgeMessage = (): string => E.driverAge(MIN_DRIVER_AGE);

const CNIC_FORMAT = /^\d{5}-\d{7}-\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's local date as YYYY-MM-DD, read when a rule runs (never at import time). */
const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * The latest date of birth of someone who is `years` old today (YYYY-MM-DD), read when a rule
 * runs. Born on 29 February: the cutoff falls on 28 February in a non-leap year, so the rule
 * is never looser than the backend's `today - 18 years`.
 */
export const latestBirthDateForAge = (years: number, now: Date = new Date()): string => {
  const year = now.getFullYear() - years;
  const month = now.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(now.getDate(), lastDayOfMonth);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
};

/** A real calendar date in YYYY-MM-DD (rejects 2026-02-30). */
export const isIsoDate = (value: string | undefined): boolean => {
  if (!value || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export const EMERGENCY_RELATIONS = ['father', 'mother', 'spouse', 'brother', 'sister', 'friend', 'other'] as const;

/**
 * A person's name: letters (any script, with their marks), spaces, dots, apostrophes and hyphens,
 * starting with a letter (T-564). T-566: plain spaces only (`\p{Zs}`, no tabs or newlines), the
 * server's BE-106 PersonNameFormat pattern.
 */
export const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'-]*$/u;
const personNameMessage = () => E.personName;

type LabelKey = keyof typeof E.labels;

const requiredText = (label: LabelKey, max: number) =>
  yup
    .string()
    .trim()
    .required(() => E.required(E.labels[label]))
    .max(max, () => E.tooLong(E.labels[label], max));

const phoneRule = yup
  .string()
  .trim()
  .required(() => E.phoneRequired)
  .test('pk-mobile', () => E.phoneFormat, (value) =>
    toPkMobileE164(value ?? '') !== null,
  );

const passwordRule = yup
  .string()
  .required(() => E.passwordRequired)
  .min(8, () => E.passwordMin)
  .matches(/[a-z]/, () => E.passwordLower)
  .matches(/[A-Z]/, () => E.passwordUpper)
  .matches(/\d/, () => E.passwordDigit);

const personalBase = {
  fullName: yup
    .string()
    .trim()
    .required(() => E.fullNameRequired)
    .min(2, () => E.fullNameMin)
    .max(255, () => E.fullNameMax),
  email: yup
    .string()
    .trim()
    .required(() => E.emailRequired)
    .email(() => E.emailFormat)
    .max(255, () => E.emailMax),
  phoneNumber: phoneRule,
  cnic: yup
    .string()
    .trim()
    .required(() => E.cnicRequired)
    .matches(CNIC_FORMAT, () => E.cnicFormat),
  address: yup
    .string()
    .trim()
    .required(() => E.addressRequired)
    .min(10, () => E.addressMin)
    .max(200, () => E.addressMax),
  dateOfBirth: yup
    .string()
    .trim()
    .required(() => E.dobRequired)
    .test('iso-date', () => E.dobFormat, (value) => isIsoDate(value))
    .test('past', () => E.dobPast, (value) => !isIsoDate(value) || (value as string) < todayIso())
    // Stricter than the backend (date, before:today) on purpose: catches typos like 0199.
    .test(
      'plausible',
      () => E.dobMinYear(MIN_BIRTH_YEAR),
      (value) => !isIsoDate(value) || Number((value as string).slice(0, 4)) >= MIN_BIRTH_YEAR,
    ),
  gender: yup
    .string()
    .required(() => E.genderRequired)
    .oneOf(['male', 'female', 'other'], () => E.genderRequired),
  password: passwordRule,
  confirmPassword: yup
    .string()
    .required(() => E.confirmRequired)
    .oneOf([yup.ref('password')], () => E.confirmMismatch),
  emergencyContactNumber: yup
    .string()
    .trim()
    .max(20, () => E.tooLong(E.labels.emergencyContactNumber, 20)),
  emergencyContactName: yup
    .string()
    .trim()
    .max(100, () => E.tooLong(E.labels.emergencyContactName, 100))
    .test('person-name', personNameMessage, (value) => !value || PERSON_NAME.test(value)),
  emergencyRelationship: yup.string(),
};

/** Passengers: the backend requires the emergency contact's number, name and relation. */
const passengerPersonal = yup.object({
  ...personalBase,
  emergencyContactNumber: requiredText('emergencyContactNumber', 20).test(
    'phone-chars',
    () => E.emergencyPhoneFormat,
    (value) => !value || /^\+?[0-9\s-]{10,20}$/.test(value),
  ),
  emergencyContactName: requiredText('emergencyContactName', 100).test(
    'person-name',
    personNameMessage,
    (value) => !value || PERSON_NAME.test(value),
  ),
  emergencyRelationship: yup
    .string()
    .required(() => E.relationshipRequired)
    .oneOf([...EMERGENCY_RELATIONS], () => E.relationshipRequired),
});

/** Drivers: 18+ on the day they register (BE-68: date_of_birth <= today - 18 years). */
const driverPersonal = yup.object({
  ...personalBase,
  dateOfBirth: personalBase.dateOfBirth.test(
    'driver-adult',
    driverAgeMessage,
    (value) => !isIsoDate(value) || (value as string) <= latestBirthDateForAge(MIN_DRIVER_AGE),
  ),
});

const driverVehicle = yup.object({
  vehicleType: yup
    .string()
    .required(() => E.vehicleTypeRequired)
    .oneOf([...VEHICLE_TYPE_IDS], () => E.vehicleTypeInvalid),
  vehicleNumber: requiredText('vehicleNumber', 50),
  vehicleBrand: requiredText('vehicleBrand', 100),
  vehicleModel: requiredText('vehicleModel', 100),
  vehicleYear: yup
    .string()
    .trim()
    .required(() => E.vehicleYearRequired)
    .test('year-range', () => E.vehicleYearInvalid, function (value) {
      const year = Number(value);
      const max = maxVehicleYear();
      if (!/^\d{4}$/.test(value ?? '') || year < MIN_VEHICLE_YEAR || year > max) {
        return this.createError({ message: () => E.vehicleYearRange(MIN_VEHICLE_YEAR, max) });
      }
      return true;
    }),
  vehicleColor: requiredText('vehicleColor', 50),
  // Driving licence number: required for drivers (owner decision, T-207/BE-68; max:50 on the API).
  licenseNumber: requiredText('licenseNumber', 50),
  licenseType: requiredText('licenseType', 10),
  licenseExpiryDate: yup
    .string()
    .trim()
    .required(() => E.licenseExpiryRequired)
    .test('iso-date', () => E.licenseExpiryFormat, (value) => isIsoDate(value))
    .test('future', () => E.licenseExpired, (value) => !isIsoDate(value) || (value as string) > todayIso()),
  licensePlate: requiredText('licensePlate', 20),
  registrationNumber: requiredText('registrationNumber', 50),
  drivingExperience: yup.string().trim().required(() => E.experienceRequired),
  bankName: requiredText('bankName', 100),
  bankBranch: requiredText('bankBranch', 100),
  bankAccountNumber: requiredText('bankAccountNumber', 50),
});

const driverDocuments = yup.object({
  driverPicture: yup.string().required(() => E.driverPictureRequired),
  cnicPicture: yup.string().required(() => E.cnicFrontRequired),
  // Sent as cnic_back_image (T-203); the server's approval rule needs it, so it is asked upfront.
  cnicBackPicture: yup.string().required(() => E.cnicBackRequired),
  // Sent as license_image, required for drivers (T-207/BE-68). The back side stays optional.
  licenseFrontPicture: yup.string().required(() => E.licenseFrontRequired),
  vehiclePictures: yup
    .array()
    .of(yup.string())
    // Sent as vehicle_front/back/left/right_image (T-203): one photo per slot, empty slots are ''.
    .max(VEHICLE_PHOTO_SLOTS.length, () => E.vehiclePicturesMax)
    .test(
      'all-sides',
      () => E.vehiclePicturesAll,
      (value) => filledVehiclePhotoCount(value) >= VEHICLE_PHOTO_SLOTS.length,
    ),
});

const NOTHING = yup.object({});

/** The schema of one step for one role (passengers have no vehicle or required documents). */
export const stepSchema = (step: RegistrationStep, role: RegistrationRole): yup.AnyObjectSchema => {
  switch (step) {
    case 'personal':
      return role === 'driver' ? driverPersonal : passengerPersonal;
    case 'vehicle':
      return role === 'driver' ? driverVehicle : NOTHING;
    case 'documents':
      return role === 'driver' ? driverDocuments : NOTHING;
    default:
      return NOTHING;
  }
};

export type StepErrors = Partial<Record<keyof RegistrationFormData, string>>;

/** First error per field of one step; empty when the step is valid. */
export function validateStep(step: RegistrationStep, data: RegistrationFormData): StepErrors {
  try {
    stepSchema(step, data.role).validateSync(data, { abortEarly: false });
    return {};
  } catch (error) {
    if (!(error instanceof yup.ValidationError)) {
      throw error;
    }
    const errors: StepErrors = {};
    (error.inner.length > 0 ? error.inner : [error]).forEach((issue) => {
      const field = issue.path as keyof RegistrationFormData | undefined;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    });
    return errors;
  }
}

/** One field's error (blur validation in the step components), or undefined. */
export function validateStepField(
  step: RegistrationStep,
  field: keyof RegistrationFormData,
  data: RegistrationFormData,
): string | undefined {
  const schema = stepSchema(step, data.role);
  if (!(field in schema.fields)) {
    return undefined;
  }
  try {
    schema.validateSyncAt(field, data);
    return undefined;
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return error.message;
    }
    throw error;
  }
}

/**
 * Whether a step field is required for a role (drives the `*` markers, T-206): a field is
 * required when the schema refuses it empty. Fields the schema doesn't know are optional.
 */
export function isStepFieldRequired(
  step: RegistrationStep,
  field: keyof RegistrationFormData,
  role: RegistrationRole,
): boolean {
  const empty: RegistrationFormData = { ...INITIAL_REGISTRATION_FORM, role };
  return validateStepField(step, field, empty) !== undefined;
}

const STEP_ORDER: RegistrationStep[] = ['personal', 'vehicle', 'documents', 'review'];

/** Before submit: the first step that has errors, with its errors; null when all are valid. */
export function firstInvalidStep(
  data: RegistrationFormData,
): { step: RegistrationStep; errors: StepErrors } | null {
  for (const step of STEP_ORDER) {
    const errors = validateStep(step, data);
    if (Object.keys(errors).length > 0) {
      return { step, errors };
    }
  }
  return null;
}
