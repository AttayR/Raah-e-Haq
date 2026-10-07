import apiService, { createCancellableRequest, removeRequest } from './api';
import { isApiError, unwrap } from '../core/api/errors';
import type { Pagination } from '../core/api/types';
import { logger } from '../core/logging/logger';

export interface RideLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RideRequest {
  passenger_id: number;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  vehicle_type: string;
  service_level?: string; // economy, comfort, premium for car variants
  passenger_count: number;
  special_instructions: string;
  stops: RideStopRequest[];
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
  status: 'requested' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
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
  driver?: {
    id: number;
    name: string;
    phone: string;
    rating?: number;
    vehicle_type?: string;
    license_number?: string;
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
 */
export interface DriverLocation {
  driver_id: number;
  latitude: number;
  longitude: number;
  heading?: number | null;
  status: DriverLocationStatus;
  last_seen_at: string;
}

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

// TODO(T-110/BE-20): passengers must use GET /rides/nearby-drivers (opaque string id,
// no name/phone). /tracking/drivers-in-radius is admin-only and returns 403 to passengers.
export interface DriverInRadius {
  id: number;
  name: string;
  phone: string;
  rating: number;
  vehicle_type: string;
  distance_km: number;
  estimated_arrival_min: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

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
      logger.debug('🚗 Creating ride request:', rideData);

      // Validate required fields
      if (!rideData.passenger_id) {
        throw new Error('Passenger ID is required');
      }
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
        logger.error('❌ Failed to create ride:', error);
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
      return unwrap(await apiService.get<DriverLocation | null>(`${this.trackingUrl}/driver/${driverId}/latest`));
    } catch (error) {
      logger.error('❌ Failed to fetch driver location:', error);
      throw error;
    }
  }

  // Get drivers in radius. TODO(T-110/BE-20): admin-only route; passengers get 403.
  async getDriversInRadius(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<DriverInRadius[]> {
    try {
      logger.debug('🔍 Finding drivers in radius:', { latitude, longitude, radiusKm });
      const body = await apiService.get<DriverInRadius[]>(`${this.trackingUrl}/drivers-in-radius`, {
        params: {
          latitude,
          longitude,
          radius_km: radiusKm
        }
      });
      const drivers = unwrap(body);
      if (!Array.isArray(drivers)) {
        return [];
      }
      logger.debug('✅ Drivers found successfully:', drivers.length);
      return drivers;
    } catch (error) {
      logger.error('❌ Failed to find drivers in radius:', error);
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

  // Calculate fare estimate
  async calculateFare(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    vehicleType?: string
  ): Promise<{ fare: number; distance: number; duration: number }> {
    try {
      logger.debug('💰 Calculating fare:', { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType });

      // For now, return a mock calculation
      // In real implementation, this would call a fare calculation API
      const distance = this.calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      const baseFare = 50; // Base fare in PKR
      const perKmRate = 25; // Per km rate in PKR
  const fare = Math.round(baseFare + (distance * perKmRate));
  const duration = Math.round(distance * 2); // Rough estimate: 2 minutes per km

      const result = { fare, distance, duration };
      logger.debug('✅ Fare calculated successfully:', result);
      return result;
  } catch (error) {
      logger.error('❌ Failed to calculate fare:', error);
      throw error;
    }
  }

  // Helper method to calculate distance between two points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
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
      logger.error('❌ Failed to fetch notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: number): Promise<NotificationResource> {
    try {
      logger.debug('✅ Marking notification as read:', notificationId);
      return unwrap(await apiService.post<NotificationResource>(`${this.notificationsUrl}/${notificationId}/read`));
    } catch (error) {
      logger.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      logger.debug('✅ Marking all notifications as read');
      await apiService.post(`${this.notificationsUrl}/read-all`);
    } catch (error) {
      logger.error('❌ Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      logger.debug('🔢 Getting unread count');
      return unwrap(await apiService.get<{ unread_count: number }>(`${this.notificationsUrl}/unread-count`)).unread_count;
    } catch (error) {
      logger.error('❌ Failed to get unread count:', error);
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
