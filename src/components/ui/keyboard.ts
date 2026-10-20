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
 * Android: the activity window already ends at the keyboard's top (see `keyboardLift`), so the
 * KAV is off there; turning it on would pad twice.
 */
export const keyboardAvoidingProps = (
  os: string,
  offsetAboveParent: number,
): Pick<KeyboardAvoidingViewProps, 'behavior' | 'enabled' | 'keyboardVerticalOffset'> =>
  os === 'ios'
    ? { behavior: 'padding', enabled: true, keyboardVerticalOffset: Math.max(0, offsetAboveParent) }
    : { behavior: undefined, enabled: false, keyboardVerticalOffset: 0 };

/**
 * T-592: how far content drawn in the app's own (activity) window must rise to clear the
 * keyboard. iOS never resizes the window, so it is the keyboard's height. On Android the root
 * view already ends at the keyboard's top: API ≤ 34 resizes the window (`adjustResize`), and on
 * API 35+, where a targetSdk 35+ app is drawn edge to edge and `adjustResize` no longer resizes
 * it, MainActivity pads the content view by the keyboard's inset. So nothing more is lifted there.
 *
 * A height budget must still leave out the lift, and must start from the root's real height
 * (`useSafeAreaFrame`), which on Android shrinks with the keyboard while `useWindowDimensions`
 * does not.
 */
export const keyboardLift = (os: string, keyboardHeight: number): number =>
  os === 'ios' ? Math.max(0, keyboardHeight) : 0;

/**
 * T-592: how far content in a native Modal must rise to clear the keyboard. A Modal is a window
 * of its own, so MainActivity's keyboard padding does not reach it, and whether its window
 * shrinks with the keyboard depends on the Android version (an edge-to-edge dialog on API 35+
 * does not). So on Android the lift is measured, as KeyboardAvoidingView does: the part of the
 * Modal's root (its top at the window top: the sheet's Modal is `statusBarTranslucent`) below the
 * keyboard's top. A window that did shrink ends at the keyboard's top and gets none, so nothing is
 * counted twice. iOS: the keyboard's height, as before.
 *
 * `keyboard.top` is the keyboard event's `endCoordinates.screenY`; under a point of overlap is
 * rounding, not keyboard.
 */
export const modalKeyboardLift = (
  os: string,
  keyboard: { height: number; top: number },
  rootHeight: number,
): number => {
  if (keyboard.height <= 0) return 0;
  if (os === 'ios') return keyboard.height;
  if (rootHeight <= 0 || keyboard.top <= 0) return 0;
  const overlap = Math.round(rootHeight - keyboard.top);
  return overlap >= 1 ? overlap : 0;
};
