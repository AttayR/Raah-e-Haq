import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PassengerBottomTabs from '../tabs/PassengerBottomTabs';
import PassengerProfile from 'src/screens/Passenger/Passengerprofile';
import MessagesScreen from 'src/screens/Passenger/chat/MessagesScreen';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import PassengerRideTrackingScreen from 'src/screens/Passenger/PassengerRideTrackingScreen';

export type PassengerStackParamList = {
  PassengerTabs: undefined;
  PassengerPofile: undefined;
  MessagesScreen: { chatData: any };
  PassengerMap: undefined;
  PassengerRideTracking: { passengerId: string; rideId?: string };
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
    </Stack.Navigator>
  );
};

export default PassengerStack;
