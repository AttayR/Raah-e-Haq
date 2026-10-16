/**
 * App models of a ride in history and on the ride details screen (T-501), mapped from
 * `RideResource` (GET /rides, GET /rides/{id}; docs/api/CONTRACT_NOTES.md). Phone numbers are
 * never mapped: the history and receipt never show one.
 */

import type { MyRating } from '../rating/types';
import type { DriverFareSplit, FareLock, OverchargeState } from '../fare/types';
import type { AcReportState } from '../ac/types';
import type { SafetyReportState } from '../women-mode/types';
import type { ParcelView } from '../parcel/types';

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
  /** BE-60 / BE-83 / BE-85 parts (0 on older rides). */
  bookingFee: number;
  offerAdjustment: number;
  waiting: number;
  total: number;
}

/** The other party as the history may show them: first name (`name`) and car, never a phone. */
export interface RidePerson {
  id: number;
  name: string | null;
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
  /** BE-103: the booking quote's km and minutes (null before BE-103); a locked fare charged these. */
  quotedDistanceKm: number | null;
  quotedDurationMinutes: number | null;
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
  /** BE-82: the fare locked at accept; null before accept or on older rides. */
  fareLock: FareLock | null;
  /** BE-85: what the passenger was charged for a late cancel or no-show (null: nothing). */
  cancellationFee: number | null;
  cancellationChargeReason: 'late_cancel' | 'no_show' | null;
  /** BE-82, passenger only: the "driver asked for more" button and report. */
  overcharge: OverchargeState | null;
  /** BE-84, the ride's driver only: fare → commission → earnings. */
  split: DriverFareSplit | null;
  /** BE-86: an AC-tier ride. */
  isAc: boolean;
  /** BE-86, passenger only, AC rides: "AC not working" button and report. */
  acReport: AcReportState | null;
  /** BE-105, passenger only: "Report a women's-safety issue" button and the report already made. */
  safetyReport: SafetyReportState | null;
  /** BE-88 / T-559, sender and driver: the parcel block of a parcel ride (null: not a parcel). */
  parcel: ParcelView | null;
}

export type { Page } from '../../core/api/types';
