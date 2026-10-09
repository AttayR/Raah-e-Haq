import apiService, { createCancellableRequest, removeRequest } from './api';
import { isApiError, unwrap } from '../core/api/errors';
import type { Pagination } from '../core/api/types';
import { logger } from '../core/logging/logger';
import { logApiFailure } from '../core/api/logApiFailure';

export interface RideLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

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
  estimated_arrival?: string;
  created_at: string;
  updated_at: string;
  passenger?: {
    id: number;
    name: string;
    phone: string;
    rating?: number;
  };
  /**
   * Non-admin viewers get a minimal card (BE-20). `phone` is present only for the passenger of
   * an accepted, still-active ride (and for the driver themselves); use getDriverPhone().
   */
  driver?: {
    id: number;
    name: string;
    phone?: string | null;
    profile_image_url?: string | null;
    rating?: number | null;
    vehicle_type?: string | null;
  };
  vehicle?: {
    id: number;
    brand: string;
    model: string;
    year?: string;
    color?: string;
    license_plate: string;
  };
  requested_at: string;
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
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

/** Body of POST /tracking/update-location (DriverTrackingController@updateLocation). */
export interface LocationUpdate {
  latitude: number;
  longitude: number;
  status?: DriverLocationStatus;
  address?: string;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
}

/** The vehicle types the server accepts everywhere (BE-58 enum, GET /public/vehicle-types). */
export const VEHICLE_TYPE_KEYS = ['car', 'bike', 'rickshaw', 'van'] as const;
export type VehicleTypeKey = (typeof VEHICLE_TYPE_KEYS)[number];
export const isVehicleTypeKey = (value: unknown): value is VehicleTypeKey =>
  typeof value === 'string' && (VEHICLE_TYPE_KEYS as ReadonlyArray<string>).includes(value);

export type NearbyVehicleType = VehicleTypeKey;

/** Radius bounds of GET /rides/nearby-drivers (BE-20, DriverPrivacy::MAX_NEARBY_RADIUS_KM). */
export const NEARBY_MIN_RADIUS_KM = 1;
export const NEARBY_MAX_RADIUS_KM = 10;
export const NEARBY_DEFAULT_RADIUS_KM = 5;

/**
 * One entry of GET /rides/nearby-drivers (BE-20). No name, phone or user id: `id` is an opaque
 * string bound to the viewer (stable for about an hour; use it only as a list/marker key),
 * `rating` is in 0.5 steps, `location` is snapped to a ~550 m grid and refreshes every 2 minutes.
 */
export interface NearbyDriver {
  id: string;
  rating: number;
  /** BE-58: null when the driver has no (known) vehicle type; never guessed as car. */
  vehicle_type: VehicleTypeKey | null;
  distance_km: number;
  estimated_arrival_min: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface NearbyDriversQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  vehicleType?: NearbyVehicleType;
}

/** Ride statuses during which the passenger may see the driver's phone and position (BE-20). */
export const ACTIVE_RIDE_STATUSES: ReadonlyArray<string> = ['accepted', 'arrived', 'started', 'ongoing'];

export const isRideActive = (ride: Pick<RideResource, 'status'> | null | undefined): boolean =>
  !!ride && ACTIVE_RIDE_STATUSES.includes(ride.status);

/**
 * The driver's phone for the Call button: only from `ride.driver.phone`, which the server
 * includes only while the ride is active (BE-20). Spaces and dashes are removed; anything
 * that is not 7-15 digits with an optional leading + is rejected. Null hides the button.
 */
