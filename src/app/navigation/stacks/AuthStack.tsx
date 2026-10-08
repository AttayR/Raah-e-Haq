import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../../screens/Auth/LoginScreen';
import SignupScreen from '../../../screens/Auth/SignupScreen';
import PhoneAuthScreen from '../../../screens/Auth/PhoneAuthScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: { role?: 'driver'|'passenger' } | undefined;
  PhoneAuth: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
    </Stack.Navigator>
  );
}