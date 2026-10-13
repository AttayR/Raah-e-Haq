import 'react-native-reanimated';
import React from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavLight,
  DarkTheme as NavDark,
} from '@react-navigation/native';

import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from './src/app/providers/ThemeProvider';
import AuthFlow from './src/app/navigation/AuthFlow';
import ReduxProvider from './src/app/providers/ReduxProvider';
import NotificationManager from './src/components/NotificationManager';
import { DevKitGalleryHost } from './src/features/dev-gallery/DevKitGalleryHost';

function ThemedNav() {
  const { theme } = useAppTheme();
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
      <NavigationContainer theme={navTheme}>
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
        <ThemeProvider>
          <NotificationManager>
            <DevKitGalleryHost>
              <ThemedNav />
            </DevKitGalleryHost>
          </NotificationManager>
        </ThemeProvider>
      </ReduxProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
