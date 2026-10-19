import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import DriverStack, { type DriverStackParamList } from './stacks/DriverStack';
import PassengerStack, { type PassengerStackParamList } from './stacks/PassengerStack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logger } from '../../core/logging/logger';
import { PermissionPrimerHost } from '../../features/permissions/PermissionPrimerHost';

export type RootStackParamList = {
  Driver: NavigatorScreenParams<DriverStackParamList> | undefined;
  Passenger: NavigatorScreenParams<PassengerStackParamList> | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  // T-534 (PERF-16): the role only; other auth changes do not re-render the role stack.
  const role = useSelector((s: RootState) => s.apiAuth.user?.role);

  logger.debug('RootNavigation - Current role:', role);
  logger.debug('RootNavigation - Role type:', typeof role);
  logger.debug('RootNavigation - Role === "passenger":', role === 'passenger');
  logger.debug('RootNavigation - Role === "driver":', role === 'driver');

  // Use key prop to force re-rendering when role changes
  return (
    <>
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
    {/* UI-R8: location / notification pre-prompts, only while signed in. */}
    <PermissionPrimerHost />
    </>
  );
}