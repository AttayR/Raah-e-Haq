import { RegisterWithImagesRequest } from '../services/api';
import ValidationUtils from '../utils/ValidationUtils';
import AuthErrorHandler from '../utils/AuthErrorHandler';

// Test data based on your API documentation
export const testRegistrationData = {
  // Passenger Registration Data
  passenger: {
    name: 'Ahmed Ali Khan',
    email: 'ahmed.ali@email.com',
    password: 'Password123!',
    password_confirmation: 'Password123!',
    user_type: 'passenger' as const,
    phone: '+92-300-1234567',
    cnic: '42101-1234567-8',
    address: 'House 45, Block 6, PECHS, Karachi',
    date_of_birth: '1990-05-15',
    gender: 'male' as const,
    emergency_contact_name: 'Fatima Khan',
    emergency_contact_relation: 'sister',
    languages: 'urdu,english',
    bio: 'Professional working in IT sector, need reliable transportation for daily commute.',
    passenger_preferred_payment: 'mobile_wallet',
    passenger_emergency_contact: '+92-301-9876543',
    passenger_emergency_contact_name: 'Fatima Khan',
    passenger_emergency_contact_relation: 'sister',
    // Image paths (these would be actual file URIs in real app)
    passenger_cnic_front_image: 'file://path/to/cnic_front.jpg',
    passenger_cnic_back_image: 'file://path/to/cnic_back.jpg',
    passenger_profile_image: 'file://path/to/profile.jpg',
  },

  // Driver Registration Data
  driver: {
    name: 'Muhammad Hassan',
    email: 'm.hassan@email.com',
    password: 'DriverPass123!',
    password_confirmation: 'DriverPass123!',
    user_type: 'driver' as const,
    phone: '+92-302-2345678',
    cnic: '42101-2345678-9',
    address: 'Flat 12, Building 5, Gulshan-e-Iqbal, Karachi',
    date_of_birth: '1985-08-20',
    gender: 'male' as const,
    emergency_contact_name: 'Hassan Ahmed',
    emergency_contact_relation: 'brother',
    languages: 'urdu,english,sindhi',
    bio: 'Professional driver with 5 years experience. Available 24/7 for reliable service.',
    license_number: 'LIC-2023-001234',
    license_type: 'LTV',
    license_expiry_date: '2028-12-31',
    driving_experience: '5 years',
    bank_account_number: '1234567890123456',
    bank_name: 'Habib Bank Limited',
    bank_branch: 'Gulshan-e-Iqbal Branch',
    vehicle_type: 'car',
    vehicle_make: 'Toyota',
    vehicle_model: 'Corolla',
    vehicle_year: '2020',
    vehicle_color: 'White',
    license_plate: 'KHI-2020-1234',
    registration_number: 'REG-2020-5678',
    preferred_payment: 'mobile_wallet',
    // Image paths (these would be actual file URIs in real app)
    cnic_front_image: 'file://path/to/cnic_front.jpg',
    cnic_back_image: 'file://path/to/cnic_back.jpg',
    license_image: 'file://path/to/license.jpg',
    profile_image: 'file://path/to/profile.jpg',
    vehicle_front_image: 'file://path/to/vehicle_front.jpg',
    vehicle_back_image: 'file://path/to/vehicle_back.jpg',
    vehicle_left_image: 'file://path/to/vehicle_left.jpg',
    vehicle_right_image: 'file://path/to/vehicle_right.jpg',
  },

  // Bike Driver Registration Data
  bikeDriver: {
    name: 'Abdul Rehman',
    email: 'abdul.rehman@email.com',
    password: 'DriverPass456!',
    password_confirmation: 'DriverPass456!',
    user_type: 'driver' as const,
    phone: '+92-307-5678901',
    cnic: '42101-5678901-2',
    address: 'House 89, North Nazimabad, Karachi',
    date_of_birth: '1988-11-10',
    gender: 'male' as const,
    emergency_contact_name: 'Rehman Ahmed',
    emergency_contact_relation: 'father',
    languages: 'urdu,english',
    bio: 'Experienced bike rider, specializes in quick city deliveries and short rides.',
    license_number: 'LIC-2023-002345',
    license_type: 'MC',
    license_expiry_date: '2027-06-15',
    driving_experience: '3 years',
    bank_account_number: '2345678901234567',
    bank_name: 'United Bank Limited',
    bank_branch: 'North Nazimabad Branch',
    vehicle_type: 'bike',
    vehicle_make: 'Honda',
    vehicle_model: 'CD-70',
    vehicle_year: '2021',
    vehicle_color: 'Red',
    license_plate: 'KHI-2021-5678',
    registration_number: 'REG-2021-9012',
    preferred_payment: 'cash',
    // Image paths
    cnic_front_image: 'file://path/to/cnic_front.jpg',
    cnic_back_image: 'file://path/to/cnic_back.jpg',
    license_image: 'file://path/to/license.jpg',
    profile_image: 'file://path/to/profile.jpg',
    vehicle_front_image: 'file://path/to/vehicle_front.jpg',
    vehicle_back_image: 'file://path/to/vehicle_back.jpg',
    vehicle_left_image: 'file://path/to/vehicle_left.jpg',
    vehicle_right_image: 'file://path/to/vehicle_right.jpg',
  }
};

export const testLoginData = {
  email: 'ahmed.ali@email.com',
  password: 'Password123!',
  phone: '+92-300-1234567',
  otp_code: '123456'
};

