import { useState, useEffect, useCallback } from 'react';
import notificationService from '../services/notificationService';
import { NotificationResource } from '../services/rideService';
import { logger } from '../core/logging/logger';

export interface NotificationState {
  isInitialized: boolean;
  notifications: NotificationResource[];
  unreadCount: number;
  isLoading: boolean;
}

export const useNotifications = () => {
  const [state, setState] = useState<NotificationState>({
    isInitialized: false,
    notifications: [],
    unreadCount: 0,
    isLoading: false,
  });

  // Initialize notifications
  const initializeNotifications = useCallback(async () => {
    try {
      logger.debug('🔄 Initializing notifications...');
      
      // Load initial notifications and unread count
      const [notificationsResult, unreadCount] = await Promise.all([
        notificationService.getNotifications(1, 20),
        notificationService.getUnreadCount()
      ]);
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        notifications: notificationsResult.data,
        unreadCount: unreadCount,
      }));
      
      logger.debug('✅ Notifications initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize notifications:', error);
      setState(prev => ({
        ...prev,
        isInitialized: true, // Still mark as initialized even if failed
      }));
    }
  }, []);

  // Get notifications
  const getNotifications = useCallback(async (page: number = 1, perPage: number = 20) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const result = await notificationService.getNotifications(page, perPage);
      
      setState(prev => ({
        ...prev,
        notifications: page === 1 ? result.data : [...prev.notifications, ...result.data],
        isLoading: false,
      }));
      
      return result;
    } catch (error) {
      logger.error('❌ Failed to get notifications:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await notificationService.markAsRead(notificationId);
      
      // Update local state
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read_at: new Date().toISOString() }
            : notification
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      
    } catch (error) {
      logger.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      
      // Update local state
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.map(notification => ({
          ...notification,
          read_at: new Date().toISOString()
        })),
        unreadCount: 0,
      }));
      
    } catch (error) {
      logger.error('❌ Failed to mark all notifications as read:', error);
      throw error;
    }
  }, []);

  // Get unread count
  const getUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setState(prev => ({ ...prev, unreadCount: count }));
      return count;
    } catch (error) {
      logger.error('❌ Failed to get unread count:', error);
      throw error;
    }
  }, []);

  // Refresh notifications
  const refreshNotifications = useCallback(async () => {
    try {
      await Promise.all([
        getNotifications(1, 20),
        getUnreadCount()
      ]);
    } catch (error) {
      logger.error('❌ Failed to refresh notifications:', error);
    }
  }, [getNotifications, getUnreadCount]);

  // Handle incoming notification
  const handleIncomingNotification = useCallback((notification: NotificationResource) => {
    logger.debug('📨 Received new notification:', notification);
    
    setState(prev => ({
      ...prev,
      notifications: [notification, ...prev.notifications],
      unreadCount: prev.unreadCount + 1,
    }));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    try {
      await notificationService.clearStoredNotifications();
      setState(prev => ({
        ...prev,
        notifications: [],
        unreadCount: 0,
      }));
    } catch (error) {
      logger.error('❌ Failed to clear notifications:', error);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  return {
    ...state,
    initializeNotifications,
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    refreshNotifications,
    handleIncomingNotification,
    clearAllNotifications,
  };
};

export default useNotifications;
