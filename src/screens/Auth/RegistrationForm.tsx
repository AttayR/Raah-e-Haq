import React from 'react';
import RegistrationScreen from './RegistrationScreen';

type RegistrationFormProps = {
  initialRole?: 'driver' | 'passenger';
  onSuccess?: () => void;
};

export default function RegistrationForm({ initialRole = 'passenger', onSuccess }: RegistrationFormProps) {
  return <RegistrationScreen />;
}
