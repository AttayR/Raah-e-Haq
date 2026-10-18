/**
 * T-201 (AUTH-11, AUTH-12): each registration step is validated against registrationSchema
 * before Next. Phone is required and must be a Pakistani mobile the backend accepts, the
 * password rules apply at step 1, and the vehicle year limit moves with the calendar.
 */
import {
  DRIVER_AGE_MESSAGE,
  firstInvalidStep,
  isStepFieldRequired,
  latestBirthDateForAge,
  maxVehicleYear,
  validateStep,
  validateStepField,
} from '../../src/schemas/registrationSchema';
import { REGISTRATION_FIELDS } from '../../src/features/auth/copy/registrationFields';
import {
  INITIAL_REGISTRATION_FORM,
  type RegistrationFormData,
} from '../../src/features/auth/registration/registrationForm';

const validPassenger: RegistrationFormData = {
  ...INITIAL_REGISTRATION_FORM,
  role: 'passenger',
  fullName: 'Test Passenger',
  email: 'passenger@example.test',
  phoneNumber: '+923009990001',
  cnic: '35202-1234567-1',
  address: 'House 1, Street 2, Lahore',
  dateOfBirth: '1990-01-15',
  gender: 'female',
  password: 'Secret123',
  confirmPassword: 'Secret123',
  emergencyContactNumber: '+923009990002',
  emergencyContactName: 'Test Contact',
  emergencyRelationship: 'father',
};

const validDriver: RegistrationFormData = {
  ...validPassenger,
  role: 'driver',
  emergencyContactNumber: '',
  emergencyContactName: '',
  emergencyRelationship: '',
  vehicleType: 'car',
  vehicleNumber: 'LEA-1234',
  vehicleBrand: 'Toyota',
  vehicleModel: 'Corolla',
  vehicleYear: '2020',
  vehicleColor: 'White',
  licenseNumber: 'LHR-12345678',
  licenseType: 'LTV',
  licenseExpiryDate: '2099-01-01',
  licensePlate: 'LEA-1234',
  registrationNumber: 'REG-1',
  drivingExperience: '5',
  bankName: 'Test Bank',
  bankBranch: 'Main',
  bankAccountNumber: '0000000000',
  driverPicture: 'file:///driver.jpg',
  cnicPicture: 'file:///cnic.jpg',
  cnicBackPicture: 'file:///cnic-back.jpg',
  licenseFrontPicture: 'file:///license-front.jpg',
  vehiclePictures: ['file:///1.jpg', 'file:///2.jpg', 'file:///3.jpg', 'file:///4.jpg'],
};

afterEach(() => {
  jest.useRealTimers();
});

