import { useState, useEffect, useCallback } from 'react';
import notificationService, { NotificationData } from '../services/notificationService';

export interface NotificationState {
  isInitialized: boolean;
  fcmToken: string | null;
  hasPermission: boolean;
  notifications: NotificationData[];
}

export const useNotifications = () => {
  const [state, setState] = useState<NotificationState>({
    isInitialized: false,
    fcmToken: null,
    hasPermission: false,
    notifications: [],
  });

  // Initialize notifications
  const initializeNotifications = useCallback(async () => {
    try {
      console.log('🔄 Initializing notifications...');
      await notificationService.initialize();
      const token = notificationService.getToken();
      
      console.log('📱 FCM Token Retrieved:', token);
      console.log('📱 Token Details:', {
        token,
        length: token?.length,
        type: typeof token,
        isNull: token === null,
        isUndefined: token === undefined,
      });
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        fcmToken: token,
        hasPermission: !!token,
      }));
      
      console.log('✅ Notifications initialized successfully');
      console.log('📊 Notification State:', {
        isInitialized: true,
        fcmToken: token,
        hasPermission: !!token,
      });
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
    }
  }, []);

  // Subscribe to driver topic
  const subscribeToDriverTopic = useCallback(async (driverId: string) => {
    try {
      await notificationService.subscribeToTopic(`driver_${driverId}`);
      console.log(`✅ Subscribed to driver topic: driver_${driverId}`);
    } catch (error) {
      console.error('❌ Failed to subscribe to driver topic:', error);
    }
  }, []);

  // Subscribe to passenger topic
  const subscribeToPassengerTopic = useCallback(async (passengerId: string) => {
    try {
      await notificationService.subscribeToTopic(`passenger_${passengerId}`);
      console.log(`✅ Subscribed to passenger topic: passenger_${passengerId}`);
    } catch (error) {
      console.error('❌ Failed to subscribe to passenger topic:', error);
    }
  }, []);

  // Unsubscribe from topic
  const unsubscribeFromTopic = useCallback(async (topic: string) => {
    try {
      await notificationService.unsubscribeFromTopic(topic);
      console.log(`✅ Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error('❌ Failed to unsubscribe from topic:', error);
    }
  }, []);

  // Send notification to user
  const sendNotificationToUser = useCallback(async (userId: string, notification: NotificationData) => {
    try {
      await notificationService.sendNotificationToUser(userId, notification);
      console.log(`✅ Notification sent to user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
    }
  }, []);

  // Send notification to topic
  const sendNotificationToTopic = useCallback(async (topic: string, notification: NotificationData) => {
    try {
      await notificationService.sendNotificationToTopic(topic, notification);
      console.log(`✅ Notification sent to topic ${topic}`);
    } catch (error) {
      console.error('❌ Failed to send notification to topic:', error);
    }
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    notificationService.clearAllNotifications();
    setState(prev => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  // Set badge count
  const setBadgeCount = useCallback((count: number) => {
    notificationService.setBadgeCount(count);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  return {
    ...state,
    initializeNotifications,
    subscribeToDriverTopic,
    subscribeToPassengerTopic,
    unsubscribeFromTopic,
    sendNotificationToUser,
    sendNotificationToTopic,
    clearAllNotifications,
    setBadgeCount,
  };
};

export default useNotifications;
