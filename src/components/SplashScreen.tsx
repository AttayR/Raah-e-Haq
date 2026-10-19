import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hideNativeSplash } from '../core/nativeSplash';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { componentTokens, textStyles } from '../theme';
import { t } from '../i18n';

const k = componentTokens.splash;

/**
 * When the JS bundle started. The splash is mounted by several gates in turn (PersistGate,
 * ThemeProvider, LanguageGate, AuthFlow), each a new instance; the progress bar's 800 ms delay
 * counts from app start, not from the latest mount, so it never restarts.
 */
const APP_START = Date.now();

/** Milliseconds until the progress bar may show (0 once bootstrap has taken longer than 800 ms). */
export const progressDelayLeft = (now: number = Date.now()): number => Math.max(0, k.progressDelayMs - (now - APP_START));

/**
 * Splash (UI-R8, docs/design/screens/auth-splash.md; behaviour T-103, AUTH-14, INF-23): shown while
 * redux-persist rehydrates, the appearance and language are read and initializeAuth checks the
 * stored session, so neither Login nor home flashes before the session is known.
 *
 * - navy-950 in both modes (a brand moment), a 96 white badge with the 64 logo in the exact
 *   centre, the "Raah-e-Haq" wordmark (`h2`, white) 16 below it.
 * - It continues the native splash (T-531): iOS LaunchScreen.storyboard draws the same badge,
 *   logo and wordmark; the Android window background and Android 12 splash draw the badge and
 *   logo (a window background cannot draw text), so on Android the wordmark fades in (150 ms).
 *   Keep the values in step with the native files (__tests__/components/SplashScreen.test.tsx).
 * - The native splash stays up until this one is on screen (T-539): after its first layout and
 *   the next frame it asks native to hide, so there is no empty frame in between.
 * - Only when bootstrap takes longer than 800 ms: a 2pt indeterminate saffron bar, 120 wide,
 *   32 above the bottom inset, fades in (150 ms).
 *
 * It renders above ThemeProvider (fallback of the theme and language gates), so it reads tokens
 * directly instead of useAppTheme(), and raw Text instead of AppText. The wordmark does not scale
 * with the text size setting so it matches the native launch screen (the logo's own lettering).
 */
export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [showProgress, setShowProgress] = useState(() => progressDelayLeft() === 0);
  const wordmarkOpacity = useRef(new Animated.Value(Platform.OS === 'android' ? 0 : 1)).current;
  const progressOpacity = useRef(new Animated.Value(showProgress ? 1 : 0)).current;
  const segment = useRef(new Animated.Value(0)).current;

  const onLayout = useCallback(() => {
    requestAnimationFrame(hideNativeSplash);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const fade = Animated.timing(wordmarkOpacity, { toValue: 1, duration: k.progressFadeMs, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [wordmarkOpacity]);

  useEffect(() => {
    if (showProgress) return undefined;
    const timer = setTimeout(() => {
      setShowProgress(true);
      Animated.timing(progressOpacity, { toValue: 1, duration: k.progressFadeMs, useNativeDriver: true }).start();
    }, progressDelayLeft());
    return () => clearTimeout(timer);
  }, [showProgress, progressOpacity]);

  useEffect(() => {
    if (!showProgress || reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.timing(segment, {
        toValue: 1,
        duration: k.progressCycleMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [showProgress, reduceMotion, segment]);

  const translateX = reduceMotion
    ? (k.progressWidth - k.progressSegment) / 2
    : segment.interpolate({ inputRange: [0, 1], outputRange: [-k.progressSegment, k.progressWidth] });

  return (
    <View
      testID="app-splash"
      accessible
      accessibilityLabel={t('splash.loadingA11y')}
      style={styles.container}
      onLayout={onLayout}
    >
      <StatusBar barStyle="light-content" backgroundColor={k.background} />
      <View style={styles.badge} testID="app-splash-badge">
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      {/* Out of the flow, so the badge stays in the exact centre like the native splash. */}
      <Animated.View style={[styles.wordmarkSlot, { opacity: wordmarkOpacity }]} pointerEvents="none">
        <Text style={styles.wordmark} maxFontSizeMultiplier={1} testID="app-splash-wordmark">
          Raah-e-Haq
        </Text>
      </Animated.View>
      {showProgress ? (
        <Animated.View
          testID="app-splash-progress"
          accessibilityRole="progressbar"
          accessibilityLabel={t('splash.progressA11y')}
          style={[styles.track, { bottom: insets.bottom + k.progressBottom, opacity: progressOpacity }]}
        >
          <Animated.View style={[styles.bar, { transform: [{ translateX }] }]} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: k.background,
  },
  badge: {
    width: k.badge,
    height: k.badge,
    borderRadius: k.badge / 2,
    backgroundColor: k.badgeFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: k.logo,
    height: k.logo,
  },
  wordmarkSlot: {
    position: 'absolute',
    top: '50%',
    start: 0,
    end: 0,
    alignItems: 'center',
    marginTop: k.badge / 2 + k.wordmarkGap,
  },
  wordmark: {
    ...textStyles.h2,
    color: k.wordmark,
    textAlign: 'center',
  },
  track: {
    position: 'absolute',
    width: k.progressWidth,
    height: k.progressHeight,
    borderRadius: k.progressHeight / 2,
    backgroundColor: k.progressTrack,
    overflow: 'hidden',
  },
  bar: {
    width: k.progressSegment,
    height: k.progressHeight,
    borderRadius: k.progressHeight / 2,
    backgroundColor: k.progressBar,
  },
});
