import { Platform, PermissionsAndroid, Alert } from 'react-native';

export interface NotificationData {
  title: string;
  body: string;
  data?: any;
  type: 'ride_request' | 'ride_accepted' | 'ride_started' | 'ride_completed' | 'driver_arrived' | 'payment_received' | 'general';
  userId?: string;
  rideId?: string;
}

export interface NotificationPayload {
  notification: {
    title: string;
    body: string;
  };
  data: {
    type: string;
    userId?: string;
    rideId?: string;
    [key: string]: any;
  };
}

class NotificationService {
  private isInitialized = false;

  // Initialize notification service
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request permission
      await this.requestPermission();
      
      this.isInitialized = true;
      console.log('✅ Notification service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
    }
  }

// Request notification permission
  private async requestPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
            message: 'RaaHeHaq needs to send you notifications about your rides.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('Notification permission denied');
          return false;
        }
      }

      console.log('✅ Notification permission granted');
    return true;
  } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
    return false;
  }
  }

  // Show local notification (simplified version)
  showLocalNotification(title: string, message: string, data?: any): void {
    console.log('📱 Local notification:', { title, message, data });
    
    // For now, just show an alert
    Alert.alert(title, message, [
      { text: 'OK', onPress: () => console.log('Notification tapped') }
    ]);
  }

  // Subscribe to topic (placeholder)
  async subscribeToTopic(topic: string): Promise<void> {
    console.log(`✅ Subscribed to topic: ${topic}`);
  }

  // Unsubscribe from topic (placeholder)
  async unsubscribeFromTopic(topic: string): Promise<void> {
    console.log(`✅ Unsubscribed from topic: ${topic}`);
  }

  // Send notification to specific user (placeholder)
  async sendNotificationToUser(userId: string, notification: NotificationData): Promise<void> {
    console.log(`📤 Sending notification to user ${userId}:`, notification);
    this.showLocalNotification(notification.title, notification.body, notification.data);
  }

  // Send notification to topic (placeholder)
  async sendNotificationToTopic(topic: string, notification: NotificationData): Promise<void> {
    console.log(`📤 Sending notification to topic ${topic}:`, notification);
    this.showLocalNotification(notification.title, notification.body, notification.data);
  }

  // Clear all notifications
  clearAllNotifications(): void {
    console.log('🧹 Cleared all notifications');
  }

  // Set badge count
  setBadgeCount(count: number): void {
    console.log(`🔢 Set badge count to: ${count}`);
  }

  // Get token (placeholder)
  getToken(): string | null {
    const token = 'mock_token_' + Date.now();
    console.log('📱 FCM Token Generated:', token);
    console.log('📱 Token Length:', token.length);
    console.log('📱 Token Type:', typeof token);
    return token;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;