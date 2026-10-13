import type { KeyboardAvoidingViewProps } from 'react-native';

/**
 * KeyboardAvoidingView props used by `Screen` (DESIGN_SYSTEM §5.1, UI-R3). One place for the fix
 * first made in the chat thread (T-512) and the Pay commission form (T-509):
 *
 * RN's KeyboardAvoidingView compares its own bottom edge with the keyboard's `screenY`, but it
 * takes that edge from `onLayout`, which is relative to its parent, not to the window. Inside
 * `Screen` the KAV sits in a SafeAreaView that pads the top inset, so without an offset it
 * under-pads by exactly the status bar / Dynamic Island inset and the keyboard covers the end of
 * the content (the chat composer, a form's submit button). Anything above the KAV inside the
 * same parent (a Header) is already counted by `onLayout`'s `y`; only what sits above the parent
 * (the padded top inset) belongs in `keyboardVerticalOffset`.
 *
 * Android keeps `adjustResize` (AndroidManifest), so the KAV is off there.
 */
export const keyboardAvoidingProps = (
  os: string,
  topInset: number,
): Pick<KeyboardAvoidingViewProps, 'behavior' | 'enabled' | 'keyboardVerticalOffset'> =>
  os === 'ios'
    ? { behavior: 'padding', enabled: true, keyboardVerticalOffset: Math.max(0, topInset) }
    : { behavior: undefined, enabled: false, keyboardVerticalOffset: 0 };
