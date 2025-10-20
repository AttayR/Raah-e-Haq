import { useState, useEffect, useCallback } from 'react';
import rideService, { 
  RideResource, 
  RideRequest, 
  RideStopRequest,
  DriverInRadius, 
  DriverLocation,
  LocationUpdate,
  NotificationResource
} from '../services/rideService';
import webSocketService from '../services/webSocketService';
import notificationService from '../services/notificationService';
import locationTrackingService from '../services/locationTrackingService';
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
  updateDriverLocation: (location: LocationUpdate) => Promise<void>;
  findNearbyDrivers: (latitude: number, longitude: number, radius?: number) => Promise<DriverInRadius[]>;
  refreshRide: (rideId: number) => Promise<RideResource>;
  refreshRideHistory: () => Promise<void>;
  clearError: () => void;
  
  // Stop management
  addStop: (rideId: number, stopData: RideStopRequest) => Promise<RideResource>;
  removeStop: (rideId: number, stopId: number) => Promise<RideResource>;
  updateStopOrder: (rideId: number, stopOrders: Array<{stop_id: number, new_order: number}>) => Promise<RideResource>;
  
  // Driver navigation
  navigateToNextStop: (rideId: number) => Promise<any>;
  markStopCompleted: (rideId: number, stopId: number) => Promise<any>;
  getNavigationInstructions: (rideId: number) => Promise<any>;
  
  // Location tracking
  startLocationTracking: (config?: any) => Promise<void>;
  stopLocationTracking: () => void;
  getDriverLocation: (driverId: number) => Promise<DriverLocation>;
  
  // Notifications
  getNotifications: (page?: number, perPage?: number) => Promise<{data: NotificationResource[], pagination: any}>;
  markNotificationAsRead: (notificationId: number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  getUnreadCount: () => Promise<number>;
  
  // WebSocket
  subscribeToRideUpdates: (rideId: number, userType: 'passenger' | 'driver') => Promise<string>;
  subscribeToDriverRequests: (driverId: number, latitude: number, longitude: number, radius?: number) => Promise<string>;
  unsubscribe: (connectionId: string) => void;
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

  // ==================== STOP MANAGEMENT METHODS ====================

  // Add stop to ride
  const addStop = useCallback(async (rideId: number, stopData: RideStopRequest): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('📍 Adding stop to ride:', rideId, stopData);
      const updatedRide = await rideService.addStop(rideId, stopData);
      
      setState(prev => ({
        ...prev,
        currentRide: updatedRide,
        isLoading: false,
      }));
      
      console.log('✅ Stop added successfully:', updatedRide);
      return updatedRide;
    } catch (error) {
      console.error('❌ Failed to add stop:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add stop',
      }));
      throw error;
    }
  }, []);

  // Remove stop from ride
  const removeStop = useCallback(async (rideId: number, stopId: number): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('🗑️ Removing stop from ride:', rideId, stopId);
      const updatedRide = await rideService.removeStop(rideId, stopId);
      
      setState(prev => ({
        ...prev,
        currentRide: updatedRide,
        isLoading: false,
      }));
      
      console.log('✅ Stop removed successfully:', updatedRide);
      return updatedRide;
    } catch (error) {
      console.error('❌ Failed to remove stop:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to remove stop',
      }));
      throw error;
    }
  }, []);

  // Update stop order
  const updateStopOrder = useCallback(async (rideId: number, stopOrders: Array<{stop_id: number, new_order: number}>): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      console.log('🔄 Updating stop order:', rideId, stopOrders);
      const updatedRide = await rideService.updateStopOrder(rideId, stopOrders);
      
      setState(prev => ({
        ...prev,
        currentRide: updatedRide,
        isLoading: false,
      }));
      
      console.log('✅ Stop order updated successfully:', updatedRide);
      return updatedRide;
    } catch (error) {
      console.error('❌ Failed to update stop order:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update stop order',
      }));
      throw error;
    }
  }, []);

  // ==================== DRIVER NAVIGATION METHODS ====================

  // Navigate to next stop
  const navigateToNextStop = useCallback(async (rideId: number): Promise<any> => {
    try {
      console.log('🧭 Navigating to next stop:', rideId);
      const result = await rideService.navigateToNextStop(rideId);
      console.log('✅ Navigation started successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to start navigation:', error);
      throw error;
    }
  }, []);

  // Mark stop as completed
  const markStopCompleted = useCallback(async (rideId: number, stopId: number): Promise<any> => {
    try {
      console.log('✅ Marking stop as completed:', rideId, stopId);
      const result = await rideService.markStopCompleted(rideId, stopId);
      console.log('✅ Stop marked as completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to mark stop as completed:', error);
      throw error;
    }
  }, []);

  // Get navigation instructions
  const getNavigationInstructions = useCallback(async (rideId: number): Promise<any> => {
    try {
      console.log('🧭 Getting navigation instructions:', rideId);
      const result = await rideService.getNavigationInstructions(rideId);
      console.log('✅ Navigation instructions fetched:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to get navigation instructions:', error);
      throw error;
    }
  }, []);

  // ==================== LOCATION TRACKING METHODS ====================

  // Start location tracking
  const startLocationTracking = useCallback(async (config?: any): Promise<void> => {
    try {
      console.log('📍 Starting location tracking:', config);
      await locationTrackingService.startTracking(config);
      console.log('✅ Location tracking started');
    } catch (error) {
      console.error('❌ Failed to start location tracking:', error);
      throw error;
    }
  }, []);

  // Stop location tracking
  const stopLocationTracking = useCallback((): void => {
    try {
      console.log('📍 Stopping location tracking');
      locationTrackingService.stopTracking();
      console.log('✅ Location tracking stopped');
    } catch (error) {
      console.error('❌ Failed to stop location tracking:', error);
    }
  }, []);

  // Get driver location
  const getDriverLocation = useCallback(async (driverId: number): Promise<DriverLocation> => {
    try {
      console.log('📍 Getting driver location:', driverId);
      const location = await locationTrackingService.getDriverLocation(driverId);
      console.log('✅ Driver location fetched:', location);
      return location;
    } catch (error) {
      console.error('❌ Failed to get driver location:', error);
      throw error;
    }
  }, []);

  // ==================== NOTIFICATION METHODS ====================

  // Get notifications
  const getNotifications = useCallback(async (page: number = 1, perPage: number = 20): Promise<{data: NotificationResource[], pagination: any}> => {
    try {
      console.log('🔔 Getting notifications:', { page, perPage });
      const result = await notificationService.getNotifications(page, perPage);
      console.log('✅ Notifications fetched:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to get notifications:', error);
      throw error;
    }
  }, []);

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: number): Promise<void> => {
    try {
      console.log('✅ Marking notification as read:', notificationId);
      await notificationService.markAsRead(notificationId);
      console.log('✅ Notification marked as read');
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }, []);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async (): Promise<void> => {
    try {
      console.log('✅ Marking all notifications as read');
      await notificationService.markAllAsRead();
      console.log('✅ All notifications marked as read');
    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
      throw error;
    }
  }, []);

  // Get unread count
  const getUnreadCount = useCallback(async (): Promise<number> => {
    try {
      console.log('🔢 Getting unread count');
      const count = await notificationService.getUnreadCount();
      console.log('✅ Unread count fetched:', count);
      return count;
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      throw error;
    }
  }, []);

  // ==================== WEBSOCKET METHODS ====================

  // Subscribe to ride updates
  const subscribeToRideUpdates = useCallback(async (rideId: number, userType: 'passenger' | 'driver'): Promise<string> => {
    try {
      console.log('🔌 Subscribing to ride updates:', { rideId, userType });
      const connectionId = await webSocketService.subscribeToRideUpdates(rideId, userType, (event) => {
        console.log('📨 Received ride update:', event);
        // Handle ride update event
        if (event.type === 'ride_status_update' && event.data.ride_id === rideId) {
          // Refresh current ride if it matches
          if (state.currentRide && state.currentRide.id === rideId) {
            refreshRide(rideId);
          }
        }
      });
      console.log('✅ Subscribed to ride updates:', connectionId);
      return connectionId;
    } catch (error) {
      console.error('❌ Failed to subscribe to ride updates:', error);
      throw error;
    }
  }, [state.currentRide, refreshRide]);

  // Subscribe to driver requests
  const subscribeToDriverRequests = useCallback(async (driverId: number, latitude: number, longitude: number, radius: number = 10): Promise<string> => {
    try {
      console.log('🔌 Subscribing to driver requests:', { driverId, latitude, longitude, radius });
      const connectionId = await webSocketService.subscribeToDriverRequests(driverId, latitude, longitude, radius, (event) => {
        console.log('📨 Received driver request:', event);
        // Handle driver request event
        if (event.type === 'new_ride_request') {
          // Update available drivers or refresh ride requests
          findNearbyDrivers(latitude, longitude, radius);
        }
      });
      console.log('✅ Subscribed to driver requests:', connectionId);
      return connectionId;
    } catch (error) {
      console.error('❌ Failed to subscribe to driver requests:', error);
      throw error;
    }
  }, [findNearbyDrivers]);

  // Unsubscribe from WebSocket
  const unsubscribe = useCallback((connectionId: string): void => {
    try {
      console.log('🔌 Unsubscribing from:', connectionId);
      webSocketService.unsubscribe(connectionId);
      console.log('✅ Unsubscribed successfully');
    } catch (error) {
      console.error('❌ Failed to unsubscribe:', error);
    }
  }, []);

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
    
    // Stop management
    addStop,
    removeStop,
    updateStopOrder,
    
    // Driver navigation
    navigateToNextStop,
    markStopCompleted,
    getNavigationInstructions,
    
    // Location tracking
    startLocationTracking,
    stopLocationTracking,
    getDriverLocation,
    
    // Notifications
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadCount,
    
    // WebSocket
    subscribeToRideUpdates,
    subscribeToDriverRequests,
    unsubscribe,
  };

  return {
    ...state,
    ...actions,
  };
};

export default useRide;