/**
 * The driver's own vehicle as the profile shows it (T-507, T-514). Make, model and plate come
 * from GET /profile/documents `vehicles[]` (BE-42, owner only). Year and colour are not sent
 * yet (BE-15); nothing is shown for them until they are.
 */
export type VehicleReviewStatus = 'pending' | 'approved' | 'rejected';

export interface DriverVehicle {
  id: number;
  make: string | null;
  model: string | null;
  licensePlate: string | null;
  status: VehicleReviewStatus | null;
}
