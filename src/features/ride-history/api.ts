import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumber, readNumberOrNull, readOneOf, readText } from '../../core/api/read';
import type { Pagination } from '../../core/api/types';
import { toRideRatingState } from '../rating/api';
import { firstNameOf } from '../../utils/format';
import { driverSplitOf, fareExtrasOf, fareLockOf, toOverchargeState } from '../fare/api';
import { isAcRide, toAcReportState } from '../ac/api';
import { toSafetyReportState } from '../women-mode/api';
import { isParcelRide, toParcelView } from '../parcel/api';
import type {
  CancellationReason,
  Page,
  Ride,
  RidePoint,
  RideFareBreakdown,
  RideHistoryFilter,
  RidePerson,
  RideStatus,
  RideStop,
  RideVehicle,
} from './types';

/**
 * Ride history and one ride (T-501, BE-01; docs/api/CONTRACT_NOTES.md):
 * - GET /rides?page&per_page&status -> data: RideResource[], pagination (scoped to the token user)
 * - GET /rides/{id}                 -> data: RideResource (403 FORBIDDEN when not a participant)
 * All through the shared axios client; failures are ApiErrors.
 */

export const RIDES_PAGE_SIZE = 20;

const STATUSES: ReadonlyArray<RideStatus> = ['requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled'];
const REASONS: ReadonlyArray<CancellationReason> = ['passenger', 'driver', 'system', 'weather', 'no_driver', 'other'];

const chargeReasonOf = (value: unknown): 'late_cancel' | 'no_show' | null =>
  value === 'late_cancel' || value === 'no_show' ? value : null;

const positiveOrNull = (value: unknown): number | null => {
  const n = readNumberOrNull(value);
  return n !== null && n > 0 ? n : null;
};

/** API status words to app statuses; legacy `ongoing` reads as `started`. */
const toStatus = (value: unknown): RideStatus => (value === 'ongoing' ? 'started' : readOneOf(value, STATUSES, 'requested'));

/**
 * The other party's card. The phone the server may add is deliberately not read.
 * [T-519] The name goes through the shared `firstNameOf`, like the live ride card and the
 * after-ride sheet, so a person reads the same (first name only) everywhere.
 */
const toPerson = (raw: unknown): RidePerson | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  return {
    id,
    name: firstNameOf(readText(raw.first_name) ?? readText(raw.name)),
    profileImageUrl: readText(raw.profile_image_url),
    rating: readNumberOrNull(raw.rating),
  };
};

const toVehicle = (raw: unknown): RideVehicle | null => {
  if (!isRecord(raw)) return null;
  const vehicle = {
    make: readText(raw.make),
    model: readText(raw.model),
    color: readText(raw.color),
    licensePlate: readText(raw.license_plate),
  };
  return Object.values(vehicle).some(Boolean) ? vehicle : null;
};

const toBreakdown = (raw: unknown): RideFareBreakdown | null => {
  if (!isRecord(raw)) return null;
  return {
    base: readNumber(raw.base),
    distance: readNumber(raw.distance),
    time: readNumber(raw.time),
    stops: readNumber(raw.stops),
    minFareAdjustment: readNumber(raw.min_fare_adjustment),
    ...fareExtrasOf(raw),
    total: readNumber(raw.total),
  };
};

const toStop = (raw: unknown): RideStop | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  const address = readText(raw.address);
  if (id === null || address === null) return null;
  return { id, address, order: readNumber(raw.stop_order), status: readText(raw.status) };
};

const toStops = (raw: unknown): RideStop[] =>
  (Array.isArray(raw) ? raw : [])
    .map(toStop)
    .filter((stop): stop is RideStop => stop !== null)
    .sort((a, b) => a.order - b.order);

/** A valid latitude/longitude pair (numbers or numeric strings), else null; 0,0 counts as absent. */
const pointOf = (lat: unknown, lng: unknown): RidePoint | null => {
  const latitude = readNumberOrNull(lat);
  const longitude = readNumberOrNull(lng);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  return { latitude, longitude };
};

