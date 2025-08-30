import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../../screens/Auth/LoginScreen';
import SignupScreen from '../../../screens/Auth/SignupScreen';
import PhoneAuthScreen from '../../../screens/Auth/PhoneAuthScreen';
import RoleSelectionScreen from '../../../screens/Auth/RoleSelectionScreen';
import BasicInfoScreen from '../../../screens/Auth/BasicInfoScreen';

export type AuthStackParamList = {
  Login: undefined;
  Signup: { role?: 'driver'|'passenger' } | undefined;
  PhoneAuth: undefined;
  RoleSelection: undefined;
  BasicInfo: { role: 'driver' | 'passenger' };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign In' }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} options={{ title: 'Phone Authentication' }} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} options={{ title: 'Choose Role' }} />
      <Stack.Screen name="BasicInfo" component={BasicInfoScreen} options={{ title: 'Complete Profile' }} />
    </Stack.Navigator>
  );
}