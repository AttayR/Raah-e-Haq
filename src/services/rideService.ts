import apiService, { createCancellableRequest, removeRequest } from './api';
import { isApiError, unwrap } from '../core/api/errors';
import type { ApiResponse, Pagination } from '../core/api/types';
import { logger } from '../core/logging/logger';
import { logApiFailure } from '../core/api/logApiFailure';

export interface RideLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

/** BE-04 / BE-114 `cancellation_reason` values the app reads; an admin may store another word. */
export type RideCancellationReason = 'passenger' | 'driver' | 'system' | 'weather' | 'no_driver' | (string & Record<never, never>);

/**
 * Body of POST /rides (BE-01/BE-37/BE-58). The passenger is the token user, so there is no
 * `passenger_id`; `vehicle_type` is a catalogue key (GET /public/vehicle-types). Build it
 * with features/ride-booking/buildRideRequest, never by hand.
 */
export interface RideRequest {
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  vehicle_type: VehicleTypeKey;
  passenger_count?: number;
  special_instructions?: string;
  stops?: RideStopRequest[];
  /** BE-83: the passenger's offer in whole rupees, inside the estimate's `offer_band`. */
  offered_fare?: number;
  /** BE-87: match only verified female drivers (female passengers whose profile allows it). */
  female_driver_only?: boolean;
  /** BE-88: with vehicle_type `parcel` only (no stops, no offer). */
  parcel?: ParcelRequestBlock;
}

/** POST /rides `parcel` (BE-88): the receiver, the item and the sender's declaration. */
export interface ParcelRequestBlock {
  receiver_name: string;
  /** E.164 (`+923001234567`); the server normalises a local number too. */
  receiver_phone: string;
  item_category: string;
  size_class: string;
  /** Whole rupees, at most the options' `max_declared_value`. */
  declared_value: number;
  declaration_accepted: true;
  item_description?: string;
  /** The `rules_version` of the options the sender read. */
  rules_version: string;
}

export interface RideStopRequest {
  address: string;
  latitude: number;
  longitude: number;
  stop_order: number;
}

export interface RideUpdate {
  status?: 'requested' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
  driver_id?: number;
  fare?: number;
  distance_km?: number;
  duration_min?: number;
}

/** BE-128 `eta` on RideResource. */
export interface RideEta {
  minutes: number;
  distance_km: number;
  target: 'pickup' | 'dropoff';
  updated_at: string;
}

