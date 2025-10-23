import { messaging } from './firebase';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import { apiService } from './api';

// Notification resource interface
export interface NotificationResource {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notification Permission',
          message: 'RaaHeHaq needs to send you notifications for ride updates',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (enabled) {
        console.log('ios Authorization status:', authStatus);
        return true;
      }
      return false;
    }
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};


export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messaging().getToken();
    if (token) {
      console.log('FCM token', token);
      return token;
    }
    return null;
  } catch (error) {
    console.error(' Error getting FCM token:', error);
    return null;
  }
};


// Listen to foreground messages
export const setupForegroundMessageListener = () => {
  try {
    messaging().onMessage(async remoteMessage => {
      Alert.alert('A new FCM message arrived!', JSON.stringify(remoteMessage));
    });
  } catch (err) {
    console.log('error set up foreground', err)
  }

};

// Send notification to specific user
export const sendNotificationToUser = async (
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  try {
    // In a real implementation, you would call your backend API
    // which would then send the notification using Firebase Admin SDK
    console.log('Sending notification to user:', userId, { title, body, data });

    // For now, we'll just log it
    // In production, you would make an API call to your backend
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new Error('Failed to send notification');
  }
};

// Send ride request notification to drivers
export const sendRideRequestNotification = async (
  driverIds: string[],
  rideRequest: any
): Promise<void> => {
  try {
    const title = 'New Ride Request';
    const body = `Ride from ${rideRequest.pickup.address || 'Pickup location'} to ${rideRequest.destination.address || 'Destination'}`;

    const data = {
      type: 'ride_request',
      rideId: rideRequest.id,
      passengerName: rideRequest.passengerName,
      fare: rideRequest.fare.toString(),
      distance: rideRequest.distance,
    };

    // Send to all nearby drivers
    for (const driverId of driverIds) {
      await sendNotificationToUser(driverId, title, body, data);
    }
  } catch (error) {
    console.error('Error sending ride request notification:', error);
    throw new Error('Failed to send ride request notification');
  }
};

// Send ride status update to passenger
export const sendRideStatusUpdate = async (
  passengerId: string,
  status: string,
  rideDetails: any
): Promise<void> => {
  try {
    let title = '';
    let body = '';

    switch (status) {
      case 'accepted':
        title = 'Ride Accepted';
        body = `Your driver ${rideDetails.driverName} is on the way`;
        break;
      case 'arrived':
        title = 'Driver Arrived';
        body = `Your driver ${rideDetails.driverName} has arrived at the pickup location`;
        break;
      case 'started':
        title = 'Ride Started';
        body = `Your ride with ${rideDetails.driverName} has started`;
        break;
      case 'completed':
        title = 'Ride Completed';
        body = `Your ride has been completed. Total fare: PKR ${rideDetails.fare}`;
        break;
      case 'cancelled':
        title = 'Ride Cancelled';
        body = `Your ride has been cancelled. ${rideDetails.reason || ''}`;
        break;
      default:
        title = 'Ride Update';
        body = 'Your ride status has been updated';
    }

    const data = {
      type: 'ride_status_update',
      rideId: rideDetails.id,
      status,
    };

    await sendNotificationToUser(passengerId, title, body, data);
  } catch (error) {
    console.error('Error sending ride status update:', error);
    throw new Error('Failed to send ride status update');
  }
};

// Send ride status update to driver
export const sendDriverRideUpdate = async (
  driverId: string,
  status: string,
  rideDetails: any
): Promise<void> => {
  try {
    let title = '';
    let body = '';

    switch (status) {
      case 'requested':
        title = 'New Ride Request';
        body = `Ride request from ${rideDetails.passengerName}`;
        break;
      case 'cancelled':
        title = 'Ride Cancelled';
        body = `The ride with ${rideDetails.passengerName} has been cancelled`;
        break;
      case 'completed':
        title = 'Ride Completed';
        body = `You have completed the ride with ${rideDetails.passengerName}`;
        break;
      default:
        title = 'Ride Update';
        body = 'Your ride status has been updated';
    }

    const data = {
      type: 'driver_ride_update',
      rideId: rideDetails.id,
      status,
    };

    await sendNotificationToUser(driverId, title, body, data);
  } catch (error) {
    console.error('Error sending driver ride update:', error);
    throw new Error('Failed to send driver ride update');
  }
};

// Send promotional notification
export const sendPromotionalNotification = async (
  userIds: string[],
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  try {
    for (const userId of userIds) {
      await sendNotificationToUser(userId, title, body, {
        type: 'promotional',
        ...data,
      });
    }
  } catch (error) {
    console.error('Error sending promotional notification:', error);
    throw new Error('Failed to send promotional notification');
  }
};

// Send system maintenance notification
export const sendSystemNotification = async (
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  try {
    // In a real implementation, you would send this to all users
    // For now, we'll just log it
    console.log('System notification:', { title, body, data });
  } catch (error) {
    console.error('Error sending system notification:', error);
    throw new Error('Failed to send system notification');
  }
};

export const initializeNotificationService = async (): Promise<void> => {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission not granted');
      return;
    }
    const token = await getFCMToken();
    if (token) {
      console.log('FCM Token obtained:', token);
    }
    setupForegroundMessageListener();
  } catch (error) {
    console.error('❌ Error initializing notification service:', error);
  }
};

// ==================== NOTIFICATION API METHODS ====================

