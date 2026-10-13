import { formatMoney } from '../../core/format/money';
import type { BadgeTone } from '../../components/ui/Badge';
import { formatRating } from '../stats/format';
import type { DriverStats } from '../stats/types';
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

export interface DriverProfileStatValues {
  rating: string | null;
  rides: string | null;
  earnings: string | null;
}

/**
 * The profile stat tiles from GET /me/stats: rating ("New" until rated), lifetime trips and
 * lifetime earnings in the server's currency (PKR). `null` (a dash) while loading or failed:
 * never a made-up number.
 */
export const toDriverProfileStats = (stats: DriverStats | null): DriverProfileStatValues =>
  stats
    ? {
        rating: formatRating(stats.rating),
        rides: String(stats.totalRides),
        earnings: formatMoney(stats.totalEarnings, { currency: stats.currency }),
      }
    : { rating: null, rides: null, earnings: null };