// Test functions
export class AuthFlowTester {
  static testPassengerRegistration(): boolean {
    console.log('🧪 Testing Passenger Registration...');
    
    const rules = ValidationUtils.getRegistrationRules('passenger');
    const validationResult = ValidationUtils.validateForm(testRegistrationData.passenger, rules);
    
    console.log('✅ Validation Result:', validationResult);
    
    if (validationResult.isValid) {
      console.log('✅ Passenger registration data is valid');
      return true;
    } else {
      console.log('❌ Passenger registration validation failed:', validationResult.errors);
      return false;
    }
  }

  static testDriverRegistration(): boolean {
    console.log('🧪 Testing Driver Registration...');
    
    const rules = ValidationUtils.getRegistrationRules('driver');
    const validationResult = ValidationUtils.validateForm(testRegistrationData.driver, rules);
    
    console.log('✅ Validation Result:', validationResult);
    
    if (validationResult.isValid) {
      console.log('✅ Driver registration data is valid');
      return true;
    } else {
      console.log('❌ Driver registration validation failed:', validationResult.errors);
      return false;
    }
  }

  static testBikeDriverRegistration(): boolean {
    console.log('🧪 Testing Bike Driver Registration...');
    
    const rules = ValidationUtils.getRegistrationRules('driver');
    const validationResult = ValidationUtils.validateForm(testRegistrationData.bikeDriver, rules);
    
    console.log('✅ Validation Result:', validationResult);
    
    if (validationResult.isValid) {
      console.log('✅ Bike driver registration data is valid');
      return true;
    } else {
      console.log('❌ Bike driver registration validation failed:', validationResult.errors);
      return false;
    }
  }

  static testEmailLogin(): boolean {
    console.log('🧪 Testing Email Login...');
    
    const rules = ValidationUtils.getLoginRules('email');
    const validationResult = ValidationUtils.validateForm(testLoginData, rules);
    
    console.log('✅ Validation Result:', validationResult);
    
    if (validationResult.isValid) {
      console.log('✅ Email login data is valid');
      return true;
    } else {
      console.log('❌ Email login validation failed:', validationResult.errors);
      return false;
    }
  }

  static testOtpLogin(): boolean {
    console.log('🧪 Testing OTP Login...');
    
    const rules = ValidationUtils.getLoginRules('otp');
    const validationResult = ValidationUtils.validateForm(testLoginData, rules);
    
    console.log('✅ Validation Result:', validationResult);
    
    if (validationResult.isValid) {
      console.log('✅ OTP login data is valid');
      return true;
    } else {
      console.log('❌ OTP login validation failed:', validationResult.errors);
      return false;
    }
  }

  static testFieldValidation(): void {
    console.log('🧪 Testing Field Validation...');
    
    // Test email validation
    console.log('📧 Email validation:');
    console.log('  Valid email:', AuthErrorHandler.validateEmail('test@example.com'));
    console.log('  Invalid email:', AuthErrorHandler.validateEmail('invalid-email'));
    
    // Test phone validation
    console.log('📱 Phone validation:');
    console.log('  Valid phone:', AuthErrorHandler.validatePhone('+92-300-1234567'));
    console.log('  Invalid phone:', AuthErrorHandler.validatePhone('1234567890'));
    
    // Test CNIC validation
    console.log('🆔 CNIC validation:');
    console.log('  Valid CNIC:', AuthErrorHandler.validateCnic('42101-1234567-8'));
    console.log('  Invalid CNIC:', AuthErrorHandler.validateCnic('1234567890123'));
    
    // Test password validation
    console.log('🔒 Password validation:');
    const weakPassword = AuthErrorHandler.validatePassword('123');
    console.log('  Weak password:', weakPassword);
    
    const strongPassword = AuthErrorHandler.validatePassword('Password123!');
    console.log('  Strong password:', strongPassword);
    
    // Test formatting functions
    console.log('🔧 Formatting functions:');
    console.log('  Phone formatting:', AuthErrorHandler.formatPhoneNumber('03001234567'));
    console.log('  CNIC formatting:', AuthErrorHandler.formatCnic('4210112345678'));
  }

  static testErrorHandling(): void {
    console.log('🧪 Testing Error Handling...');
    
    // Test validation error extraction
    const mockApiError = {
      response: {
        data: {
          errors: {
            email: ['The email field is required.'],
            password: ['The password field is required.', 'The password must be at least 8 characters.']
          }
        }
      }
    };
    
    const validationErrors = AuthErrorHandler.extractValidationErrors(mockApiError);
    console.log('📋 Extracted validation errors:', validationErrors);
    
    // Test field error message extraction
    const fieldError = AuthErrorHandler.getFieldErrorMessage('email', mockApiError.response.data.errors);
    console.log('📝 Field error message:', fieldError);
  }

  static runAllTests(): boolean {
    console.log('🚀 Running Complete Authentication Flow Tests...\n');
    
    let allTestsPassed = true;
    
    // Test registration flows
    if (!this.testPassengerRegistration()) allTestsPassed = false;
    if (!this.testDriverRegistration()) allTestsPassed = false;
    if (!this.testBikeDriverRegistration()) allTestsPassed = false;
    
    // Test login flows
    if (!this.testEmailLogin()) allTestsPassed = false;
    if (!this.testOtpLogin()) allTestsPassed = false;
    
    // Test utilities
    this.testFieldValidation();
    this.testErrorHandling();
    
    console.log('\n📊 Test Results Summary:');
    console.log(allTestsPassed ? '✅ All tests passed!' : '❌ Some tests failed');
    
    return allTestsPassed;
  }
}

// Export test data for use in other files
export default AuthFlowTester;
