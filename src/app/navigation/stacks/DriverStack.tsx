import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverBottomTabs from '../tabs/DriverBottomTabs';
import DriverProfile from 'src/screens/Driver/DriverProfile';
import DriverMessagesScreen from 'src/screens/Driver/DriverMessagesScreen';
import DriverMapScreen from 'src/screens/Driver/DriverMapScreen';
import DriverRideScreen from 'src/screens/Driver/DriverRideScreen';
import { useDriverStatusSync } from '../../../features/driver-status/hooks';
import { useDriverRideRestore } from '../../../features/driver-ride/hooks';

export type DriverStackParamList = {
  DriverTabs: undefined;
  DriverProfile: undefined;
  DriverMessagesScreen: {
    chatData: {
      id: string;
      name: string;
      avatar: string;
      lastMessage: string;
      time: string;
      unreadCount: number;
      isPassenger: boolean;
    };
  };
  DriverMap: undefined;
  /** The driver's current ride (T-405); it reads the ride from the driverRide slice. */
  DriverRide: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

const DriverStack = () => {
  // Driver online/offline from the server: after sign-in (this mounts) and on foreground (T-401).
  useDriverStatusSync();
  // A ride the server reports as active (on_ride + active_ride_id) is read back (T-405).
  useDriverRideRestore();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="DriverTabs" 
        component={DriverBottomTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriverProfile" 
        component={DriverProfile} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriverMessagesScreen" 
        component={DriverMessagesScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriverMap" 
        component={DriverMapScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverRide"
        component={DriverRideScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default DriverStack;