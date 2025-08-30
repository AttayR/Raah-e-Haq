/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import BrandButton from '../../components/BrandButton';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();

  const handlePhoneSignIn = () => {
    navigation.navigate('PhoneAuth');
  };

  const handleCreateAccount = () => {
    navigation.navigate('Signup');
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

      <BrandButton
        title="Sign in with Phone Number"
        onPress={handlePhoneSignIn}
        variant="primary"
        style={styles.primaryButton}
      />

      <BrandButton
        title="Create Account"
        onPress={handleCreateAccount}
        variant="secondary"
        style={styles.secondaryButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 24,
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
    marginBottom: 32,
  },
  primaryButton: {
    marginBottom: 16,
  },
  secondaryButton: {
    marginBottom: 16,
  },
});
