import { localizedCopy } from '../../i18n/localizedCopy';

/** Static copy for the driver profile and the vehicle card (T-507, T-514). Values come from the API. */
export const DRIVER_PROFILE_COPY = localizedCopy({
  title: 'Profile',
  back: 'Back',
  driverFallbackName: 'Driver',
  roleLabel: 'Driver',
  memberSince: 'Member since',
  approved: 'Approved',
  pendingApproval: 'Pending approval',
  // Stats (GET /me/stats).
  statRating: 'Rating',
  statRides: 'Total trips',
  statEarnings: 'Total earned',
  statsFailed: "Couldn't load your stats right now.",
  // Personal info.
  personalInfo: 'Personal info',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  // Vehicle (GET /profile/documents vehicles).
  vehicleGroup: 'Vehicle',
  vehicleUnnamed: 'Your vehicle',
  plate: (plate: string) => `Plate ${plate}`,
  noPlate: 'No plate on file',
  noVehicle: 'No vehicle on file yet',
  vehicleFailed: "Couldn't load your vehicle",
  retry: 'Try again',
  vehicleStatus: {
    approved: 'Approved',
    pending: 'In review',
    rejected: 'Rejected',
  },
  // Licence (profile).
  licenceGroup: 'Driving licence',
  licenceNumber: 'Licence number',
  licenceExpiry: 'Expires',
  noLicence: 'No licence details on file yet',
} as const);
