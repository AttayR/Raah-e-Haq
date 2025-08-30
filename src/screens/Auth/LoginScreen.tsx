/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { RootState } from '../../store';
import { setUserRole } from '../../store/slices/authSlice';
import { sendVerificationCodeThunk } from '../../store/thunks/authThunks';
import ThemedTextInput from '../../components/ThemedTextInput';
import BrandButton from '../../components/BrandButton';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const nav = useNavigation();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setLocalRole] = useState<'driver' | 'passenger'>('passenger');
  const dispatch = useDispatch<any>();
  const { status, error } = useSelector((s: RootState) => s.auth);

  const onSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    try {
      dispatch(setUserRole(role));
      await dispatch(sendVerificationCodeThunk(phoneNumber.trim()));
      // Navigate to verification screen
      nav.navigate('PhoneAuth' as never);
    } catch (error: any) {
      // Error is handled in the thunk
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background }
      ]}
    >
      <Text
        style={[styles.title, { color: theme.colors.text }]}
      >
        Welcome back
      </Text>

      <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>
        Sign in with your phone number
      </Text>

      <ThemedTextInput
        placeholder="Phone number (e.g., +1234567890)"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        autoFocus
      />

      <View style={styles.roleContainer}>
        <Text style={[styles.roleLabel, { color: theme.colors.text }]}>
          I am a:
        </Text>
        <View style={styles.roleButtons}>
          <BrandButton
            title={role === 'passenger' ? 'Passenger ✓' : 'Passenger'}
            variant="secondary"
            onPress={() => setLocalRole('passenger')}
            style={styles.roleButton}
          />
          <BrandButton
            title={role === 'driver' ? 'Driver ✓' : 'Driver'}
            variant="success"
            onPress={() => setLocalRole('driver')}
            style={styles.roleButton}
          />
        </View>
      </View>

      <BrandButton
        title={status === 'loading' ? 'Sending...' : 'Send Code'}
        onPress={onSendCode}
        variant="primary"
        disabled={status === 'loading'}
      />

      {!!error && (
        <Text style={[styles.errorText, { color: theme.colors.warning }]}>
          {error}
        </Text>
      )}

      <BrandButton
        title="Create account"
        onPress={() => navigation.navigate('Signup')}
        variant="secondary"
        style={styles.createAccountButton}
      />

      <BrandButton
        title="Use Phone Authentication"
        onPress={() => nav.navigate('PhoneAuth' as never)}
        variant="secondary"
        style={styles.phoneAuthButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  roleContainer: {
    gap: 12,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 14,
  },
  createAccountButton: {
    marginTop: 8,
  },
  phoneAuthButton: {
    marginTop: 8,
  },
});
