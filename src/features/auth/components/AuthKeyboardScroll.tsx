import React, { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '../../../theme/spacing';
import { revealOffset } from '../keyboardReveal';

/** Room left between the focused input and the keyboard, so its error line shows too. */
export const KEYBOARD_REVEAL_MARGIN = Spacing[10];

interface Props {
  children: ReactNode;
  /** The caller's ref, when it scrolls the form itself (e.g. to a field error). */
  scrollRef?: RefObject<ScrollView | null>;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * The scrolling body of every auth screen (T-204, AUTH-13):
 * - iOS: KeyboardAvoidingView pads the scroll view by the keyboard height. Android uses
 *   `height`, which is a no-op while `adjustResize` resizes the window and still keeps inputs
 *   clear if enforced edge-to-edge (Android 15+) stops the resize.
 * - When the keyboard opens, the focused input is scrolled above the keyboard. Focus moving
 *   between inputs while it stays open relies on the native scroll-into-view.
 * - The first tap with the keyboard up reaches the button (`keyboardShouldPersistTaps`).
 * - The content ends above the home indicator (bottom safe-area inset).
 */
export default function AuthKeyboardScroll({ children, scrollRef, style, contentContainerStyle }: Props) {
  const ownRef = useRef<ScrollView>(null);
  const ref = scrollRef ?? ownRef;
  const scrollY = useRef(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input) {
        return;
      }
      input.measureInWindow((_x, y, _width, height) => {
        const target = revealOffset({
          fieldBottom: y + height,
          keyboardTop: event.endCoordinates.screenY,
          scrollY: scrollY.current,
          margin: KEYBOARD_REVEAL_MARGIN,
        });
        if (target !== null) {
          ref.current?.scrollTo({ y: target, animated: true });
        }
      });
    });
    return () => subscription.remove();
  }, [ref]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="auth-keyboard-avoiding"
    >
      <ScrollView
        ref={ref}
        style={[styles.fill, style]}
        contentContainerStyle={[
          styles.content,
          contentContainerStyle,
          { paddingBottom: insets.bottom + Spacing[6] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
