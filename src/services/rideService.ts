import apiService, { createCancellableRequest, removeRequest } from './api';

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

export interface DriverLocation {
  latitude: number;
  longitude: number;
  status?: 'online' | 'available' | 'busy' | 'offline';
  address?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

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

export interface DriverLocation {
  driver_id: number;
  latitude: number;
  longitude: number;
  status: 'online' | 'offline' | 'busy';
  speed?: number;
  heading?: number;
  accuracy?: number;
  last_seen_at: string;
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  status: 'online' | 'offline' | 'busy';
  speed?: number;
  heading?: number;
  accuracy?: number;
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

class RideService {
  private baseUrl = '/rides';
  private trackingUrl = '/tracking';
  private notificationsUrl = '/notifications';
  private websocketUrl = '/websocket';

  // Create a new ride request with stops support
  async createRide(rideData: RideRequest): Promise<RideResource> {
    const cancelSource = createCancellableRequest();
    
    try {
      console.log('🚗 Creating ride request:', rideData);
      
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
      
      const response = await apiService.post(`${this.baseUrl}`, rideData, {
        cancelToken: cancelSource.token
      });
      console.log('✅ Ride created successfully:', response.data);
      
      // Remove from tracking when successful
      removeRequest(cancelSource);
      
      // Handle different response formats
      if (response.data && response.data.data) {
        return response.data.data;
      } else if (response.data) {
        return response.data;
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      // Remove from tracking on error
      removeRequest(cancelSource);
      
      // Handle cancelled requests
      if (error.name === 'CanceledError' || error.message?.includes('canceled')) {
        console.log('🚫 Ride creation cancelled');
        throw new Error('Request was cancelled');
      }
      
      console.error('❌ Failed to create ride:', error);
      
      // Provide more specific error messages
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.response.data?.error || 'Unknown server error';
        
        if (status === 401) {
          throw new Error('Authentication required. Please login again.');
        } else if (status === 422) {
          throw new Error(`Validation error: ${message}`);
        } else if (status === 500) {
          throw new Error(`Server error: ${message}`);
        } else {
          throw new Error(`Request failed (${status}): ${message}`);
        }
      } else if (error.request) {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error(error.message || 'Unknown error occurred');
      }
    }
  }

  // Get all rides (with pagination and filters)
  async getRides(params?: {
    page?: number;
    status?: string;
    passenger_id?: number;
    driver_id?: number;
  }): Promise<PaginatedRides> {
    try {
      console.log('📋 Fetching rides:', params);
      const response = await apiService.get(`${this.baseUrl}`, { params });
      console.log('✅ Rides fetched successfully:', response.data);
      
      // Handle case where response.data might be undefined
      if (!response || !response.data) {
        console.warn('⚠️ API returned empty response');
        return { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 };
      }
      
      return response.data.data || { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 };
    } catch (error) {
      console.error('❌ Failed to fetch rides:', error);
      throw error;
    }
  }

  // Get a specific ride by ID
  async getRide(rideId: number): Promise<RideResource> {
    try {
      console.log('🔍 Fetching ride:', rideId);
      const response = await apiService.get(`${this.baseUrl}/${rideId}`);
      console.log('✅ Ride fetched successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to fetch ride:', error);
      throw error;
    }
  }

  // Update ride status and details
  async updateRide(rideId: number, updateData: RideUpdate): Promise<RideResource> {
    try {
      console.log('🔄 Updating ride:', rideId, updateData);
      const response = await apiService.put(`${this.baseUrl}/${rideId}`, updateData);
      console.log('✅ Ride updated successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to update ride:', error);
      throw error;
    }
  }

  // Delete a ride
  async deleteRide(rideId: number): Promise<void> {
    try {
      console.log('🗑️ Deleting ride:', rideId);
      const response = await apiService.delete(`${this.baseUrl}/${rideId}`);
      console.log('✅ Ride deleted successfully:', response.data);
    } catch (error) {
      console.error('❌ Failed to delete ride:', error);
      throw error;
    }
  }

