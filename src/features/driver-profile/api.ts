import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumberOrNull, readText } from '../../core/api/read';
import type { DriverVehicle, VehicleReviewStatus } from './types';

/**
 * GET /profile/documents (BE-22/BE-42, owner only, `Cache-Control: private, no-store`):
 * `data.vehicles[]` carries `id, make, model, license_plate, verification_status, rejection_reason`
 * (BE-126 adds `vehicle_type, year, color`). The same
 * body holds short-lived signed links to the identity documents; they are never read or kept
 * here (only the vehicle labels are mapped), so nothing sensitive outlives the request.
 */

const STATUSES: ReadonlyArray<VehicleReviewStatus> = ['pending', 'approved', 'rejected'];

const text = (value: unknown): string | null => readText(value)?.trim() ?? null;

const toVehicle = (raw: unknown): DriverVehicle | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    make: text(raw.make),
    model: text(raw.model),
    licensePlate: text(raw.license_plate),
    status: STATUSES.find((status) => status === raw.verification_status) ?? null,
    rejectionReason: text(raw.rejection_reason) || null,
    vehicleType: text(raw.vehicle_type) || null,
    year: readNumberOrNull(raw.year),
    color: text(raw.color) || null,
  };
};

/** The vehicles of a GET /profile/documents payload; anything malformed is dropped. */
export const toDriverVehicles = (data: unknown): DriverVehicle[] =>
  (isRecord(data) && Array.isArray(data.vehicles) ? data.vehicles : [])
    .map(toVehicle)
    .filter((vehicle): vehicle is DriverVehicle => vehicle !== null);

export const driverProfileApi = {
  async getVehicles(): Promise<DriverVehicle[]> {
    return toDriverVehicles(unwrap(await apiService.get<unknown>('/profile/documents')));
  },
};
