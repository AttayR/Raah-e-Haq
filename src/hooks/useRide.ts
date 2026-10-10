import { useState, useEffect, useCallback } from 'react';
import rideService, { 
  RideResource, 
  RideRequest, 
  RideStopRequest,
  RideStopsUpdate,
  NearbyDriver,
  RideDriverLocation,
  LocationUpdate,
  NotificationResource
} from '../services/rideService';
import webSocketService from '../services/webSocketService';
import notificationService from '../services/notificationService';
import locationTrackingService from '../services/locationTrackingService';
import { usePassengerNotifications } from './usePassengerNotifications';
import { useDriverNotifications } from './useDriverNotifications';
import { 
  showRideRequestedModal, 
  showErrorModal,
} from '../components/NotificationManager';
import { toast } from '../core/toast';
import { logger } from '../core/logging/logger';

export interface RideState {
  currentRide: RideResource | null;
  rideHistory: RideResource[];
  availableDrivers: NearbyDriver[];
  isLoading: boolean;
  error: string | null;
}

export interface RideActions {
  requestRide: (rideData: RideRequest) => Promise<RideResource>;
  cancelRide: (rideId: number) => Promise<RideResource>;
  updateDriverLocation: (location: LocationUpdate) => Promise<void>;
  findNearbyDrivers: (latitude: number, longitude: number, radius?: number) => Promise<NearbyDriver[]>;
  refreshRide: (rideId: number) => Promise<RideResource>;
  refreshRideHistory: () => Promise<void>;
  clearError: () => void;
  
  // Stop management
  addStop: (rideId: number, stopData: RideStopRequest) => Promise<RideStopsUpdate>;
  removeStop: (rideId: number, stopId: number) => Promise<RideStopsUpdate>;
  updateStopOrder: (rideId: number, stopOrders: Array<{stop_id: number, new_order: number}>) => Promise<RideStopsUpdate>;
  
  // Driver navigation
  navigateToNextStop: (rideId: number) => Promise<any>;
  markStopCompleted: (rideId: number, stopId: number) => Promise<any>;
  getNavigationInstructions: (rideId: number) => Promise<any>;
  
