import type { RideFareBreakdown, RideResource } from '../../services/rideService';
import type { RideStatus } from './status';

/**
 * The passenger's ride stage machine (T-304, PAX-05). The stage is derived from the server's
 * RideResource.status only (BE-04: requested | accepted | arrived | started | completed |
 * cancelled), never from local booking steps, so a poll, a restore and a user action all
 * land on the same screen.
 */
export type PassengerRideStage =
  | 'searching'
  | 'driver_en_route'
  | 'driver_arrived'
  | 'in_trip'
  | 'completed'
  | 'cancelled';

/** A transient fact about how the ride got to its stage (shown with the stage). */
export type PassengerRideNotice = 'driver_cancelled' | null;

export interface PassengerRideStageState {
  rideId: number | null;
  stage: PassengerRideStage;
  notice: PassengerRideNotice;
}

export const rideStageOf = (status: RideStatus): PassengerRideStage => {
  switch (status) {
    case 'requested':
      return 'searching';
    case 'accepted':
      return 'driver_en_route';
    case 'arrived':
      return 'driver_arrived';
    case 'started':
    case 'ongoing': // pre-BE-04 word for started; the API no longer sends it.
      return 'in_trip';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
  }
};

/** Stages with an assigned driver whose position the passenger may see (BE-06/BE-20). */
const DRIVER_STAGES: ReadonlyArray<PassengerRideStage> = ['driver_en_route', 'driver_arrived', 'in_trip'];

/** Poll GET /rides/{id}/driver-location only while a driver is assigned and the ride is active. */
export const isDriverTrackable = (ride: Pick<RideResource, 'status' | 'driver_id'> | null | undefined): boolean =>
  !!ride && typeof ride.driver_id === 'number' && DRIVER_STAGES.includes(rideStageOf(ride.status));

/** The passenger may cancel until the trip starts (Ride::canBeCancelled). */
export const canPassengerCancel = (stage: PassengerRideStage): boolean =>
  stage === 'searching' || stage === 'driver_en_route' || stage === 'driver_arrived';

/**
 * The next stage state for `ride`, given the previous one. Pure; returns `prev` itself when
 * nothing changed so it can drive React state without re-renders.
 *
 * A ride that goes back from a driver stage to `requested` was requeued by the driver's cancel
 * (BE-04 requeue mode): the passenger is searching again, with the `driver_cancelled` notice,
 * which stays until the stage moves on.
 */
export const advanceRideStage = (
  prev: PassengerRideStageState | null,
  ride: Pick<RideResource, 'id' | 'status'> | null,
): PassengerRideStageState | null => {
  if (!ride) return null;
  const stage = rideStageOf(ride.status);
  const sameRide = !!prev && prev.rideId === ride.id;
  let notice: PassengerRideNotice = null;
  if (sameRide && stage === 'searching') {
    const wasWithDriver = DRIVER_STAGES.includes(prev.stage);
    if (wasWithDriver || prev.notice === 'driver_cancelled') notice = 'driver_cancelled';
  }
  if (sameRide && prev.stage === stage && prev.notice === notice) return prev;
  return { rideId: ride.id, stage, notice };
};

/** Who ended a cancelled ride, from cancellation_reason (BE-04). */
export type CancelledBy = 'passenger' | 'driver' | 'system';

export const cancelledByOf = (ride: Pick<RideResource, 'cancellation_reason'>): CancelledBy => {
  if (ride.cancellation_reason === 'passenger') return 'passenger';
  if (ride.cancellation_reason === 'driver') return 'driver';
  return 'system';
};

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/** What the driver-assigned card shows. Only server data; a missing field is left out. */
export interface DriverCardInfo {
  name: string | null;
  /** null when unrated (or rating 0). */
  rating: number | null;
  /** "Toyota Corolla", or null when the server sent neither make nor model. */
  vehicleName: string | null;
  color: string | null;
  plate: string | null;
}

export const driverCardOf = (ride: Pick<RideResource, 'driver' | 'vehicle'>): DriverCardInfo => {
  const rating = toNumber(ride.driver?.rating);
  const vehicle = ride.vehicle ?? null;
  const vehicleName = [text(vehicle?.make), text(vehicle?.model)].filter((p): p is string => p !== null).join(' ');
  return {
    name: text(ride.driver?.name),
    rating: rating !== null && rating > 0 ? rating : null,
    vehicleName: vehicleName || null,
    color: text(vehicle?.color),
    plate: text(vehicle?.license_plate),
  };
};

/** The final fare as the server computed it (total_fare and fare_breakdown, BE-05). */
export interface RideFareSummary {
  total: number;
  breakdown: {
    base: number;
    distance: number;
    time: number;
    stops: number;
    minFareAdjustment: number;
  } | null;
  paymentMethod: string | null;
}

const breakdownOf = (raw: RideFareBreakdown | null | undefined): RideFareSummary['breakdown'] => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    base: toNumber(raw.base) ?? 0,
    distance: toNumber(raw.distance) ?? 0,
    time: toNumber(raw.time) ?? 0,
    stops: toNumber(raw.stops) ?? 0,
    minFareAdjustment: toNumber(raw.min_fare_adjustment) ?? 0,
  };
};

/** The fare fields as they arrive (Laravel `decimal:2` casts serialise as strings). */
export interface RideFareFields {
  total_fare?: number | string | null;
  fare_breakdown?: RideFareBreakdown | null;
  payment_method?: string | null;
}

/** null when the server has not sent a total (it is never computed here). */
export const fareSummaryOf = (ride: RideFareFields): RideFareSummary | null => {
  const total = toNumber(ride.total_fare);
  if (total === null) return null;
  return { total, breakdown: breakdownOf(ride.fare_breakdown), paymentMethod: text(ride.payment_method) };
};
