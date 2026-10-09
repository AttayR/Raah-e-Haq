/**
 * The registration form's data and steps (T-201). The screen holds one RegistrationFormData;
 * each step edits part of it and is validated by src/schemas/registrationSchema before Next.
 */
export type RegistrationRole = 'driver' | 'passenger';

export type RegistrationStep = 'personal' | 'vehicle' | 'documents' | 'review';

export const REGISTRATION_STEPS: ReadonlyArray<{ key: RegistrationStep; title: string; icon: string }> = [
  { key: 'personal', title: 'Personal Info', icon: 'person' },
  { key: 'vehicle', title: 'Vehicle Info', icon: 'local-taxi' },
  { key: 'documents', title: 'Documents', icon: 'description' },
  { key: 'review', title: 'Review', icon: 'check-circle' },
];

/**
 * The vehicle types the backend accepts (BE-58: car, bike, rickshaw, van; anything else is a
 * 422). Used by the vehicle step, registrationSchema and the review step.
 * TODO(T-203/T-302): load this list from GET /api/public/vehicle-types (BE-58) instead.
 */
export const VEHICLE_TYPES = [
  { id: 'car', label: 'Car', icon: 'directions-car', description: 'Sedan, Hatchback, SUV' },
  { id: 'bike', label: 'Bike', icon: 'two-wheeler', description: 'Motorcycle, Scooter' },
  { id: 'rickshaw', label: 'Rickshaw', icon: 'electric-rickshaw', description: 'Auto rickshaw, Qingqi' },
  { id: 'van', label: 'Van', icon: 'airport-shuttle', description: 'Minivan, Hiace' },
] as const;

export type VehicleTypeId = (typeof VEHICLE_TYPES)[number]['id'];

export const VEHICLE_TYPE_IDS: readonly string[] = VEHICLE_TYPES.map((type) => type.id);

/** Label for a stored vehicle type id (the id itself when unknown). */
export const vehicleTypeLabel = (id: string): string =>
  VEHICLE_TYPES.find((type) => type.id === id)?.label ?? id;

export interface RegistrationFormData {
  // Personal Info
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  cnic: string;
  address: string;
  phoneNumber: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'male' | 'female' | 'other' | '';
  // Emergency Contact (per passenger/driver forms)
  emergencyContactNumber: string;
  emergencyContactName: string;
  emergencyRelationship: string; // e.g. father, mother, spouse, friend

  // Vehicle Info (for drivers)
  vehicleType: string;
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  licenseType: string;
  licenseExpiryDate: string; // YYYY-MM-DD
  licensePlate: string;
  registrationNumber: string;
  drivingExperience: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;

  // Documents
  driverPicture: string;
  cnicPicture: string;
  licenseFrontPicture: string; // For drivers
  licenseBackPicture: string; // For drivers
  cnicFrontPicture: string; // For passengers
  cnicBackPicture: string; // For passengers
  profilePicture: string; // For passengers (and optional for drivers)
  vehiclePictures: string[];

  role: RegistrationRole;
}

export const INITIAL_REGISTRATION_FORM: RegistrationFormData = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  cnic: '',
  address: '',
  phoneNumber: '',
  dateOfBirth: '',
  gender: '',
  emergencyContactNumber: '',
  emergencyContactName: '',
  emergencyRelationship: '',
  vehicleType: '',
  vehicleNumber: '',
  vehicleBrand: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleColor: '',
  licenseType: '',
  licenseExpiryDate: '',
  licensePlate: '',
  registrationNumber: '',
  drivingExperience: '',
  bankName: '',
  bankBranch: '',
  bankAccountNumber: '',
  driverPicture: '',
  cnicPicture: '',
  licenseFrontPicture: '',
  licenseBackPicture: '',
  cnicFrontPicture: '',
  cnicBackPicture: '',
  profilePicture: '',
  vehiclePictures: [],
  role: 'passenger',
};