/** One RideResource; null without a usable id. */
export const toRide = (raw: unknown): Ride | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  if (id === null) return null;
  const reason = readText(raw.cancellation_reason);
  const rating = toRideRatingState(raw);
  return {
    id,
    rideCode: readText(raw.ride_id),
    status: toStatus(raw.status),
    passengerId: readId(raw.passenger_id),
    driverId: readId(raw.driver_id),
    pickupAddress: readText(raw.pickup_address) ?? '',
    dropoffAddress: readText(raw.dropoff_address) ?? '',
    pickupLocation: pointOf(raw.pickup_latitude, raw.pickup_longitude),
    dropoffLocation: pointOf(raw.dropoff_latitude, raw.dropoff_longitude),
    stops: toStops(raw.stops),
    vehicleType: readText(raw.vehicle_type),
    totalFare: readNumber(raw.total_fare),
    fareBreakdown: toBreakdown(raw.fare_breakdown),
    driverEarnings: readNumberOrNull(raw.driver_earnings),
    platformCommission: readNumberOrNull(raw.platform_commission),
    distanceKm: readNumberOrNull(raw.distance_km),
    durationMinutes: readNumberOrNull(raw.duration_minutes),
    quotedDistanceKm: readNumberOrNull(raw.quoted_distance_km),
    quotedDurationMinutes: readNumberOrNull(raw.quoted_duration_minutes),
    // Cash only (B-08): a ride without a method was paid in cash.
    paymentMethod: readText(raw.payment_method) ?? 'cash',
    paymentStatus: readText(raw.payment_status),
    passenger: toPerson(raw.passenger),
    driver: toPerson(raw.driver),
    vehicle: toVehicle(raw.vehicle),
    requestedAt: readText(raw.requested_at),
    acceptedAt: readText(raw.accepted_at),
    arrivedAt: readText(raw.arrived_at),
    startedAt: readText(raw.started_at),
    completedAt: readText(raw.completed_at),
    cancelledAt: readText(raw.cancelled_at),
    cancellationReason: reason ? readOneOf(reason, REASONS, 'other') : null,
    cancellationNote: readText(raw.cancellation_note),
    createdAt: readText(raw.created_at),
    myRating: rating.myRating,
    canRate: rating.canRate,
    fareLock: fareLockOf(raw),
    cancellationFee: positiveOrNull(raw.cancellation_fee),
    cancellationChargeReason: chargeReasonOf(raw.cancellation_charge_reason),
    overcharge: toOverchargeState(raw.overcharge_report),
    split: driverSplitOf(raw),
    isAc: isAcRide(raw),
    acReport: toAcReportState(raw.ac_report),
    safetyReport: toSafetyReportState(raw.safety_report),
    parcel: isParcelRide(raw) ? toParcelView(raw.parcel) : null,
  };
};

export const toRideList = (raw: unknown): Ride[] =>
  (Array.isArray(raw) ? raw : []).map(toRide).filter((ride): ride is Ride => ride !== null);

const toPage = <T>(items: T[], pagination: Pagination | undefined, page: number): Page<T> => ({
  items,
  page: pagination?.current_page ?? page,
  lastPage: pagination?.last_page ?? page,
  total: pagination?.total ?? items.length,
});

export interface RideHistoryQuery {
  page: number;
  filter?: RideHistoryFilter;
  perPage?: number;
}

export const rideHistoryApi = {
  async listRides({ page, filter = 'all', perPage = RIDES_PAGE_SIZE }: RideHistoryQuery): Promise<Page<Ride>> {
    const params: Record<string, string | number> = { page, per_page: perPage };
    if (filter !== 'all') params.status = filter;
    const body = await apiService.get<unknown>('/rides', { params });
    return toPage(toRideList(unwrap(body)), body.pagination, page);
  },

  async getRide(id: number): Promise<Ride | null> {
    return toRide(unwrap(await apiService.get<unknown>(`/rides/${id}`)));
  },
};