  // Assign driver to a ride
  async assignDriver(rideId: number, driverId: number): Promise<RideResource> {
    try {
      console.log('👨‍💼 Assigning driver:', rideId, driverId);
      const response = await apiService.post(`${this.baseUrl}/${rideId}/assign-driver`, {
        driver_id: driverId
      });
      console.log('✅ Driver assigned successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to assign driver:', error);
      throw error;
    }
  }

  // Cancel a ride
  async cancelRide(rideId: number): Promise<RideResource> {
    try {
      console.log('❌ Cancelling ride:', rideId);
      const response = await apiService.post(`${this.baseUrl}/${rideId}/cancel`);
      console.log('✅ Ride cancelled successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to cancel ride:', error);
      throw error;
    }
  }

  // Driver accepts a ride
  async acceptRide(rideId: number, driverId: number): Promise<RideResource> {
    try {
      console.log('✅ Driver accepting ride:', rideId, driverId);
      const response = await this.updateRide(rideId, {
        status: 'accepted',
        driver_id: driverId
      });
      console.log('✅ Ride accepted successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to accept ride:', error);
      throw error;
    }
  }

  // Start a ride
  async startRide(rideId: number): Promise<RideResource> {
    try {
      console.log('🚀 Starting ride:', rideId);
      const response = await this.updateRide(rideId, {
        status: 'ongoing'
      });
      console.log('✅ Ride started successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to start ride:', error);
      throw error;
    }
  }

  // Complete a ride
  async completeRide(rideId: number, fare?: number, distanceKm?: number, durationMin?: number): Promise<RideResource> {
    try {
      console.log('🏁 Completing ride:', rideId, { fare, distanceKm, durationMin });
      const response = await this.updateRide(rideId, {
        status: 'completed',
        fare,
        distance_km: distanceKm,
        duration_min: durationMin
      });
      console.log('✅ Ride completed successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to complete ride:', error);
      throw error;
    }
  }

  // Update driver location
  async updateDriverLocation(locationData: DriverLocation): Promise<void> {
    try {
      console.log('📍 Updating driver location:', locationData);
      const response = await apiService.post('/tracking/update-location', locationData);
      console.log('✅ Driver location updated successfully:', response.data);
    } catch (error) {
      console.error('❌ Failed to update driver location:', error);
      throw error;
    }
  }

  // Get latest driver location
  async getDriverLocation(driverId: number): Promise<DriverLocation> {
    try {
      console.log('📍 Fetching driver location:', driverId);
      const response = await apiService.get(`/tracking/driver/${driverId}/latest`);
      console.log('✅ Driver location fetched successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to fetch driver location:', error);
      throw error;
    }
  }

