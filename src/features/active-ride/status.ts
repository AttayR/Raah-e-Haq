import type { RideResource } from '../../services/rideService';
import { ACTIVE_RIDE_COPY } from './copy';

/**
 * Ride statuses as the API returns them (RideResource.status, from the backend's
 * Ride::getStatusForApi): `requested | accepted | ongoing | completed | cancelled`.
 * `arrived` and `started` are database statuses the API maps to accepted/ongoing today; they
 * are listed so a server that starts returning them still counts as an active ride.
 * This file is the one place that says which statuses are in progress and which are final.
 */
export type RideStatus = RideResource['status'];

/** A ride the passenger is still in: waiting for a driver, driver on the way, or on the trip. */
export const IN_PROGRESS_RIDE_STATUSES: ReadonlyArray<RideStatus> = [
  'requested',
  'accepted',
  'arrived',
  'started',
  'ongoing',
];

/** Final statuses: polling stops and the booking flow starts over. */
export const TERMINAL_RIDE_STATUSES: ReadonlyArray<RideStatus> = ['completed', 'cancelled'];

type WithStatus = Pick<RideResource, 'status'> | null | undefined;

export const isRideInProgress = (ride: WithStatus): boolean =>
  !!ride && IN_PROGRESS_RIDE_STATUSES.includes(ride.status);

export const isRideTerminal = (ride: WithStatus): boolean =>
  !!ride && TERMINAL_RIDE_STATUSES.includes(ride.status);

/** One line for a ride in progress, e.g. on Home's "Return to your ride" card (T-543). */
export const liveRideStatusText = (status: RideStatus): string => {
  switch (status) {
    case 'requested':
      return ACTIVE_RIDE_COPY.searchingTitle;
    case 'accepted':
      return ACTIVE_RIDE_COPY.driverEnRouteTitle;
    case 'arrived':
      return ACTIVE_RIDE_COPY.driverArrivedTitle;
    default:
      return ACTIVE_RIDE_COPY.inTripTitle;
  }
};
