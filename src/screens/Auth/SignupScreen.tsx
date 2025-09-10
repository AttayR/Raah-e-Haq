/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useDispatch } from 'react-redux';

import { useAppTheme } from '../../app/providers/ThemeProvider';

import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import { emailSignUpThunk } from '../../store/thunks/authThunks';

export default function SignupScreen() {
  const { theme } = useAppTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'driver' | 'passenger'>('passenger');
  const dispatch = useDispatch<any>();

  const onSignup = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    dispatch(emailSignUpThunk(email.trim(), password.trim(), role, name.trim()));
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: 16,
        gap: 12,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}
      >
        Create your account
      </Text>
      <ThemedTextInput
        placeholder="Name"
        autoCapitalize="none"
        value={name}
        onChangeText={setName}
      />
      <ThemedTextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <ThemedTextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <ThemedTextInput
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <BrandButton
          title={role === 'passenger' ? 'Passenger ✓' : 'Passenger'}
          variant="secondary"
          onPress={() => setRole('passenger')}
          style={{ flex: 1 }}
        />
        <BrandButton
          title={role === 'driver' ? 'Driver ✓' : 'Driver'}
          variant="success"
          onPress={() => setRole('driver')}
          style={{ flex: 1 }}
        />
      </View>

      <BrandButton title="Sign up" onPress={onSignup} variant="primary" />
      <BrandButton
        title="Continue with Google"
        onPress={onSignup}
        variant="secondary"
      />
    </View>
  );
}
