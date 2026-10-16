import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';
import RegistrationScreen from './RegistrationScreen';

/** AuthStack `Signup`: the registration wizard; `role` (when a caller passes it) preselects a role card. */
export default function SignupScreen({ route }: NativeStackScreenProps<AuthStackParamList, 'Signup'>) {
  return <RegistrationScreen initialRole={route.params?.role} />;
}