describe('personal step', () => {
  it('passes a complete passenger and a complete driver', () => {
    expect(validateStep('personal', validPassenger)).toEqual({});
    expect(validateStep('personal', validDriver)).toEqual({});
  });

  it('reports every missing field of an empty form, phone included', () => {
    const errors = validateStep('personal', INITIAL_REGISTRATION_FORM);
    expect(errors).toMatchObject({
      fullName: 'Full name is required',
      email: 'Email is required',
      phoneNumber: 'Phone number is required',
      cnic: 'CNIC is required',
      address: 'Address is required',
      dateOfBirth: 'Date of birth is required',
      gender: 'Gender is required',
      password: 'Password is required',
      confirmPassword: 'Please confirm your password',
      emergencyContactNumber: 'Emergency contact number is required',
      emergencyContactName: 'Emergency contact name is required',
      emergencyRelationship: 'Relationship is required',
    });
  });

  it.each(['03009990001', '+92 300 9990001', '923009990001', '+923009990001', '3009990001'])(
    'accepts the Pakistani mobile %s',
    (phoneNumber) => {
      expect(validateStepField('personal', 'phoneNumber', { ...validPassenger, phoneNumber })).toBeUndefined();
    },
  );

  it.each(['+92', '+924212345678', '+14155550100', '0300-999', 'abc'])('refuses %s as the server would (422)', (phoneNumber) => {
    expect(validateStepField('personal', 'phoneNumber', { ...validPassenger, phoneNumber })).toBe(
      'Enter a Pakistani mobile number, e.g. +923001234567',
    );
  });

  it('applies the password rules at step 1', () => {
    const check = (password: string) =>
      validateStep('personal', { ...validPassenger, password, confirmPassword: password }).password;
    expect(check('Short1')).toBe('Password must be at least 8 characters');
    expect(check('ALLUPPER123')).toBe('Password must contain at least one lowercase letter');
    expect(check('alllower123')).toBe('Password must contain at least one uppercase letter');
    expect(check('NoDigitsHere')).toBe('Password must contain at least one number');
    expect(check('Secret123')).toBeUndefined();
    expect(validateStep('personal', { ...validPassenger, confirmPassword: 'Secret124' }).confirmPassword).toBe(
      'Passwords do not match',
    );
  });

  it('refuses a malformed CNIC, a non-date and a future date of birth', () => {
    const errors = validateStep('personal', {
      ...validPassenger,
      cnic: '3520212345671',
      dateOfBirth: '2999-01-01',
    });
    expect(errors.cnic).toBe('Please enter CNIC in format: 00000-0000000-0');
    expect(errors.dateOfBirth).toBe('Date of birth must be in the past');
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '1990-02-30' }).dateOfBirth).toBe(
      'Use format YYYY-MM-DD (e.g. 1990-01-15)',
    );
  });

  it('drivers do not need the passenger emergency contact', () => {
    expect(validateStep('personal', { ...validDriver, emergencyRelationship: '' })).toEqual({});
  });
});

describe('vehicle step', () => {
  it('is skipped for passengers', () => {
    expect(validateStep('vehicle', validPassenger)).toEqual({});
  });

  it('requires every driver vehicle and bank field', () => {
    const errors = validateStep('vehicle', { ...validDriver, vehicleBrand: '', bankAccountNumber: ' ', vehicleYear: '' });
    expect(errors).toEqual({
      vehicleBrand: 'Vehicle brand is required',
      bankAccountNumber: 'Bank account number is required',
      vehicleYear: 'Vehicle year is required',
    });
  });

  it('the vehicle year limit is next year, read from the clock (AUTH-12)', () => {
    jest.useFakeTimers({ now: new Date('2026-10-08T10:00:00Z') });
    expect(maxVehicleYear()).toBe(2027);
    expect(validateStep('vehicle', { ...validDriver, vehicleYear: '2026' })).toEqual({});
    expect(validateStep('vehicle', { ...validDriver, vehicleYear: '2027' })).toEqual({});
    expect(validateStep('vehicle', { ...validDriver, vehicleYear: '2028' }).vehicleYear).toBe(
      'Vehicle year must be between 1980 and 2027',
    );
    expect(validateStep('vehicle', { ...validDriver, vehicleYear: '1979' }).vehicleYear).toBe(
      'Vehicle year must be between 1980 and 2027',
    );

    jest.setSystemTime(new Date('2031-03-01T10:00:00Z'));
    expect(validateStep('vehicle', { ...validDriver, vehicleYear: '2032' })).toEqual({});
  });

  it('accepts only the backend vehicle types (BE-58): rickshaw yes, truck no', () => {
    expect(validateStep('vehicle', { ...validDriver, vehicleType: 'rickshaw' })).toEqual({});
    expect(validateStep('vehicle', { ...validDriver, vehicleType: 'van' })).toEqual({});
    expect(validateStep('vehicle', { ...validDriver, vehicleType: 'truck' }).vehicleType).toBe(
      'Please select a valid vehicle type',
    );
  });

    it('refuses an expired license', () => {
    expect(validateStep('vehicle', { ...validDriver, licenseExpiryDate: '2001-01-01' }).licenseExpiryDate).toBe(
      'License must not be expired',
    );
  });
});