export interface RideResource {
  id: number;
  ride_id: string;
  passenger_id: number;
  driver_id?: number;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  status: 'requested' | 'accepted' | 'arrived' | 'started' | 'ongoing' | 'completed' | 'cancelled';
  vehicle_type: string;
  passenger_count: number;
  special_instructions?: string;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  total_fare: number;
  /**
   * BE-05: the parts of total_fare (decimal numbers or strings); null for legacy rows that only
   * have a total. Read it with features/driver-ride/steps toRideSummary, never by hand.
   */
  fare_breakdown?: RideFareBreakdown | null;
  driver_earnings: number;
  platform_commission: number;
  distance_km?: number;
  duration_minutes?: number;
  payment_method: string;
  payment_status: string;
  stops: RideStopResource[];
  current_stop_index: number;
  active_stops_count: number;
  completed_stops_count: number;
  /** Deprecated (BE-128): not an ETA; never shown. Use `eta`. */
  estimated_arrival?: string;
  /**
   * BE-128: the server's ETA for the ride's passenger and assigned driver while accepted /
   * arrived (target pickup) or started (target drop-off); null otherwise or when the driver's
   * location is stale; absent for anyone else.
   */
  eta?: RideEta | null;
  created_at: string;
  updated_at: string;
  /** BE-78: never a phone number (calls go through POST /rides/{id}/call). */
  passenger?: {
    id: number;
    name: string;
    profile_image_url?: string | null;
    /** BE-07: null until the passenger has 3 ratings (show "New"). */
    rating?: number | null;
  };
  /** Non-admin viewers get a minimal card (BE-20); BE-78: never a phone number. */
  driver?: {
    id: number;
    name: string;
    profile_image_url?: string | null;
    /** BE-07: null until the driver has 3 ratings (show "New"). */
    rating?: number | null;
    vehicle_type?: string | null;
  };
  /** The assigned vehicle as non-admin viewers get it (BE-01 RideResource::vehicleFor). */
  vehicle?: {
    id: number;
    vehicle_type?: string | null;
    make?: string | null;
    model?: string | null;
    color?: string | null;
    license_plate?: string | null;
  } | null;
  /** BE-05: the minimum-fare top-up included in total_fare. */
  min_fare_adjustment?: number | string | null;
  requested_at: string;
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  /**
   * Who cancelled (`passenger`, `driver`, `system`, `weather`), BE-114 `no_driver` (an unanswered
   * request the server expired: no fee), or an admin's own reason.
   */
  cancellation_reason?: RideCancellationReason | null;
  /** The free-text note given on cancel (a driver must give one, BE-04). */
  cancellation_note?: string | null;
  /** BE-07: the caller's own rating of this ride, or null. Read with features/rating/api. */
  my_rating?: RideMyRating | null;
  /** BE-07: the caller may still rate this ride (completed, within the window, not rated yet). */
  can_rate?: boolean;
  /**
   * BE-78: what the caller may do to reach the other party (null for anyone but the ride's
   * passenger and assigned driver). Read it with features/safety/contact rideContactOf.
   */
  contact?: RideContactWire | null;
  /** BE-81: the 4-digit start PIN, for the passenger only, while accepted/arrived and required. */
  pin?: string;
  /** BE-81: the driver's start needs the PIN now. */
  pin_required?: boolean;
  /** BE-81: the start is blocked until an admin clears it (the driver contacts support). */
  pin_blocked?: boolean;
  /**
   * BE-60 / BE-82..85 (T-521). Read these through features/fare/api (decimals arrive as strings),
   * never by hand. Passenger-only and driver-only keys are absent for the other side.
   */
  booking_fee?: number | string | null;
  server_fare?: number | string | null;
  offered_fare?: number | string | null;
  is_offer?: boolean;
  fare_locked?: boolean;
  accepted_fare?: number | string | null;
  fare_locked_at?: string | null;
  /**
   * BE-103: the booking quote's km (a decimal string) and minutes, kept after completion; null on
   * rides completed before BE-103. A locked fare charged these, not the trip as driven.
   */
  quoted_distance_km?: number | string | null;
  quoted_duration_minutes?: number | null;
  waiting_minutes?: number | null;
  waiting_fee?: number | string | null;
  arrival_verified?: boolean;
  /** While the ride is requested or active (BE-85). */
  fare_policy?: unknown;
  /** Passenger only, while the ride can be cancelled (BE-85). */
  cancellation_preview?: unknown;
  /** Driver only: when "Passenger didn't come" may be used (BE-85). */
  no_show_cancel_at?: string | null;
  /** BE-109, the ride's driver only: the no-show fee a cancel would charge now; null unless arrived. */
  no_show_preview?: NoShowPreviewWire | null;
  cancellation_fee?: number | string | null;
  cancellation_charge_reason?: string | null;
  /** How often a driver cancel put the ride back in the queue (BE-85 re-matching). */
  requeue_count?: number | null;
  /** Passenger only (BE-82). */
  overcharge_report?: unknown;
  /** BE-86: an AC-tier ride (vehicle_type car_ac); read through features/ac/api. */
  is_ac?: boolean;
  /** BE-86, passenger only, AC rides: `{can_report, report}` ("AC not working"). */
  ac_report?: unknown;
  /** BE-87, passenger only: the ride asked for a female driver. Drivers never get these. */
  female_driver_only?: boolean;
  /** BE-87, passenger only: the women-mode block (read through features/women-mode/api). */
  women_mode?: unknown;
  /**
   * BE-116 (T-587), passenger only, while `requested`: `{sent, viewing}` counts of the request's
   * reach (null counts in women mode). Read through features/active-ride/reach, never by hand.
   */
  reach?: unknown;
  /**
   * BE-136, the ride's passenger and assigned driver only: unread messages from the other party
   * in the current chat thread (0 with no driver or after the chat expired). Absent for admins
   * and in the driver request feed. Read through features/chat/rideUnread, never by hand.
   */
  chat?: RideChatWire | null;
  /** BE-105, passenger only: `{can_report, report}` (read through features/women-mode/api). */
  safety_report?: unknown;
  /** BE-88: a parcel delivery (vehicle_type parcel). */
  is_parcel?: boolean;
  /** BE-88: the parcel block for this viewer; read it through features/parcel/api, never by hand. */
  parcel?: unknown;
  /** BE-84, the ride's driver only. */
  fare?: number | string | null;
  commission_rate?: number | string | null;
  commission_amount?: number | string | null;
  driver_net?: number | string | null;
  commission_final?: boolean;
}

/** RideResource.no_show_preview (BE-109): read it through features/driver-ride/noShow. */
export interface NoShowPreviewWire {
  fee?: number | string;
  fee_applies?: boolean;
  capped?: boolean;
  verified?: boolean;
  cancel_at?: string | null;
}

/** RideResource.chat as the server sends it (BE-136). */
export interface RideChatWire {
  unread_count?: number | string | null;
}

