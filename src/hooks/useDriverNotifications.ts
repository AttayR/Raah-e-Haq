import { useCallback, useEffect } from 'react';
import { useNotifications } from './useNotifications';
import { NotificationData } from '../services/notificationService';

export const useDriverNotifications = (driverId?: string) => {
  const {
    isInitialized,
    fcmToken,
    hasPermission,
    subscribeToDriverTopic,
    unsubscribeFromTopic,
    sendNotificationToUser,
    sendNotificationToTopic,
  } = useNotifications();

  // Log FCM token for driver
  useEffect(() => {
    if (fcmToken) {
      console.log('🚗 Driver FCM Token:', fcmToken);
      console.log('🚗 Driver ID:', driverId);
      console.log('🚗 Driver Token Details:', {
        token: fcmToken,
        driverId,
        length: fcmToken.length,
        timestamp: new Date().toISOString(),
      });
    }
  }, [fcmToken, driverId]);

  // Subscribe to driver notifications
  const subscribeToDriverNotifications = useCallback(async () => {
    if (!driverId) return;
    
    try {
      await subscribeToDriverTopic(driverId);
      console.log(`✅ Driver ${driverId} subscribed to notifications`);
    } catch (error) {
      console.error('❌ Failed to subscribe to driver notifications:', error);
    }
  }, [driverId, subscribeToDriverTopic]);

  // Unsubscribe from driver notifications
  const unsubscribeFromDriverNotifications = useCallback(async () => {
    if (!driverId) return;
    
    try {
      await unsubscribeFromTopic(`driver_${driverId}`);
      console.log(`✅ Driver ${driverId} unsubscribed from notifications`);
    } catch (error) {
      console.error('❌ Failed to unsubscribe from driver notifications:', error);
    }
  }, [driverId, unsubscribeFromTopic]);

  // Send ride request notification to driver
  const sendRideRequestNotification = useCallback(async (passengerId: string, rideData: any) => {
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
      await sendNotificationToUser(driverId!, notification);
      console.log('✅ Ride request notification sent to driver');
    } catch (error) {
      console.error('❌ Failed to send ride request notification:', error);
    }
  }, [driverId, sendNotificationToUser]);

  // Send ride accepted notification to passenger
  const sendRideAcceptedNotification = useCallback(async (passengerId: string, rideData: any) => {
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
      await sendNotificationToUser(passengerId, notification);
      console.log('✅ Ride accepted notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send ride accepted notification:', error);
    }
  }, [driverId, sendNotificationToUser]);

  // Send driver arrived notification
  const sendDriverArrivedNotification = useCallback(async (passengerId: string, rideData: any) => {
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
      await sendNotificationToUser(passengerId, notification);
      console.log('✅ Driver arrived notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send driver arrived notification:', error);
    }
  }, [driverId, sendNotificationToUser]);

  // Send ride started notification
  const sendRideStartedNotification = useCallback(async (passengerId: string, rideData: any) => {
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
      await sendNotificationToUser(passengerId, notification);
      console.log('✅ Ride started notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send ride started notification:', error);
    }
  }, [driverId, sendNotificationToUser]);

  // Send ride completed notification
  const sendRideCompletedNotification = useCallback(async (passengerId: string, rideData: any) => {
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
      await sendNotificationToUser(passengerId, notification);
      console.log('✅ Ride completed notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send ride completed notification:', error);
    }
  }, [driverId, sendNotificationToUser]);

  // Send payment received notification
  const sendPaymentReceivedNotification = useCallback(async (passengerId: string, paymentData: any) => {
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
      await sendNotificationToUser(passengerId, notification);
      console.log('✅ Payment received notification sent to passenger');
    } catch (error) {
      console.error('❌ Failed to send payment received notification:', error);
    }
  }, [sendNotificationToUser]);

  return {
    isInitialized,
    fcmToken,
    hasPermission,
    subscribeToDriverNotifications,
    unsubscribeFromDriverNotifications,
    sendRideRequestNotification,
    sendRideAcceptedNotification,
    sendDriverArrivedNotification,
    sendRideStartedNotification,
    sendRideCompletedNotification,
    sendPaymentReceivedNotification,
  };
};

export default useDriverNotifications;
