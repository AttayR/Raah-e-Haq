import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PassengerBottomTabs from '../tabs/PassengerBottomTabs';
import PassengerProfile from 'src/screens/Passenger/Passengerprofile';
import MessagesScreen from 'src/screens/Passenger/chat/MessagesScreen';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import PassengerRideTrackingScreen from 'src/screens/Passenger/PassengerRideTrackingScreen';
import RideHistoryScreen from 'src/screens/Passenger/RideHistoryScreen';
import FavoriteLocationsScreen from 'src/screens/Passenger/FavoriteLocationsScreen';
import WalletScreen from 'src/screens/Passenger/WalletScreen';
import PassengerNotificationsScreen from 'src/screens/Passenger/PassengerNotificationsScreen';

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

const PassengerStack = () => {
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