/** RideResource.contact as the server sends it (BE-78). */
export interface RideContactWire {
  can_chat?: boolean;
  can_call?: boolean;
  call_mode?: string;
  closes_at?: string | null;
}

/** RideResource.my_rating (BE-07). */
export interface RideMyRating {
  stars: number;
  tags: string[];
  comment: string | null;
  created_at: string | null;
}

/** RideResource.fare_breakdown (BE-05): the same keys as POST /rides/estimate. */
export interface RideFareBreakdown {
  base: number | string;
  distance: number | string;
  time: number | string;
  stops: number | string;
  min_fare_adjustment: number | string;
  /** BE-60 / BE-83 / BE-85 parts (absent on older rides); they still add up to `total`. */
  booking_fee?: number | string;
  offer_adjustment?: number | string;
  waiting?: number | string;
  total: number | string;
}

export interface RideStopResource {
  id: number;
  ride_id: number;
  address: string;
  latitude: number;
  longitude: number;
  stop_order: number;
  status: 'active' | 'completed' | 'cancelled' | 'skipped';
  status_label: string;
  status_color: string;
  arrived_at?: string;
  completed_at?: string;
  notes?: string;
  estimated_arrival?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedRides {
  data: RideResource[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}


export type DriverLocationStatus = 'online' | 'available' | 'busy' | 'offline';

/**
 * A driver's latest position, as returned by GET /tracking/driver/{id}/latest.
 * Non-admin callers get only these fields (BE-20, DriverPrivacy::PUBLIC_LOCATION_FIELDS).
 * The server sends latitude/longitude/heading as decimal strings; getDriverLocation returns numbers.
 */
export interface DriverLocation {
  driver_id: number;
  latitude: number;
  longitude: number;
  heading?: number | null;
  status: DriverLocationStatus;
  last_seen_at: string;
}

/** Wire shape of the latest-location body (Laravel `decimal:8` casts serialise as strings). */
interface DriverLocationWire {
  driver_id: number;
  latitude: number | string;
  longitude: number | string;
  heading?: number | string | null;
  status: DriverLocationStatus;
  last_seen_at: string;
}

/**
 * GET /tracking/driver/{id}/latest during a ride: the position, or `available: false` when the
 * server refuses it (403 outside an accepted, still-active ride) or the driver has not sent one.
 */
export type RideDriverLocation =
  | { available: true; location: DriverLocation }
  | { available: false };

/**
 * Body of POST /tracking/update-location (BE-06). Never `driver_id` or `status`: the server
 * takes the driver from the token and ignores a body status. The driver app posts through
 * features/driver-location (T-402).
 */
export interface LocationUpdate {
  latitude: number;
  longitude: number;
  address?: string;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
}

/**
 * The ride types the server accepts (BE-58 enum, GET /public/vehicle-types). BE-86: `car_ac` is a
 * ride tier served by an AC-approved car, listed only while an admin has it active; a vehicle
 * itself is never `car_ac` (registration keeps its own list of vehicle kinds). BE-88: `parcel`
 * is a parcel delivery by bike, booked from "Send a parcel", never from the ride vehicle list.
 */
export const VEHICLE_TYPE_KEYS = ['car', 'bike', 'rickshaw', 'van', 'car_ac', 'parcel'] as const;
export type VehicleTypeKey = (typeof VEHICLE_TYPE_KEYS)[number];
export const isVehicleTypeKey = (value: unknown): value is VehicleTypeKey =>
  typeof value === 'string' && (VEHICLE_TYPE_KEYS as ReadonlyArray<string>).includes(value);

export type NearbyVehicleType = VehicleTypeKey;

/** Radius bounds of GET /rides/nearby-drivers (BE-20, DriverPrivacy::MAX_NEARBY_RADIUS_KM). */
export const NEARBY_MIN_RADIUS_KM = 1;
export const NEARBY_MAX_RADIUS_KM = 10;
export const NEARBY_DEFAULT_RADIUS_KM = 5;

/**
 * BE-118 (SEC-31): how a nearby marker's position was made. `fine`: the driver's position 45 s
 * ago rounded to ~55 m (moving drivers only); `coarse`: the ~550 m grid, refreshed every 2 minutes.
 */
export type NearbyPrecision = 'fine' | 'coarse';

/**
 * One entry of GET /rides/nearby-drivers (BE-20). No name, phone or user id: `id` is an opaque
 * string bound to the viewer, used only as a list/marker key. It changes at least hourly, at a
 * new driver session and on every coarse/hidden → fine switch (BE-118): a new id is a new marker.
 * BE-118 sends `rating` as 0 on every marker; the app does not read it (T-590).
 */
export interface NearbyDriver {
  id: string;
  /** BE-118: `coarse` when absent (older server) or unknown. */
  precision?: NearbyPrecision;
  /** BE-58: null when the driver has no (known) vehicle type; never guessed as car. */
  vehicle_type: VehicleTypeKey | null;
  distance_km: number;
  estimated_arrival_min: number;
  location: {
    latitude: number;
    longitude: number;
  };
  /**
   * BE-76: degrees clockwise from north (15° steps), or null when the driver is standing, sent
   * no heading, or the ping is stale. Null keeps the marker's last rotation (T-524).
   */
  heading: number | null;
  /**
   * BE-116 (T-586): the ride tiers this driver can serve (an AC-approved car serves `car` and
   * `car_ac`; an opted-in bike `bike` and `parcel`). Absent on older servers: the map then
   * falls back to `vehicle_type`.
   */
  tiers?: VehicleTypeKey[];
}

/** BE-116 (T-586): server counts within the query radius (never the number of markers drawn). */
export interface NearbyCounts {
  byTier: Partial<Record<VehicleTypeKey, number>>;
  onlineTotal: number | null;
}

/** GET /rides/nearby-drivers: the list, plus the BE-116 counts when the server sends them. */
export interface NearbyDriversResult {
  drivers: NearbyDriver[];
  counts: NearbyCounts | null;
  /**
   * BE-119 `meta.fine_epoch`: names the fine-path answer this list is. A requested ride's
   * `reach.sent_ids` / `viewing_ids` refer to these markers only while `reach.epoch` equals it.
   * Null when absent (older server) or when the answer has no fine markers.
   */
  fineEpoch?: string | null;
}

export interface NearbyDriversQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  vehicleType?: NearbyVehicleType;
}

/** Ride statuses during which the passenger may see the driver's position (BE-20). */
export const ACTIVE_RIDE_STATUSES: ReadonlyArray<string> = ['accepted', 'arrived', 'started', 'ongoing'];

export const isRideActive = (ride: Pick<RideResource, 'status'> | null | undefined): boolean =>
  !!ride && ACTIVE_RIDE_STATUSES.includes(ride.status);

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const normalizeDriverLocation = (raw: DriverLocationWire | null | undefined): DriverLocation | null => {
  if (!raw || typeof raw !== 'object') return null;
  const latitude = toNumber(raw.latitude);
  const longitude = toNumber(raw.longitude);
  if (latitude === null || longitude === null) return null;
  return {
    driver_id: raw.driver_id,
    latitude,
    longitude,
    heading: toNumber(raw.heading),
    status: raw.status,
    last_seen_at: raw.last_seen_at,
  };
};

const normalizeNearbyDriver = (raw: unknown): NearbyDriver | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const location = (item.location ?? {}) as Record<string, unknown>;
  const latitude = toNumber(location.latitude);
  const longitude = toNumber(location.longitude);
  if (typeof item.id !== 'string' || item.id === '' || latitude === null || longitude === null) {
    return null;
  }
  return {
    id: item.id,
    precision: item.precision === 'fine' ? 'fine' : 'coarse',
    vehicle_type: isVehicleTypeKey(item.vehicle_type) ? item.vehicle_type : null,
    distance_km: toNumber(item.distance_km) ?? 0,
    estimated_arrival_min: toNumber(item.estimated_arrival_min) ?? 0,
    location: { latitude, longitude },
    heading: nearbyHeading(item.heading),
    ...(Array.isArray(item.tiers) ? { tiers: item.tiers.filter(isVehicleTypeKey) } : null),
  };
};

