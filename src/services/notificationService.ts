import { messaging } from './firebase';
import { getToken, onMessage } from '@react-native-firebase/messaging';
import { Platform, Alert, PermissionsAndroid } from 'react-native';

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
