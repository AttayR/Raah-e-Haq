/* eslint-disable react-native/no-inline-styles */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import BrandButton from '../../components/BrandButton';
import ThemedTextInput from '../../components/ThemedTextInput';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { emailSignInThunk, resetPasswordThunk } from '../../store/thunks/authThunks';

type LoginMethod = 'phone' | 'email';

export default function LoginScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<any>();
  
  const { status, error } = useSelector((state: RootState) => state.auth);
  
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handlePhoneSignIn = () => {
    navigation.navigate('PhoneAuth');
  };

  const handleCreateAccount = () => {
    navigation.navigate('Signup');
  };

  const handleEmailSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      await dispatch(emailSignInThunk(email.trim(), password));
    } catch (error: any) {
      // Error is handled in the thunk
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email first');
      return;
    }

    try {
      await dispatch(resetPasswordThunk(email.trim()));
      Alert.alert(
        'Password Reset',
        'Password reset email sent! Please check your inbox.',
        [{ text: 'OK' }]
      );
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
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Welcome to RaaHeHaq
      </Text>

      <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>
        Sign in to your account or create a new one
      </Text>

      {/* Login Method Toggle */}
      <View style={styles.toggleContainer}>
        <BrandButton
          title="Phone"
          onPress={() => setLoginMethod('phone')}
          variant={loginMethod === 'phone' ? 'primary' : 'secondary'}
          style={[styles.toggleButton, { flex: 1 }]}
        />
        <BrandButton
          title="Email"
          onPress={() => setLoginMethod('email')}
          variant={loginMethod === 'email' ? 'primary' : 'secondary'}
          style={[styles.toggleButton, { flex: 1 }]}
        />
      </View>

      {/* Phone Login */}
      {loginMethod === 'phone' && (
        <>
          <BrandButton
            title="Sign in with Phone Number"
            onPress={handlePhoneSignIn}
            variant="primary"
            style={styles.primaryButton}
          />
        </>
      )}

      {/* Email Login */}
      {loginMethod === 'email' && (
        <>
          <ThemedTextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <ThemedTextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <BrandButton
            title={status === 'loading' ? 'Signing in...' : 'Sign in with Email'}
            onPress={handleEmailSignIn}
            variant="primary"
            disabled={status === 'loading'}
            style={styles.primaryButton}
          />
          
          <BrandButton
            title="Forgot Password?"
            onPress={handleForgotPassword}
            variant="secondary"
            style={styles.forgotButton}
          />
        </>
      )}

      <BrandButton
        title="Create New Account"
        onPress={handleCreateAccount}
        variant="secondary"
        style={styles.secondaryButton}
      />

      {error && (
        <Text style={[styles.errorText, { color: theme.colors.warning }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toggleButton: {
    marginBottom: 0,
  },
  primaryButton: {
    marginBottom: 16,
  },
  secondaryButton: {
    marginBottom: 16,
  },
  forgotButton: {
    marginBottom: 8,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
});