/**
 * BE-116 `counts: {by_tier: {<tier>: n}, online_total: n}`, at the top of the body, in `meta`, or
 * inside `data` when `data` is an object; null when absent or malformed (older backend).
 */
const normalizeNearbyCounts = (raw: unknown): NearbyCounts | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const byTierRaw = item.by_tier && typeof item.by_tier === 'object' ? (item.by_tier as Record<string, unknown>) : null;
  const onlineTotal = toNumber(item.online_total);
  if (!byTierRaw && onlineTotal === null) return null;
  const byTier: Partial<Record<VehicleTypeKey, number>> = {};
  if (byTierRaw) {
    for (const [key, value] of Object.entries(byTierRaw)) {
      const n = toNumber(value);
      if (isVehicleTypeKey(key) && n !== null && n >= 0) byTier[key] = Math.floor(n);
    }
  }
  return { byTier, onlineTotal: onlineTotal !== null && onlineTotal >= 0 ? Math.floor(onlineTotal) : null };
};

/** Splits a nearby-drivers body into the list and the counts (see normalizeNearbyCounts). */
const normalizeNearbyResult = (body: ApiResponse<unknown>): NearbyDriversResult => {
  const data = unwrap(body);
  const envelope: Record<string, unknown> = { ...body };
  const meta = envelope.meta && typeof envelope.meta === 'object' ? (envelope.meta as Record<string, unknown>) : null;
  let list: unknown = data;
  let counts = normalizeNearbyCounts(envelope.counts) ?? normalizeNearbyCounts(meta?.counts);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>;
    list = inner.drivers;
    counts = counts ?? normalizeNearbyCounts(inner.counts);
  }
  const drivers = Array.isArray(list) ? list.map(normalizeNearbyDriver).filter((d): d is NearbyDriver => d !== null) : [];
  const epoch = meta?.fine_epoch;
  return { drivers, counts, fineEpoch: typeof epoch === 'string' && epoch !== '' ? epoch : null };
};