  // Location tracking
  startLocationTracking: (config?: any) => Promise<void>;
  stopLocationTracking: () => void;
  getDriverLocation: (ride: RideResource) => Promise<RideDriverLocation>;
  
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

// Stop endpoints return only the stops and new fare; merge them into the current ride.
const applyStopsUpdate = (ride: RideResource | null, update: RideStopsUpdate): RideResource | null =>
  ride && ride.id === update.id
    ? { ...ride, stops: update.stops, total_fare: update.updated_fare }
    : ride;

export const useRide = (userId?: number, userType?: 'passenger' | 'driver') => {
  const [state, setState] = useState<RideState>({
    currentRide: null,
    rideHistory: [],
    availableDrivers: [],
    isLoading: false,
    error: null,
  });

  // Use notifications based on user type
  // Kept for its subscription side effects; the backend sends ride notifications.
  usePassengerNotifications(userId?.toString());
  useDriverNotifications(userId?.toString());

  // Request a ride (Passenger)
  const requestRide = useCallback(async (rideData: RideRequest): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Show loading toast
    const loadingToastId = toast.loading('Creating Ride Request', 'Please wait while we process your request...');
    
    try {
      logger.debug('🚗 Requesting ride:', rideData);
      const ride = await rideService.createRide(rideData);
      
      // Hide loading toast
      toast.hide(loadingToastId);
      
      setState(prev => ({
        ...prev,
        currentRide: ride,
        isLoading: false,
      }));

      // The backend notifies nearby drivers (BE-20: nearby ids are opaque, not driver ids).

      // Show success modal
      showRideRequestedModal();

      logger.debug('✅ Ride requested successfully:', ride);
      return ride;
    } catch (error) {
      // Hide loading toast
      toast.hide(loadingToastId);
      
      logger.error('❌ Failed to request ride:', error);
      
      // Handle different types of errors
      let errorMessage = 'Failed to request ride';
      let errorTitle = 'Ride Request Failed';
      
      if (error && typeof error === 'object') {
        if ('message' in error) {
          const errorObj = error as Error;
          if (errorObj.message.includes('Property') && errorObj.message.includes("doesn't exist")) {
            errorTitle = 'App Data Error';
            errorMessage = 'There was an issue with the app data. Please restart the app.';
          } else if (errorObj.message.includes('Network')) {
            errorTitle = 'Network Error';
            errorMessage = 'Network connection issue. Please check your internet connection.';
          } else if (errorObj.message.includes('Authentication')) {
            errorTitle = 'Authentication Error';
            errorMessage = 'Authentication error. Please log in again.';
          } else if (errorObj.message.includes('Database') || errorObj.message.includes('SQL')) {
            errorTitle = 'Server Error';
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

      // Show error modal
      showErrorModal(
        errorTitle,
        errorMessage,
        {
          label: 'Try Again',
          onPress: () => {
            // Retry logic could be added here
            logger.debug('Retry ride request');
          },
        },
        {
          label: 'Cancel',
          onPress: () => {
            logger.debug('Cancel ride request');
          },
        }
      );
      
      throw error;
    }
  }, []);

  // Cancel a ride
  const cancelRide = useCallback(async (rideId: number): Promise<RideResource> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      logger.debug('❌ Cancelling ride:', rideId);
      const ride = await rideService.cancelRide(rideId);
      
      setState(prev => ({
        ...prev,
        currentRide: null,
        rideHistory: [ride, ...prev.rideHistory],
        isLoading: false,
      }));

      logger.debug('✅ Ride cancelled successfully:', ride);
      return ride;
    } catch (error) {
      logger.error('❌ Failed to cancel ride:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to cancel ride',
      }));
      throw error;
    }
  }, []);

  // Update driver location
  const updateDriverLocation = useCallback(async (location: LocationUpdate): Promise<void> => {
    try {
      logger.debug('📍 Updating driver location:', location);
      await rideService.updateDriverLocation(location);
      logger.debug('✅ Driver location updated successfully');
    } catch (error) {
      logger.error('❌ Failed to update driver location:', error);
      throw error;
    }
  }, []);

  // Find nearby drivers once (GET /rides/nearby-drivers). The passenger map polls with
  // useNearbyDrivers instead, which respects the 429 retry_after.
  const findNearbyDrivers = useCallback(async (
    latitude: number,
    longitude: number,
    radius: number = 5
  ): Promise<NearbyDriver[]> => {
    try {
      const drivers = await rideService.getNearbyDrivers({ latitude, longitude, radiusKm: radius });
      setState(prev => ({ ...prev, availableDrivers: drivers }));
      return drivers;
    } catch {
      // rideService already logged it; the list is advisory.
      setState(prev => ({ ...prev, availableDrivers: [] }));
      return [];
    }
  }, []);

  // Refresh current ride
  const refreshRide = useCallback(async (rideId: number): Promise<RideResource> => {
    try {
      logger.debug('🔄 Refreshing ride:', rideId);
      const ride = await rideService.getRide(rideId);
      
      setState(prev => ({
        ...prev,
        currentRide: ride,
      }));

      logger.debug('✅ Ride refreshed successfully:', ride);
      return ride;
    } catch (error) {
      logger.error('❌ Failed to refresh ride:', error);
      throw error;
    }
  }, []);

  // Refresh ride history
  const refreshRideHistory = useCallback(async (): Promise<void> => {
    if (!userId) return;
    
    try {
      logger.debug('📋 Refreshing ride history:', userId, userType);
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

      logger.debug('✅ Ride history refreshed successfully:', rides);
    } catch (error) {
      logger.error('❌ Failed to refresh ride history:', error);
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
        logger.warn('Failed to auto-refresh ride:', error);
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
  const addStop = useCallback(async (rideId: number, stopData: RideStopRequest): Promise<RideStopsUpdate> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      logger.debug('📍 Adding stop to ride:', rideId, stopData);
      const updatedRide = await rideService.addStop(rideId, stopData);
      
      setState(prev => ({
        ...prev,
        currentRide: applyStopsUpdate(prev.currentRide, updatedRide),
        isLoading: false,
      }));
      
      logger.debug('✅ Stop added successfully:', updatedRide);
      return updatedRide;
    } catch (error) {
      logger.error('❌ Failed to add stop:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add stop',
      }));
      throw error;
    }
  }, []);

  // Remove stop from ride
  const removeStop = useCallback(async (rideId: number, stopId: number): Promise<RideStopsUpdate> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      logger.debug('🗑️ Removing stop from ride:', rideId, stopId);
      const updatedRide = await rideService.removeStop(rideId, stopId);
      
      setState(prev => ({
        ...prev,
        currentRide: applyStopsUpdate(prev.currentRide, updatedRide),
        isLoading: false,
      }));
      
      logger.debug('✅ Stop removed successfully:', updatedRide);
      return updatedRide;
    } catch (error) {
      logger.error('❌ Failed to remove stop:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to remove stop',
      }));
      throw error;
    }
  }, []);

  // Update stop order
  const updateStopOrder = useCallback(async (rideId: number, stopOrders: Array<{stop_id: number, new_order: number}>): Promise<RideStopsUpdate> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      logger.debug('🔄 Updating stop order:', rideId, stopOrders);
      const updatedRide = await rideService.updateStopOrder(rideId, stopOrders);
      
      setState(prev => ({
        ...prev,
        currentRide: applyStopsUpdate(prev.currentRide, updatedRide),
        isLoading: false,
      }));
      
      logger.debug('✅ Stop order updated successfully:', updatedRide);
      return updatedRide;
    } catch (error) {
      logger.error('❌ Failed to update stop order:', error);
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
      logger.debug('🧭 Navigating to next stop:', rideId);
      const result = await rideService.navigateToNextStop(rideId);
      logger.debug('✅ Navigation started successfully:', result);
      return result;
    } catch (error) {
      logger.error('❌ Failed to start navigation:', error);
      throw error;
    }
  }, []);

  // Mark stop as completed
  const markStopCompleted = useCallback(async (rideId: number, stopId: number): Promise<any> => {
    try {
      logger.debug('✅ Marking stop as completed:', rideId, stopId);
      const result = await rideService.markStopCompleted(rideId, stopId);
      logger.debug('✅ Stop marked as completed:', result);
      return result;
    } catch (error) {
      logger.error('❌ Failed to mark stop as completed:', error);
      throw error;
    }
  }, []);

  // Get navigation instructions
  const getNavigationInstructions = useCallback(async (rideId: number): Promise<any> => {
    try {
      logger.debug('🧭 Getting navigation instructions:', rideId);
      const result = await rideService.getNavigationInstructions(rideId);
      logger.debug('✅ Navigation instructions fetched:', result);
      return result;
    } catch (error) {
      logger.error('❌ Failed to get navigation instructions:', error);
      throw error;
    }
  }, []);

  // ==================== LOCATION TRACKING METHODS ====================

  // Start location tracking
  const startLocationTracking = useCallback(async (config?: any): Promise<void> => {
    try {
      logger.debug('📍 Starting location tracking:', config);
      await locationTrackingService.startTracking(config);
      logger.debug('✅ Location tracking started');
    } catch (error) {
      logger.error('❌ Failed to start location tracking:', error);
      throw error;
    }
  }, []);

  // Stop location tracking
  const stopLocationTracking = useCallback((): void => {
    try {
      logger.debug('📍 Stopping location tracking');
      locationTrackingService.stopTracking();
      logger.debug('✅ Location tracking stopped');
    } catch (error) {
      logger.error('❌ Failed to stop location tracking:', error);
    }
  }, []);

  // Get the assigned driver's location; only asks the server while the ride is active (BE-20).
  const getDriverLocation = useCallback(
    (ride: RideResource): Promise<RideDriverLocation> => rideService.getDriverLocationForRide(ride),
    [],
  );

  // ==================== NOTIFICATION METHODS ====================

  // Get notifications
  const getNotifications = useCallback(async (page: number = 1, perPage: number = 20): Promise<{data: NotificationResource[], pagination: any}> => {
    try {
      logger.debug('🔔 Getting notifications:', { page, perPage });
      const result = await notificationService.getNotifications(page, perPage);
      logger.debug('✅ Notifications fetched:', result);
      return result;
    } catch (error) {
      logger.error('❌ Failed to get notifications:', error);
      throw error;
    }
  }, []);

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: number): Promise<void> => {
    try {
      logger.debug('✅ Marking notification as read:', notificationId);
      await notificationService.markAsRead(notificationId);
      logger.debug('✅ Notification marked as read');
    } catch (error) {
      logger.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }, []);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async (): Promise<void> => {
    try {
      logger.debug('✅ Marking all notifications as read');
      await notificationService.markAllAsRead();
      logger.debug('✅ All notifications marked as read');
    } catch (error) {
      logger.error('❌ Failed to mark all notifications as read:', error);
      throw error;
    }
  }, []);

  // Get unread count
  const getUnreadCount = useCallback(async (): Promise<number> => {
    try {
      logger.debug('🔢 Getting unread count');
      const count = await notificationService.getUnreadCount();
      logger.debug('✅ Unread count fetched:', count);
      return count;
    } catch (error) {
      logger.error('❌ Failed to get unread count:', error);
      throw error;
    }
  }, []);

  // ==================== WEBSOCKET METHODS ====================

  // Subscribe to ride updates
  const subscribeToRideUpdates = useCallback(async (rideId: number, userType: 'passenger' | 'driver'): Promise<string> => {
    try {
      logger.debug('🔌 Subscribing to ride updates:', { rideId, userType });
      const connectionId = await webSocketService.subscribeToRideUpdates(rideId, userType, (event) => {
        logger.debug('📨 Received ride update:', event);
        // Handle ride update event
        if (event.type === 'ride_status_update' && event.data.ride_id === rideId) {
          // Refresh current ride if it matches
          if (state.currentRide && state.currentRide.id === rideId) {
            refreshRide(rideId);
          }
        }
      });
      logger.debug('✅ Subscribed to ride updates:', connectionId);
      return connectionId;
    } catch (error) {
      logger.error('❌ Failed to subscribe to ride updates:', error);
      throw error;
    }
  }, [state.currentRide, refreshRide]);

  // Subscribe to driver requests
  const subscribeToDriverRequests = useCallback(async (driverId: number, latitude: number, longitude: number, radius: number = 10): Promise<string> => {
    try {
      logger.debug('🔌 Subscribing to driver requests:', { driverId, latitude, longitude, radius });
      const connectionId = await webSocketService.subscribeToDriverRequests(driverId, latitude, longitude, radius, (event) => {
        logger.debug('📨 Received driver request:', event);
        // Handle driver request event
        if (event.type === 'new_ride_request') {
          // Update available drivers or refresh ride requests
          findNearbyDrivers(latitude, longitude, radius);
        }
      });
      logger.debug('✅ Subscribed to driver requests:', connectionId);
      return connectionId;
    } catch (error) {
      logger.error('❌ Failed to subscribe to driver requests:', error);
      throw error;
    }
  }, [findNearbyDrivers]);

  // Unsubscribe from WebSocket
  const unsubscribe = useCallback((connectionId: string): void => {
    try {
      logger.debug('🔌 Unsubscribing from:', connectionId);
      webSocketService.unsubscribe(connectionId);
      logger.debug('✅ Unsubscribed successfully');
    } catch (error) {
      logger.error('❌ Failed to unsubscribe:', error);
    }
  }, []);

  const actions: RideActions = {
    requestRide,
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