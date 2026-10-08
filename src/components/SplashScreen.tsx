import React from 'react';
import { ActivityIndicator, Image, StyleSheet, useColorScheme, View } from 'react-native';
import { DarkTheme, LightTheme } from '../theme';

/**
 * Shown while redux-persist rehydrates and initializeAuth checks the stored session
 * (AUTH-14, INF-23), so neither Login nor home flashes before the session is known.
 * It also renders above ThemeProvider (inside PersistGate), so it resolves the theme from
 * the system scheme itself instead of useAppTheme().
 */
export default function SplashScreen() {
  const theme = useColorScheme() === 'dark' ? DarkTheme : LightTheme;

  return (
    <View
      testID="app-splash"
      accessibilityLabel="Loading"
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  spinner: {
    marginTop: 24,
  },
});