/** BE-76 heading as 0..360, or null (missing, not a number, negative). */
const nearbyHeading = (value: unknown): number | null => {
  const n = toNumber(value);
  return n === null || n < 0 ? null : n % 360;
};

const clampRadius = (radiusKm: number | undefined): number => {
  const r = typeof radiusKm === 'number' && Number.isFinite(radiusKm) ? radiusKm : NEARBY_DEFAULT_RADIUS_KM;
  return Math.min(NEARBY_MAX_RADIUS_KM, Math.max(NEARBY_MIN_RADIUS_KM, r));
};

/** data of POST /rides/{id}/stops, DELETE /rides/{id}/stops/{stop} and PUT /rides/{id}/stops/reorder. */
export interface RideStopsUpdate {
  id: number;
  stops: RideStopResource[];
  updated_fare: number;
  updated_distance: string;
  updated_duration: string;
}

export interface NotificationResource {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WebSocketSubscription {
  ride_id: number;
  user_type: 'passenger' | 'driver';
  websocket_url: string;
  channels: string[];
}

export interface DriverRequestSubscription {
  driver_id: number;
  websocket_url: string;
  channels: string[];
}

const emptyPage = (): PaginatedRides => ({ data: [], current_page: 1, last_page: 1, per_page: 0, total: 0 });

class RideService {
  private baseUrl = '/rides';
  private trackingUrl = '/tracking';
  private notificationsUrl = '/notifications';
  private websocketUrl = '/websocket';

  // Create a new ride request with stops support
  /**
   * `idempotencyKey` (UI-R10, for BE-113): one key per Request tap, reused if that same attempt is
   * sent again, so the server can answer a repeat with the ride it already created.
   */
  async createRide(rideData: RideRequest, options: { idempotencyKey?: string } = {}): Promise<RideResource> {
    const cancelSource = createCancellableRequest();

    try {
      logger.debug('Creating ride request:', rideData.vehicle_type);

      // Validate required fields (the passenger comes from the token, BE-01)
      if (!rideData.pickup_latitude || !rideData.pickup_longitude) {
        throw new Error('Pickup coordinates are required');
      }
      if (!rideData.dropoff_latitude || !rideData.dropoff_longitude) {
        throw new Error('Dropoff coordinates are required');
      }

      const body = await apiService.post<RideResource>(`${this.baseUrl}`, rideData, {
        cancelToken: cancelSource.token,
        ...(options.idempotencyKey ? { headers: { 'Idempotency-Key': options.idempotencyKey } } : {}),
      });
      const ride = unwrap(body);
      logger.debug('Ride created successfully:', ride.id);
      return ride;
    } catch (error) {
      if (isApiError(error) && error.kind === 'cancelled') {
        logger.debug('Ride creation cancelled');
      } else {
        // Refusals (422, 403 PHONE_NOT_VERIFIED) are warnings, not a red LogBox (PAX-23).
        logApiFailure('Failed to create ride', error);
      }
      // ApiError (from the axios interceptor) carries kind, status, message and fieldErrors.
      throw error;
    } finally {
      removeRequest(cancelSource);
    }
  }

  // Get rides (GET /rides: { success, data: RideResource[], pagination }).
  // The server scopes the list to the signed-in passenger or driver.
  async getRides(params?: {
    page?: number;
    status?: string;
    passenger_id?: number;
    driver_id?: number;
  }): Promise<PaginatedRides> {
    try {
      logger.debug('Fetching rides:', params);
      const body = await apiService.get<RideResource[]>(`${this.baseUrl}`, { params });
      const rides = unwrap(body);
      if (!Array.isArray(rides)) {
        return emptyPage();
      }
      const pagination: Pagination = body.pagination ?? {
        current_page: 1,
        last_page: 1,
        per_page: rides.length,
        total: rides.length,
      };
      logger.debug('Rides fetched successfully:', rides.length);
      return { ...pagination, data: rides };
    } catch (error) {
      // T-581: a summary, never an empty line; a refused account (403 ACCOUNT_*) is not an error.
      logApiFailure('Failed to fetch rides', error);
      throw error;
    }
  }

