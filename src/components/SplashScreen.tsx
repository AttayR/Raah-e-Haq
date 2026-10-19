import React, { useCallback } from 'react';
import { ActivityIndicator, Image, StyleSheet, useColorScheme, View } from 'react-native';
import { hideNativeSplash } from '../core/nativeSplash';
import { DarkTheme, LightTheme } from '../theme';
import { t } from '../i18n';

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
 *
 * The native splash stays up until this one is on screen (T-539): after its first layout and
 * the next frame it asks native to hide, so there is no empty frame (logo blink) in between.
 */
/** Matches the native splash logo (120 pt; 120/240/360 px assets). */
const LOGO_SIZE = 120;

export default function SplashScreen() {
  const theme = useColorScheme() === 'dark' ? DarkTheme : LightTheme;
  const onLayout = useCallback(() => {
    requestAnimationFrame(hideNativeSplash);
  }, []);

  return (
    <View
      testID="app-splash"
      accessibilityLabel={t('kit.loadingA11y')}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      onLayout={onLayout}
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
