import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { StatusBarStyle } from '../../theme';
import { DialogHost } from './Dialog';
import { ToastHost } from './Toast';

type Props = React.PropsWithChildren<{
  /** Overrides the theme's bar style (e.g. light content over a dark scrim). */
  statusBarStyle?: StatusBarStyle;
  /** Mount a dialog host inside this Modal. Default true; the Dialog's own Modal passes false. */
  withDialogHost?: boolean;
}>;

/**
 * Root for anything presented in a native `Modal` (Dialog, modal BottomSheet, the kit gallery).
 * A Modal is a separate native window: it ignores the app's StatusBar, safe-area provider and
 * gesture root, so this sets all three (DESIGN_SYSTEM §5.1, §5.14, §5.15). The status bar keeps
 * the theme style (dark text in light mode) unless the caller overrides it, and on Android it is
 * translucent so the scrim reaches the top edge.
 */
export function ModalRoot({ statusBarStyle, withDialogHost = true, children }: Props) {
  const { theme } = useAppTheme();
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar barStyle={statusBarStyle ?? theme.statusBarStyle} translucent backgroundColor="transparent" />
      <SafeAreaProvider>
        {children}
        {/* Dialogs asked for while this Modal is up render as an overlay inside it (iOS cannot stack a second Modal). */}
        {withDialogHost ? <DialogHost inline /> : null}
        {/* Toasts too: the root host sits under this Modal's window and would never be seen. */}
        <ToastHost inline />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