  // Get a specific ride by ID
  async getRide(rideId: number): Promise<RideResource> {
    try {
      logger.debug('Fetching ride:', rideId);
      return unwrap(await apiService.get<RideResource>(`${this.baseUrl}/${rideId}`));
    } catch (error) {
      logApiFailure('Failed to fetch ride', error);
      throw error;
    }
  }

  // Update ride status and details
  async updateRide(rideId: number, updateData: RideUpdate): Promise<RideResource> {
    try {
      logger.debug('Updating ride:', rideId, updateData);
      return unwrap(await apiService.put<RideResource>(`${this.baseUrl}/${rideId}`, updateData));
    } catch (error) {
      logger.error('Failed to update ride:', error);
      throw error;
    }
  }

  // Delete a ride
  async deleteRide(rideId: number): Promise<void> {
    try {
      logger.debug('Deleting ride:', rideId);
      await apiService.delete(`${this.baseUrl}/${rideId}`);
      logger.debug('Ride deleted successfully');
    } catch (error) {
      logger.error('Failed to delete ride:', error);
      throw error;
    }
  }

  // The signed-in driver takes a ride (BE-03): no body, the driver is the token's user.
  // The driver app accepts through features/driver-requests (T-404).
  async assignDriver(rideId: number): Promise<RideResource> {
    try {
      logger.debug('Assigning driver:', rideId);
      return unwrap(await apiService.post<RideResource>(`${this.baseUrl}/${rideId}/assign-driver`));
    } catch (error) {
      logger.error('Failed to assign driver:', error);
      throw error;
    }
  }

  // Cancel a ride
  async cancelRide(rideId: number): Promise<RideResource> {
    try {
      logger.debug('Cancelling ride:', rideId);
      return unwrap(await apiService.post<RideResource>(`${this.baseUrl}/${rideId}/cancel`));
    } catch (error) {
      // T-589: the screen shows "Couldn't cancel. Try again."; offline, a 409 (the ride moved on)
      // and other expected refusals log at debug, not a red Debug LogBox. A 5xx is still an error.
      logApiFailure('Failed to cancel ride', error);
      throw error;
    }
  }

  // Driver accepts a ride: the atomic POST /rides/{id}/assign-driver (T-404), not a PUT.
  async acceptRide(rideId: number): Promise<RideResource> {
    try {
      logger.debug('Driver accepting ride:', rideId);
      const response = await this.assignDriver(rideId);
      logger.debug('Ride accepted successfully:', response.id);
      return response;
    } catch (error) {
      logger.error('Failed to accept ride:', error);
      throw error;
    }
  }

  // Get latest driver location (GET /tracking/driver/{id}/latest).
  // 403 unless the caller is that driver, an admin, or the passenger of an active ride with them (BE-20).
  // data is null when the driver has not sent a location yet.
  async getDriverLocation(driverId: number): Promise<DriverLocation | null> {
    try {
      logger.debug('Fetching driver location:', driverId);
      return normalizeDriverLocation(
        unwrap(await apiService.get<DriverLocationWire | null>(`${this.trackingUrl}/driver/${driverId}/latest`)),
      );
    } catch (error) {
      logApiFailure('Failed to fetch driver location', error);
      throw error;
    }
  }

  /**
   * The assigned driver's position for the passenger's ride (GET /rides/{id}/driver-location,
   * BE-06). Never calls the server unless the ride is active and has a driver; `data: null`
   * (no fresh position, ride not active) and a 403 are "not available", not an error.
   */
  async getDriverLocationForRide(ride: RideResource | null | undefined): Promise<RideDriverLocation> {
    if (!ride || !isRideActive(ride) || typeof ride.driver_id !== 'number') {
      return { available: false };
    }
    try {
      const location = normalizeDriverLocation(
        unwrap(await apiService.get<DriverLocationWire | null>(`${this.baseUrl}/${ride.id}/driver-location`)),
      );
      return location ? { available: true, location } : { available: false };
    } catch (error) {
      if (isApiError(error) && error.kind === 'forbidden' && !error.code?.startsWith('ACCOUNT_')) {
        return { available: false };
      }
      logApiFailure('Failed to fetch the ride driver location', error);
      throw error;
    }
  }

