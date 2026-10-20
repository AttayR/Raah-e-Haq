import type { BadgeTone } from '../../components/ui/Badge';
import { DRIVER_PROFILE_COPY as COPY } from './copy';
import type { DriverVehicle, VehicleReviewStatus } from './types';

/** "Toyota Corolla"; "Your vehicle" when the server has neither make nor model. */
export const vehicleTitle = (vehicle: DriverVehicle): string =>
  [vehicle.make, vehicle.model].filter(Boolean).join(' ') || COPY.vehicleUnnamed;

/** "Plate LEA-1234", or that there is none. */
export const vehiclePlate = (vehicle: DriverVehicle): string =>
  vehicle.licensePlate ? COPY.plate(vehicle.licensePlate) : COPY.noPlate;

const STATUS_TONE: Record<VehicleReviewStatus, BadgeTone> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

/** The review badge for a vehicle; none when the server sent no status. */
export const vehicleStatusBadge = (vehicle: DriverVehicle): { label: string; tone: BadgeTone } | null =>
  vehicle.status ? { label: COPY.vehicleStatus[vehicle.status], tone: STATUS_TONE[vehicle.status] } : null;

