import { apiClient, ApiResponse } from './api';

// Ride Types based on API documentation
export interface Ride {
  id: number;
  passenger_id: number;
  driver_id?: number;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  status: 'requested' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
  fare?: number;
  distance_km?: number;
  duration_min?: number;
  vehicle_type?: string;
  created_at: string;
  updated_at: string;
  passenger?: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  driver?: {
    id: number;
    name: string;
    phone: string;
    email: string;
    vehicle_type: string;
    rating?: number;
  };
}

export interface CreateRideRequest {
  passenger_id: number;
  pickup_address: string;
  dropoff_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  vehicle_type?: string;
}

export interface UpdateRideRequest {
  status?: 'requested' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
  driver_id?: number;
  fare?: number;
  distance_km?: number;
  duration_min?: number;
}

export interface AssignDriverRequest {
  driver_id: number;
}

export interface RideFilters {
  status?: string;
  passenger_id?: number;
  driver_id?: number;
  page?: number;
  per_page?: number;
}

export interface PaginatedRides {
  data: Ride[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// Driver Tracking Types
export interface DriverLocation {
  id: number;
  driver_id: number;
  latitude: number;
  longitude: number;
  status: 'online' | 'available' | 'busy' | 'offline';
  address?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateLocationRequest {
  latitude: number;
  longitude: number;
  status?: 'online' | 'available' | 'busy' | 'offline';
  address?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

export interface DriversInRadiusRequest {
  latitude: number;
  longitude: number;
  radius_km: number;
}

// Payment Types
export interface Transaction {
  id: number;
  user_id: number;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference_id?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: number;
  user_id: number;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface AdjustWalletRequest {
  amount: number;
  reason?: string;
}

// Legacy interfaces for backward compatibility
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RideRequest {
  id?: string;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  passengerRating: number;
  pickup: Location;
  destination: Location;
  fare: number;
  distance: string;
  duration: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  vehicleInfo?: {
    type: string;
    brand: string;
    model: string;
    color: string;
    plateNumber: string;
  };
  requestedAt: any;
  acceptedAt?: any;
  startedAt?: any;
  completedAt?: any;
  cancelledAt?: any;
  cancellationReason?: string;
  paymentMethod?: 'cash' | 'card' | 'wallet';
  paymentStatus?: 'pending' | 'completed' | 'failed';
  rating?: {
    passengerRating?: number;
    driverRating?: number;
    passengerComment?: string;
    driverComment?: string;
  };
}

// Ride Service Class
class RideService {
  // Ride Management
  async createRide(rideData: CreateRideRequest): Promise<ApiResponse<{ ride: Ride }>> {
    console.log('🚗 Ride Service - Creating new ride...');
    console.log('📡 Endpoint: POST /rides');
    console.log('📋 Ride data:', rideData);
    
    try {
      const response = await apiClient.post('/rides', rideData);
      
      console.log('📨 Ride Service - Ride creation response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Response data:', response.data);
      
      if (response.data.success) {
        console.log('✅ Ride created successfully');
        console.log('🆔 Ride ID:', response.data.data?.ride?.id);
        console.log('📍 Pickup:', response.data.data?.ride?.pickup_address);
        console.log('🎯 Destination:', response.data.data?.ride?.dropoff_address);
        console.log('📊 Status:', response.data.data?.ride?.status);
      } else {
        console.log('❌ Ride creation failed:', response.data.message);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Ride Service - Ride creation error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        rideData: rideData
      });
      throw error;
    }
  }

  async getRides(filters?: RideFilters): Promise<ApiResponse<PaginatedRides>> {
    console.log('🚗 Ride Service - Fetching rides...');
    console.log('📡 Endpoint: GET /rides');
    console.log('🔍 Filters:', filters);
    
    try {
      const response = await apiClient.get('/rides', { params: filters });
      
      console.log('📨 Ride Service - Rides fetch response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Total rides:', response.data.data?.total || 0);
      console.log('📄 Current page:', response.data.data?.current_page || 1);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Ride Service - Rides fetch error:', error);
      throw error;
    }
  }

  async getRide(rideId: number): Promise<ApiResponse<{ ride: Ride }>> {
    console.log('🚗 Ride Service - Fetching ride details...');
    console.log('📡 Endpoint: GET /rides/' + rideId);
    
    try {
      const response = await apiClient.get(`/rides/${rideId}`);
      
      console.log('📨 Ride Service - Ride details response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Ride data:', response.data.data?.ride);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Ride Service - Ride details error:', error);
      throw error;
    }
  }

  async updateRide(rideId: number, updateData: UpdateRideRequest): Promise<ApiResponse<{ ride: Ride }>> {
    console.log('🚗 Ride Service - Updating ride...');
    console.log('📡 Endpoint: PUT /rides/' + rideId);
    console.log('📋 Update data:', updateData);
    
    try {
      const response = await apiClient.put(`/rides/${rideId}`, updateData);
      
      console.log('📨 Ride Service - Ride update response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Updated ride:', response.data.data?.ride);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Ride Service - Ride update error:', error);
      throw error;
    }
  }

  async deleteRide(rideId: number): Promise<ApiResponse> {
    console.log('🚗 Ride Service - Deleting ride...');
    console.log('📡 Endpoint: DELETE /rides/' + rideId);
    
    try {
      const response = await apiClient.delete(`/rides/${rideId}`);
      
      console.log('📨 Ride Service - Ride deletion response received');
      console.log('📊 Response status:', response.status);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Ride Service - Ride deletion error:', error);
      throw error;
    }
  }

  async assignDriver(rideId: number, driverData: AssignDriverRequest): Promise<ApiResponse<{ ride: Ride }>> {
    console.log('🚗 Ride Service - Assigning driver to ride...');
    console.log('📡 Endpoint: POST /rides/' + rideId + '/assign-driver');
    console.log('👨‍💼 Driver ID:', driverData.driver_id);
    
    try {
      const response = await apiClient.post(`/rides/${rideId}/assign-driver`, driverData);
      
      console.log('📨 Ride Service - Driver assignment response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Updated ride:', response.data.data?.ride);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Ride Service - Driver assignment error:', error);
      throw error;
    }
  }

  async cancelRide(rideId: number): Promise<ApiResponse<{ ride: Ride }>> {
    console.log('🚗 Ride Service - Cancelling ride...');
    console.log('📡 Endpoint: POST /rides/' + rideId + '/cancel');
    
    try {
      const response = await apiClient.post(`/rides/${rideId}/cancel`);
      
      console.log('📨 Ride Service - Ride cancellation response received');
      console.log('📊 Response status:', response.status);
      console.log('📋 Cancelled ride:', response.data.data?.ride);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Ride Service - Ride cancellation error:', error);
      throw error;
    }
  }

  // Driver Tracking
  async updateLocation(locationData: UpdateLocationRequest): Promise<ApiResponse<{ location: DriverLocation }>> {
    console.log('📍 Tracking Service - Updating driver location...');
    console.log('📡 Endpoint: POST /tracking/update-location');
    console.log('📍 Location:', {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      status: locationData.status
    });
    
    try {
      const response = await apiClient.post('/tracking/update-location', locationData);
      
      console.log('📨 Tracking Service - Location update response received');
      console.log('📊 Response status:', response.status);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Tracking Service - Location update error:', error);
      throw error;
    }
  }

  async getDriverLatestLocation(driverId: number): Promise<ApiResponse<{ location: DriverLocation }>> {
    console.log('📍 Tracking Service - Fetching driver latest location...');
    console.log('📡 Endpoint: GET /tracking/driver/' + driverId + '/latest');
    
    try {
      const response = await apiClient.get(`/tracking/driver/${driverId}/latest`);
      
      console.log('📨 Tracking Service - Driver location response received');
      console.log('📊 Response status:', response.status);
      console.log('📍 Location:', response.data.data?.location);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Tracking Service - Driver location error:', error);
      throw error;
    }
  }

  async getDriversInRadius(radiusData: DriversInRadiusRequest): Promise<ApiResponse<{ drivers: DriverLocation[] }>> {
    console.log('📍 Tracking Service - Finding drivers in radius...');
    console.log('📡 Endpoint: GET /tracking/drivers-in-radius');
    console.log('🔍 Radius data:', radiusData);
    
    try {
      const response = await apiClient.get('/tracking/drivers-in-radius', { params: radiusData });
      
      console.log('📨 Tracking Service - Drivers in radius response received');
      console.log('📊 Response status:', response.status);
      console.log('👨‍💼 Drivers found:', response.data.data?.drivers?.length || 0);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Tracking Service - Drivers in radius error:', error);
      throw error;
    }
  }

  async getRidePath(rideId: number): Promise<ApiResponse<{ path: any[] }>> {
    console.log('📍 Tracking Service - Fetching ride path...');
    console.log('📡 Endpoint: GET /tracking/ride/' + rideId + '/path');
    
    try {
      const response = await apiClient.get(`/tracking/ride/${rideId}/path`);
      
      console.log('📨 Tracking Service - Ride path response received');
      console.log('📊 Response status:', response.status);
      console.log('🛣️ Path points:', response.data.data?.path?.length || 0);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Tracking Service - Ride path error:', error);
      throw error;
    }
  }

  // Payment Management
  async getTransactions(): Promise<ApiResponse<{ transactions: Transaction[] }>> {
    console.log('💳 Payment Service - Fetching transactions...');
    console.log('📡 Endpoint: GET /payments/transactions');
    
    try {
      const response = await apiClient.get('/payments/transactions');
      
      console.log('📨 Payment Service - Transactions response received');
      console.log('📊 Response status:', response.status);
      console.log('💳 Transactions count:', response.data.data?.transactions?.length || 0);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Payment Service - Transactions error:', error);
      throw error;
    }
  }

  async getTransaction(transactionId: number): Promise<ApiResponse<{ transaction: Transaction }>> {
    console.log('💳 Payment Service - Fetching transaction details...');
    console.log('📡 Endpoint: GET /payments/transactions/' + transactionId);
    
    try {
      const response = await apiClient.get(`/payments/transactions/${transactionId}`);
      
      console.log('📨 Payment Service - Transaction details response received');
      console.log('📊 Response status:', response.status);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Payment Service - Transaction details error:', error);
      throw error;
    }
  }

  async adjustWallet(walletId: number, adjustData: AdjustWalletRequest): Promise<ApiResponse<{ wallet: Wallet }>> {
    console.log('💳 Payment Service - Adjusting wallet...');
    console.log('📡 Endpoint: POST /payments/wallets/' + walletId + '/adjust');
    console.log('💰 Amount:', adjustData.amount);
    
    try {
      const response = await apiClient.post(`/payments/wallets/${walletId}/adjust`, adjustData);
      
      console.log('📨 Payment Service - Wallet adjustment response received');
      console.log('📊 Response status:', response.status);
      console.log('💰 New balance:', response.data.data?.wallet?.balance);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Payment Service - Wallet adjustment error:', error);
      throw error;
    }
  }

  async getWalletTransactions(walletId: number): Promise<ApiResponse<{ transactions: Transaction[] }>> {
    console.log('💳 Payment Service - Fetching wallet transactions...');
    console.log('📡 Endpoint: GET /payments/wallets/' + walletId + '/transactions');
    
    try {
      const response = await apiClient.get(`/payments/wallets/${walletId}/transactions`);
      
      console.log('📨 Payment Service - Wallet transactions response received');
      console.log('📊 Response status:', response.status);
      console.log('💳 Transactions count:', response.data.data?.transactions?.length || 0);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Payment Service - Wallet transactions error:', error);
      throw error;
    }
  }

  async getFinancialReport(): Promise<ApiResponse<{ report: any }>> {
    console.log('💳 Payment Service - Fetching financial report...');
    console.log('📡 Endpoint: GET /payments/reports/financial');
    
    try {
      const response = await apiClient.get('/payments/reports/financial');
      
      console.log('📨 Payment Service - Financial report response received');
      console.log('📊 Response status:', response.status);
      
      return response.data;
    } catch (error: any) {
      console.error('💥 Payment Service - Financial report error:', error);
      throw error;
    }
  }

  // Real-time ride updates (WebSocket simulation)
  async listenToRideUpdates(rideId: number, onUpdate: (ride: Ride) => void): Promise<() => void> {
    console.log('🔄 Real-time Service - Starting ride updates listener...');
    console.log('🆔 Ride ID:', rideId);
    
    // Simulate real-time updates with polling
    const pollInterval = setInterval(async () => {
      try {
        const response = await this.getRide(rideId);
        if (response.success && response.data?.ride) {
          onUpdate(response.data.ride);
        }
      } catch (error) {
        console.error('💥 Real-time Service - Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
    
    // Return cleanup function
    return () => {
      console.log('🔄 Real-time Service - Stopping ride updates listener...');
      clearInterval(pollInterval);
    };
  }

  // Utility methods
  calculateFare(distanceKm: number, durationMin: number, vehicleType: string = 'economy'): number {
    const baseFare = 50; // PKR
    const perKmRate = 25; // PKR per km
    const perMinRate = 2; // PKR per minute
    
    const vehicleMultiplier = {
      'bike': 0.6,
      'economy': 1.0,
      'comfort': 1.4,
      'premium': 2.0
    }[vehicleType] || 1.0;
    
    const totalFare = (baseFare + (distanceKm * perKmRate) + (durationMin * perMinRate)) * vehicleMultiplier;
    return Math.round(totalFare);
  }

  formatRideStatus(status: string): string {
    const statusMap = {
      'requested': 'Requested',
      'accepted': 'Accepted',
      'ongoing': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  }

  getRideStatusColor(status: string): string {
    const colorMap = {
      'requested': '#3B82F6', // Blue
      'accepted': '#10B981', // Green
      'ongoing': '#F59E0B', // Yellow
      'completed': '#6B7280', // Gray
      'cancelled': '#EF4444' // Red
    };
    return colorMap[status as keyof typeof colorMap] || '#6B7280';
  }
}

// Export singleton instance
export const rideService = new RideService();
export default rideService;

// Legacy functions for backward compatibility
export const calculateDistance = (point1: Location, point2: Location): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const calculateFare = (pickup: Location, destination: Location, vehicleType: string = 'car'): {
  fare: number;
  distance: string;
  duration: string;
} => {
  const distance = calculateDistance(pickup, destination);
  
  // Base fare and per km rates (in PKR)
  const baseFares = {
    car: 50,
    bike: 30,
    van: 70,
    truck: 100,
  };
  
  const perKmRates = {
    car: 25,
    bike: 15,
    van: 35,
    truck: 50,
  };
  
  const baseFare = baseFares[vehicleType as keyof typeof baseFares] || baseFares.car;
  const perKmRate = perKmRates[vehicleType as keyof typeof perKmRates] || perKmRates.car;
  
  const fare = Math.round(baseFare + (distance * perKmRate));
  const duration = Math.round(distance * 2); // Rough estimate: 2 minutes per km
  
  return {
    fare,
    distance: `${distance.toFixed(1)} km`,
    duration: `${duration} min`,
  };
};

export const getRideHistory = async (userId: string, userType: 'passenger' | 'driver'): Promise<RideRequest[]> => {
  try {
    const response = await rideService.getRides({
      [userType === 'passenger' ? 'passenger_id' : 'driver_id']: parseInt(userId),
      status: 'completed'
    });
    
    if (response.success && response.data) {
      // Convert API format to legacy format
      return response.data.data.map(ride => ({
        id: ride.id.toString(),
        passengerId: ride.passenger_id.toString(),
        passengerName: ride.passenger?.name || 'Unknown',
        passengerPhone: ride.passenger?.phone || '',
        passengerRating: 5,
        pickup: {
          latitude: ride.pickup_latitude,
          longitude: ride.pickup_longitude,
          address: ride.pickup_address
        },
        destination: {
          latitude: ride.dropoff_latitude,
          longitude: ride.dropoff_longitude,
          address: ride.dropoff_address
        },
        fare: ride.fare || 0,
        distance: ride.distance_km ? `${ride.distance_km} km` : '0 km',
        duration: ride.duration_min ? `${ride.duration_min} min` : '0 min',
        status: ride.status === 'ongoing' ? 'in_progress' : ride.status as any,
        driverId: ride.driver_id?.toString(),
        driverName: ride.driver?.name,
        driverPhone: ride.driver?.phone,
        driverRating: ride.driver?.rating,
        vehicleInfo: ride.vehicle_type ? {
          type: ride.vehicle_type,
          brand: '',
          model: '',
          color: '',
          plateNumber: ''
        } : undefined,
        requestedAt: ride.created_at,
        acceptedAt: ride.status === 'accepted' ? ride.updated_at : undefined,
        startedAt: ride.status === 'ongoing' ? ride.updated_at : undefined,
        completedAt: ride.status === 'completed' ? ride.updated_at : undefined,
        cancelledAt: ride.status === 'cancelled' ? ride.updated_at : undefined,
        paymentMethod: 'cash' as const,
        paymentStatus: 'completed' as const
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error getting ride history:', error);
    throw new Error('Failed to get ride history');
  }
};

export const rateRide = async (rideId: string, rating: number, comment: string, ratedBy: 'passenger' | 'driver'): Promise<void> => {
  try {
    // This would need to be implemented in the API
    console.log('Rating ride:', { rideId, rating, comment, ratedBy });
    // For now, just log the rating
  } catch (error) {
    console.error('Error rating ride:', error);
    throw new Error('Failed to rate ride');
  }
};

// Legacy functions for backward compatibility
export const createRideRequest = async (rideData: Omit<RideRequest, 'id' | 'requestedAt'>): Promise<string> => {
  try {
    const response = await rideService.createRide({
      passenger_id: parseInt(rideData.passengerId),
      pickup_address: rideData.pickup.address || '',
      dropoff_address: rideData.destination.address || '',
      pickup_latitude: rideData.pickup.latitude,
      pickup_longitude: rideData.pickup.longitude,
      dropoff_latitude: rideData.destination.latitude,
      dropoff_longitude: rideData.destination.longitude,
      vehicle_type: rideData.vehicleInfo?.type
    });
    
    if (response.success && response.data?.ride) {
      return response.data.ride.id.toString();
    }
    
    throw new Error('Failed to create ride request');
  } catch (error) {
    console.error('Error creating ride request:', error);
    throw new Error('Failed to create ride request');
  }
};

export const updateRideStatus = async (rideId: string, updates: Partial<RideRequest>): Promise<void> => {
  try {
    const statusMap = {
      'pending': 'requested',
      'accepted': 'accepted',
      'in_progress': 'ongoing',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    
    const apiStatus = statusMap[updates.status as keyof typeof statusMap];
    if (apiStatus) {
      await rideService.updateRide(parseInt(rideId), {
        status: apiStatus as any,
        driver_id: updates.driverId ? parseInt(updates.driverId) : undefined,
        fare: updates.fare,
        distance_km: updates.distance ? parseFloat(updates.distance.replace(' km', '')) : undefined,
        duration_min: updates.duration ? parseInt(updates.duration.replace(' min', '')) : undefined
      });
    }
  } catch (error) {
    console.error('Error updating ride status:', error);
    throw new Error('Failed to update ride status');
  }
};

export const acceptRideRequest = async (rideId: string, driverId: string, driverInfo: any): Promise<void> => {
  try {
    await rideService.assignDriver(parseInt(rideId), { driver_id: parseInt(driverId) });
  } catch (error) {
    console.error('Error accepting ride request:', error);
    throw new Error('Failed to accept ride request');
  }
};

export const startRide = async (rideId: string): Promise<void> => {
  try {
    await rideService.updateRide(parseInt(rideId), { status: 'ongoing' });
  } catch (error) {
    console.error('Error starting ride:', error);
    throw new Error('Failed to start ride');
  }
};

export const completeRide = async (rideId: string, paymentInfo?: any): Promise<void> => {
  try {
    await rideService.updateRide(parseInt(rideId), { status: 'completed' });
  } catch (error) {
    console.error('Error completing ride:', error);
    throw new Error('Failed to complete ride');
  }
};

export const cancelRide = async (rideId: string, reason: string, cancelledBy: 'passenger' | 'driver'): Promise<void> => {
  try {
    await rideService.cancelRide(parseInt(rideId));
  } catch (error) {
    console.error('Error cancelling ride:', error);
    throw new Error('Failed to cancel ride');
  }
};

export const getNearbyDrivers = async (userLocation: Location, radiusKm: number = 5): Promise<DriverLocation[]> => {
  try {
    const response = await rideService.getDriversInRadius({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      radius_km: radiusKm
    });
    
    if (response.success && response.data?.drivers) {
      return response.data.drivers.map(driver => ({
        driverId: driver.driver_id.toString(),
        location: {
          latitude: driver.latitude,
          longitude: driver.longitude,
          address: driver.address
        },
        isOnline: driver.status === 'online' || driver.status === 'available',
        lastSeen: driver.updated_at
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error getting nearby drivers:', error);
    throw new Error('Failed to get nearby drivers');
  }
};

export const updateDriverLocation = async (driverId: string, location: Location): Promise<void> => {
  try {
    await rideService.updateLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      status: 'online'
    });
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw new Error('Failed to update driver location');
  }
};

export const setDriverStatus = async (driverId: string, isOnline: boolean): Promise<void> => {
  try {
    await rideService.updateLocation({
      latitude: 0, // This would need to be the current location
      longitude: 0,
      status: isOnline ? 'online' : 'offline'
    });
  } catch (error) {
    console.error('Error setting driver status:', error);
    throw new Error('Failed to set driver status');
  }
};

export const listenToRideRequests = (driverId: string, callback: (rides: RideRequest[]) => void) => {
  // This would need to be implemented with WebSocket or polling
  console.log('Listening to ride requests for driver:', driverId);
  // Return a cleanup function
  return () => {
    console.log('Stopped listening to ride requests');
  };
};

export const listenToActiveRide = (passengerId: string, callback: (ride: RideRequest | null) => void) => {
  // This would need to be implemented with WebSocket or polling
  console.log('Listening to active ride for passenger:', passengerId);
  // Return a cleanup function
  return () => {
    console.log('Stopped listening to active ride');
  };
};
