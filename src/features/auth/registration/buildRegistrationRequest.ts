import type { RegisterWithImagesRequest } from '../../../services/api';
import { toPkMobileE164 } from '../../../services/otpService';
import type { RegistrationFormData } from './registrationForm';

/**
 * Payments are cash only for now (owner decision B-08), so the form does not ask. The backend
 * still requires the field (passenger_preferred_payment in:cash,card,mobile_wallet; driver
 * preferred_payment), so it is always sent as cash.
 */
const PREFERRED_PAYMENT = 'cash';

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
    license_number: form.vehicleNumber,
    preferred_payment: PREFERRED_PAYMENT,
    license_type: form.licenseType,
    license_expiry_date: form.licenseExpiryDate,
    license_plate: form.licensePlate || form.vehicleNumber,
    registration_number: form.registrationNumber || form.vehicleNumber,
    driving_experience: form.drivingExperience,
    vehicle_make: form.vehicleBrand,
    vehicle_model: form.vehicleModel,
    vehicle_year: form.vehicleYear,
    vehicle_color: form.vehicleColor,
    bank_name: form.bankName,
    bank_branch: form.bankBranch,
    bank_account_number: form.bankAccountNumber,
  };
}
