import { NotificationResource } from './rideService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationData {
  ride_id?: number;
  driver_name?: string;
  driver_phone?: string;
  passenger_name?: string;
  passenger_phone?: string;
  estimated_arrival?: string;
  fare?: number;
  [key: string]: any;
}

class NotificationService {
  private baseUrl = '/notifications';
  private unreadCount: number = 0;
  private listeners: Set<(count: number) => void> = new Set();

  // Get user notifications with pagination
  async getNotifications(page: number = 1, perPage: number = 20): Promise<{
    data: NotificationResource[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  }> {
    try {
      console.log('🔔 Fetching notifications:', { page, perPage });
      
      const response = await fetch(`https://raahehaq.com/api${this.baseUrl}?page=${page}&per_page=${perPage}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ Notifications endpoint not implemented yet, returning empty list');
          return {
            data: [],
            pagination: {
              current_page: 1,
              last_page: 1,
              per_page: perPage,
              total: 0
            }
          };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notifications fetched successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to fetch notifications:', error);
      // Return empty result as fallback when notifications are not implemented
      return {
        data: [],
        pagination: {
          current_page: 1,
          last_page: 1,
          per_page: perPage,
          total: 0
        }
      };
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: number): Promise<void> {
    try {
      console.log('✅ Marking notification as read:', notificationId);
      
      const response = await fetch(`https://raahehaq.com/api${this.baseUrl}/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ Mark as read endpoint not implemented yet, skipping');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notification marked as read:', result);
      
      // Update unread count
      await this.updateUnreadCount();
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      // Don't throw error, just log it
    }
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    try {
      console.log('✅ Marking all notifications as read');
      
      const response = await fetch(`https://raahehaq.com/api${this.baseUrl}/read-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ Mark all as read endpoint not implemented yet, skipping');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ All notifications marked as read:', result);
      
      // Update unread count
      this.unreadCount = 0;
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
      // Don't throw error, just log it
    }
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      console.log('🔢 Getting unread count');
      
      const response = await fetch(`https://raahehaq.com/api${this.baseUrl}/unread-count`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ Notifications endpoint not implemented yet, returning 0');
          this.unreadCount = 0;
          this.notifyListeners();
          return 0;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Unread count fetched:', result);
      
      this.unreadCount = result.data.unread_count;
      this.notifyListeners();
      
      return this.unreadCount;
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      // Return 0 as fallback when notifications are not implemented
      this.unreadCount = 0;
      this.notifyListeners();
      return 0;
    }
  }

  // Update unread count
  private async updateUnreadCount(): Promise<void> {
    try {
      const count = await this.getUnreadCount();
      this.unreadCount = count;
      this.notifyListeners();
    } catch (error) {
      console.error('❌ Failed to update unread count:', error);
      // Set to 0 as fallback
      this.unreadCount = 0;
      this.notifyListeners();
    }
  }

  // Add listener for unread count changes
  addUnreadCountListener(listener: (count: number) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.unreadCount);
      } catch (error) {
        console.error('❌ Error notifying listener:', error);
      }
    });
  }

  // Get current unread count (cached)
  getCurrentUnreadCount(): number {
    return this.unreadCount;
  }

  // Handle incoming notification
  handleIncomingNotification(notification: NotificationResource): void {
    console.log('📨 Received new notification:', notification);
    
    // Increment unread count
    this.unreadCount++;
    this.notifyListeners();
    
    // Store notification locally for offline access
    this.storeNotificationLocally(notification);
    
    // Show local notification if app is in background
    this.showLocalNotification(notification);
  }

  // Store notification locally
  private async storeNotificationLocally(notification: NotificationResource): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      const notifications = stored ? JSON.parse(stored) : [];
      
      // Add new notification at the beginning
      notifications.unshift(notification);
      
      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications.splice(100);
      }
      
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('❌ Failed to store notification locally:', error);
    }
  }

  // Get stored notifications
  async getStoredNotifications(): Promise<NotificationResource[]> {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to get stored notifications:', error);
      return [];
    }
  }

  // Show local notification
  private showLocalNotification(notification: NotificationResource): void {
    // This would integrate with your push notification service
    // For now, just log it
    console.log('📱 Showing local notification:', {
      title: notification.title,
      message: notification.message,
      type: notification.type
    });
  }

  // Clear all stored notifications
  async clearStoredNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem('notifications');
      console.log('✅ Cleared stored notifications');
    } catch (error) {
      console.error('❌ Failed to clear stored notifications:', error);
    }
  }

  // Get authentication token
  private async getAuthToken(): Promise<string> {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }
      return token;
    } catch (error) {
      console.error('❌ Failed to get auth token:', error);
      throw error;
    }
  }

  // Format notification message based on type
  formatNotificationMessage(notification: NotificationResource): string {
    switch (notification.type) {
      case 'driver_assigned':
        return `Your ride has been accepted by ${notification.data?.driver_name || 'a driver'}`;
      
      case 'driver_arrived':
        return `Your driver has arrived at the pickup location`;
      
      case 'ride_started':
        return `Your ride has started`;
      
      case 'ride_completed':
        return `Your ride has been completed. Fare: PKR ${notification.data?.fare || 'N/A'}`;
      
      case 'ride_cancelled':
        return `Your ride has been cancelled`;
      
      case 'new_ride_request':
        return `New ride request from ${notification.data?.passenger_name || 'a passenger'}`;
      
      case 'stop_completed':
        return `Stop completed: ${notification.data?.stop_address || 'Unknown location'}`;
      
      case 'payment_received':
        return `Payment received: PKR ${notification.data?.amount || 'N/A'}`;
      
      default:
        return notification.message;
    }
  }

  // Get notification icon based on type
  getNotificationIcon(notification: NotificationResource): string {
    switch (notification.type) {
      case 'driver_assigned':
      case 'driver_arrived':
        return '🚗';
      
      case 'ride_started':
      case 'ride_completed':
        return '✅';
      
      case 'ride_cancelled':
        return '❌';
      
      case 'new_ride_request':
        return '📱';
      
      case 'stop_completed':
        return '📍';
      
      case 'payment_received':
        return '💰';
      
      default:
        return '🔔';
    }
  }

  // Get notification color based on type
  getNotificationColor(notification: NotificationResource): string {
    switch (notification.type) {
      case 'driver_assigned':
      case 'driver_arrived':
      case 'ride_started':
      case 'ride_completed':
        return '#10B981'; // Green
      
      case 'ride_cancelled':
        return '#EF4444'; // Red
      
      case 'new_ride_request':
        return '#3B82F6'; // Blue
      
      case 'stop_completed':
        return '#8B5CF6'; // Purple
      
      case 'payment_received':
        return '#F59E0B'; // Yellow
      
      default:
        return '#6B7280'; // Gray
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;