  /**
   * Available drivers near a point for the passenger map (GET /rides/nearby-drivers, BE-20).
   * The radius is clamped to 1..10 km. Rate limited to 6 requests a minute and 300 an hour per
   * user, 30 a minute per IP (BE-118, SEC-31): a 429 rejects with ApiError kind 'rate_limited'
   * and `retryAfter` (seconds).
   */
  async getNearbyDrivers(query: NearbyDriversQuery, signal?: AbortSignal): Promise<NearbyDriver[]> {
    return (await this.getNearbyDriversResult(query, signal)).drivers;
  }

  /**
   * GET /rides/nearby-drivers with the BE-116 counts (T-586): `counts` is null until the server
   * sends them. Same limits as getNearbyDrivers.
   */
  async getNearbyDriversResult(query: NearbyDriversQuery, signal?: AbortSignal): Promise<NearbyDriversResult> {
    try {
      const params: Record<string, string | number> = {
        latitude: query.latitude,
        longitude: query.longitude,
        radius: clampRadius(query.radiusKm),
      };
      if (query.vehicleType) {
        params.vehicle_type = query.vehicleType;
      }
      return normalizeNearbyResult(await apiService.get<unknown>(`${this.baseUrl}/nearby-drivers`, { params, signal }));
    } catch (error) {
      logApiFailure('Failed to load nearby drivers', error);
      throw error;
    }
  }

  // Get ride path/tracking
  async getRidePath(rideId: number): Promise<unknown> {
    try {
      logger.debug('Fetching ride path:', rideId);
      return unwrap(await apiService.get<unknown>(`${this.trackingUrl}/ride/${rideId}/path`));
    } catch (error) {
      logger.error('Failed to fetch ride path:', error);
      throw error;
    }
  }

  // Get passenger rides
  async getPassengerRides(passengerId: number, status?: string): Promise<RideResource[]> {
    try {
      logger.debug('Fetching passenger rides:', passengerId, status);
      const page = await this.getRides({
        passenger_id: passengerId,
        status
      });
      return page.data;
    } catch (error) {
      logger.error('Failed to fetch passenger rides:', error);
      throw error;
    }
  }

  // Get driver rides
  async getDriverRides(driverId: number, status?: string): Promise<RideResource[]> {
    try {
      logger.debug('Fetching driver rides:', driverId, status);
      const page = await this.getRides({
        driver_id: driverId,
        status
      });
      return page.data;
    } catch (error) {
      logger.error('Failed to fetch driver rides:', error);
      throw error;
    }
  }

  // Get active rides for driver
  // NOTE: the backend filters status with "=", so 'accepted,ongoing' matches nothing (CONTRACT_NOTES).
  async getActiveDriverRides(driverId: number): Promise<RideResource[]> {
    try {
      logger.debug('Fetching active driver rides:', driverId);
      return await this.getDriverRides(driverId, 'accepted,ongoing');
    } catch (error) {
      logger.error('Failed to fetch active driver rides:', error);
      throw error;
    }
  }

  // ==================== STOP MANAGEMENT METHODS ====================
  // These endpoints return the ride id, its stops and the updated fare, not a full RideResource.

  // Add stop to ride
  async addStop(rideId: number, stopData: RideStopRequest): Promise<RideStopsUpdate> {
    try {
      logger.debug('Adding stop to ride:', rideId, stopData);
      return unwrap(await apiService.post<RideStopsUpdate>(`${this.baseUrl}/${rideId}/stops`, stopData));
    } catch (error) {
      logger.error('Failed to add stop:', error);
      throw error;
    }
  }

  // Remove stop from ride
  async removeStop(rideId: number, stopId: number): Promise<RideStopsUpdate> {
    try {
      logger.debug('Removing stop from ride:', rideId, stopId);
      return unwrap(await apiService.delete<RideStopsUpdate>(`${this.baseUrl}/${rideId}/stops/${stopId}`));
    } catch (error) {
      logger.error('Failed to remove stop:', error);
      throw error;
    }
  }

  // Update stop order
  async updateStopOrder(rideId: number, stopOrders: Array<{stop_id: number, new_order: number}>): Promise<RideStopsUpdate> {
    try {
      logger.debug('Updating stop order:', rideId, stopOrders);
      return unwrap(
        await apiService.put<RideStopsUpdate>(`${this.baseUrl}/${rideId}/stops/reorder`, { stop_orders: stopOrders }),
      );
    } catch (error) {
      logger.error('Failed to update stop order:', error);
      throw error;
    }
  }

  // ==================== DRIVER NAVIGATION METHODS ====================

