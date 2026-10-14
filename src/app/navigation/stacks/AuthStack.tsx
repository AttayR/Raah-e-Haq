import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../../screens/Auth/LoginScreen';
import PhoneAuthScreen from '../../../screens/Auth/PhoneAuthScreen';

export type AuthStackParamList = {
  /** `method` opens Login on that tab (PhoneAuth's email fallback, T-113). */
  Login: { method?: 'phone' | 'email' } | undefined;
  Signup: { role?: 'driver'|'passenger' } | undefined;
  PhoneAuth: undefined;
};

/*
 * Secondary routes are required on first navigation, not when the stack mounts (PERF-03,
 * T-531): the first screen paints without evaluating these screens and their imports.
 */
const loadSignupScreen = () => require('../../../screens/Auth/SignupScreen').default;

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" getComponent={loadSignupScreen} />
      <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
    </Stack.Navigator>
  );
}