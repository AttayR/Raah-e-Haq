import type { KeyboardAvoidingViewProps } from 'react-native';

/**
 * KeyboardAvoidingView props for the chat thread (T-512).
 *
 * RN's KeyboardAvoidingView compares its own bottom edge with the keyboard's `screenY`, but it
 * takes that edge from `onLayout`, which is relative to its parent, not to the window. In the
 * thread the KAV sits inside `Screen` (a SafeAreaView padding the top inset), so without an
 * offset it under-pads by exactly the status bar / Dynamic Island inset and the keyboard covers
 * the composer. The header above the KAV is already counted by `onLayout`'s `y`; only what sits
 * above the parent (the top safe-area inset) belongs in `keyboardVerticalOffset`.
 *
 * Android keeps `adjustResize` (AndroidManifest), so the KAV does nothing there.
 */
export const chatKeyboardAvoidingProps = (
  os: string,
  topInset: number,
): Pick<KeyboardAvoidingViewProps, 'behavior' | 'enabled' | 'keyboardVerticalOffset'> =>
  os === 'ios'
    ? { behavior: 'padding', enabled: true, keyboardVerticalOffset: Math.max(0, topInset) }
    : { behavior: undefined, enabled: false, keyboardVerticalOffset: 0 };
