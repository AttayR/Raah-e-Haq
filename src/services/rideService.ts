import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp 
} from '@react-native-firebase/firestore';
import apiService, { createCancellableRequest, removeRequest } from './api';

export interface RideLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RideRequest {
  passenger_id?: number;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  vehicle_type: string;
  service_level?: string;
  passenger_count?: number;
  special_instructions?: string;
  stops?: any[];
}

export interface RideUpdate {
  status?: 'requested' | 'accepted' | 'arrived' | 'ongoing' | 'completed' | 'cancelled';
  driver_id?: number;
  fare?: number;
  distance_km?: number;
  duration_min?: number;
  started_at?: string;
  completed_at?: string;
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
  status: 'requested' | 'accepted' | 'arrived' | 'ongoing' | 'completed' | 'cancelled';
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

/** Payload for adding a stop to a ride (POST /rides/:id/stops) */
export interface RideStopRequest {
  address: string;
  latitude: number;
  longitude: number;
  stop_order: number;
}

export interface PaginatedRides {
  data: RideResource[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DriverLocation {
  driver_id: number;
  latitude: number;
  longitude: number;
  status?: 'online' | 'available' | 'busy' | 'offline';
  address?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
  last_seen_at: string;
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

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  status: 'online' | 'available' | 'offline' | 'busy';
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

// --- 8.3 Ride Booking APIs (doc) ---
export interface EstimateLocationDoc {
  latitude: number;
  longitude: number;
  address: string;
}

export interface EstimateRequestDoc {
  pickupLocation: EstimateLocationDoc;
  dropoffLocation: EstimateLocationDoc;
  additionalStops?: { latitude: number; longitude: number; address: string }[];
  vehicleType: string;
  rideMode?: 'uber' | 'indrive';
}

export interface EstimateResponseDoc {
  estimateId: string;
  vehicleType: string;
  rideMode: string;
  totalDistance: number;
  totalDuration: number;
  stops?: { order: number; address: string; distanceFromPrevious: number }[];
  fareBreakdown?: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    additionalStopsFee?: number;
    discount?: number;
    serviceFee?: number;
    tax?: number;
    surgeFee?: number;
    total: number;
  };
  surgeMultiplier?: number;
  estimatedETA?: number;
  availableDrivers?: number;
  validUntil?: string;
}

export interface CreateRideRequestDoc {
  estimateId?: string;
  pickupLocation: EstimateLocationDoc;
  dropoffLocation: EstimateLocationDoc;
  additionalStops?: { order: number; latitude: number; longitude: number; address: string; waitTime?: number }[];
  vehicleType: string;
  rideMode?: 'uber' | 'indrive';
  paymentMethod?: string;
  scheduledTime?: string | null;
  notes?: string;
  passengerCount?: number;
  promoCode?: string;
  offeredPrice?: number;
  biddingDuration?: number;
}

export interface CancelRideRequestDoc {
  reason?: string;
  comments?: string;
  cancelledBy?: 'passenger' | 'driver';
}

// 9.2 Driver Ride Request APIs
export interface DriverRideRequestDoc {
  requestId: string;
  rideId: string;
  rideMode?: string;
  passenger?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    rating: number;
    totalRides?: number;
  };
  pickupLocation?: { latitude: number; longitude: number; address: string };
  dropoffLocation?: { latitude: number; longitude: number; address: string };
  additionalStops?: { order: number; address: string }[];
  totalStops?: number;
  distance?: number;
  estimatedDuration?: number;
  estimatedFare?: number;
  driverShare?: number;
  distanceFromDriver?: number;
  etaToPickup?: number;
  paymentMethod?: string;
  notes?: string;
  expiresAt?: string;
  createdAt?: string;
}

export interface AcceptDriverRequestDoc {
  currentLocation: { latitude: number; longitude: number; heading?: number; speed?: number; accuracy?: number };
  estimatedArrival: number;
}

export interface RejectDriverRequestDoc {
  reason?: 'too_far' | 'wrong_direction' | 'not_accepting_rides' | 'passenger_rating_low' | 'other';
  comments?: string;
}

class RideService {
  private baseUrl = '/rides';
  private driversUrl = '/drivers';
  private trackingUrl = '/tracking';
  private notificationsUrl = '/notifications';
  private websocketUrl = '/websocket';

