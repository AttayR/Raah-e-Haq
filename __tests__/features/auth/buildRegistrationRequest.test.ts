/**
 * T-201 (BE-27/BE-28): registration sends the phone as the E.164 number the backend stores
 * (+923XXXXXXXXX), never "+0300…" or an empty "+", and only values the backend accepts.
 */
import { buildRegistrationRequest } from '../../../src/features/auth/registration/buildRegistrationRequest';
import { INITIAL_REGISTRATION_FORM } from '../../../src/features/auth/registration/registrationForm';
import { toPkMobileE164 } from '../../../src/services/otpService';

const form = {
  ...INITIAL_REGISTRATION_FORM,
  fullName: '  Test Passenger ',
  email: 'Passenger@Example.TEST',
  phoneNumber: '0300 9990001',
  cnic: '35202-1234567-1',
  address: 'House 1, Street 2, Lahore',
  dateOfBirth: '1990-01-15',
  gender: 'female' as const,
  password: 'Secret123',
  confirmPassword: 'Secret123',
  emergencyContactName: 'Test Contact',
  emergencyRelationship: 'father',
};

describe('toPkMobileE164 (mirrors backend Phone::toE164 for +92)', () => {
  it.each([
    ['+92 300 9990001', '+923009990001'],
    ['00923009990001', '+923009990001'],
    ['923009990001', '+923009990001'],
    ['03009990001', '+923009990001'],
    ['3009990001', '+923009990001'],
    ['+03009990001', '+923009990001'],
    ['+92 0300 9990001', '+923009990001'],
    ['(0300) 999-0001', '+923009990001'],
  ])('%s -> %s', (input, expected) => {
    expect(toPkMobileE164(input)).toBe(expected);
  });

  it.each(['', '+', '+92', '+924212345678', '+14155550100', '03009990001x', '030099900011'])('refuses %p', (input) => {
    expect(toPkMobileE164(input)).toBeNull();
  });
});

describe('buildRegistrationRequest', () => {
  it('normalises the phone and uses it as the passenger emergency contact fallback', () => {
    const request = buildRegistrationRequest(form);
    expect(request).toMatchObject({
      name: 'Test Passenger',
      email: 'passenger@example.test',
      phone: '+923009990001',
      emergency_contact: '+923009990001',
      passenger_emergency_contact: '+923009990001',
      passenger_emergency_contact_name: 'Test Contact',
      passenger_emergency_contact_relation: 'father',
      passenger_preferred_payment: 'cash',
      date_of_birth: '1990-01-15',
      gender: 'female',
      user_type: 'passenger',
    });
    expect(request).not.toHaveProperty('vehicle_year');
  });

  it('always sends cash as the payment preference (B-08: cash only)', () => {
    expect(buildRegistrationRequest(form).passenger_preferred_payment).toBe('cash');
    expect(buildRegistrationRequest({ ...form, role: 'driver' }).preferred_payment).toBe('cash');
  });

  it('refuses to build a request from an unvalidated phone', () => {
    expect(() => buildRegistrationRequest({ ...form, phoneNumber: '+' })).toThrow();
  });

  it('sends the driver vehicle fields', () => {
    const request = buildRegistrationRequest({
      ...form,
      role: 'driver',
      vehicleType: 'car',
      vehicleNumber: 'LEA-1234',
      vehicleYear: '2027',
      licensePlate: '',
    });
    expect(request).toMatchObject({ user_type: 'driver', vehicle_year: '2027', license_plate: 'LEA-1234', phone: '+923009990001' });
    expect(request).not.toHaveProperty('passenger_preferred_payment');
  });

  it('sends license_number from the licence input and license_image from the licence front picture (T-207)', () => {
    const request = buildRegistrationRequest({
      ...form,
      role: 'driver',
      vehicleType: 'car',
      vehicleNumber: 'LEA-1234',
      licenseNumber: ' LHR-12345678 ',
      licenseFrontPicture: 'file:///license-front.jpg',
    });
    expect(request.license_number).toBe('LHR-12345678');
    expect(request.license_number).not.toBe('LEA-1234');
    expect(request.license_image).toBe('file:///license-front.jpg');
  });

  it('sends every driver image the form collected (T-203): profile, CNIC front/back, licence, 4 vehicle sides', () => {
    const request = buildRegistrationRequest({
      ...form,
      role: 'driver',
      vehicleType: 'car',
      driverPicture: 'file:///driver.jpg',
      cnicPicture: 'file:///cnic-front.jpg',
      cnicBackPicture: 'file:///cnic-back.jpg',
      licenseFrontPicture: 'file:///license-front.jpg',
      vehiclePictures: ['file:///v-front.jpg', 'file:///v-back.jpg', 'file:///v-left.jpg', 'file:///v-right.jpg'],
    });
    expect(request).toMatchObject({
      profile_image: 'file:///driver.jpg',
      cnic_front_image: 'file:///cnic-front.jpg',
      cnic_back_image: 'file:///cnic-back.jpg',
      license_image: 'file:///license-front.jpg',
      vehicle_front_image: 'file:///v-front.jpg',
      vehicle_back_image: 'file:///v-back.jpg',
      vehicle_left_image: 'file:///v-left.jpg',
      vehicle_right_image: 'file:///v-right.jpg',
    });
    // Passenger image fields are never used for drivers.
    expect(request).not.toHaveProperty('passenger_cnic_front_image');
  });

  it('leaves out driver images that were not picked (never sends "")', () => {
    const request = buildRegistrationRequest({
      ...form,
      role: 'driver',
      cnicPicture: 'file:///cnic-front.jpg',
      vehiclePictures: ['file:///v-front.jpg', '', 'file:///v-left.jpg', ''],
    });
    expect(request.cnic_front_image).toBe('file:///cnic-front.jpg');
    expect(request.vehicle_front_image).toBe('file:///v-front.jpg');
    expect(request).not.toHaveProperty('cnic_back_image');
    expect(request).not.toHaveProperty('profile_image');
    // Index-stable: slot 2 is the left side even with slot 1 empty.
    expect(request.vehicle_left_image).toBe('file:///v-left.jpg');
    expect(request).not.toHaveProperty('vehicle_back_image');
    expect(request).not.toHaveProperty('vehicle_right_image');
  });

  it('a passenger request carries no licence fields', () => {
    const request = buildRegistrationRequest({ ...form, licenseNumber: 'X', licenseFrontPicture: 'file:///x.jpg' });
    expect(request).not.toHaveProperty('license_number');
    expect(request).not.toHaveProperty('license_image');
  });
});
