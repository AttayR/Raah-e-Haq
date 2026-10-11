import React from 'react';
import { ScrollView, StatusBar, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { layout } from '../../theme';

export type ScreenProps = React.PropsWithChildren<{
  /** Wraps content in a ScrollView (taps reach inputs while the keyboard is up). */
  scroll?: boolean;
  /**
   * Safe-area edges to pad. Default `['top']`: tab screens sit above the tab bar, which owns
   * the bottom inset. Map screens pass `[]` and place overlays from `useSafeAreaInsets()`.
   */
  edges?: Edge[];
  /** Style of the scroll content (or of the inner View without `scroll`). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/**
 * Screen root (DESIGN_SYSTEM §5.1): safe-area insets, the `background` colour and the status
 * bar style from the theme, so no screen sets StatusBar itself.
 * Keyboard avoidance (react-native-keyboard-controller) comes with T-602 for form screens.
 */
export function Screen({ scroll = false, edges = ['top'], contentStyle, testID, children }: ScreenProps) {
  const { theme } = useAppTheme();
  const background = { backgroundColor: theme.colors.background };
  return (
    <SafeAreaView edges={edges} style={[styles.root, background]} testID={testID}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.colors.background} />
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Centred column capped at the tablet content width (§3.2); full width on phones.
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
});
