import { useCallback, useEffect } from 'react';
import { useNotifications } from './useNotifications';
import { NotificationData } from '../services/notificationService';

export const useDriverNotifications = (driverId?: string) => {
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

  // Log driver ID
  useEffect(() => {
    if (driverId) {
      console.log('🚗 Driver ID:', driverId);
      console.log('🚗 Driver Details:', {
        driverId,
        timestamp: new Date().toISOString(),
      });
    }
  }, [driverId]);

  // Subscribe to driver notifications
  const subscribeToDriverNotifications = useCallback(async () => {
    if (!driverId) return;
    
    try {
      console.log(`✅ Driver ${driverId} subscribed to notifications`);
      // In our new system, notifications are automatically fetched from the API
      await refreshNotifications();
    } catch (error) {
      console.error('❌ Failed to subscribe to driver notifications:', error);
    }
  }, [driverId, refreshNotifications]);

  // Unsubscribe from driver notifications
  const unsubscribeFromDriverNotifications = useCallback(async () => {
    if (!driverId) return;
    
    try {
      console.log(`✅ Driver ${driverId} unsubscribed from notifications`);
      // In our new system, we just clear local notifications
      await clearAllNotifications();
    } catch (error) {
      console.error('❌ Failed to unsubscribe from driver notifications:', error);
    }
  }, [driverId, clearAllNotifications]);

  // Send ride request notification to driver
  const sendRideRequestNotification = useCallback(async (passengerId: string, rideData: any) => {
    try {
      console.log('📱 Sending ride request notification to driver:', passengerId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride request notification:', error);
    }
  }, []);

  // Send ride accepted notification to passenger
  const sendRideAcceptedNotification = useCallback(async (passengerId: string, rideData: any) => {
    try {
      console.log('📱 Ride accepted notification:', passengerId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride accepted notification:', error);
    }
  }, []);

  // Send driver arrived notification
  const sendDriverArrivedNotification = useCallback(async (passengerId: string, rideData: any) => {
    try {
      console.log('📱 Driver arrived notification:', passengerId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send driver arrived notification:', error);
    }
  }, []);

  // Send ride started notification
  const sendRideStartedNotification = useCallback(async (passengerId: string, rideData: any) => {
    try {
      console.log('📱 Ride started notification:', passengerId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride started notification:', error);
    }
  }, []);

  // Send ride completed notification
  const sendRideCompletedNotification = useCallback(async (passengerId: string, rideData: any) => {
    try {
      console.log('📱 Ride completed notification:', passengerId, rideData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send ride completed notification:', error);
    }
  }, []);

  // Send payment notification
  const sendPaymentNotification = useCallback(async (passengerId: string, paymentData: any) => {
    try {
      console.log('📱 Payment notification:', passengerId, paymentData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send payment notification:', error);
    }
  }, []);

  // Send rating notification
  const sendRatingNotification = useCallback(async (passengerId: string, ratingData: any) => {
    try {
      console.log('📱 Rating notification:', passengerId, ratingData);
      // In our new system, notifications are sent by the backend
    } catch (error) {
      console.error('❌ Failed to send rating notification:', error);
    }
  }, []);

  // Send general notification
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
    subscribeToDriverNotifications,
    unsubscribeFromDriverNotifications,
    sendRideRequestNotification,
    sendRideAcceptedNotification,
    sendDriverArrivedNotification,
    sendRideStartedNotification,
    sendRideCompletedNotification,
    sendPaymentNotification,
    sendRatingNotification,
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

export default useDriverNotifications;