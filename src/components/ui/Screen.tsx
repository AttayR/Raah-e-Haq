import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { layout, type StatusBarStyle } from '../../theme';
import { keyboardAvoidingProps } from './keyboard';

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
  /**
   * Keeps the end of the content above the keyboard (iOS; Android resizes the window). Default:
   * on for `scroll` screens. Turn it on for non-scroll screens whose bottom holds an input or a
   * sticky action (chat composer, a FlatList form). Offsets by the top inset when `edges` pads it.
   */
  keyboardAvoiding?: boolean;
  /** Pull to refresh for `scroll` screens, tinted `primary`. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** A custom `<RefreshControl>`; wins over `refreshing`/`onRefresh`. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /**
   * Scroll handler for `scroll` screens, e.g. `useHeaderScroll().onScroll` so a Header fades in
   * its hairline or collapses its large title. Accepts a Reanimated handler or a plain callback.
   */
  onScroll?: React.ComponentProps<typeof Animated.ScrollView>['onScroll'];
  /** Overrides the theme bar style (rare: content under the status bar that is always dark). */
  statusBarStyle?: StatusBarStyle;
  testID?: string;
}>;

/**
 * Screen root (DESIGN_SYSTEM §5.1): safe-area insets, the `background` colour, the status bar
 * from the theme (so no screen sets StatusBar itself) and keyboard avoidance with the top-inset
 * offset (see `keyboard.ts`). `scroll` screens get `keyboardShouldPersistTaps="handled"`, so
 * the first tap with the keyboard up reaches the button.
 *
 * Anything presented in a native Modal (Dialog, modal BottomSheet) is a separate window and
 * wraps itself in `ModalRoot`, which sets its own StatusBar, safe-area provider and gesture root.
 */
export function Screen({
  scroll = false,
  edges = ['top'],
  contentStyle,
  keyboardAvoiding,
  refreshing,
  onRefresh,
  refreshControl,
  onScroll,
  statusBarStyle,
  testID,
  children,
}: ScreenProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const background = { backgroundColor: theme.colors.background };
  const avoid = keyboardAvoiding ?? scroll;
  const topInset = edges.includes('top') ? insets.top : 0;

  const refresh =
    refreshControl ??
    (onRefresh ? (
      <RefreshControl
        refreshing={!!refreshing}
        onRefresh={onRefresh}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
      />
    ) : undefined);

  const body = scroll ? (
    <Animated.ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      refreshControl={refresh}
      onScroll={onScroll}
      scrollEventThrottle={16}
      testID={testID ? `${testID}-scroll` : undefined}
    >
      {children}
    </Animated.ScrollView>
  ) : (
    <View style={[styles.root, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.root, background]} testID={testID}>
      <StatusBar barStyle={statusBarStyle ?? theme.statusBarStyle} backgroundColor={theme.colors.background} />
      {avoid ? (
        <KeyboardAvoidingView
          style={styles.root}
          {...keyboardAvoidingProps(Platform.OS, topInset)}
          testID={testID ? `${testID}-keyboard-avoider` : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Centred column capped at the tablet content width (§3.2); full width on phones.
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
});
