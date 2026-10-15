import type { KeyboardAvoidingViewProps } from 'react-native';

/**
 * KeyboardAvoidingView props used by `Screen` (DESIGN_SYSTEM §5.1, UI-R3).
 *
 * RN's KeyboardAvoidingView pads by `frame.y + frame.height - (keyboard.screenY - offset)`, with
 * `frame` from its own `onLayout`, which is relative to its parent, not to the window. So
 * `keyboardVerticalOffset` must be exactly the distance from the window top to the parent's top
 * edge: anything inside the parent (its padding, a Header above the KAV) is already in `frame.y`.
 *
 * In `Screen` the KAV is a direct child of the safe-area `SafeAreaView`, whose top inset is Yoga
 * padding and therefore already counted in `frame.y`; the screen itself starts at the window top.
 * So `Screen` passes 0. T-540: it used to pass the top inset as well (a leftover from T-512, when
 * the chat's KAV sat one level deeper, below the padded area), which counted the inset twice and
 * left the chat composer and form actions floating a top inset (~62 pt on iPhone 17) above the
 * keyboard.
 *
 * Android keeps `adjustResize` (AndroidManifest), so the KAV is off there.
 */
export const keyboardAvoidingProps = (
  os: string,
  offsetAboveParent: number,
): Pick<KeyboardAvoidingViewProps, 'behavior' | 'enabled' | 'keyboardVerticalOffset'> =>
  os === 'ios'
    ? { behavior: 'padding', enabled: true, keyboardVerticalOffset: Math.max(0, offsetAboveParent) }
    : { behavior: undefined, enabled: false, keyboardVerticalOffset: 0 };
