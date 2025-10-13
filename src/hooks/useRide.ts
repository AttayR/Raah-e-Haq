import { useState, useEffect, useCallback } from 'react';
import rideService, { RideResource, RideRequest, DriverInRadius, DriverLocation } from '../services/rideService';
import { usePassengerNotifications } from './usePassengerNotifications';
import { useDriverNotifications } from './useDriverNotifications';

export interface RideState {
  currentRide: RideResource | null;
  rideHistory: RideResource[];
  availableDrivers: DriverInRadius[];
  isLoading: boolean;
  error: string | null;
}

export interface RideActions {
  requestRide: (rideData: RideRequest) => Promise<RideResource>;
  acceptRide: (rideId: number, driverId: number) => Promise<RideResource>;
  startRide: (rideId: number) => Promise<RideResource>;
  completeRide: (rideId: number, fare?: number, distance?: number, duration?: number) => Promise<RideResource>;
  cancelRide: (rideId: number) => Promise<RideResource>;
  updateDriverLocation: (location: DriverLocation) => Promise<void>;
  findNearbyDrivers: (latitude: number, longitude: number, radius?: number) => Promise<DriverInRadius[]>;
  refreshRide: (rideId: number) => Promise<RideResource>;
  refreshRideHistory: () => Promise<void>;
  clearError: () => void;
}