  // Get drivers in radius
  async getDriversInRadius(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<DriverInRadius[]> {
    try {
      console.log('🔍 Finding drivers in radius:', { latitude, longitude, radiusKm });
      const response = await apiService.get('/tracking/drivers-in-radius', {
        params: {
          latitude,
          longitude,
          radius_km: radiusKm
        }
      });
      console.log('✅ Drivers found successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to find drivers in radius:', error);
      throw error;
    }
  }

  // Get ride path/tracking
  async getRidePath(rideId: number): Promise<any> {
    try {
      console.log('🗺️ Fetching ride path:', rideId);
      const response = await apiService.get(`/tracking/ride/${rideId}/path`);
      console.log('✅ Ride path fetched successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to fetch ride path:', error);
      throw error;
    }
  }

  // Get passenger rides
  async getPassengerRides(passengerId: number, status?: string): Promise<RideResource[]> {
    try {
      console.log('👤 Fetching passenger rides:', passengerId, status);
      const response = await this.getRides({
        passenger_id: passengerId,
        status
      });
      console.log('✅ Passenger rides fetched successfully:', response);
      
      // Handle case where response might be undefined or null
      if (!response) {
        console.warn('⚠️ getRides returned undefined');
        return [];
      }
      
      // Handle both array and object responses
      return Array.isArray(response) ? response : response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch passenger rides:', error);
      throw error;
    }
  }

  // Get driver rides
  async getDriverRides(driverId: number, status?: string): Promise<RideResource[]> {
    try {
      console.log('👨‍💼 Fetching driver rides:', driverId, status);
      const response = await this.getRides({
        driver_id: driverId,
        status
      });
      console.log('✅ Driver rides fetched successfully:', response);
      
      // Handle case where response might be undefined or null
      if (!response) {
        console.warn('⚠️ getRides returned undefined');
        return [];
      }
      
      // Handle both array and object responses
      return Array.isArray(response) ? response : response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch driver rides:', error);
      throw error;
    }
  }

  // Get active rides for driver
  async getActiveDriverRides(driverId: number): Promise<RideResource[]> {
    try {
      console.log('🚗 Fetching active driver rides:', driverId);
      const response = await this.getDriverRides(driverId, 'accepted,ongoing');
      console.log('✅ Active driver rides fetched successfully:', response);
      return response;
      } catch (error) {
      console.error('❌ Failed to fetch active driver rides:', error);
      throw error;
    }
  }

  // Get pending rides for driver
  async getPendingRides(): Promise<RideResource[]> {
    try {
      console.log('⏳ Fetching pending rides');
      const response = await this.getRides({ status: 'requested' });
      console.log('✅ Pending rides fetched successfully:', response);
      
      // Handle case where response might be undefined or null
      if (!response) {
        console.warn('⚠️ getRides returned undefined');
        return [];
      }
      
      // Handle both array and object responses
      return Array.isArray(response) ? response : response.data || [];
    } catch (error) {
      console.error('❌ Failed to fetch pending rides:', error);
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
      console.log('💰 Calculating fare:', { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType });
      
      // For now, return a mock calculation
      // In real implementation, this would call a fare calculation API
      const distance = this.calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
      const baseFare = 50; // Base fare in PKR
      const perKmRate = 25; // Per km rate in PKR
  const fare = Math.round(baseFare + (distance * perKmRate));
  const duration = Math.round(distance * 2); // Rough estimate: 2 minutes per km
  
      const result = { fare, distance, duration };
      console.log('✅ Fare calculated successfully:', result);
      return result;
  } catch (error) {
      console.error('❌ Failed to calculate fare:', error);
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

  // Add stop to ride
  async addStop(rideId: number, stopData: RideStopRequest): Promise<RideResource> {
    try {
      console.log('📍 Adding stop to ride:', rideId, stopData);
      const response = await apiService.post(`${this.baseUrl}/${rideId}/stops`, stopData);
      console.log('✅ Stop added successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to add stop:', error);
      throw error;
    }
  }

  // Remove stop from ride
  async removeStop(rideId: number, stopId: number): Promise<RideResource> {
    try {
      console.log('🗑️ Removing stop from ride:', rideId, stopId);
      const response = await apiService.delete(`${this.baseUrl}/${rideId}/stops/${stopId}`);
      console.log('✅ Stop removed successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to remove stop:', error);
      throw error;
    }
  }

  // Update stop order
  async updateStopOrder(rideId: number, stopOrders: Array<{stop_id: number, new_order: number}>): Promise<RideResource> {
    try {
      console.log('🔄 Updating stop order:', rideId, stopOrders);
      const response = await apiService.put(`${this.baseUrl}/${rideId}/stops/reorder`, { stop_orders: stopOrders });
      console.log('✅ Stop order updated successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to update stop order:', error);
      throw error;
    }
  }

  // ==================== DRIVER NAVIGATION METHODS ====================

  // Navigate to next stop
  async navigateToNextStop(rideId: number): Promise<any> {
    try {
      console.log('🧭 Navigating to next stop:', rideId);
      const response = await apiService.post(`${this.baseUrl}/${rideId}/navigate-next-stop`);
      console.log('✅ Navigation started successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to start navigation:', error);
      throw error;
    }
  }

  // Mark stop as completed
  async markStopCompleted(rideId: number, stopId: number): Promise<any> {
    try {
      console.log('✅ Marking stop as completed:', rideId, stopId);
      const response = await apiService.post(`${this.baseUrl}/${rideId}/stops/${stopId}/complete`);
      console.log('✅ Stop marked as completed:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to mark stop as completed:', error);
      throw error;
    }
  }

  // Get navigation instructions
  async getNavigationInstructions(rideId: number): Promise<any> {
    try {
      console.log('🧭 Getting navigation instructions:', rideId);
      const response = await apiService.get(`${this.baseUrl}/${rideId}/navigation-instructions`);
      console.log('✅ Navigation instructions fetched:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get navigation instructions:', error);
      throw error;
    }
  }

  // ==================== LOCATION TRACKING METHODS ====================

  // Update driver location
  async updateDriverLocation(locationData: LocationUpdate): Promise<any> {
    try {
      console.log('📍 Updating driver location:', locationData);
      const response = await apiService.post(`${this.trackingUrl}/update-location`, locationData);
      console.log('✅ Driver location updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to update driver location:', error);
      throw error;
    }
  }

  // Get driver location
  async getDriverLocationById(driverId: number): Promise<DriverLocation> {
    try {
      console.log('📍 Fetching driver location:', driverId);
      const response = await apiService.get(`${this.trackingUrl}/driver/${driverId}/location`);
      console.log('✅ Driver location fetched successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to fetch driver location:', error);
      throw error;
    }
  }

  // ==================== NOTIFICATION METHODS ====================

  // Get user notifications
  async getNotifications(page: number = 1, perPage: number = 20): Promise<{data: NotificationResource[], pagination: any}> {
    try {
      console.log('🔔 Fetching notifications:', { page, perPage });
      const response = await apiService.get(`${this.notificationsUrl}`, {
        params: { page, per_page: perPage }
      });
      console.log('✅ Notifications fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: number): Promise<any> {
    try {
      console.log('✅ Marking notification as read:', notificationId);
      const response = await apiService.post(`${this.notificationsUrl}/${notificationId}/read`);
      console.log('✅ Notification marked as read:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(): Promise<any> {
    try {
      console.log('✅ Marking all notifications as read');
      const response = await apiService.post(`${this.notificationsUrl}/read-all`);
      console.log('✅ All notifications marked as read:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      console.log('🔢 Getting unread count');
      const response = await apiService.get(`${this.notificationsUrl}/unread-count`);
      console.log('✅ Unread count fetched:', response.data);
      return response.data.data.unread_count;
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      throw error;
    }
  }

  // ==================== WEBSOCKET METHODS ====================

  // Subscribe to ride updates
  async subscribeToRideUpdates(rideId: number, userType: 'passenger' | 'driver'): Promise<WebSocketSubscription> {
    try {
      console.log('🔌 Subscribing to ride updates:', { rideId, userType });
      const response = await apiService.post(`${this.websocketUrl}/subscribe-ride`, {
        ride_id: rideId,
        user_type: userType
      });
      console.log('✅ Subscribed to ride updates:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to subscribe to ride updates:', error);
      throw error;
    }
  }

  // Subscribe to driver requests
  async subscribeToDriverRequests(driverId: number, latitude: number, longitude: number, radius: number = 10): Promise<WebSocketSubscription> {
    try {
      console.log('🔌 Subscribing to driver requests:', { driverId, latitude, longitude, radius });
      const response = await apiService.post(`${this.websocketUrl}/subscribe-driver`, {
        driver_id: driverId,
        latitude,
        longitude,
        radius
      });
      console.log('✅ Subscribed to driver requests:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to subscribe to driver requests:', error);
      throw error;
    }
  }

  // Get WebSocket events documentation
  async getWebSocketEvents(): Promise<any> {
    try {
      console.log('📋 Getting WebSocket events documentation');
      const response = await apiService.get(`${this.websocketUrl}/events`);
      console.log('✅ WebSocket events fetched:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get WebSocket events:', error);
      throw error;
    }
  }
}

// Create singleton instance
const rideService = new RideService();

export default rideService;