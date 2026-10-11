import React, { useCallback } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import PassengerBottomTabs from '../tabs/PassengerBottomTabs';
import PassengerProfile from 'src/screens/Passenger/Passengerprofile';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import PassengerRideTrackingScreen from 'src/screens/Passenger/PassengerRideTrackingScreen';
import RideHistoryScreen from 'src/screens/Passenger/RideHistoryScreen';
import FavoriteLocationsScreen from 'src/screens/Passenger/FavoriteLocationsScreen';
import WalletScreen from 'src/screens/Passenger/WalletScreen';
import PassengerNotificationsScreen from 'src/screens/Passenger/PassengerNotificationsScreen';
import { useRestoreActiveRide } from '../../../features/active-ride/hooks';
import ChatThreadScreen from '../../../features/chat/screens/ChatThreadScreen';
import { rideChatScreenId, type RideChatParams } from '../../../features/chat/navigation';
import { useNotificationsSync } from '../../../features/notifications/hooks';
import { usePushNotifications } from '../../../features/notifications/usePushNotifications';
import { NotificationPreferencesScreen } from '../../../features/notifications/screens/NotificationPreferencesScreen';
import type { RootStackParamList } from '../RootNavigation';

export type PassengerStackParamList = {
  PassengerTabs: undefined;
  PassengerPofile: undefined;
  /** One ride's chat thread (T-510). */
  RideChat: RideChatParams;
  PassengerMap: undefined;
  PassengerRideTracking: { passengerId: string; rideId?: string };
  RideHistory: undefined;
  FavoriteLocations: undefined;
  Wallet: undefined;
  PassengerNotifications: undefined;
  /** Settings → Notifications: push preferences (T-502, BE-11). */
  NotificationPreferences: undefined;
};

const Stack = createNativeStackNavigator<PassengerStackParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'Passenger'>;

/**
 * The passenger app. `PassengerMap` is the one booking route (T-301: it is no longer also a
 * tab). On mount it asks the server for an in-progress ride and, if there is one, opens the
 * booking screen on top of the tabs, which shows it from the activeRide slice.
 */
const PassengerStack = ({ navigation }: Props) => {
  const openActiveRide = useCallback(() => {
    // initial: false keeps PassengerTabs underneath, so Back returns to Home.
    navigation.navigate('Passenger', { screen: 'PassengerMap', initial: false });
  }, [navigation]);
  useRestoreActiveRide(openActiveRide);
  // The one unread-count owner and FCM (device registration, foreground toast, tap routing) (T-502).
  useNotificationsSync();
  usePushNotifications('passenger');

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} />
      <Stack.Screen name="PassengerPofile" component={PassengerProfile} />
      {/* One screen per ride: another ride's thread never reuses this one's state. */}
      <Stack.Screen name="RideChat" component={ChatThreadScreen} getId={rideChatScreenId} />
      <Stack.Screen name="PassengerMap" component={PassengerMapScreen} />
      <Stack.Screen name="PassengerRideTracking" component={PassengerRideTrackingScreen} />
      <Stack.Screen name="RideHistory" component={RideHistoryScreen} />
      <Stack.Screen name="FavoriteLocations" component={FavoriteLocationsScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="PassengerNotifications" component={PassengerNotificationsScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
    </Stack.Navigator>
  );
};

export default PassengerStack;