export const getDriverPhone = (ride: RideResource | null | undefined): string | null => {
  if (!ride || !isRideActive(ride)) return null;
  const phone = ride.driver?.phone;
  if (typeof phone !== 'string') return null;
  // Digits with an optional leading +, so a tel: link can't carry dial codes (; , # * etc.).
  const compact = phone.replace(/[\s-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(compact) ? compact : null;
};

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
    rating: toNumber(item.rating) ?? 0,
    vehicle_type: isVehicleTypeKey(item.vehicle_type) ? item.vehicle_type : null,
    distance_km: toNumber(item.distance_km) ?? 0,
    estimated_arrival_min: toNumber(item.estimated_arrival_min) ?? 0,
    location: { latitude, longitude },
  };
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
  async createRide(rideData: RideRequest): Promise<RideResource> {
    const cancelSource = createCancellableRequest();

    try {
      logger.debug('🚗 Creating ride request:', rideData.vehicle_type);

      // Validate required fields (the passenger comes from the token, BE-01)
      if (!rideData.pickup_latitude || !rideData.pickup_longitude) {
        throw new Error('Pickup coordinates are required');
      }
      if (!rideData.dropoff_latitude || !rideData.dropoff_longitude) {
        throw new Error('Dropoff coordinates are required');
      }

      const body = await apiService.post<RideResource>(`${this.baseUrl}`, rideData, {
        cancelToken: cancelSource.token
      });
      const ride = unwrap(body);
      logger.debug('✅ Ride created successfully:', ride.id);
      return ride;
    } catch (error) {
      if (isApiError(error) && error.kind === 'cancelled') {
        logger.debug('🚫 Ride creation cancelled');
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
      logger.debug('📋 Fetching rides:', params);
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
      logger.debug('✅ Rides fetched successfully:', rides.length);
      return { ...pagination, data: rides };
    } catch (error) {
      logger.error('❌ Failed to fetch rides:', error);
      throw error;
    }
  }

  // Get a specific ride by ID
  async getRide(rideId: number): Promise<RideResource> {
    try {
      logger.debug('🔍 Fetching ride:', rideId);
      return unwrap(await apiService.get<RideResource>(`${this.baseUrl}/${rideId}`));
    } catch (error) {
      logger.error('❌ Failed to fetch ride:', error);
      throw error;
    }
  }

  // Update ride status and details
  async updateRide(rideId: number, updateData: RideUpdate): Promise<RideResource> {
    try {
      logger.debug('🔄 Updating ride:', rideId, updateData);
      return unwrap(await apiService.put<RideResource>(`${this.baseUrl}/${rideId}`, updateData));
    } catch (error) {
      logger.error('❌ Failed to update ride:', error);
      throw error;
    }
  }

  // Delete a ride
  async deleteRide(rideId: number): Promise<void> {
    try {
      logger.debug('🗑️ Deleting ride:', rideId);
      await apiService.delete(`${this.baseUrl}/${rideId}`);
      logger.debug('✅ Ride deleted successfully');
    } catch (error) {
      logger.error('❌ Failed to delete ride:', error);
      throw error;
    }
  }

  // Assign driver to a ride
  async assignDriver(rideId: number, driverId: number): Promise<RideResource> {
    try {
      logger.debug('👨‍💼 Assigning driver:', rideId, driverId);
      return unwrap(
        await apiService.post<RideResource>(`${this.baseUrl}/${rideId}/assign-driver`, {
          driver_id: driverId
        }),
      );
    } catch (error) {
      logger.error('❌ Failed to assign driver:', error);
      throw error;
    }
  }

  // Cancel a ride
  async cancelRide(rideId: number): Promise<RideResource> {
    try {
      logger.debug('❌ Cancelling ride:', rideId);
      return unwrap(await apiService.post<RideResource>(`${this.baseUrl}/${rideId}/cancel`));
    } catch (error) {
      logger.error('❌ Failed to cancel ride:', error);
      throw error;
    }
  }

  // Driver accepts a ride
  async acceptRide(rideId: number, driverId: number): Promise<RideResource> {
    try {
      logger.debug('✅ Driver accepting ride:', rideId, driverId);
      const response = await this.updateRide(rideId, {
        status: 'accepted',
        driver_id: driverId
      });
      logger.debug('✅ Ride accepted successfully:', response.id);
      return response;
    } catch (error) {
      logger.error('❌ Failed to accept ride:', error);
      throw error;
    }
  }

  // Start a ride
  async startRide(rideId: number): Promise<RideResource> {
    try {
      logger.debug('🚀 Starting ride:', rideId);
      const response = await this.updateRide(rideId, {
        status: 'ongoing'
      });
      logger.debug('✅ Ride started successfully:', response.id);
      return response;
    } catch (error) {
      logger.error('❌ Failed to start ride:', error);
      throw error;
    }
  }

  // Complete a ride
  async completeRide(rideId: number, fare?: number, distanceKm?: number, durationMin?: number): Promise<RideResource> {
    try {
      logger.debug('🏁 Completing ride:', rideId, { fare, distanceKm, durationMin });
      const response = await this.updateRide(rideId, {
        status: 'completed',
        fare,
        distance_km: distanceKm,
        duration_min: durationMin
      });
      logger.debug('✅ Ride completed successfully:', response.id);
      return response;
    } catch (error) {
      logger.error('❌ Failed to complete ride:', error);
      throw error;
    }
  }

  // Get latest driver location (GET /tracking/driver/{id}/latest).
  // 403 unless the caller is that driver, an admin, or the passenger of an active ride with them (BE-20).
  // data is null when the driver has not sent a location yet.
  async getDriverLocation(driverId: number): Promise<DriverLocation | null> {
    try {
      logger.debug('📍 Fetching driver location:', driverId);
      return normalizeDriverLocation(
        unwrap(await apiService.get<DriverLocationWire | null>(`${this.trackingUrl}/driver/${driverId}/latest`)),
      );
    } catch (error) {
      logApiFailure('Failed to fetch driver location', error);
      throw error;
    }
  }

  /**
   * The assigned driver's position for the passenger's ride. Never calls the server unless the
   * ride is active and has a driver; a 403 (ride no longer active) is "not available", not an error.
   */
  async getDriverLocationForRide(ride: RideResource | null | undefined): Promise<RideDriverLocation> {
    if (!ride || !isRideActive(ride) || typeof ride.driver_id !== 'number') {
      return { available: false };
    }
    try {
      const location = await this.getDriverLocation(ride.driver_id);
      return location ? { available: true, location } : { available: false };
    } catch (error) {
      if (isApiError(error) && error.kind === 'forbidden' && !error.code?.startsWith('ACCOUNT_')) {
        return { available: false };
      }
      throw error;
    }
  }

  /**
   * Available drivers near a point for the passenger map (GET /rides/nearby-drivers, BE-20).
   * The radius is clamped to 1..10 km. Rate limited to 12 requests a minute per user: a 429
   * rejects with ApiError kind 'rate_limited' and `retryAfter` (seconds).
   */
  async getNearbyDrivers(query: NearbyDriversQuery, signal?: AbortSignal): Promise<NearbyDriver[]> {
    try {
      const params: Record<string, string | number> = {
        latitude: query.latitude,
        longitude: query.longitude,
        radius: clampRadius(query.radiusKm),
      };
      if (query.vehicleType) {
        params.vehicle_type = query.vehicleType;
      }
      const drivers = unwrap(await apiService.get<unknown>(`${this.baseUrl}/nearby-drivers`, { params, signal }));
      if (!Array.isArray(drivers)) {
        return [];
      }
      return drivers.map(normalizeNearbyDriver).filter((d): d is NearbyDriver => d !== null);
    } catch (error) {
      logApiFailure('Failed to load nearby drivers', error);
      throw error;
    }
  }

  // Get ride path/tracking
  async getRidePath(rideId: number): Promise<unknown> {
    try {
      logger.debug('🗺️ Fetching ride path:', rideId);
      return unwrap(await apiService.get<unknown>(`${this.trackingUrl}/ride/${rideId}/path`));
    } catch (error) {
      logger.error('❌ Failed to fetch ride path:', error);
      throw error;
    }
  }

  // Get passenger rides
  async getPassengerRides(passengerId: number, status?: string): Promise<RideResource[]> {
    try {
      logger.debug('👤 Fetching passenger rides:', passengerId, status);
      const page = await this.getRides({
        passenger_id: passengerId,
        status
      });
      return page.data;
    } catch (error) {
      logger.error('❌ Failed to fetch passenger rides:', error);
      throw error;
    }
  }

  // Get driver rides
  async getDriverRides(driverId: number, status?: string): Promise<RideResource[]> {
    try {
      logger.debug('👨‍💼 Fetching driver rides:', driverId, status);
      const page = await this.getRides({
        driver_id: driverId,
        status
      });
      return page.data;
    } catch (error) {
      logger.error('❌ Failed to fetch driver rides:', error);
      throw error;
    }
  }

  // Get active rides for driver
  // NOTE: the backend filters status with "=", so 'accepted,ongoing' matches nothing (CONTRACT_NOTES).
  async getActiveDriverRides(driverId: number): Promise<RideResource[]> {
    try {
      logger.debug('🚗 Fetching active driver rides:', driverId);
      return await this.getDriverRides(driverId, 'accepted,ongoing');
    } catch (error) {
      logger.error('❌ Failed to fetch active driver rides:', error);
      throw error;
    }
  }

  // Get pending rides for driver
  // TODO(T-403/BE-02): use GET /rides/pending; GET /rides only lists the driver's own rides.
  async getPendingRides(): Promise<RideResource[]> {
    try {
      logger.debug('⏳ Fetching pending rides');
      const page = await this.getRides({ status: 'requested' });
      return page.data;
    } catch (error) {
      logger.error('❌ Failed to fetch pending rides:', error);
      throw error;
    }
  }

  // ==================== STOP MANAGEMENT METHODS ====================
  // These endpoints return the ride id, its stops and the updated fare, not a full RideResource.

  // Add stop to ride
  async addStop(rideId: number, stopData: RideStopRequest): Promise<RideStopsUpdate> {
    try {
      logger.debug('📍 Adding stop to ride:', rideId, stopData);
      return unwrap(await apiService.post<RideStopsUpdate>(`${this.baseUrl}/${rideId}/stops`, stopData));
    } catch (error) {
      logger.error('❌ Failed to add stop:', error);
      throw error;
    }
  }

  // Remove stop from ride
  async removeStop(rideId: number, stopId: number): Promise<RideStopsUpdate> {
    try {
      logger.debug('🗑️ Removing stop from ride:', rideId, stopId);
      return unwrap(await apiService.delete<RideStopsUpdate>(`${this.baseUrl}/${rideId}/stops/${stopId}`));
    } catch (error) {
      logger.error('❌ Failed to remove stop:', error);
      throw error;
    }
  }

  // Update stop order
  async updateStopOrder(rideId: number, stopOrders: Array<{stop_id: number, new_order: number}>): Promise<RideStopsUpdate> {
    try {
      logger.debug('🔄 Updating stop order:', rideId, stopOrders);
      return unwrap(
        await apiService.put<RideStopsUpdate>(`${this.baseUrl}/${rideId}/stops/reorder`, { stop_orders: stopOrders }),
      );
    } catch (error) {
      logger.error('❌ Failed to update stop order:', error);
      throw error;
    }
  }

  // ==================== DRIVER NAVIGATION METHODS ====================

  // Navigate to next stop
  async navigateToNextStop(rideId: number): Promise<any> {
    try {
      logger.debug('🧭 Navigating to next stop:', rideId);
      return unwrap(await apiService.post<unknown>(`${this.baseUrl}/${rideId}/navigate-next-stop`));
    } catch (error) {
      logger.error('❌ Failed to start navigation:', error);
      throw error;
    }
  }

  // Mark stop as completed
  async markStopCompleted(rideId: number, stopId: number): Promise<any> {
    try {
      logger.debug('✅ Marking stop as completed:', rideId, stopId);
      return unwrap(await apiService.post<unknown>(`${this.baseUrl}/${rideId}/stops/${stopId}/complete`));
    } catch (error) {
      logger.error('❌ Failed to mark stop as completed:', error);
      throw error;
    }
  }

  // Get navigation instructions
  async getNavigationInstructions(rideId: number): Promise<any> {
    try {
      logger.debug('🧭 Getting navigation instructions:', rideId);
      return unwrap(await apiService.get<unknown>(`${this.baseUrl}/${rideId}/navigation-instructions`));
    } catch (error) {
      logger.error('❌ Failed to get navigation instructions:', error);
      throw error;
    }
  }

  // ==================== LOCATION TRACKING METHODS ====================

  // Update driver location (POST /tracking/update-location). The one implementation.
  async updateDriverLocation(locationData: LocationUpdate): Promise<void> {
    try {
      logger.debug('📍 Updating driver location');
      await apiService.post(`${this.trackingUrl}/update-location`, locationData);
    } catch (error) {
      logger.error('❌ Failed to update driver location:', error);
      throw error;
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  // Get user notifications
  async getNotifications(page: number = 1, perPage: number = 20): Promise<{data: NotificationResource[], pagination: Pagination}> {
    try {
      logger.debug('🔔 Fetching notifications:', { page, perPage });
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
      logger.debug('✅ Marking notification as read:', notificationId);
      return unwrap(await apiService.post<NotificationResource>(`${this.notificationsUrl}/${notificationId}/read`));
    } catch (error) {
      logApiFailure('RideService#markNotificationAsRead failed', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      logger.debug('✅ Marking all notifications as read');
      await apiService.post(`${this.notificationsUrl}/read-all`);
    } catch (error) {
      logApiFailure('RideService#markAllNotificationsAsRead failed', error);
      throw error;
    }
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      logger.debug('🔢 Getting unread count');
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
      logger.debug('🔌 Subscribing to ride updates:', { rideId, userType });
      return unwrap(
        await apiService.post<WebSocketSubscription>(`${this.websocketUrl}/subscribe-ride`, {
          ride_id: rideId,
          user_type: userType
        }),
      );
    } catch (error) {
      logger.error('❌ Failed to subscribe to ride updates:', error);
      throw error;
    }
  }

  // Subscribe to driver requests (returns the socket URL to connect to)
  async subscribeToDriverRequests(driverId: number, latitude: number, longitude: number, radius: number = 10): Promise<DriverRequestSubscription> {
    try {
      logger.debug('🔌 Subscribing to driver requests:', { driverId, radius });
      return unwrap(
        await apiService.post<DriverRequestSubscription>(`${this.websocketUrl}/subscribe-driver`, {
          driver_id: driverId,
          latitude,
          longitude,
          radius
        }),
      );
    } catch (error) {
      logger.error('❌ Failed to subscribe to driver requests:', error);
      throw error;
    }
  }

  // Get WebSocket events documentation
  async getWebSocketEvents(): Promise<unknown> {
    try {
      logger.debug('📋 Getting WebSocket events documentation');
      return unwrap(await apiService.get<unknown>(`${this.websocketUrl}/events`));
    } catch (error) {
      logger.error('❌ Failed to get WebSocket events:', error);
      throw error;
    }
  }
}

// Create singleton instance
const rideService = new RideService();

export default rideService;
