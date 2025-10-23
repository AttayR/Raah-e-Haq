# 🚀 Complete Authentication System Documentation

## Overview

This document provides comprehensive documentation for the complete authentication system implemented for the RaaHeHaq ride-sharing application. The system supports both passenger and driver registration with image uploads, email/password login, and OTP-based authentication.

## 📁 File Structure

```
src/
├── services/
│   └── api.ts                          # Updated API service with new interfaces
├── hooks/
│   └── useApiAuth.ts                   # Updated auth hook with new interfaces
├── store/
│   └── thunks/
│       └── apiThunks.ts                # Updated Redux thunks
├── screens/
│   └── Auth/
│       ├── CompleteRegistrationScreen.tsx  # New comprehensive registration screen
│       └── CompleteLoginScreen.tsx         # New comprehensive login screen
├── utils/
│   ├── AuthErrorHandler.ts            # Comprehensive error handling
│   ├── ValidationUtils.ts             # Form validation utilities
│   └── AuthFlowTester.ts              # Testing utilities
└── theme/
    └── colors.ts                       # Brand colors
```

## 🔧 API Interfaces

### RegisterRequest Interface

```typescript
interface RegisterRequest {
  // Basic Info
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  user_type: 'driver' | 'passenger';
  phone: string;
  cnic: string;
  address: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  emergency_contact_name: string;
  emergency_contact_relation: string;
  languages: string;
  bio: string;

  // Passenger specific fields
  passenger_preferred_payment?: string;
  passenger_emergency_contact?: string;
  passenger_emergency_contact_name?: string;
  passenger_emergency_contact_relation?: string;

  // Driver specific fields
  license_number?: string;
  license_type?: string;
  license_expiry_date?: string;
  driving_experience?: string;
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  vehicle_type?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_color?: string;
  license_plate?: string;
  registration_number?: string;
  preferred_payment?: string;
}
```

### RegisterWithImagesRequest Interface

```typescript
interface RegisterWithImagesRequest extends RegisterRequest {
  // Image fields for passengers
  passenger_cnic_front_image?: string;
  passenger_cnic_back_image?: string;
  passenger_profile_image?: string;

  // Image fields for drivers
  cnic_front_image?: string;
  cnic_back_image?: string;
  license_image?: string;
  profile_image?: string;
  vehicle_front_image?: string;
  vehicle_back_image?: string;
  vehicle_left_image?: string;
  vehicle_right_image?: string;
}
```

## 🎯 Registration Flow

### Passenger Registration

1. **Step 1: Basic Information**

   - Full name, email, password, phone, CNIC, address
   - Date of birth, gender, emergency contact details
   - Languages and bio

2. **Step 2: Passenger Information**

   - Preferred payment method (mobile_wallet, card, cash)
   - Emergency contact details

3. **Step 3: Document Upload**
   - CNIC front image
   - CNIC back image
   - Profile image

### Driver Registration

1. **Step 1: Basic Information**

   - Same as passenger

2. **Step 2: Driver Information**

   - License number, type, expiry date
   - Driving experience
   - Bank account details

3. **Step 3: Vehicle Information**

   - Vehicle type (car/bike)
   - Make, model, year, color
   - License plate, registration number
   - Preferred payment method

4. **Step 4: Document Upload**
   - CNIC front/back images
   - License image
   - Profile image
   - Vehicle images (front, back, left, right)

## 🔐 Login Flow

### Email/Password Login

```typescript
const loginData = {
  email: 'user@example.com',
  password: 'Password123!',
};
```

### OTP Login

```typescript
// Step 1: Send OTP
const phone = '+92-300-1234567';
await sendOtpToPhone(phone);

// Step 2: Verify OTP
const otpData = {
  phone: '+92-300-1234567',
  otp_code: '123456',
};
await verifyOtpCode(otpData);
```

## 🛠️ Usage Examples

### Using the Complete Registration Screen

```typescript
import CompleteRegistrationScreen from '../screens/Auth/CompleteRegistrationScreen';

// Navigate to registration
navigation.navigate('CompleteRegistration');
```

### Using the Complete Login Screen

```typescript
import CompleteLoginScreen from '../screens/Auth/CompleteLoginScreen';

// Navigate to login
navigation.navigate('CompleteLogin');
```

### Using Validation Utils

```typescript
import ValidationUtils from '../utils/ValidationUtils';

// Validate registration form
const rules = ValidationUtils.getRegistrationRules('passenger');
const result = ValidationUtils.validateForm(formData, rules);

if (result.isValid) {
  // Proceed with registration
} else {
  // Handle validation errors
  console.log(result.errors);
}
```

