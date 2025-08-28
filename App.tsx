import React from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavLight,
  DarkTheme as NavDark,
} from '@react-navigation/native';

import { StatusBar } from 'react-native';
import { ThemeProvider, useAppTheme } from './src/app/providers/ThemeProvider';
import RootNavigator from './src/app/navigation/RootNavigation';
import ReduxProvider from './src/app/providers/ReduxProvider';

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
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <ThemedNav />
      </ThemeProvider>
    </ReduxProvider>
  );
}
