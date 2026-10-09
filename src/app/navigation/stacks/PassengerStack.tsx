import React, { useCallback } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import PassengerBottomTabs from '../tabs/PassengerBottomTabs';
import PassengerProfile from 'src/screens/Passenger/Passengerprofile';
import MessagesScreen from 'src/screens/Passenger/chat/MessagesScreen';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import PassengerRideTrackingScreen from 'src/screens/Passenger/PassengerRideTrackingScreen';
import RideHistoryScreen from 'src/screens/Passenger/RideHistoryScreen';
import FavoriteLocationsScreen from 'src/screens/Passenger/FavoriteLocationsScreen';
import WalletScreen from 'src/screens/Passenger/WalletScreen';
import PassengerNotificationsScreen from 'src/screens/Passenger/PassengerNotificationsScreen';
import { useRestoreActiveRide } from '../../../features/active-ride/hooks';
import type { RootStackParamList } from '../RootNavigation';

export type PassengerStackParamList = {
  PassengerTabs: undefined;
  PassengerPofile: undefined;
  MessagesScreen: { chatData: any };
  PassengerMap: undefined;
  PassengerRideTracking: { passengerId: string; rideId?: string };
  RideHistory: undefined;
  FavoriteLocations: undefined;
  Wallet: undefined;
  PassengerNotifications: undefined;
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

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} />
      <Stack.Screen name="PassengerPofile" component={PassengerProfile} />
      <Stack.Screen name="MessagesScreen" component={MessagesScreen} />
      <Stack.Screen name="PassengerMap" component={PassengerMapScreen} />
      <Stack.Screen name="PassengerRideTracking" component={PassengerRideTrackingScreen} />
      <Stack.Screen name="RideHistory" component={RideHistoryScreen} />
      <Stack.Screen name="FavoriteLocations" component={FavoriteLocationsScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="PassengerNotifications" component={PassengerNotificationsScreen} />
    </Stack.Navigator>
  );
};

export default PassengerStack;