describe('documents step and submit', () => {
  it('a driver needs a picture, a CNIC picture and 4 vehicle pictures; a passenger none', () => {
    expect(validateStep('documents', validPassenger)).toEqual({});
    expect(validateStep('documents', { ...validDriver, driverPicture: '', vehiclePictures: ['a'] })).toEqual({
      driverPicture: 'Driver picture is required',
      vehiclePictures: 'Please upload at least 4 vehicle pictures (front, back, left, right)',
    });
  });

  it('T-203: exactly 4 vehicle pictures (front, back, left, right); the driver CNIC back is required', () => {
    const five = ['1', '2', '3', '4', '5'].map((n) => `file:///${n}.jpg`);
    expect(validateStep('documents', { ...validDriver, vehiclePictures: five }).vehiclePictures).toBe(
      'Upload 4 vehicle pictures: front, back, left and right',
    );
    // Cleared slots hold '': four entries with one empty is still missing a side.
    expect(
      validateStep('documents', { ...validDriver, vehiclePictures: ['file:///1.jpg', '', 'file:///3.jpg', 'file:///4.jpg'] })
        .vehiclePictures,
    ).toBe('Please upload at least 4 vehicle pictures (front, back, left, right)');
    expect(validateStep('documents', { ...validDriver, cnicBackPicture: '' })).toEqual({
      cnicBackPicture: 'CNIC back picture is required',
    });
    expect(isStepFieldRequired('documents', 'cnicBackPicture', 'driver')).toBe(true);
    // Passengers keep it optional.
    expect(isStepFieldRequired('documents', 'cnicBackPicture', 'passenger')).toBe(false);
  });

  it('firstInvalidStep sends the user back to the first step with errors', () => {
    expect(firstInvalidStep(validPassenger)).toBeNull();
    expect(firstInvalidStep(validDriver)).toBeNull();
    expect(firstInvalidStep({ ...validDriver, vehicleColor: '', cnicPicture: '' })).toEqual({
      step: 'vehicle',
      errors: { vehicleColor: 'Vehicle color is required' },
    });
    expect(firstInvalidStep({ ...validDriver, password: 'weak' })?.step).toBe('personal');
  });
});

describe('T-206: date of birth and required markers', () => {
  it('refuses a year of birth before 1900 (typo guard), accepts a real past date', () => {
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '0199-01-15' }).dateOfBirth).toBe(
      'Year of birth must be 1900 or later',
    );
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '1900-01-01' }).dateOfBirth).toBeUndefined();
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '2000-02-29' }).dateOfBirth).toBeUndefined();
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '1990-01' }).dateOfBirth).toBe(
      'Use format YYYY-MM-DD (e.g. 1990-01-15)',
    );
  });

  it('marks only the documents the schema requires for the role', () => {
    for (const field of ['profilePicture', 'cnicFrontPicture', 'cnicBackPicture'] as const) {
      expect(isStepFieldRequired('documents', field, 'passenger')).toBe(false);
    }
    expect(isStepFieldRequired('documents', 'driverPicture', 'driver')).toBe(true);
    expect(isStepFieldRequired('documents', 'cnicPicture', 'driver')).toBe(true);
    expect(isStepFieldRequired('documents', 'vehiclePictures', 'driver')).toBe(true);
    // T-207: the licence front picture is required for drivers (license_image); the back stays optional.
    expect(isStepFieldRequired('documents', 'licenseFrontPicture', 'driver')).toBe(true);
    expect(isStepFieldRequired('personal', 'emergencyContactName', 'passenger')).toBe(true);
    expect(isStepFieldRequired('personal', 'emergencyContactName', 'driver')).toBe(false);
  });
});

