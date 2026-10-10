import { apiService, unwrap } from '../../services/api';
import type { RideResource } from '../../services/rideService';

/**
 * The assigned driver's ride lifecycle (T-405, BE-04, docs/api/CONTRACT_NOTES.md).
 *
 * - GET /rides/{id}: the ride (the driver sees the passenger's phone while the ride is active).
 * - POST /rides/{id}/arrived (accepted → arrived), /start (arrived → started) and /complete
 *   (started → completed). No body: the server computes the fare, distance, duration and
 *   driver earnings on complete (cash is marked paid). 200 `data: RideResource`.
 * - POST /rides/{id}/cancel {note}: the driver may cancel only before the trip starts and must
 *   say why (3-500 characters, 422 `errors.note` otherwise). The ride is cancelled, or goes
 *   back to `requested` for another driver (server config); either way it is no longer ours.
 * - POST /rides/{id}/stops/{stop}/complete: answers with stop counters, not a ride, so the
 *   ride is read again afterwards.
 *
 * - 422 `not_near_pickup` from /arrived (BE-64): the driver's latest location ping is farther
 *   than the server's radius from pickup; `error.distance_m` / `error.radius_m` say how far.
 *   The ride stays `accepted`.
 *
 * Refusals: 403 NOT_ASSIGNED_DRIVER / DRIVER_NOT_ACTIVE; 409 INVALID_STATUS_TRANSITION or
 * RIDE_CANNOT_BE_CANCELLED (with `error.current_status`), 409 RIDE_NOT_ACTIVE /
 * STOP_ALREADY_COMPLETED / STOP_ALREADY_CANCELLED / STOP_NOT_ACTIVE for a stop.
 */
export const DRIVER_RIDE_CODES = {
  invalidTransition: 'INVALID_STATUS_TRANSITION',
  notAssignedDriver: 'NOT_ASSIGNED_DRIVER',
  cannotBeCancelled: 'RIDE_CANNOT_BE_CANCELLED',
  driverNotActive: 'DRIVER_NOT_ACTIVE',
  rideNotActive: 'RIDE_NOT_ACTIVE',
  stopAlreadyCompleted: 'STOP_ALREADY_COMPLETED',
  stopAlreadyCancelled: 'STOP_ALREADY_CANCELLED',
  stopNotActive: 'STOP_NOT_ACTIVE',
  notNearPickup: 'not_near_pickup',
} as const;

/** The driver's cancel note bounds (BE-04 driverCancel, `note` max:500). */
export const CANCEL_NOTE_MIN_LENGTH = 3;
export const CANCEL_NOTE_MAX_LENGTH = 500;

/** The forward steps the driver takes, each its own endpoint. */
export type DriverRideTransition = 'arrived' | 'start' | 'complete';

export const driverRideApi = {
  async get(rideId: number): Promise<RideResource> {
    return unwrap(await apiService.get<RideResource>(`/rides/${rideId}`));
  },

  async arrived(rideId: number): Promise<RideResource> {
    return unwrap(await apiService.post<RideResource>(`/rides/${rideId}/arrived`));
  },

  async start(rideId: number): Promise<RideResource> {
    return unwrap(await apiService.post<RideResource>(`/rides/${rideId}/start`));
  },

  /** No body: the fare is the server's (DRV-05). */
  async complete(rideId: number): Promise<RideResource> {
    return unwrap(await apiService.post<RideResource>(`/rides/${rideId}/complete`));
  },

  async cancel(rideId: number, note: string): Promise<RideResource> {
    return unwrap(await apiService.post<RideResource>(`/rides/${rideId}/cancel`, { note }));
  },

  /** Resolves once the server marked the stop done; read the ride again for the new state. */
  async completeStop(rideId: number, stopId: number): Promise<void> {
    unwrap(await apiService.post<unknown>(`/rides/${rideId}/stops/${stopId}/complete`));
  },
};

/** The transition's endpoint call. */
export const runTransition = (rideId: number, transition: DriverRideTransition): Promise<RideResource> =>
  driverRideApi[transition](rideId);
