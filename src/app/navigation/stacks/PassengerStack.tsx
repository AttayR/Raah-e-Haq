import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PassengerHomeScreen from '../../../screens/Passenger/PassengerHomeScreen';

export type PassengerStackParamList = {
  PassengerHome: undefined;
};

const Stack = createNativeStackNavigator<PassengerStackParamList>();
export default function PassengerStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PassengerHome"
        component={PassengerHomeScreen}
        options={{ title: 'Passenger' }}
      />
    </Stack.Navigator>
  );
}