// Get notifications with pagination
export const getNotifications = async (page: number = 1, perPage: number = 20): Promise<{data: NotificationResource[], pagination: any}> => {
  try {
    console.log('🔔 Getting notifications:', { page, perPage });
    const response = await apiService.get(`/notifications?page=${page}&per_page=${perPage}`);
    console.log('✅ Notifications fetched:', response.data);
    console.log('🔍 Notifications response structure analysis:', {
      hasData: !!response.data,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'N/A',
      hasDataProperty: response.data && 'data' in response.data,
      hasPagination: response.data && 'pagination' in response.data,
      dataArrayLength: Array.isArray(response.data) ? response.data.length : 'N/A'
    });
    
    // Handle different response structures
    if (response.data && typeof response.data === 'object') {
      // If response.data has data and pagination directly
      if ('data' in response.data && 'pagination' in response.data) {
        console.log('✅ Found data and pagination directly in response.data');
        return response.data;
      }
      // If response.data is the data array directly
      if (Array.isArray(response.data)) {
        console.log('✅ Response.data is an array directly');
        return {
          data: response.data,
          pagination: {
            current_page: page,
            last_page: page,
            per_page: perPage,
            total: response.data.length
          }
        };
      }
      // If response.data has a data property
      if (response.data.data && Array.isArray(response.data.data)) {
        console.log('✅ Found data array in response.data.data');
        return {
          data: response.data.data,
          pagination: response.data.pagination || {
            current_page: page,
            last_page: page,
            per_page: perPage,
            total: response.data.data.length
          }
        };
      }
    }
    
    // Fallback to empty result
    console.warn('Unexpected response structure for notifications:', response.data);
    return {
      data: [],
      pagination: {
        current_page: page,
        last_page: page,
        per_page: perPage,
        total: 0
      }
    };
  } catch (error) {
    console.error('❌ Failed to get notifications:', error);
    throw error;
  }
};

// Mark notification as read
export const markAsRead = async (notificationId: number): Promise<any> => {
  try {
    console.log('✅ Marking notification as read:', notificationId);
    const response = await apiService.put(`/notifications/${notificationId}/read`);
    console.log('✅ Notification marked as read');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    throw error;
  }
};

// Mark all notifications as read
export const markAllAsRead = async (): Promise<any> => {
  try {
    console.log('✅ Marking all notifications as read');
    const response = await apiService.put('/notifications/mark-all-read');
    console.log('✅ All notifications marked as read');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to mark all notifications as read:', error);
    throw error;
  }
};

// Get unread count
export const getUnreadCount = async (): Promise<number> => {
  try {
    console.log('🔢 Getting unread count');
    const response = await apiService.get('/notifications/unread-count');
    console.log('✅ Unread count fetched:', response.data);
    console.log('🔍 Response structure analysis:', {
      hasData: !!response.data,
      dataType: typeof response.data,
      dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'N/A',
      hasUnreadCount: response.data && 'unread_count' in response.data,
      hasDataProperty: response.data && 'data' in response.data,
      dataDataKeys: response.data && response.data.data && typeof response.data.data === 'object' ? Object.keys(response.data.data) : 'N/A'
    });
    
    // Handle different response structures
    if (response.data && typeof response.data === 'object') {
      // If response.data has unread_count directly
      if ('unread_count' in response.data) {
        console.log('✅ Found unread_count directly in response.data');
        return response.data.unread_count;
      }
      // If response.data has a data property with unread_count
      if (response.data.data && 'unread_count' in response.data.data) {
        console.log('✅ Found unread_count in response.data.data');
        return response.data.data.unread_count;
      }
      // If response.data is the count directly
      if (typeof response.data === 'number') {
        console.log('✅ Response.data is a number directly');
        return response.data;
      }
    }
    
    // Fallback to 0 if structure is unexpected
    console.warn('Unexpected response structure for unread count:', response.data);
    return 0;
  } catch (error) {
    console.error('❌ Failed to get unread count:', error);
    throw error;
  }
};

// Clear stored notifications (for local storage)
export const clearStoredNotifications = async (): Promise<void> => {
  try {
    console.log('🗑️ Clearing stored notifications');
    // This would clear local storage if you're storing notifications locally
    // For now, we'll just log it
    console.log('✅ Stored notifications cleared');
  } catch (error) {
    console.error('❌ Failed to clear stored notifications:', error);
    throw error;
  }
};

// ==================== NOTIFICATION SERVICE CLASS ====================

class NotificationService {
  // Firebase methods
  requestPermission = requestNotificationPermission;
  getFCMToken = getFCMToken;
  setupForegroundMessageListener = setupForegroundMessageListener;
  sendNotificationToUser = sendNotificationToUser;
  sendRideRequestNotification = sendRideRequestNotification;
  sendRideStatusUpdate = sendRideStatusUpdate;
  sendDriverRideUpdate = sendDriverRideUpdate;
  sendPromotionalNotification = sendPromotionalNotification;
  sendSystemNotification = sendSystemNotification;
  initialize = initializeNotificationService;

  // API methods
  getNotifications = getNotifications;
  markAsRead = markAsRead;
  markAllAsRead = markAllAsRead;
  getUnreadCount = getUnreadCount;
  clearStoredNotifications = clearStoredNotifications;
}

// Create and export default instance
const notificationService = new NotificationService();
export default notificationService;
