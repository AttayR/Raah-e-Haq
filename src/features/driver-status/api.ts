import { apiService, unwrap } from '../../services/api';

/**
 * The signed-in driver's availability (BE-06, docs/api/CONTRACT_NOTES.md):
 * - GET /driver/status
 * - PUT /driver/status {status: online|offline}  ('online' is stored as 'available')
 *
 * data: {status: offline|available|on_ride, is_online, can_accept_rides, active_ride_id,
 * changed_at, last_location_at}. `on_ride` is never set by the app: it follows the
 * driver's active ride.
 * Refusals: 403 NO_APPROVED_VEHICLE / DRIVER_NOT_ACTIVE, 409 RIDE_IN_PROGRESS (going offline
 * during a ride), 422 unknown status. Their `message` is user-facing.
 */
export type DriverAvailability = 'offline' | 'available' | 'on_ride';

/** What the app may ask for. */
export type DriverStatusTarget = 'online' | 'offline';

export interface DriverStatusInfo {
  status: DriverAvailability;
  activeRideId: number | null;
  changedAt: string | null;
}

/** BE-06 refusal codes the toggle reacts to. */
export const DRIVER_STATUS_CODES = {
  rideInProgress: 'RIDE_IN_PROGRESS',
  noApprovedVehicle: 'NO_APPROVED_VEHICLE',
  driverNotActive: 'DRIVER_NOT_ACTIVE',
} as const;

const AVAILABILITIES: readonly DriverAvailability[] = ['offline', 'available', 'on_ride'];

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

/**
 * The server's status data as DriverStatusInfo. An unknown or missing status is read as
 * `offline` (fail closed: the app never shows a driver as online unless the server said so).
 */
export const toDriverStatusInfo = (raw: unknown): DriverStatusInfo => {
  const data = isRecord(raw) ? raw : {};
  const status = AVAILABILITIES.find(known => known === data.status) ?? 'offline';
  return {
    status,
    activeRideId: status === 'on_ride' ? toId(data.active_ride_id) : null,
    changedAt: typeof data.changed_at === 'string' ? data.changed_at : null,
  };
};

export const driverStatusApi = {
  async get(): Promise<DriverStatusInfo> {
    return toDriverStatusInfo(unwrap(await apiService.get<unknown>('/driver/status')));
  },

  async set(target: DriverStatusTarget): Promise<DriverStatusInfo> {
    return toDriverStatusInfo(
      unwrap(await apiService.put<unknown>('/driver/status', { status: target })),
    );
  },
};
