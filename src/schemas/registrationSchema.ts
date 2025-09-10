import * as yup from 'yup';

// CNIC validation regex (Pakistani CNIC format)
const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;

// Base validation schema
const baseSchema = yup.object({
  fullName: yup
    .string()
    .required('Full name is required')
    .min(2, 'Full name must be at least 2 characters')
    .max(50, 'Full name must be less than 50 characters'),
  
  cnic: yup
    .string()
    .required('CNIC is required')
    .matches(cnicRegex, 'Please enter a valid CNIC (e.g., 12345-1234567-1)'),
  
  address: yup
    .string()
    .required('Address is required')
    .min(10, 'Address must be at least 10 characters')
    .max(200, 'Address must be less than 200 characters'),
  
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  
  password: yup
    .string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters')
    .max(50, 'Password must be less than 50 characters'),
  
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
});

// Driver-specific validation schema
const driverSchema = baseSchema.shape({
  role: yup
    .string()
    .required('Please select a role')
    .oneOf(['driver'], 'Role must be driver'),
  
  vehicleType: yup
    .string()
    .required('Vehicle type is required')
    .oneOf(['car', 'bike', 'van', 'truck'], 'Please select a valid vehicle type'),
  
  vehicleNumber: yup
    .string()
    .required('Vehicle number is required')
    .min(3, 'Vehicle number must be at least 3 characters')
    .max(20, 'Vehicle number must be less than 20 characters'),
  
  vehicleBrand: yup
    .string()
    .required('Vehicle brand is required')
    .min(2, 'Vehicle brand must be at least 2 characters')
    .max(30, 'Vehicle brand must be less than 30 characters'),
  
  vehicleModel: yup
    .string()
    .required('Vehicle model is required')
    .min(2, 'Vehicle model must be at least 2 characters')
    .max(30, 'Vehicle model must be less than 30 characters'),
  
  vehicleYear: yup
    .string()
    .optional()
    .matches(/^(19|20)\d{2}$/, 'Please enter a valid year (1900-2099)'),
  
  vehicleColor: yup
    .string()
    .optional()
    .max(20, 'Vehicle color must be less than 20 characters'),
  
  driverPicture: yup
    .string()
    .required('Driver picture is required'),
  
  cnicPicture: yup
    .string()
    .required('CNIC picture is required'),
  
  vehiclePictures: yup
    .array()
    .of(yup.string())
    .min(4, 'Please upload at least 4 vehicle pictures (front, back, left, right)')
    .max(6, 'Maximum 6 vehicle pictures allowed'),
});

// Passenger validation schema
const passengerSchema = baseSchema.shape({
  role: yup
    .string()
    .required('Please select a role')
    .oneOf(['passenger'], 'Role must be passenger'),
});

// Dynamic validation schema based on role
export const createValidationSchema = (role: 'driver' | 'passenger') => {
  return role === 'driver' ? driverSchema : passengerSchema;
};

// Export validation functions
export const validateRegistration = (data: any, role: 'driver' | 'passenger') => {
  const schema = role === 'driver' ? driverSchema : passengerSchema;
  return schema.validate(data, { abortEarly: false });
};

export const validateDriverRegistration = (data: any) => {
  return driverSchema.validate(data, { abortEarly: false });
};

export const validatePassengerRegistration = (data: any) => {
  return passengerSchema.validate(data, { abortEarly: false });
};

// Type definitions for form data
export interface BaseRegistrationData {
  fullName: string;
  cnic: string;
  address: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'driver' | 'passenger';
}

export interface DriverRegistrationData extends BaseRegistrationData {
  role: 'driver';
  vehicleType: 'car' | 'bike' | 'van' | 'truck';
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear?: string;
  vehicleColor?: string;
  driverPicture: string;
  cnicPicture: string;
  vehiclePictures: string[];
}

export interface PassengerRegistrationData extends BaseRegistrationData {
  role: 'passenger';
}

export type RegistrationData = DriverRegistrationData | PassengerRegistrationData;
