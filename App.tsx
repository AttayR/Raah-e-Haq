import 'react-native-reanimated';
import React, { useMemo } from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavLight,
  DarkTheme as NavDark,
} from '@react-navigation/native';

import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from './src/app/providers/ThemeProvider';
import AuthFlow from './src/app/navigation/AuthFlow';
import { createLinking } from './src/app/navigation/linking';
import type { RootState } from './src/store';
import ReduxProvider from './src/app/providers/ReduxProvider';
import NotificationManager from './src/components/NotificationManager';
import SplashScreen from './src/components/SplashScreen';
import { DevKitGalleryHost } from './src/features/dev-gallery/DevKitGalleryHost';
import { LanguageGate } from './src/app/providers/LanguageGate';
import { restoreStoredLanguage } from './src/i18n/languagePreference';

// T-523: read the stored language now, alongside the appearance read, so the gate rarely waits.
restoreStoredLanguage();

function ThemedNav() {
  const { theme } = useAppTheme();
  // `raahehaq://wallet/topup?id=…` (T-515): routed by the auth state when a link arrives.
  const store = useStore<RootState>();
  const linking = useMemo(
    () =>
      createLinking(() => {
        const { isInitialized, isAuthenticated, user } = store.getState().apiAuth;
        return { isInitialized, isAuthenticated, user };
      }),
    [store],
  );
  const navTheme =
    theme.mode === 'dark'
      ? {
          ...NavDark,
          colors: {
            ...NavDark.colors,
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.textPrimary,
            border: theme.colors.border,
          },
        }
      : {
          ...NavLight,
          colors: {
            ...NavLight.colors,
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.textPrimary,
            border: theme.colors.border,
          },
        };
  return (
    <>
      <StatusBar
        barStyle={theme.statusBarStyle}
        backgroundColor={theme.colors.background}
      />
      {/* T-523: a language switch re-renders the screens, not this tree (localeScreenLayout). */}
      <NavigationContainer theme={navTheme} linking={linking}>
        <AuthFlow />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    // Gesture root for the kit BottomSheet (UI-R3); native Modals add their own (ModalRoot).
    <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
      <ReduxProvider>
        {/* The splash, not a blank frame, while the appearance is read (T-539). */}
        <ThemeProvider fallback={<SplashScreen />}>
          <LanguageGate fallback={<SplashScreen />}>
            <NotificationManager>
              <DevKitGalleryHost>
                <ThemedNav />
              </DevKitGalleryHost>
            </NotificationManager>
          </LanguageGate>
        </ThemeProvider>
      </ReduxProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
