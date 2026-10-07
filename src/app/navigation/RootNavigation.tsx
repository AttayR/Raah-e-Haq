import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverStack from './stacks/DriverStack';
import PassengerStack from './stacks/PassengerStack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logger } from '../../core/logging/logger';

export type RootStackParamList = {
  Driver: undefined;
  Passenger: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user } = useSelector((s: RootState) => s.apiAuth);
  const role = user?.role;

  logger.debug('RootNavigation - Current role:', role);
  logger.debug('RootNavigation - Role type:', typeof role);
  logger.debug('RootNavigation - Role === "passenger":', role === 'passenger');
  logger.debug('RootNavigation - Role === "driver":', role === 'driver');

  // Use key prop to force re-rendering when role changes
  return (
    <Stack.Navigator 
      key={role || 'no-role'} 
      screenOptions={{ headerShown: false }}
    >
      {role === 'driver' && (
        <Stack.Screen 
          name="Driver" 
          component={DriverStack} 
        />
      )}
      {role === 'passenger' && (
        <Stack.Screen 
          name="Passenger" 
          component={PassengerStack} 
        />
      )}
    </Stack.Navigator>
  );
}