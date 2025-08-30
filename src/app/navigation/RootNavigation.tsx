import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverStack from './stacks/DriverStack';
import PassengerStack from './stacks/PassengerStack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export type RootStackParamList = {
  Driver: undefined;
  Passenger: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { role } = useSelector((s: RootState) => s.user);

  // Only show role-based screens when authenticated
  // AuthFlow will handle showing Auth screens when not authenticated
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {role === 'driver' && <Stack.Screen name="Driver" component={DriverStack} />}
      {role === 'passenger' && <Stack.Screen name="Passenger" component={PassengerStack} />}
      {/* If no role is set, this means user is not authenticated */}
      {/* AuthFlow will handle showing the appropriate auth screens */}
    </Stack.Navigator>
  );
}