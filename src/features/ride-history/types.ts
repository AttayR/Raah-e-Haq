/**
 * App models of a ride in history and on the ride details screen (T-501), mapped from
 * `RideResource` (GET /rides, GET /rides/{id}; docs/api/CONTRACT_NOTES.md). Phone numbers are
 * never mapped: the history and receipt never show one.
 */

import type { MyRating } from '../rating/types';

export type RideStatus = 'requested' | 'accepted' | 'arrived' | 'started' | 'completed' | 'cancelled';

/** Who cancelled (`rides.cancellation_reason`). */
export type CancellationReason = 'passenger' | 'driver' | 'system' | 'weather' | 'other';

/** Whose side of the ride the screen shows: the passenger pays the fare, the driver earns. */
export type RideViewer = 'passenger' | 'driver';

/** The list filter (maps to GET /rides `status`). */
export type RideHistoryFilter = 'all' | 'completed' | 'cancelled';

export interface RideStop {
  id: number;
  address: string;
  order: number;
  status: string | null;
}

export interface RideFareBreakdown {
  base: number;
  distance: number;
  time: number;
  stops: number;
  minFareAdjustment: number;
  total: number;
}

/** The other party as the history may show them: first name and car, never a phone. */
export interface RidePerson {
  id: number;
  firstName: string | null;
  profileImageUrl: string | null;
  rating: number | null;
}

export interface RideVehicle {
  make: string | null;
  model: string | null;
  color: string | null;
  licensePlate: string | null;
}

export interface Ride {
  id: number;
  /** Public ride code ("RH…"). */
  rideCode: string | null;
  status: RideStatus;
  passengerId: number | null;
  driverId: number | null;
  pickupAddress: string;
  dropoffAddress: string;
  stops: RideStop[];
  vehicleType: string | null;
  totalFare: number;
  fareBreakdown: RideFareBreakdown | null;
  driverEarnings: number | null;
  platformCommission: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  paymentMethod: string;
  paymentStatus: string | null;
  passenger: RidePerson | null;
  driver: RidePerson | null;
  vehicle: RideVehicle | null;
  requestedAt: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: CancellationReason | null;
  cancellationNote: string | null;
  createdAt: string | null;
  /** BE-07: the signed-in user's own rating of this ride, or null. */
  myRating: MyRating | null;
  /** BE-07: the signed-in user may still rate this ride. */
  canRate: boolean;
}

export type { Page } from '../../core/api/types';
