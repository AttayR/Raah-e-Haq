import type { RegisterWithImagesRequest } from '../../../services/api';
import { toPkMobileE164 } from '../../../services/otpService';
import { VEHICLE_PHOTO_SLOTS, type RegistrationFormData } from './registrationForm';

/**
 * Payments are cash only for now (owner decision B-08), so the form does not ask. The backend
 * still requires the field (passenger_preferred_payment in:cash,card,mobile_wallet; driver
 * preferred_payment), so it is always sent as cash.
 */
const PREFERRED_PAYMENT = 'cash';

type DriverImages = Pick<
  RegisterWithImagesRequest,
  | 'profile_image'
  | 'cnic_front_image'
  | 'cnic_back_image'
  | 'license_image'
  | 'vehicle_front_image'
  | 'vehicle_back_image'
  | 'vehicle_left_image'
  | 'vehicle_right_image'
>;

/** Only the images that were picked: an empty slot is left out, never sent as "". */
const optionalImages = (images: Record<keyof DriverImages, string | undefined>): DriverImages => {
  const picked: DriverImages = {};
  (Object.keys(images) as Array<keyof DriverImages>).forEach((field) => {
    const uri = images[field];
    if (uri) {
      picked[field] = uri;
    }
  });
  return picked;
};

/** Only the text fields that were filled in: a blank one is left out, never sent as "". */
const optionalText = <K extends string>(fields: Record<K, string>): Partial<Record<K, string>> => {
  const filled: Partial<Record<K, string>> = {};
  (Object.keys(fields) as K[]).forEach((field) => {
    if (fields[field]) {
      filled[field] = fields[field];
    }
  });
  return filled;
};

/** Vehicle photos by slot index (VEHICLE_PHOTO_SLOTS order); an empty slot is skipped later. */
const vehicleImages = (pictures: readonly string[]) => {
  const [front, back, left, right] = VEHICLE_PHOTO_SLOTS.map((_, index) => pictures[index]);
  return { vehicle_front_image: front, vehicle_back_image: back, vehicle_left_image: left, vehicle_right_image: right };
};

/**
 * POST /auth/register body from a form that passed every step's schema (T-201). The phone is
 * sent as the E.164 number the backend stores (+923XXXXXXXXX, BE-27), never as typed.
 * Throws when the phone does not normalise: callers validate first (registrationSchema).
 */
export function buildRegistrationRequest(form: RegistrationFormData): RegisterWithImagesRequest {
  const phone = toPkMobileE164(form.phoneNumber);
  if (!phone) {
    throw new Error('buildRegistrationRequest: the phone number was not validated');
  }
  const emergencyContact = form.emergencyContactNumber.trim() || phone;

  const request: RegisterWithImagesRequest = {
    name: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    password: form.password,
    password_confirmation: form.confirmPassword,
    user_type: form.role,
    phone,
    cnic: form.cnic.trim(),
    address: form.address.trim(),
    emergency_contact: emergencyContact,
    date_of_birth: form.dateOfBirth.trim(),
    ...(form.gender ? { gender: form.gender } : {}),
    // UI-R18 §I4: only when given (the server normalises it and refuses an unknown one).
    ...(form.inviteCode.trim() ? { referral_code: form.inviteCode.trim().toUpperCase() } : {}),
  };

  if (form.role === 'passenger') {
    return {
      ...request,
      passenger_cnic_front_image: form.cnicFrontPicture,
      passenger_cnic_back_image: form.cnicBackPicture,
      passenger_profile_image: form.profilePicture,
      passenger_emergency_contact: emergencyContact,
      passenger_emergency_contact_name: form.emergencyContactName.trim(),
      passenger_emergency_contact_relation: form.emergencyRelationship || 'other',
      passenger_preferred_payment: PREFERRED_PAYMENT,
    };
  }

  return {
    ...request,
    vehicle_type: form.vehicleType,
    // The driving licence number from its own input (T-207); never the vehicle number.
    license_number: form.licenseNumber.trim(),
    // Every driver image the form collects, as local file URIs (T-203). Each becomes a driver
    // document under review (BE-66).
    ...optionalImages({
      profile_image: form.driverPicture,
      cnic_front_image: form.cnicPicture,
      cnic_back_image: form.cnicBackPicture,
      license_image: form.licenseFrontPicture,
      ...vehicleImages(form.vehiclePictures),
    }),
    preferred_payment: PREFERRED_PAYMENT,
    // T-567: the driver's emergency contact name and relation (BE-106), not only the number.
    // Left out when blank: the server takes them as optional for drivers.
    ...optionalText({
      emergency_contact_name: form.emergencyContactName.trim(),
      emergency_contact_relation: form.emergencyRelationship,
    }),
    license_type: form.licenseType,
    license_expiry_date: form.licenseExpiryDate,
    license_plate: form.licensePlate || form.vehicleNumber,
    registration_number: form.registrationNumber || form.vehicleNumber,
    driving_experience: form.drivingExperience,
    vehicle_make: form.vehicleBrand,
    vehicle_model: form.vehicleModel,
    vehicle_year: form.vehicleYear,
    // BE-86: only a car can declare AC; the server refuses it for anything else.
    ...(form.vehicleType === 'car' && form.vehicleHasAc ? { vehicle_has_ac: true } : {}),
    vehicle_color: form.vehicleColor,
    bank_name: form.bankName,
    bank_branch: form.bankBranch,
    bank_account_number: form.bankAccountNumber,
  };
}
