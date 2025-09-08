import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PassengerBottomTabs from '../tabs/PassengerBottomTabs';
import PassengerProfile from 'src/screens/Passenger/Passengerprofile';

export type PassengerStackParamList = {
  PassengerTabs: undefined;
  PassengerPofile: undefined;
};

const Stack = createNativeStackNavigator<PassengerStackParamList>();

const PassengerStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} />
      <Stack.Screen name="PassengerPofile" component={PassengerProfile} />
    </Stack.Navigator>
  );
};

export default PassengerStack;
