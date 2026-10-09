import * as yup from 'yup';
import { toPkMobileE164 } from '../services/otpService';
import {
  VEHICLE_TYPE_IDS,
  type RegistrationFormData,
  type RegistrationRole,
  type RegistrationStep,
} from '../features/auth/registration/registrationForm';

/**
 * Per-step validation of the registration form (T-201, AUTH-11, AUTH-12). Each step is
 * validated before Next, and every step again before Create Account, so nothing the server
 * would refuse with 422 for a format reason gets that far. The rules follow the backend's
 * AuthController::register (BE-27/BE-28/BE-29); a few are stricter on purpose (password
 * strength, CNIC format). Errors are keyed by the form field name.
 */

/** The backend's oldest accepted model year (App\Support\VehicleYear::MIN). */
export const MIN_VEHICLE_YEAR = 1980;

/** Next year's models go on sale this year (VehicleYear::max): computed on every call. */
export const maxVehicleYear = (now: Date = new Date()): number => now.getFullYear() + 1;

const CNIC_FORMAT = /^\d{5}-\d{7}-\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's local date as YYYY-MM-DD, read when a rule runs (never at import time). */
const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** A real calendar date in YYYY-MM-DD (rejects 2026-02-30). */
const isIsoDate = (value: string | undefined): boolean => {
  if (!value || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export const EMERGENCY_RELATIONS = ['father', 'mother', 'spouse', 'brother', 'sister', 'friend', 'other'] as const;

const requiredText = (label: string, max: number) =>
  yup.string().trim().required(`${label} is required`).max(max, `${label} must be at most ${max} characters`);

const phoneRule = yup
  .string()
  .trim()
  .required('Phone number is required')
  .test('pk-mobile', 'Enter a Pakistani mobile number, e.g. +923001234567', (value) =>
    toPkMobileE164(value ?? '') !== null,
  );

const passwordRule = yup
  .string()
  .required('Password is required')
  .min(8, 'Password must be at least 8 characters')
  .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
  .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .matches(/\d/, 'Password must contain at least one number');

const personalBase = {
  fullName: yup
    .string()
    .trim()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters')
    .max(255, 'Full name must be at most 255 characters'),
  email: yup
    .string()
    .trim()
    .required('Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be at most 255 characters'),
  phoneNumber: phoneRule,
  cnic: yup
    .string()
    .trim()
    .required('CNIC is required')
    .matches(CNIC_FORMAT, 'Please enter CNIC in format: 00000-0000000-0'),
  address: yup
    .string()
    .trim()
    .required('Address is required')
    .min(10, 'Address must be at least 10 characters')
    .max(200, 'Address must be at most 200 characters'),
  dateOfBirth: yup
    .string()
    .trim()
    .required('Date of birth is required')
    .test('iso-date', 'Use format YYYY-MM-DD (e.g. 1990-01-15)', (value) => isIsoDate(value))
    .test('past', 'Date of birth must be in the past', (value) => !isIsoDate(value) || (value as string) < todayIso()),
  gender: yup
    .string()
    .required('Gender is required')
    .oneOf(['male', 'female', 'other'], 'Gender is required'),
  password: passwordRule,
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
  emergencyContactNumber: yup.string().trim().max(20, 'Emergency contact number must be at most 20 characters'),
  emergencyContactName: yup.string().trim().max(100, 'Emergency contact name must be at most 100 characters'),
  emergencyRelationship: yup.string(),
};

/** Passengers: the backend requires the emergency contact's number, name and relation. */
const passengerPersonal = yup.object({
  ...personalBase,
  emergencyContactNumber: requiredText('Emergency contact number', 20).test(
    'phone-chars',
    'Enter a valid phone number',
    (value) => !value || /^\+?[0-9\s-]{10,20}$/.test(value),
  ),
  emergencyContactName: requiredText('Emergency contact name', 100),
  emergencyRelationship: yup
    .string()
    .required('Relationship is required')
    .oneOf([...EMERGENCY_RELATIONS], 'Relationship is required'),
});

const driverPersonal = yup.object(personalBase);

const driverVehicle = yup.object({
  vehicleType: yup
    .string()
    .required('Vehicle type is required')
    .oneOf([...VEHICLE_TYPE_IDS], 'Please select a valid vehicle type'),
  vehicleNumber: requiredText('Vehicle number', 50),
  vehicleBrand: requiredText('Vehicle brand', 100),
  vehicleModel: requiredText('Vehicle model', 100),
  vehicleYear: yup
    .string()
    .trim()
    .required('Vehicle year is required')
    .test('year-range', 'Enter a valid vehicle year', function (value) {
      const year = Number(value);
      const max = maxVehicleYear();
      if (!/^\d{4}$/.test(value ?? '') || year < MIN_VEHICLE_YEAR || year > max) {
        return this.createError({ message: `Vehicle year must be between ${MIN_VEHICLE_YEAR} and ${max}` });
      }
      return true;
    }),
  vehicleColor: requiredText('Vehicle color', 50),
  licenseType: requiredText('License type', 10),
  licenseExpiryDate: yup
    .string()
    .trim()
    .required('License expiry date is required')
    .test('iso-date', 'Use format YYYY-MM-DD (e.g. 2030-01-15)', (value) => isIsoDate(value))
    .test('future', 'License must not be expired', (value) => !isIsoDate(value) || (value as string) > todayIso()),
  licensePlate: requiredText('License plate', 20),
  registrationNumber: requiredText('Registration number', 50),
  drivingExperience: yup.string().trim().required('Driving experience is required'),
  bankName: requiredText('Bank name', 100),
  bankBranch: requiredText('Bank branch', 100),
  bankAccountNumber: requiredText('Bank account number', 50),
});

const driverDocuments = yup.object({
  driverPicture: yup.string().required('Driver picture is required'),
  cnicPicture: yup.string().required('CNIC picture is required'),
  vehiclePictures: yup
    .array()
    .of(yup.string())
    .min(4, 'Please upload at least 4 vehicle pictures (front, back, left, right)')
    .max(6, 'Maximum 6 vehicle pictures allowed'),
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
