/**
 * T-202 (AUTH-10): a 422 `errors` map from POST /auth/register (AuthController::register field
 * names) lands on the registration form's inputs; the first errored step and field are picked
 * in on-screen order; fields no input shows become form-level messages.
 */
import { firstFieldMessages } from '../../../src/core/api/errors';
import { mapRegistrationServerErrors } from '../../../src/features/auth/registration/serverFieldErrors';

describe('firstFieldMessages', () => {
  it('keeps the first non-empty message per field', () => {
    expect(
      firstFieldMessages({ email: ['', 'The email field must be a valid email address.', 'other'], phone: [] }),
    ).toEqual({ email: 'The email field must be a valid email address.' });
    expect(firstFieldMessages(undefined)).toEqual({});
  });
});

describe('mapRegistrationServerErrors', () => {
  it('maps every personal-step field the server validates (the ones AUTH-10 found unshown)', () => {
    const result = mapRegistrationServerErrors(
      {
        name: ['The name field is required.'],
        email: ['The email field must be a valid email address.'],
        phone: ['Enter a Pakistani mobile number.'],
        cnic: ['The cnic field must not be greater than 20 characters.'],
        password_confirmation: ['The password confirmation does not match.'],
        passenger_emergency_contact: ['The passenger emergency contact field is required.'],
        passenger_emergency_contact_name: ['The passenger emergency contact name field is required.'],
        passenger_emergency_contact_relation: ['The selected passenger emergency contact relation is invalid.'],
      },
      'passenger',
    );

    expect(result.fieldErrors).toEqual({
      fullName: 'The name field is required.',
      email: 'The email field must be a valid email address.',
      phoneNumber: 'Enter a Pakistani mobile number.',
      cnic: 'The cnic field must not be greater than 20 characters.',
      confirmPassword: 'The password confirmation does not match.',
      emergencyContactNumber: 'The passenger emergency contact field is required.',
      emergencyContactName: 'The passenger emergency contact name field is required.',
      emergencyRelationship: 'The selected passenger emergency contact relation is invalid.',
    });
    expect(result.step).toBe('personal');
    expect(result.firstField).toBe('fullName');
    expect(result.formErrors).toEqual([]);
  });

  it('opens the vehicle step for a driver whose only errors are vehicle fields, first field in screen order', () => {
    const result = mapRegistrationServerErrors(
      {
        bank_account_number: ['The bank account number field is required.'],
        license_plate: ['The license plate has already been taken.'],
        vehicle_year: ['The vehicle year field must not be greater than 2027.'],
      },
      'driver',
    );

    expect(result.step).toBe('vehicle');
    expect(result.firstField).toBe('vehicleYear');
    expect(result.fieldErrors.licensePlate).toBe('The license plate has already been taken.');
    expect(result.fieldErrors.bankAccountNumber).toBe('The bank account number field is required.');
  });

  it('the earliest step wins when several steps have errors', () => {
    const result = mapRegistrationServerErrors(
      { vehicle_make: ['Required.'], date_of_birth: ['The date of birth field must be a date before today.'] },
      'driver',
    );
    expect(result.step).toBe('personal');
    expect(result.firstField).toBe('dateOfBirth');
  });

  it('maps passenger document uploads to the documents step', () => {
    const result = mapRegistrationServerErrors(
      { passenger_cnic_back_image: ['The passenger cnic back image field must be an image.'] },
      'passenger',
    );
    expect(result).toEqual({
      fieldErrors: { cnicBackPicture: 'The passenger cnic back image field must be an image.' },
      step: 'documents',
      firstField: 'cnicBackPicture',
      formErrors: [],
    });
  });

  it('unknown fields and the other role’s fields fall back to form-level messages (once each)', () => {
    const result = mapRegistrationServerErrors(
      {
        passenger_preferred_payment: ['The selected passenger preferred payment is invalid.'],
        referral_code: ['The selected referral code is invalid.'],
        vehicle_make: ['Required.'],
        license_type: ['Required.'],
      },
      'passenger',
    );
    expect(result.fieldErrors).toEqual({});
    expect(result.step).toBeNull();
    expect(result.firstField).toBeNull();
    expect(result.formErrors).toEqual([
      'The selected passenger preferred payment is invalid.',
      'The selected referral code is invalid.',
      'Required.',
    ]);
  });

  it('array keys (vehicle_front_image.0) map by their base field', () => {
    const result = mapRegistrationServerErrors(
      { 'vehicle_front_image.0': ['The vehicle front image must be an image.'], vehicle_back_image: ['Too big.'] },
      'driver',
    );
    expect(result.fieldErrors).toEqual({ vehiclePictures: 'The vehicle front image must be an image.' });
    expect(result.step).toBe('documents');
  });
});
