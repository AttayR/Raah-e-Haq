/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { RootState } from '../../store';
import { setRole } from '../../store/slices/userSlice';
import { signInThunk } from '../../store/thunks/authThunks';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setLocalRole] = useState<'driver' | 'passenger'>('passenger');
  const dispatch = useDispatch<any>();
  const { status, error } = useSelector((s: RootState) => s.auth);

  const onLogin = () => {
    dispatch(setRole(role));
    dispatch(signInThunk(email.trim(), password.trim(), role));
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
        Welcome back
      </Text>

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

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <BrandButton
          title={role === 'passenger' ? 'Passenger ✓' : 'Passenger'}
          variant="secondary"
          onPress={() => setLocalRole('passenger')}
          style={{ flex: 1 }}
        />
        <BrandButton
          title={role === 'driver' ? 'Driver ✓' : 'Driver'}
          variant="success"
          onPress={() => setLocalRole('driver')}
          style={{ flex: 1 }}
        />
      </View>

      <BrandButton
        title={status === 'loading' ? 'Signing in…' : 'Sign in'}
        onPress={onLogin}
        variant="primary"
      />

      {!!error && (
        <Text style={{ color: theme.colors.warning, marginTop: 6 }}>
          {error}
        </Text>
      )}

      <BrandButton
        title="Create account"
        onPress={() => navigation.navigate('Signup')}
        variant="secondary"
        style={{ marginTop: 8 }}
      />
    </View>
  );
}
