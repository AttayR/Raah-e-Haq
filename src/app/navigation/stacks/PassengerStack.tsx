import React, { useCallback } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import PassengerBottomTabs, { type PassengerTabParamList } from '../tabs/PassengerBottomTabs';
import PassengerProfile from 'src/screens/Passenger/Passengerprofile';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import FavoriteLocationsScreen from 'src/screens/Passenger/FavoriteLocationsScreen';
import { useRestoreActiveRide } from '../../../features/active-ride/hooks';
import ChatThreadScreen from '../../../features/chat/screens/ChatThreadScreen';
import { rideChatScreenId, type RideChatParams } from '../../../features/chat/navigation';
import { useNotificationsSync } from '../../../features/notifications/hooks';
import { usePushNotifications } from '../../../features/notifications/usePushNotifications';
import { NotificationPreferencesScreen } from '../../../features/notifications/screens/NotificationPreferencesScreen';
import TransactionDetailScreen from '../../../features/wallet/screens/TransactionDetailScreen';
import type { WalletRoutes } from '../../../features/wallet/navigation';
import RideDetailsScreen from '../../../features/ride-history/screens/RideDetailsScreen';
import { rideDetailsScreenId, type RideHistoryRoutes } from '../../../features/ride-history/navigation';
import type { RootStackParamList } from '../RootNavigation';

export type PassengerStackParamList = {
  /** Home · Activity · Inbox · Account (UI-R4, DESIGN_SYSTEM §8.1). */
  PassengerTabs: NavigatorScreenParams<PassengerTabParamList> | undefined;
  Profile: undefined;
  /** One ride's chat thread (T-510). */
  RideChat: RideChatParams;
  /** The booking flow and the ride in progress, full-screen over the tabs (T-301; UI-R4 rename of PassengerMap). */
  Booking: undefined;
  /** One ride's details/receipt (T-501); the list itself is Activity › Rides. */
  RideDetails: RideHistoryRoutes['RideDetails'];
  FavoriteLocations: undefined;
  /** One ledger entry (T-508); the wallet itself is Activity › Wallet. */
  WalletTransaction: WalletRoutes['WalletTransaction'];
  /** Account → Notifications: push preferences (T-502, BE-11). */
  NotificationPreferences: undefined;
};

const Stack = createNativeStackNavigator<PassengerStackParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'Passenger'>;

/**
 * The passenger app. `Booking` is the one booking route (T-301: never also a tab; UI-R4: Home is
 * the map-first tab and "Where to?" pushes it). On mount it asks the server for an in-progress
 * ride and, if there is one, opens the booking screen on top of the tabs, which shows it from
 * the activeRide slice.
 */
const PassengerStack = ({ navigation }: Props) => {
  const openActiveRide = useCallback(() => {
    // initial: false keeps PassengerTabs underneath, so Back returns to Home.
    navigation.navigate('Passenger', { screen: 'Booking', initial: false });
  }, [navigation]);
  useRestoreActiveRide(openActiveRide);
  // The one unread-count owner and FCM (device registration, foreground toast, tap routing) (T-502).
  useNotificationsSync();
  usePushNotifications('passenger');

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} />
      <Stack.Screen name="Profile" component={PassengerProfile} />
      {/* One screen per ride: another ride's thread never reuses this one's state. */}
      <Stack.Screen name="RideChat" component={ChatThreadScreen} getId={rideChatScreenId} />
      <Stack.Screen name="Booking" component={PassengerMapScreen} />
      <Stack.Screen name="RideDetails" component={RideDetailsScreen} getId={rideDetailsScreenId} />
      <Stack.Screen name="FavoriteLocations" component={FavoriteLocationsScreen} />
      <Stack.Screen name="WalletTransaction" component={TransactionDetailScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
    </Stack.Navigator>
  );
};

export default PassengerStack;
