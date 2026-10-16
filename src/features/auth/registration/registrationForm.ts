/**
 * The registration form's data and steps (T-201). The screen holds one RegistrationFormData;
 * each step edits part of it and is validated by src/schemas/registrationSchema before Next.
 */
import type { IconName } from '../../../components/ui/icons';

export type RegistrationRole = 'driver' | 'passenger';

export type RegistrationStep = 'personal' | 'vehicle' | 'documents' | 'review';

export const REGISTRATION_STEPS: ReadonlyArray<{ key: RegistrationStep; title: string; icon: IconName }> = [
  { key: 'personal', title: 'Personal Info', icon: 'account' },
  { key: 'vehicle', title: 'Vehicle Info', icon: 'car' },
  { key: 'documents', title: 'Documents', icon: 'document' },
  { key: 'review', title: 'Review', icon: 'check' },
];

/**
 * The vehicle types the backend accepts (BE-58: car, bike, rickshaw, van; anything else is a
 * 422). Used by the vehicle step, registrationSchema and the review step.
 * TODO(T-203/T-302): load this list from GET /api/public/vehicle-types (BE-58) instead.
 */
export const VEHICLE_TYPES = [
  { id: 'car', label: 'Car', icon: 'car', description: 'Sedan, Hatchback, SUV' },
  { id: 'bike', label: 'Bike', icon: 'bike', description: 'Motorcycle, Scooter' },
  { id: 'rickshaw', label: 'Rickshaw', icon: 'rickshaw', description: 'Auto rickshaw, Qingqi' },
  { id: 'van', label: 'Van', icon: 'van', description: 'Minivan, Hiace' },
] as const;

export type VehicleTypeId = (typeof VEHICLE_TYPES)[number]['id'];

export const VEHICLE_TYPE_IDS: readonly string[] = VEHICLE_TYPES.map((type) => type.id);

/** Label for a stored vehicle type id (the id itself when unknown). */
export const vehicleTypeLabel = (id: string): string =>
  VEHICLE_TYPES.find((type) => type.id === id)?.label ?? id;

/**
 * The vehicle photo slots, index-stable: slot i is always sent as `field` (T-203). An empty
 * slot holds '' so removing one photo never shifts the others into the wrong side.
 */
export const VEHICLE_PHOTO_SLOTS = [
  { label: 'Front', field: 'vehicle_front_image' },
  { label: 'Back', field: 'vehicle_back_image' },
  { label: 'Left side', field: 'vehicle_left_image' },
  { label: 'Right side', field: 'vehicle_right_image' },
] as const;

/** The pictures with slot `index` set to `uri` ('' clears it); always one entry per slot. */
export const setVehiclePhoto = (pictures: readonly string[], index: number, uri: string): string[] =>
  VEHICLE_PHOTO_SLOTS.map((_, i) => (i === index ? uri : pictures[i] ?? ''));

/** How many vehicle slots hold a photo. */
export const filledVehiclePhotoCount = (pictures: readonly (string | undefined)[] | undefined): number =>
  (pictures ?? []).filter((uri) => typeof uri === 'string' && uri.trim() !== '').length;

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
  /** BE-86: the car has AC (sent only for a car; an admin checks it before AC rides). */
  vehicleHasAc: boolean;
  licenseNumber: string; // Driving licence number (T-207: required for drivers)
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
  licenseFrontPicture: string; // For drivers (sent as license_image)
  cnicFrontPicture: string; // For passengers
  cnicBackPicture: string; // For passengers
  profilePicture: string; // For passengers (and optional for drivers)
  /** One entry per VEHICLE_PHOTO_SLOTS slot ('' when empty). */
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
  vehicleHasAc: false,
  licenseNumber: '',
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
  cnicFrontPicture: '',
  cnicBackPicture: '',
  profilePicture: '',
  vehiclePictures: [],
  role: 'passenger',
};
