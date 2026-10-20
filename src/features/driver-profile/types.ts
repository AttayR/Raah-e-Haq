/**
 * The driver's own vehicle as the profile shows it (T-507, T-514). Make, model and plate come
 * from GET /profile/documents `vehicles[]` (BE-42, owner only). The vehicle's own type, year and
 * colour come with BE-126 (null until then; nothing is shown for them, UI-R17).
 */
export type VehicleReviewStatus = 'pending' | 'approved' | 'rejected';

export interface DriverVehicle {
  id: number;
  make: string | null;
  model: string | null;
  licensePlate: string | null;
  status: VehicleReviewStatus | null;
  /** Sent with a rejected review (BE-42); shown under the plate. */
  rejectionReason: string | null;
  /** BE-126: `car`, `bike`, `rickshaw`, … (picks the row glyph); null until sent. */
  vehicleType: string | null;
  year: number | null;
  color: string | null;
}
