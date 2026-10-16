import React from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, space } from '../../theme';
import { AppText } from './AppText';

export type KeyboardDoneBarProps = {
  /** Inputs opt in with `inputAccessoryViewID={nativeID}`. */
  nativeID: string;
  label: string;
  testID?: string;
};

/**
 * iOS bar with a "Done" button above the keyboard. The number pad (and a multiline input) has no
 * return key, so without it the keyboard could not be closed (T-509; kit since T-545). Android's
 * keyboards always have a close key, so nothing is rendered there.
 *
 * Prefer `<TextField doneBar />`: the field renders its own bar with a unique id (T-548/T-550).
 * On Fabric an InputAccessoryView attaches only to the first input in the window with its
 * `nativeID`, so do not share one bar between several inputs. Use this directly only for an
 * input that is not a TextField: one bar per input, a unique `nativeID`, rendered next to it.
 * Render it after its input: the bar looks the input up when it mounts. An autoFocus input is
 * already focused by then; the patched native view reloads its keyboard so the bar shows (T-551).
 */
export function KeyboardDoneBar({ nativeID, label, testID }: KeyboardDoneBarProps) {
  const { theme } = useAppTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={[styles.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          accessibilityRole="button"
          accessibilityLabel={label}
          hitSlop={space[2]}
          style={styles.button}
          testID={testID}
        >
          <AppText variant="bodyStrong" color="primaryText">
            {label}
          </AppText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  // 32 visual + 8 slop each side = a 48 target.
  button: {
    minHeight: componentTokens.keyboardDoneBar.buttonHeight,
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
});
