import { useCallback, useEffect } from 'react';
import { useNotifications } from './useNotifications';
import { NotificationData } from '../services/notificationService';

export const usePassengerNotifications = (passengerId?: string) => {
  const {
    isInitialized,
    fcmToken,
    hasPermission,
    subscribeToPassengerTopic,
    unsubscribeFromTopic,
    sendNotificationToUser,
    sendNotificationToTopic,
  } = useNotifications();

  // Log FCM token for passenger
  useEffect(() => {
    if (fcmToken) {
      console.log('👤 Passenger FCM Token:', fcmToken);
      console.log('👤 Passenger ID:', passengerId);
      console.log('👤 Passenger Token Details:', {
        token: fcmToken,
        passengerId,
        length: fcmToken.length,
        timestamp: new Date().toISOString(),
      });
    }
  }, [fcmToken, passengerId]);

  // Subscribe to passenger notifications
  const subscribeToPassengerNotifications = useCallback(async () => {
    if (!passengerId) return;
    
    try {
      await subscribeToPassengerTopic(passengerId);
      console.log(`✅ Passenger ${passengerId} subscribed to notifications`);
    } catch (error) {
      console.error('❌ Failed to subscribe to passenger notifications:', error);
    }
  }, [passengerId, subscribeToPassengerTopic]);

  // Unsubscribe from passenger notifications
  const unsubscribeFromPassengerNotifications = useCallback(async () => {
    if (!passengerId) return;
    
    try {
      await unsubscribeFromTopic(`passenger_${passengerId}`);
      console.log(`✅ Passenger ${passengerId} unsubscribed from notifications`);
    } catch (error) {
      console.error('❌ Failed to unsubscribe from passenger notifications:', error);
    }
  }, [passengerId, unsubscribeFromTopic]);

  // Send ride request notification to driver
  const sendRideRequestNotification = useCallback(async (driverId: string, rideData: any) => {
    const notification: NotificationData = {
      title: 'New Ride Request',
      body: `Passenger ${rideData.passengerName} requested a ride`,
      type: 'ride_request',
      userId: driverId,
      rideId: rideData.rideId,
      data: {
        passengerId,
        pickup: rideData.pickup,
        destination: rideData.destination,
        fare: rideData.fare,
        distance: rideData.distance,
      },
    };

    try {
      await sendNotificationToUser(driverId, notification);
      console.log('✅ Ride request notification sent to driver');
    } catch (error) {
      console.error('❌ Failed to send ride request notification:', error);
    }
  }, [passengerId, sendNotificationToUser]);

  // Send ride accepted notification to passenger
  const sendRideAcceptedNotification = useCallback(async (driverId: string, rideData: any) => {
    const notification: NotificationData = {
      title: 'Ride Accepted',
      body: `Driver ${rideData.driverName} accepted your ride request`,
      type: 'ride_accepted',
      userId: passengerId,
      rideId: rideData.rideId,
      data: {
        driverId,
        driverName: rideData.driverName,
        driverPhone: rideData.driverPhone,
        estimatedArrival: rideData.estimatedArrival,
      },
    };

    try {
      await sendNotificationToUser(passengerId!, notification);
      console.log('✅ Ride accepted notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send ride accepted notification:', error);
    }
  }, [passengerId, sendNotificationToUser]);

  // Send driver arrived notification
  const sendDriverArrivedNotification = useCallback(async (driverId: string, rideData: any) => {
    const notification: NotificationData = {
      title: 'Driver Arrived',
      body: `Driver ${rideData.driverName} has arrived at pickup location`,
      type: 'driver_arrived',
      userId: passengerId,
      rideId: rideData.rideId,
      data: {
        driverId,
        driverName: rideData.driverName,
        driverPhone: rideData.driverPhone,
        pickupLocation: rideData.pickup,
      },
    };

    try {
      await sendNotificationToUser(passengerId!, notification);
      console.log('✅ Driver arrived notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send driver arrived notification:', error);
    }
  }, [passengerId, sendNotificationToUser]);

  // Send ride started notification
  const sendRideStartedNotification = useCallback(async (driverId: string, rideData: any) => {
    const notification: NotificationData = {
      title: 'Ride Started',
      body: `Your ride with ${rideData.driverName} has started`,
      type: 'ride_started',
      userId: passengerId,
      rideId: rideData.rideId,
      data: {
        driverId,
        driverName: rideData.driverName,
        destination: rideData.destination,
        estimatedDuration: rideData.estimatedDuration,
      },
    };

    try {
      await sendNotificationToUser(passengerId!, notification);
      console.log('✅ Ride started notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send ride started notification:', error);
    }
  }, [passengerId, sendNotificationToUser]);

  // Send ride completed notification
  const sendRideCompletedNotification = useCallback(async (driverId: string, rideData: any) => {
    const notification: NotificationData = {
      title: 'Ride Completed',
      body: `Your ride with ${rideData.driverName} has been completed`,
      type: 'ride_completed',
      userId: passengerId,
      rideId: rideData.rideId,
      data: {
        driverId,
        driverName: rideData.driverName,
        fare: rideData.fare,
        duration: rideData.duration,
        distance: rideData.distance,
      },
    };

    try {
      await sendNotificationToUser(passengerId!, notification);
      console.log('✅ Ride completed notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send ride completed notification:', error);
    }
  }, [passengerId, sendNotificationToUser]);

  // Send payment received notification
  const sendPaymentReceivedNotification = useCallback(async (paymentData: any) => {
    const notification: NotificationData = {
      title: 'Payment Received',
      body: `Payment of ₨${paymentData.amount} received for ride`,
      type: 'payment_received',
      userId: passengerId,
      rideId: paymentData.rideId,
      data: {
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        transactionId: paymentData.transactionId,
      },
    };

    try {
      await sendNotificationToUser(passengerId!, notification);
      console.log('✅ Payment received notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send payment received notification:', error);
    }
  }, [passengerId, sendNotificationToUser]);

  // Send general notification to passenger
  const sendGeneralNotification = useCallback(async (title: string, body: string, data?: any) => {
    const notification: NotificationData = {
      title,
      body,
      type: 'general',
      userId: passengerId,
      data,
    };

    try {
      await sendNotificationToUser(passengerId!, notification);
      console.log('✅ General notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send general notification:', error);
    }
  }, [passengerId, sendNotificationToUser]);

  return {
    isInitialized,
    fcmToken,
    hasPermission,
    subscribeToPassengerNotifications,
    unsubscribeFromPassengerNotifications,
    sendRideRequestNotification,
    sendRideAcceptedNotification,
    sendDriverArrivedNotification,
    sendRideStartedNotification,
    sendRideCompletedNotification,
    sendPaymentReceivedNotification,
    sendGeneralNotification,
  };
};

export default usePassengerNotifications;
