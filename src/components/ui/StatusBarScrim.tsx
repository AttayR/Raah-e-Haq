import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens } from '../../theme';
import { LinearFade } from './LinearFade';

/**
 * [UI-R12/R13] Status-bar scrim over a full-screen map (passenger-home V9, shared-trip-sheet TS2):
 * `insets.top + 24` high, `surface` at 0.85 fading to 0, static, takes no touches. Keeps the clock
 * and battery legible over map labels.
 */
export function StatusBarScrim({ testID = 'status-scrim' }: { testID?: string }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearFade
      color={theme.colors.surface}
      direction="down"
      fromOpacity={componentTokens.home.scrimOpacity}
      toOpacity={0}
      style={[styles.scrim, { height: insets.top + componentTokens.home.scrimExtra }]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, start: 0, end: 0 },
});
