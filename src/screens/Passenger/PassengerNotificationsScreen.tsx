import React from 'react';
import { useRoute } from '@react-navigation/native';
import { NotificationsScreen } from '../../features/notifications/screens/NotificationsScreen';

/**
 * Passenger notifications (T-502): the Notifications tab, and the `PassengerNotifications`
 * stack route opened from the Home bell and Settings (that one has a back button).
 */
const PassengerNotificationsScreen = () => {
  const route = useRoute();
  return <NotificationsScreen role="passenger" showBack={route.name === 'PassengerNotifications'} />;
};

export default PassengerNotificationsScreen;
