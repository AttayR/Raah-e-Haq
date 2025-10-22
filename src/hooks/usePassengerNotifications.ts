import { useCallback, useEffect } from 'react';
import { useNotifications } from './useNotifications';
import { NotificationData } from '../services/notificationService';

export const usePassengerNotifications = (passengerId?: string) => {
  const {
    isInitialized,
    notifications,
    unreadCount,
    isLoading,
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    refreshNotifications,
    handleIncomingNotification,
    clearAllNotifications,
  } = useNotifications();

  // Log passenger ID
  useEffect(() => {
    if (passengerId) {
      console.log('👤 Passenger ID:', passengerId);
      console.log('👤 Passenger Details:', {
        passengerId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [passengerId]);

  // Subscribe to passenger notifications
  const subscribeToPassengerNotifications = useCallback(async () => {
    if (!passengerId) return;
    
    try {
      console.log(`✅ Passenger ${passengerId} subscribed to notifications`);
      // In our new system, notifications are automatically fetched from the API
      await refreshNotifications();
    } catch (error) {
      console.error('❌ Failed to subscribe to passenger notifications:', error);
    }
  }, [passengerId, refreshNotifications]);

  // Unsubscribe from passenger notifications
  const unsubscribeFromPassengerNotifications = useCallback(async () => {
    if (!passengerId) return;
    
    try {
      console.log(`✅ Passenger ${passengerId} unsubscribed from notifications`);
      // In our new system, we just clear local notifications
      await clearAllNotifications();
    } catch (error) {
      console.error('❌ Failed to unsubscribe from passenger notifications:', error);
    }
  }, [passengerId, clearAllNotifications]);

  // Send ride request notification to driver
  const sendRideRequestNotification = useCallback(async (driverId: string, rideData: any) => {
    try {
      console.log('📱 Sending ride request notification to driver:', driverId);
      console.log('📱 Ride data:', rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride request notification:', error);
    }
  }, []);

  // Send ride accepted notification to passenger
  const sendRideAcceptedNotification = useCallback(async (driverId: string, rideData: any) => {
    try {
      console.log('📱 Ride accepted notification:', driverId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride accepted notification:', error);
    }
  }, []);

  // Send driver arrived notification
  const sendDriverArrivedNotification = useCallback(async (driverId: string, rideData: any) => {
    try {
      console.log('📱 Driver arrived notification:', driverId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send driver arrived notification:', error);
    }
  }, []);

  // Send ride started notification
  const sendRideStartedNotification = useCallback(async (driverId: string, rideData: any) => {
    try {
      console.log('📱 Ride started notification:', driverId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride started notification:', error);
    }
  }, []);

  // Send ride completed notification
  const sendRideCompletedNotification = useCallback(async (driverId: string, rideData: any) => {
    try {
      console.log('📱 Ride completed notification:', driverId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride completed notification:', error);
    }
  }, []);

  // Send payment received notification
  const sendPaymentReceivedNotification = useCallback(async (paymentData: any) => {
    try {
      console.log('📱 Payment received notification:', paymentData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send payment received notification:', error);
    }
  }, []);

  // Send general notification to passenger
  const sendGeneralNotification = useCallback(async (title: string, body: string, data?: any) => {
    try {
      console.log('📱 General notification:', { title, body, data });
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send general notification:', error);
    }
  }, []);

  return {
    isInitialized,
    notifications,
    unreadCount,
    isLoading,
    subscribeToPassengerNotifications,
    unsubscribeFromPassengerNotifications,
    sendRideRequestNotification,
    sendRideAcceptedNotification,
    sendDriverArrivedNotification,
    sendRideStartedNotification,
    sendRideCompletedNotification,
    sendPaymentReceivedNotification,
    sendGeneralNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    refreshNotifications,
    handleIncomingNotification,
    clearAllNotifications,
  };
};

export default usePassengerNotifications;
