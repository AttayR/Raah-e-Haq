import React from 'react';
import { ActivityIndicator, Image, StyleSheet, useColorScheme, View } from 'react-native';
import { DarkTheme, LightTheme } from '../theme';

/**
 * Shown while redux-persist rehydrates and initializeAuth checks the stored session
 * (AUTH-14, INF-23), so neither Login nor home flashes before the session is known.
 * It also renders above ThemeProvider (inside PersistGate), so it resolves the theme from
 * the system scheme itself instead of useAppTheme().
 *
 * It continues the native splash (T-531): iOS LaunchScreen.storyboard and the Android
 * windowBackground / Android 12 splash draw the same background and the same 120 pt logo
 * exactly in the centre, so the logo stays put and only the spinner appears below it.
 * Keep the colours in step with ios/…/SplashBackground.colorset and android res colors.xml
 * (__tests__/components/SplashScreen.test.tsx checks them).
 */
/** Matches the native splash logo (120 pt; 120/240/360 px assets). */
const LOGO_SIZE = 120;

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
      <View style={styles.spinnerSlot} pointerEvents="none">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
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
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 24,
  },
  // Below the centred logo (half its height + 24), without moving the logo off centre.
  spinnerSlot: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: LOGO_SIZE / 2 + 24,
  },
});