  // Navigate to next stop
  async navigateToNextStop(rideId: number): Promise<any> {
    try {
      logger.debug('Navigating to next stop:', rideId);
      return unwrap(await apiService.post<unknown>(`${this.baseUrl}/${rideId}/navigate-next-stop`));
    } catch (error) {
      logger.error('Failed to start navigation:', error);
      throw error;
    }
  }

  // Mark stop as completed
  async markStopCompleted(rideId: number, stopId: number): Promise<any> {
    try {
      logger.debug('Marking stop as completed:', rideId, stopId);
      return unwrap(await apiService.post<unknown>(`${this.baseUrl}/${rideId}/stops/${stopId}/complete`));
    } catch (error) {
      logger.error('Failed to mark stop as completed:', error);
      throw error;
    }
  }

  // Get navigation instructions
  async getNavigationInstructions(rideId: number): Promise<any> {
    try {
      logger.debug('Getting navigation instructions:', rideId);
      return unwrap(await apiService.get<unknown>(`${this.baseUrl}/${rideId}/navigation-instructions`));
    } catch (error) {
      logger.error('Failed to get navigation instructions:', error);
      throw error;
    }
  }

  // ==================== LOCATION TRACKING METHODS ====================

  // Update driver location (POST /tracking/update-location). The one implementation.
  async updateDriverLocation(locationData: LocationUpdate): Promise<void> {
    try {
      logger.debug('Updating driver location');
      await apiService.post(`${this.trackingUrl}/update-location`, locationData);
    } catch (error) {
      logger.error('Failed to update driver location:', error);
      throw error;
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  // Get user notifications
  async getNotifications(page: number = 1, perPage: number = 20): Promise<{data: NotificationResource[], pagination: Pagination}> {
    try {
      logger.debug('Fetching notifications:', { page, perPage });
      const body = await apiService.get<NotificationResource[]>(`${this.notificationsUrl}`, {
        params: { page, per_page: perPage }
      });
      const data = unwrap(body);
      return {
        data,
        pagination: body.pagination ?? { current_page: page, last_page: page, per_page: perPage, total: data.length },
      };
    } catch (error) {
      // Keyed summary (never an empty line); offline/401 are warnings, not errors (T-104).
      logApiFailure('RideService#getNotifications failed', error);
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: number): Promise<NotificationResource> {
    try {
      logger.debug('Marking notification as read:', notificationId);
      return unwrap(await apiService.post<NotificationResource>(`${this.notificationsUrl}/${notificationId}/read`));
    } catch (error) {
      logApiFailure('RideService#markNotificationAsRead failed', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      logger.debug('Marking all notifications as read');
      await apiService.post(`${this.notificationsUrl}/read-all`);
    } catch (error) {
      logApiFailure('RideService#markAllNotificationsAsRead failed', error);
      throw error;
    }
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      logger.debug('Getting unread count');
      return unwrap(await apiService.get<{ unread_count: number }>(`${this.notificationsUrl}/unread-count`)).unread_count;
    } catch (error) {
      logApiFailure('RideService#getUnreadCount failed', error);
      throw error;
    }
  }

  // ==================== WEBSOCKET METHODS ====================

  // Subscribe to ride updates (returns the socket URL to connect to)
  async subscribeToRideUpdates(rideId: number, userType: 'passenger' | 'driver'): Promise<WebSocketSubscription> {
    try {
      logger.debug('Subscribing to ride updates:', { rideId, userType });
      return unwrap(
        await apiService.post<WebSocketSubscription>(`${this.websocketUrl}/subscribe-ride`, {
          ride_id: rideId,
          user_type: userType
        }),
      );
    } catch (error) {
      logger.error('Failed to subscribe to ride updates:', error);
      throw error;
    }
  }

  // Subscribe to driver requests (returns the socket URL to connect to)
  async subscribeToDriverRequests(driverId: number, latitude: number, longitude: number, radius: number = 10): Promise<DriverRequestSubscription> {
    try {
      logger.debug('Subscribing to driver requests:', { driverId, radius });
      return unwrap(
        await apiService.post<DriverRequestSubscription>(`${this.websocketUrl}/subscribe-driver`, {
          driver_id: driverId,
          latitude,
          longitude,
          radius
        }),
      );
    } catch (error) {
      logger.error('Failed to subscribe to driver requests:', error);
      throw error;
    }
  }

  // Get WebSocket events documentation
  async getWebSocketEvents(): Promise<unknown> {
    try {
      logger.debug('Getting WebSocket events documentation');
      return unwrap(await apiService.get<unknown>(`${this.websocketUrl}/events`));
    } catch (error) {
      logger.error('Failed to get WebSocket events:', error);
      throw error;
    }
  }
}

// Create singleton instance
const rideService = new RideService();

export default rideService;