### Using Error Handler

```typescript
import AuthErrorHandler from '../utils/AuthErrorHandler';

try {
  await registerWithImages(registrationData);
} catch (error) {
  AuthErrorHandler.handleRegistrationError(error);
}
```

## 📋 API Endpoints

### Registration

- **POST** `/api/auth/register`
- **Content-Type**: `application/json` or `multipart/form-data`
- **Body**: `RegisterRequest` or `RegisterWithImagesRequest`

### Login

- **POST** `/api/auth/login`
- **Content-Type**: `application/json`
- **Body**: `{ email: string, password: string }`

### OTP

- **POST** `/api/auth/send-otp`
- **Content-Type**: `application/json`
- **Body**: `{ phone: string }`

- **POST** `/api/auth/verify-otp`
- **Content-Type**: `application/json`
- **Body**: `{ phone: string, otp_code: string }`

## 🧪 Testing

### Running Tests

```typescript
import AuthFlowTester from '../utils/AuthFlowTester';

// Run all tests
AuthFlowTester.runAllTests();

// Run specific tests
AuthFlowTester.testPassengerRegistration();
AuthFlowTester.testDriverRegistration();
AuthFlowTester.testEmailLogin();
AuthFlowTester.testOtpLogin();
```

### Test Data

The system includes comprehensive test data based on your API documentation:

```typescript
import { testRegistrationData, testLoginData } from '../utils/AuthFlowTester';

// Use test data for development/testing
const passengerData = testRegistrationData.passenger;
const driverData = testRegistrationData.driver;
const bikeDriverData = testRegistrationData.bikeDriver;
```

## 🔒 Security Features

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Phone Number Format

- Must be in format: `+92-XXX-XXXXXXX`
- Automatically formatted by the system

### CNIC Format

- Must be in format: `XXXXX-XXXXXXX-X`
- Automatically formatted by the system

### Image Validation

- All required images must be uploaded
- Images are validated on the client side before submission

## 🎨 UI Features

### Registration Screen

- Multi-step form with progress indicator
- User type selection (Passenger/Driver)
- Dynamic form fields based on user type
- Image picker for document uploads
- Real-time validation with error messages
- Responsive design for different screen sizes

### Login Screen

- Dual login method (Email/OTP)
- Toggle between login methods
- OTP resend functionality
- Real-time validation
- Loading states and error handling

## 🚨 Error Handling

### Validation Errors

- Field-level validation with specific error messages
- Real-time validation as user types
- Step-by-step validation for multi-step forms

### API Errors

- Network error handling
- Server error handling
- Validation error extraction and display
- User-friendly error messages

### Image Upload Errors

- File size validation
- File type validation
- Upload progress indication
- Retry functionality

## 📱 Navigation Integration

### Screen Navigation

```typescript
// Navigate to registration
navigation.navigate('CompleteRegistration');

// Navigate to login
navigation.navigate('CompleteLogin');

// Navigate back to login after successful registration
navigation.navigate('CompleteLogin');
```

### Authentication State Management

The system integrates with Redux for state management:

- User authentication state
- Loading states
- Error states
- Form data persistence

## 🔄 State Management

### Redux Integration

- `useApiAuth` hook for authentication actions
- Redux thunks for async operations
- State persistence with AsyncStorage
- Error state management

### Form State

- Local state management for form data
- Step-by-step form progression
- Data persistence between steps
- Validation state management

## 🎯 Best Practices

### Code Organization

- Separation of concerns
- Reusable validation utilities
- Centralized error handling
- Type-safe interfaces

### User Experience

- Progressive form completion
- Clear error messages
- Loading indicators
- Success feedback

### Performance

- Lazy loading of form steps
- Optimized image handling
- Efficient validation
- Minimal re-renders

## 🚀 Getting Started

1. **Import the screens** in your navigation setup
2. **Add the routes** to your navigation stack
3. **Configure the API base URL** in `src/services/api.ts`
4. **Test the flow** using the provided test utilities
5. **Customize the UI** according to your design requirements

## 📞 Support

For any issues or questions regarding the authentication system:

1. Check the console logs for detailed error information
2. Use the `AuthFlowTester` to validate your data
3. Review the API documentation for endpoint requirements
4. Check the validation rules in `ValidationUtils.ts`

---

**Note**: This authentication system is fully compatible with your backend API as documented in the provided payload examples. All field names, validation rules, and API endpoints match your backend specifications.