describe('T-207: drivers are 18+ and hold a driving licence', () => {
  // 2026-10-11 local noon: the 18th birthday cutoff is 2008-10-11.
  const today = () => jest.useFakeTimers({ now: new Date(2026, 9, 11, 12, 0, 0) });

  it('a driver born 17 years 364 days ago is refused, under Date of Birth', () => {
    today();
    expect(validateStep('personal', { ...validDriver, dateOfBirth: '2008-10-12' })).toEqual({
      dateOfBirth: DRIVER_AGE_MESSAGE,
    });
    expect(DRIVER_AGE_MESSAGE).toBe('Drivers must be at least 18 years old.');
    expect(validateStepField('personal', 'dateOfBirth', { ...validDriver, dateOfBirth: '2008-10-12' })).toBe(
      'Drivers must be at least 18 years old.',
    );
  });

  it('a driver who turns 18 today (or is older) passes', () => {
    today();
    expect(validateStep('personal', { ...validDriver, dateOfBirth: '2008-10-11' })).toEqual({});
    expect(validateStep('personal', { ...validDriver, dateOfBirth: '1990-01-15' })).toEqual({});
  });

  it('passengers keep the old rule: any real past date', () => {
    today();
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '2008-10-12' })).toEqual({});
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '2020-05-01' })).toEqual({});
    expect(validateStep('personal', { ...validPassenger, dateOfBirth: '2026-10-11' }).dateOfBirth).toBe(
      'Date of birth must be in the past',
    );
  });

  it('a future date says "in the past" first, not the age rule', () => {
    today();
    expect(validateStep('personal', { ...validDriver, dateOfBirth: '2999-01-01' }).dateOfBirth).toBe(
      'Date of birth must be in the past',
    );
  });

  it('the cutoff on 29 February is 28 February 18 years earlier', () => {
    expect(latestBirthDateForAge(18, new Date(2028, 1, 29, 9))).toBe('2010-02-28');
    expect(latestBirthDateForAge(18, new Date(2026, 9, 11, 9))).toBe('2008-10-11');
    expect(latestBirthDateForAge(18, new Date(2027, 0, 1, 0, 5))).toBe('2009-01-01');
  });

  it('requires the licence number (max 50) and the licence front picture for drivers', () => {
    expect(validateStep('vehicle', { ...validDriver, licenseNumber: ' ' })).toEqual({
      licenseNumber: 'License number is required',
    });
    expect(validateStep('vehicle', { ...validDriver, licenseNumber: 'X'.repeat(51) }).licenseNumber).toBe(
      'License number must be at most 50 characters',
    );
    expect(validateStep('documents', { ...validDriver, licenseFrontPicture: '' })).toEqual({
      licenseFrontPicture: 'License front picture is required',
    });
  });

  it('the required * follows the schema: drivers yes, passengers no', () => {
    expect(isStepFieldRequired('vehicle', 'licenseNumber', 'driver')).toBe(true);
    expect(isStepFieldRequired('vehicle', 'licenseNumber', 'passenger')).toBe(false);
    expect(isStepFieldRequired('documents', 'licenseFrontPicture', 'passenger')).toBe(false);
    expect(validateStep('vehicle', validPassenger)).toEqual({});
    expect(validateStep('documents', validPassenger)).toEqual({});
  });
});

describe('T-564: emergency contact name and experience copy', () => {
  const nameError = 'Use letters only (spaces, dots, apostrophes and hyphens are fine)';

  it.each(['Ayesha Khan', "Mehr-un-Nisa O'Brien", 'Dr. Ali', 'عائشہ خان'])('accepts the name %s', (name) => {
    expect(validateStepField('personal', 'emergencyContactName', { ...validPassenger, emergencyContactName: name })).toBeUndefined();
  });

  it.each(['Ali 2', '12345', 'Ali@home', '-Ali', 'Ali_Khan'])('refuses the name %s (passenger and driver)', (name) => {
    expect(validateStepField('personal', 'emergencyContactName', { ...validPassenger, emergencyContactName: name })).toBe(nameError);
    expect(validateStepField('personal', 'emergencyContactName', { ...validDriver, emergencyContactName: name })).toBe(nameError);
  });

  it('an empty name is still only "required" for passengers and fine for drivers', () => {
    expect(validateStepField('personal', 'emergencyContactName', { ...validPassenger, emergencyContactName: '' })).toBe(
      'Emergency contact name is required',
    );
    expect(validateStepField('personal', 'emergencyContactName', { ...validDriver, emergencyContactName: '' })).toBeUndefined();
  });

  it('driving experience: "1 year", then plural', () => {
    expect(REGISTRATION_FIELDS.licence.experienceValue('1')).toBe('1 year');
    expect(REGISTRATION_FIELDS.licence.experienceValue('2')).toBe('2 years');
    expect(REGISTRATION_FIELDS.licence.experienceValue('30')).toBe('30 years');
  });
});