export const useRide = (userId?: number, userType?: 'passenger' | 'driver') => {
  const [state, setState] = useState<RideState>({
    currentRide: null,
    rideHistory: [],
    availableDrivers: [],
    isLoading: false,
    error: null,
  });

  // Use notifications based on user type
  const passengerNotifications = usePassengerNotifications(userId?.toString());
  const driverNotifications = useDriverNotifications(userId?.toString());

  // Request a ride (Passenger)
  const requestRide = useCallback(async (rideData: RideRequest): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('🚗 Requesting ride:', rideData);
      const ride = await rideService.createRide(rideData);
      
      setState(prev => ({
        ...prev,
        currentRide: ride,
        isLoading: false,
      }));

      // Find nearby drivers and send notifications
      const drivers = await findNearbyDrivers(
        rideData.pickup_latitude,
        rideData.pickup_longitude,
        5 // 5km radius
      );

      // Send notifications to nearby drivers
      for (const driver of drivers) {
        await passengerNotifications.sendRideRequestNotification(driver.id, {
          rideId: ride.id,
          passengerName: 'Passenger', // TODO: Get actual passenger name
          pickup: {
            latitude: rideData.pickup_latitude,
            longitude: rideData.pickup_longitude,
            address: rideData.pickup_address,
          },
          destination: {
            latitude: rideData.dropoff_latitude,
            longitude: rideData.dropoff_longitude,
            address: rideData.dropoff_address,
          },
          fare: 0, // Will be calculated
          distance: '0 km', // Will be calculated
        });
      }

      console.log('✅ Ride requested successfully:', ride);
      return ride;
    } catch (error) {
      console.error('❌ Failed to request ride:', error);
      
      // Handle different types of errors
      let errorMessage = 'Failed to request ride';
      
      if (error && typeof error === 'object') {
        if ('message' in error) {
          const errorObj = error as Error;
          if (errorObj.message.includes('Property') && errorObj.message.includes("doesn't exist")) {
            errorMessage = 'There was an issue with the app data. Please restart the app.';
          } else if (errorObj.message.includes('Network')) {
            errorMessage = 'Network connection issue. Please check your internet connection.';
          } else if (errorObj.message.includes('Authentication')) {
            errorMessage = 'Authentication error. Please log in again.';
          } else if (errorObj.message.includes('Database') || errorObj.message.includes('SQL')) {
            errorMessage = 'Server error. Please try again in a moment.';
          } else {
            errorMessage = errorObj.message;
          }
        }
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [passengerNotifications]);

  // Accept a ride (Driver)
  const acceptRide = useCallback(async (rideId: number, driverId: number): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('✅ Accepting ride:', rideId, driverId);
      const ride = await rideService.acceptRide(rideId, driverId);
      
      setState(prev => ({
        ...prev,
        currentRide: ride,
        isLoading: false,
      }));

      // Send notification to passenger
      await driverNotifications.sendRideAcceptedNotification(ride.passenger_id, {
        rideId: ride.id,
        driverName: 'Driver', // TODO: Get actual driver name
        driverPhone: 'N/A', // TODO: Get actual driver phone
        estimatedArrival: '5 minutes',
      });

      console.log('✅ Ride accepted successfully:', ride);
      return ride;
    } catch (error) {
      console.error('❌ Failed to accept ride:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to accept ride',
      }));
      throw error;
    }
  }, [driverNotifications]);

  // Start a ride (Driver)
  const startRide = useCallback(async (rideId: number): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('🚀 Starting ride:', rideId);
      const ride = await rideService.startRide(rideId);
      
      setState(prev => ({
        ...prev,
        currentRide: ride,
        isLoading: false,
      }));

      // Send notification to passenger
      await driverNotifications.sendRideStartedNotification(ride.passenger_id, {
        rideId: ride.id,
        driverName: 'Driver', // TODO: Get actual driver name
        destination: ride.dropoff_address,
        estimatedDuration: '15 minutes',
      });

      console.log('✅ Ride started successfully:', ride);
      return ride;
    } catch (error) {
      console.error('❌ Failed to start ride:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start ride',
      }));
      throw error;
    }
  }, [driverNotifications]);

  // Complete a ride (Driver)
  const completeRide = useCallback(async (
    rideId: number,
    fare?: number,
    distance?: number,
    duration?: number
  ): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('🏁 Completing ride:', rideId, { fare, distance, duration });
      const ride = await rideService.completeRide(rideId, fare, distance, duration);
      
      setState(prev => ({
        ...prev,
        currentRide: null,
        rideHistory: [ride, ...prev.rideHistory],
        isLoading: false,
      }));

      // Send notification to passenger
      await driverNotifications.sendRideCompletedNotification(ride.passenger_id, {
        rideId: ride.id,
        driverName: 'Driver', // TODO: Get actual driver name
        fare: fare || 0,
        duration: `${duration || 0} minutes`,
        distance: `${distance || 0} km`,
      });

      console.log('✅ Ride completed successfully:', ride);
      return ride;
    } catch (error) {
      console.error('❌ Failed to complete ride:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to complete ride',
      }));
      throw error;
    }
  }, [driverNotifications]);

  // Cancel a ride
  const cancelRide = useCallback(async (rideId: number): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('❌ Cancelling ride:', rideId);
      const ride = await rideService.cancelRide(rideId);
      
      setState(prev => ({
        ...prev,
        currentRide: null,
        rideHistory: [ride, ...prev.rideHistory],
        isLoading: false,
      }));

      console.log('✅ Ride cancelled successfully:', ride);
      return ride;
    } catch (error) {
      console.error('❌ Failed to cancel ride:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to cancel ride',
      }));
      throw error;
    }
  }, []);

  // Update driver location
  const updateDriverLocation = useCallback(async (location: DriverLocation): Promise<void> => {
    try {
      console.log('📍 Updating driver location:', location);
      await rideService.updateDriverLocation(location);
      console.log('✅ Driver location updated successfully');
    } catch (error) {
      console.error('❌ Failed to update driver location:', error);
      throw error;
    }
  }, []);

  // Find nearby drivers
  const findNearbyDrivers = useCallback(async (
    latitude: number,
    longitude: number,
    radius: number = 5
  ): Promise<DriverInRadius[]> => {
    try {
      console.log('🔍 Finding nearby drivers:', { latitude, longitude, radius });
      const drivers = await rideService.getDriversInRadius(latitude, longitude, radius);
      
      setState(prev => ({
        ...prev,
        availableDrivers: drivers,
      }));

      console.log('✅ Nearby drivers found:', drivers);
      return drivers;
    } catch (error) {
      console.error('❌ Failed to find nearby drivers:', error);
      throw error;
    }
  }, []);

  // Refresh current ride
  const refreshRide = useCallback(async (rideId: number): Promise<RideResource> => {
    try {
      console.log('🔄 Refreshing ride:', rideId);
      const ride = await rideService.getRide(rideId);
      
      setState(prev => ({
        ...prev,
        currentRide: ride,
      }));

      console.log('✅ Ride refreshed successfully:', ride);
      return ride;
    } catch (error) {
      console.error('❌ Failed to refresh ride:', error);
      throw error;
    }
  }, []);

  // Refresh ride history
  const refreshRideHistory = useCallback(async (): Promise<void> => {
    if (!userId) return;
    
    try {
      console.log('📋 Refreshing ride history:', userId, userType);
      let rides: RideResource[];
      
      if (userType === 'passenger') {
        rides = await rideService.getPassengerRides(userId);
      } else if (userType === 'driver') {
        rides = await rideService.getDriverRides(userId);
      } else {
        return;
      }
      
      setState(prev => ({
        ...prev,
        rideHistory: rides,
      }));

      console.log('✅ Ride history refreshed successfully:', rides);
    } catch (error) {
      console.error('❌ Failed to refresh ride history:', error);
    }
  }, [userId, userType]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-refresh current ride if it exists
  useEffect(() => {
    if (!state.currentRide) return;

    const interval = setInterval(async () => {
      try {
        await refreshRide(state.currentRide!.id);
      } catch (error) {
        console.warn('Failed to auto-refresh ride:', error);
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [state.currentRide, refreshRide]);

  // Load ride history on mount
  useEffect(() => {
    if (userId && userType) {
      refreshRideHistory();
    }
  }, [userId, userType, refreshRideHistory]);

  const actions: RideActions = {
    requestRide,
    acceptRide,
    startRide,
    completeRide,
    cancelRide,
    updateDriverLocation,
    findNearbyDrivers,
    refreshRide,
    refreshRideHistory,
    clearError,
  };

  return {
    ...state,
    ...actions,
  };
};

export default useRide;