import { apiService, unwrap } from '../../services/api';
import type { RideResource } from '../../services/rideService';

/**
 * Incoming ride requests for the signed-in driver (T-403/T-404, docs/api/CONTRACT_NOTES.md).
 *
 * - GET /rides/pending (BE-02): the driver comes from the token (no `driver_id`). Optional
 *   `latitude`/`longitude` are a fallback the server uses only when it has no ping from the
 *   last 5 minutes. 200 `data: RideResource[]` plus `estimated_distance` (km, driver to pickup),
 *   `estimated_pickup_min` and `estimated_fare`; `meta.max_age_minutes` is how long a request
 *   stays listed. 409 `error.code` DRIVER_NOT_AVAILABLE / DRIVER_ON_RIDE / NO_APPROVED_VEHICLE,
 *   422 `code` LOCATION_REQUIRED, 429 `rate_limited` with `retry_after` (30 polls a minute).
 * - POST /rides/{id}/assign-driver (BE-03): no body, atomic accept. 200 `data: RideResource`
 *   (with vehicle and accepted_at). 409 RIDE_ALREADY_ACCEPTED / RIDE_NOT_AVAILABLE /
 *   DRIVER_ON_RIDE / DRIVER_NOT_AVAILABLE / NO_APPROVED_VEHICLE, 403 PHONE_NOT_VERIFIED.
 *
 * There is no reject endpoint: a rejected request is hidden on this device until it expires.
 */
export const PENDING_RIDES_CODES = {
  driverNotAvailable: 'DRIVER_NOT_AVAILABLE',
  driverOnRide: 'DRIVER_ON_RIDE',
  noApprovedVehicle: 'NO_APPROVED_VEHICLE',
  locationRequired: 'LOCATION_REQUIRED',
} as const;

export const ACCEPT_RIDE_CODES = {
  alreadyAccepted: 'RIDE_ALREADY_ACCEPTED',
  notAvailable: 'RIDE_NOT_AVAILABLE',
  driverOnRide: 'DRIVER_ON_RIDE',
  driverNotAvailable: 'DRIVER_NOT_AVAILABLE',
  noApprovedVehicle: 'NO_APPROVED_VEHICLE',
  phoneNotVerified: 'PHONE_NOT_VERIFIED',
} as const;

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** One request as the card shows it. Numbers the server did not send are null (never invented). */
export interface PendingRideRequest {
  id: number;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  /** The minimal passenger card: first name and rating only (no phone before accept). */
  passengerFirstName: string | null;
  passengerRating: number | null;
  /** km from the driver to the pickup. */
  estimatedDistanceKm: number | null;
  estimatedPickupMin: number | null;
  estimatedFare: number | null;
  paymentMethod: string | null;
  vehicleType: string | null;
  /** Epoch ms after which the server stops listing it; null when the server gave no time. */
  expiresAt: number | null;
}

export interface PendingRidesPage {
  requests: PendingRideRequest[];
}

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Laravel `decimal:*` casts arrive as strings ("350.00"). */
const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const toLatLng = (lat: unknown, lng: unknown): LatLng | null => {
  const latitude = toNumber(lat);
  const longitude = toNumber(lng);
  return latitude === null || longitude === null ? null : { latitude, longitude };
};

const toTime = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * One `data[]` entry as a PendingRideRequest, or null when it lacks an id or an address.
 * `expiresAt` is `requested_at` (or `created_at`) plus `meta.max_age_minutes`, the window
 * in which the server keeps listing it.
 */
export const toPendingRideRequest = (
  raw: unknown,
  maxAgeMinutes: number | null,
): PendingRideRequest | null => {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const pickupAddress = toText(raw.pickup_address);
  const dropoffAddress = toText(raw.dropoff_address);
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || !pickupAddress || !dropoffAddress) {
    return null;
  }
  const passenger = isRecord(raw.passenger) ? raw.passenger : {};
  const requestedAt = toTime(raw.requested_at) ?? toTime(raw.created_at);
  return {
    id,
    pickupAddress,
    dropoffAddress,
    pickup: toLatLng(raw.pickup_latitude, raw.pickup_longitude),
    dropoff: toLatLng(raw.dropoff_latitude, raw.dropoff_longitude),
    passengerFirstName: toText(passenger.first_name) ?? toText(passenger.name),
    passengerRating: toNumber(passenger.rating),
    estimatedDistanceKm: toNumber(raw.estimated_distance),
    estimatedPickupMin: toNumber(raw.estimated_pickup_min),
    estimatedFare: toNumber(raw.estimated_fare),
    paymentMethod: toText(raw.payment_method),
    vehicleType: toText(raw.vehicle_type),
    expiresAt:
      requestedAt !== null && maxAgeMinutes !== null ? requestedAt + maxAgeMinutes * 60_000 : null,
  };
};

/** The whole 200 body (data plus meta) as a PendingRidesPage. */
export const toPendingRidesPage = (body: unknown): PendingRidesPage => {
  const envelope = isRecord(body) ? body : {};
  const meta = isRecord(envelope.meta) ? envelope.meta : {};
  const maxAge = toNumber(meta.max_age_minutes);
  const maxAgeMinutes = maxAge !== null && maxAge > 0 ? maxAge : null;
  const data = Array.isArray(envelope.data) ? envelope.data : [];
  return {
    requests: data
      .map((item) => toPendingRideRequest(item, maxAgeMinutes))
      .filter((item): item is PendingRideRequest => item !== null),
  };
};

export const driverRequestsApi = {
  /** GET /rides/pending with the device location as the documented fallback. */
  async listPending(location: LatLng | null): Promise<PendingRidesPage> {
    const params = location ? { latitude: location.latitude, longitude: location.longitude } : undefined;
    const body = await apiService.get<unknown>('/rides/pending', params ? { params } : undefined);
    // unwrap() throws on a `success: false` 2xx; the page keeps `meta`, so it reads the body.
    unwrap(body);
    return toPendingRidesPage(body);
  },

  /** POST /rides/{id}/assign-driver. No body: the driver is the token's user. */
  async accept(rideId: number): Promise<RideResource> {
    return unwrap(await apiService.post<RideResource>(`/rides/${rideId}/assign-driver`));
  },
};
