/**
 * T-201 (AUTH-11, AUTH-12): each registration step is validated against registrationSchema
 * before Next. Phone is required and must be a Pakistani mobile the backend accepts, the
 * password rules apply at step 1, and the vehicle year limit moves with the calendar.
 */
import {
  firstInvalidStep,
  maxVehicleYear,
  validateStep,
  validateStepField,
} from '../../src/schemas/registrationSchema';
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