  // Create a new ride request with stops support
  async createRide(rideData: RideRequest): Promise<RideResource> {
    const cancelSource = createCancellableRequest();

    try {
      console.log('🚗 Creating ride request:', rideData);
      console.log('📍 Pickup:', rideData.pickup_address);
      console.log('📍 Dropoff:', rideData.dropoff_address);
      console.log('🚗 Vehicle Type:', rideData.vehicle_type);

      // Validate required fields
      if (!rideData.pickup_latitude || !rideData.pickup_longitude) {
        throw new Error('Pickup coordinates are required');
      }
      if (!rideData.dropoff_latitude || !rideData.dropoff_longitude) {
        throw new Error('Dropoff coordinates are required');
      }
      if (!rideData.pickup_address) {
        throw new Error('Pickup address is required');
      }
      if (!rideData.dropoff_address) {
        throw new Error('Dropoff address is required');
      }
      if (!rideData.vehicle_type) {
        throw new Error('Vehicle type is required');
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
    } catch (error: any) {
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
        const responseData = error.response.data;

        console.error('🚨 Error response data:', JSON.stringify(responseData, null, 2));
        console.error('🚨 Error status:', status);

        if (status === 401) {
          throw new Error('Authentication required. Please login again.');
        } else if (status === 422) {
          // Handle validation errors with detailed field information
          let validationMessage = 'Validation error';

          if (responseData?.error?.details) {
            // New API format with nested error details
            const details = responseData.error.details;
            const errorMessages = Object.keys(details).map(field => {
              const fieldErrors = Array.isArray(details[field]) ? details[field] : [details[field]];
              return `${field}: ${fieldErrors.join(', ')}`;
            });
            validationMessage = errorMessages.join('; ');
          } else if (responseData?.errors) {
            // Laravel-style validation errors
            const errors = responseData.errors;
            const errorMessages = Object.keys(errors).map(field => {
              const fieldErrors = Array.isArray(errors[field]) ? errors[field] : [errors[field]];
              return `${field}: ${fieldErrors.join(', ')}`;
            });
            validationMessage = errorMessages.join('; ');
          } else if (responseData?.message) {
            validationMessage = responseData.message;
          } else if (responseData?.error?.message) {
            validationMessage = responseData.error.message;
          } else {
            validationMessage = JSON.stringify(responseData);
          }

          throw new Error(validationMessage);
        } else if (status === 500) {
          const message = responseData?.message || responseData?.error || 'Unknown server error';
          throw new Error(`Server error: ${message}`);
        } else {
          const message = responseData?.message || responseData?.error || 'Unknown server error';
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
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    vehicle_type?: string;
  }): Promise<PaginatedRides> {
    try {
      console.log('📋 Fetching rides:', params);
      const response = await apiService.get(`${this.baseUrl}`, { params });
      console.log('✅ Rides fetched successfully:', response.data);
      
      // Handle case where response.data might be undefined
      if (!response || response.data === undefined) {
        console.warn('⚠️ API returned empty response');
        return { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 };
      }
      // Backend may return array directly or paginated { data: [...] }
      const list = Array.isArray(response.data)
        ? response.data
        : (response.data?.data ?? []);
      const total = Array.isArray(list) ? list.length : 0;
      return {
        data: Array.isArray(list) ? list : [],
        current_page: 1,
        last_page: 1,
        per_page: total || 10,
        total: total || 0,
      };
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

  // POST /rides/estimate — fare estimate (doc 8.3). Request body: pickupLocation, dropoffLocation, additionalStops?, vehicleType, rideMode.
  // On 405 or other error, returns { data: undefined } so caller can fall back to local calculation without surfacing error.
  async getFareEstimate(body: EstimateRequestDoc): Promise<{ data?: EstimateResponseDoc }> {
    try {
      console.log('💰 Fetching fare estimate:', body);
      const response = await apiService.post(`${this.baseUrl}/estimate`, body);
      console.log('✅ Fare estimate received:', response.data);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 405) {
        console.log('Fare estimate endpoint not available (405), using local calculation');
      } else {
        console.warn('Fare estimate failed:', status ?? error?.message);
      }
      return { data: undefined };
    }
  }

  // POST /rides/create — create ride with doc payload (estimateId, pickupLocation, etc.)
  async createRideFromEstimate(body: CreateRideRequestDoc): Promise<RideResource> {
    try {
      console.log('🚗 Creating ride from estimate:', body);
      const response = await apiService.post(`${this.baseUrl}/create`, body);
      const data = response.data?.data ?? response.data;
      console.log('✅ Ride created:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to create ride from estimate:', error);
      throw error;
    }
  }

  // GET /rides/:rideId/track — real-time tracking (doc 8.3)
  async getRideTrack(rideId: number): Promise<any> {
    try {
      const response = await apiService.get(`${this.baseUrl}/${rideId}/track`);
      return response.data?.data ?? response.data;
    } catch (error) {
      console.error('❌ Failed to get ride track:', error);
      throw error;
    }
  }

  // Update ride status and details — PUT /api/rides/:id (doc Phases 5.3, 6.1, 7.1)
  async updateRide(rideId: number, updateData: RideUpdate): Promise<RideResource> {
    try {
      console.log('🔄 Updating ride:', rideId, updateData);
      const response = await apiService.put(`${this.baseUrl}/${rideId}`, updateData);
      console.log('✅ Ride updated successfully:', response.data);
      return response.data?.data ?? response.data;
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

  // Assign driver to a ride — POST /rides/:id/assign-driver with { driver_id }
  async assignDriver(rideId: number, driverId: number): Promise<RideResource> {
    const response = await apiService.post(`${this.baseUrl}/${rideId}/assign-driver`, {
      driver_id: Number(driverId),
    });
    return response.data?.data ?? response.data;
  }

  // Cancel a ride (optional body per doc: reason, comments, cancelledBy)
  async cancelRide(rideId: number, options?: CancelRideRequestDoc): Promise<RideResource> {
    try {
      console.log('❌ Cancelling ride:', rideId, options);
      const response = await apiService.post(`${this.baseUrl}/${rideId}/cancel`, options ?? {});
      console.log('✅ Ride cancelled successfully:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to cancel ride:', error);
      throw error;
    }
  }

  // Driver accepts a ride (uses POST /rides/:id/assign-driver per API doc)
  async acceptRide(rideId: number, driverId: number): Promise<RideResource> {
    return this.assignDriver(rideId, driverId);
  }

  // Start a ride — PUT /api/rides/:id with { status: 'ongoing', started_at } (doc Phase 6.1)
  async startRide(rideId: number): Promise<RideResource> {
    try {
      console.log('🚀 Starting ride:', rideId);
      const startedAt = new Date().toISOString();
      const response = await this.updateRide(rideId, {
        status: 'ongoing',
        started_at: startedAt,
      });
      console.log('✅ Ride started successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to start ride:', error);
      throw error;
    }
  }

  // Complete a ride — PUT /api/rides/:id with status, fare, distance_km, duration_min, completed_at (doc Phase 7.1)
  async completeRide(rideId: number, fare?: number, distanceKm?: number, durationMin?: number): Promise<RideResource> {
    try {
      console.log('🏁 Completing ride:', rideId, { fare, distanceKm, durationMin });
      const completedAt = new Date().toISOString();
      const response = await this.updateRide(rideId, {
        status: 'completed',
        fare,
        distance_km: distanceKm,
        duration_min: durationMin,
        completed_at: completedAt,
      });
      console.log('✅ Ride completed successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to complete ride:', error);
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

  // Get drivers in radius (legacy) — GET /tracking/drivers-in-radius
  async getDriversInRadius(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<DriverInRadius[]> {
    try {
      console.log('🔍 Finding drivers in radius:', { latitude, longitude, radiusKm });
      const response = await apiService.get('/tracking/drivers-in-radius', {
        params: { latitude, longitude, radius_km: radiusKm },
      });
      console.log('✅ Drivers found successfully:', response.data);
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Failed to find drivers in radius:', error);
      throw error;
    }
  }

  // Get nearby drivers — GET /api/rides/nearby-drivers (doc Phase 3.2).
  async getNearbyDrivers(
    latitude: number,
    longitude: number,
    radius: number = 10,
    vehicleType?: string
  ): Promise<DriverInRadius[]> {
    try {
      console.log('🔍 Finding nearby drivers:', { latitude, longitude, radius, vehicle_type: vehicleType });
      const response = await apiService.get(`${this.baseUrl}/nearby-drivers`, {
        params: { latitude, longitude, radius, vehicle_type: vehicleType ?? 'car' },
      });
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return this.getDriversInRadius(latitude, longitude, radius);
      }
      console.error('❌ Failed to find nearby drivers:', error);
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

  // Get pending rides for driver — GET /api/rides/pending (doc Phase 4.1).
  // Params: driver_id, latitude, longitude, radius, vehicle_type.
  async getPendingRides(params?: {
    driver_id?: number;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    radius?: number;
    vehicle_type?: string;
  }): Promise<RideResource[]> {
    try {
      const { radius_km, radius, ...rest } = params ?? {};
      const radiusParam = radius ?? radius_km ?? 10;
      console.log('⏳ Fetching pending rides', params);
      const response = await apiService.get(`${this.baseUrl}/pending`, {
        params: { ...rest, radius: radiusParam },
      });
      const raw = response.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      const arr = Array.isArray(list) ? list : [];
      return arr.filter((r: RideResource) => r && r.status === 'requested');
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.response?.status === 422) {
        const response = await this.getRides({
          status: 'requested',
          ...params,
        });
        if (!response) return [];
        const list = Array.isArray(response.data) ? response.data : response.data || [];
        const arr = Array.isArray(list) ? list : [];
        return arr.filter((r: RideResource) => r && r.status === 'requested');
      }
      console.error('❌ Failed to fetch pending rides:', error);
      throw error;
    }
  }

  // GET /drivers/ride-requests — pending ride requests for driver (doc 9.2)
  async getDriverRideRequests(): Promise<DriverRideRequestDoc[]> {
    try {
      const response = await apiService.get(`${this.driversUrl}/ride-requests`);
      const requests = response.data?.data?.requests ?? response.data?.requests ?? [];
      return Array.isArray(requests) ? requests : [];
    } catch (error: any) {
      return [];
    }
  }

  // POST /drivers/ride-requests/:requestId/accept (doc 9.2)
  async acceptDriverRequest(requestId: string, body: AcceptDriverRequestDoc): Promise<RideResource> {
    const response = await apiService.post(`${this.driversUrl}/ride-requests/${requestId}/accept`, body);
    const data = response.data?.data ?? response.data;
    return data;
  }

  // POST /drivers/ride-requests/:requestId/reject (doc 9.2)
  async rejectDriverRequest(requestId: string, body?: RejectDriverRequestDoc): Promise<void> {
    await apiService.post(`${this.driversUrl}/ride-requests/${requestId}/reject`, body ?? {});
  }

  // Driver arrives at pickup — PUT /api/rides/:id with { status: 'arrived' } (doc Phase 5.3)
  async driverArrived(rideId: number, _body?: { currentLocation: { latitude: number; longitude: number }; arrivedAt?: string }): Promise<RideResource> {
    try {
      const response = await this.updateRide(rideId, { status: 'arrived' });
      return response;
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.response?.status === 422) {
        const response = await apiService.post(`${this.driversUrl}/rides/${rideId}/arrived`, _body ?? {});
        return response.data?.data ?? response.data;
      }
      console.error('❌ Failed to mark arrived:', error);
      throw error;
    }
  }

  // Driver starts ride — PUT /api/rides/:id with { status: 'ongoing', started_at } (doc Phase 6.1)
  async driverStartRide(rideId: number, _body?: { currentLocation: { latitude: number; longitude: number }; startOTP?: string }): Promise<RideResource> {
    try {
      const startedAt = new Date().toISOString();
      return await this.updateRide(rideId, { status: 'ongoing', started_at: startedAt });
    } catch (error: any) {
      if (error?.response?.status === 404 || error?.response?.status === 422) {
        const response = await apiService.post(`${this.driversUrl}/rides/${rideId}/start`, _body ?? {});
        return response.data?.data ?? response.data;
      }
      console.error('❌ Failed to start ride (driver):', error);
      throw error;
    }
  }

  // PUT /drivers/status — toggle driver online/offline with real-time location. Call before accepting rides.
  async updateDriverStatus(body: { status: 'online' | 'offline' | 'busy' | 'break'; currentLocation?: { latitude: number; longitude: number; heading?: number; speed?: number; accuracy?: number } }): Promise<any> {
    const response = await apiService.put(`${this.driversUrl}/status`, body);
    return response.data?.data ?? response.data;
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

  // Get driver location by ID
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