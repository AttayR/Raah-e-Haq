import type { KeyboardAvoidingViewProps } from 'react-native';

/** The iOS "Done" bar above the Pay commission keyboard (InputAccessoryView nativeID). */
export const PAY_COMMISSION_KEYBOARD_DONE_ID = 'payCommissionKeyboardDone';

/**
 * KeyboardAvoidingView props for the Pay commission form (T-509).
 *
 * The KAV takes its bottom edge from `onLayout`, which is relative to its parent `Screen` (a
 * SafeAreaView padding the top inset), not to the window. Without an offset it under-padded by
 * exactly that inset, so with the number pad open the end of the form, the "Report payment"
 * button, stayed behind the keypad even when scrolled to the bottom and taps landed on the
 * keyboard. Same cause and fix as the chat composer (T-512, src/features/chat/keyboard.ts).
 *
 * Android keeps `adjustResize` (AndroidManifest), so the KAV does nothing there.
 */
export const formKeyboardAvoidingProps = (
  os: string,
  topInset: number,
): Pick<KeyboardAvoidingViewProps, 'behavior' | 'enabled' | 'keyboardVerticalOffset'> =>
  os === 'ios'
    ? { behavior: 'padding', enabled: true, keyboardVerticalOffset: Math.max(0, topInset) }
    : { behavior: undefined, enabled: false, keyboardVerticalOffset: 0 };
