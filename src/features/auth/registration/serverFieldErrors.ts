import { firstFieldMessages, type FieldErrors } from '../../../core/api/errors';
import type { StepErrors } from '../../../schemas/registrationSchema';
import type { RegistrationFormData, RegistrationRole, RegistrationStep } from './registrationForm';

type FormField = keyof RegistrationFormData;

/**
 * The form's inputs per step, in on-screen order (T-202). The first errored field of the first
 * errored step is the one the form scrolls to.
 */
const STEP_FIELDS: ReadonlyArray<{ step: RegistrationStep; fields: readonly FormField[] }> = [
  {
    step: 'personal',
    fields: [
      'fullName', 'email', 'phoneNumber', 'cnic', 'address', 'dateOfBirth', 'gender', 'password',
      'confirmPassword', 'emergencyContactNumber', 'emergencyContactName', 'emergencyRelationship',
    ],
  },
  {
    step: 'vehicle',
    fields: [
      'vehicleType', 'vehicleNumber', 'vehicleBrand', 'vehicleModel', 'vehicleYear', 'vehicleColor',
      'licensePlate', 'registrationNumber', 'licenseType', 'licenseExpiryDate', 'drivingExperience',
      'bankName', 'bankBranch', 'bankAccountNumber',
    ],
  },
  {
    step: 'documents',
    fields: [
      'profilePicture', 'cnicFrontPicture', 'cnicBackPicture', 'driverPicture', 'cnicPicture',
      'licenseFrontPicture', 'licenseBackPicture', 'vehiclePictures',
    ],
  },
];

/** POST /auth/register field names (AuthController::register) every role's form shows. */
const COMMON_FIELDS: Readonly<Record<string, FormField>> = {
  name: 'fullName',
  email: 'email',
  phone: 'phoneNumber',
  cnic: 'cnic',
  address: 'address',
  date_of_birth: 'dateOfBirth',
  gender: 'gender',
  password: 'password',
  password_confirmation: 'confirmPassword',
  emergency_contact: 'emergencyContactNumber',
  emergency_contact_name: 'emergencyContactName',
  emergency_contact_relation: 'emergencyRelationship',
};

const PASSENGER_FIELDS: Readonly<Record<string, FormField>> = {
  passenger_emergency_contact: 'emergencyContactNumber',
  passenger_emergency_contact_name: 'emergencyContactName',
  passenger_emergency_contact_relation: 'emergencyRelationship',
  passenger_profile_image: 'profilePicture',
  passenger_cnic_front_image: 'cnicFrontPicture',
  passenger_cnic_back_image: 'cnicBackPicture',
};

/** buildRegistrationRequest sends license_number from vehicleNumber (T-203 adds its own input). */
const DRIVER_FIELDS: Readonly<Record<string, FormField>> = {
  vehicle_type: 'vehicleType',
  license_number: 'vehicleNumber',
  vehicle_make: 'vehicleBrand',
  vehicle_model: 'vehicleModel',
  vehicle_year: 'vehicleYear',
  vehicle_color: 'vehicleColor',
  license_plate: 'licensePlate',
  registration_number: 'registrationNumber',
  license_type: 'licenseType',
  license_expiry_date: 'licenseExpiryDate',
  driving_experience: 'drivingExperience',
  bank_name: 'bankName',
  bank_branch: 'bankBranch',
  bank_account_number: 'bankAccountNumber',
  profile_image: 'driverPicture',
  cnic_front_image: 'cnicPicture',
  license_image: 'licenseFrontPicture',
  vehicle_front_image: 'vehiclePictures',
  vehicle_back_image: 'vehiclePictures',
  vehicle_left_image: 'vehiclePictures',
  vehicle_right_image: 'vehiclePictures',
};

export interface RegistrationServerErrors {
  /** The first server message per form input, keyed like the schema's StepErrors. */
  fieldErrors: StepErrors;
  /** The first step that has a field error (null when no input shows any). */
  step: RegistrationStep | null;
  /** The first errored input of that step, in on-screen order. */
  firstField: FormField | null;
  /** Messages for server fields no input of this role shows: shown once at form level. */
  formErrors: string[];
}

/** `vehicle_images.0` → `vehicle_images` (Laravel array rules key each item). */
const baseKey = (field: string): string => field.split('.')[0];

/**
 * Maps a 422 `errors` map (ApiError.fieldErrors) onto the registration form (T-202, AUTH-10).
 * Fields of the other role (or that no input shows, e.g. preferred_payment, referral_code)
 * become form-level messages instead of being dropped.
 */
export function mapRegistrationServerErrors(
  fieldErrors: FieldErrors,
  role: RegistrationRole,
): RegistrationServerErrors {
  const roleFields = role === 'driver' ? DRIVER_FIELDS : PASSENGER_FIELDS;
  const mapped: StepErrors = {};
  const formErrors: string[] = [];

  Object.entries(firstFieldMessages(fieldErrors)).forEach(([serverField, message]) => {
    const key = baseKey(serverField);
    const formField = COMMON_FIELDS[key] ?? roleFields[key];
    if (formField) {
      // Two server fields can share one input (vehicle images): the first message stays.
      if (!mapped[formField]) mapped[formField] = message;
    } else if (!formErrors.includes(message)) {
      formErrors.push(message);
    }
  });

  for (const { step, fields } of STEP_FIELDS) {
    const firstField = fields.find((field) => mapped[field]);
    if (firstField) {
      return { fieldErrors: mapped, step, firstField, formErrors };
    }
  }
  return { fieldErrors: mapped, step: null, firstField: null, formErrors };
}
