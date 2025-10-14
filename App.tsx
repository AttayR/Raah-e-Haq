import 'react-native-reanimated';
import React, { useEffect } from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavLight,
  DarkTheme as NavDark,
} from '@react-navigation/native';

import { StatusBar } from 'react-native';
import { ThemeProvider, useAppTheme } from './src/app/providers/ThemeProvider';
import AuthFlow from './src/app/navigation/AuthFlow';
import ReduxProvider from './src/app/providers/ReduxProvider';
import Toast from 'react-native-toast-message';
import { configureGoogleSignIn } from './src/services/googleSignIn';
import { initializeNotificationService } from 'src/services/notificationService';

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
            text: theme.colors.text,
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
            text: theme.colors.text,
            border: theme.colors.border,
          },
        };
  return (
    <>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <NavigationContainer theme={navTheme}>
        <AuthFlow />
      </NavigationContainer>
      <Toast />
    </>
  );
}

export default function App() {
  useEffect(() => {
    // Configure Google Sign-In when app starts
    initializeNotificationService()
    configureGoogleSignIn();
  }, []);

  return (
    <ReduxProvider>
      <ThemeProvider>
        <ThemedNav />
      </ThemeProvider>
    </ReduxProvider>
  );
}
