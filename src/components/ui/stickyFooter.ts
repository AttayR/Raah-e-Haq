import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
import { layout, space } from '../../theme';

/**
 * [UI-R19] Bottom padding of a sticky footer (DESIGN_SYSTEM §5.14 [UI-R3]):
 * `max(insets.bottom + 8, 16)` normally, and just 8 while the keyboard is up (the keyboard
 * covers the home-indicator inset, so keeping it left a ~42 pt gap above the keyboard).
 */
export const stickyFooterBottom = (insetBottom: number, keyboardUp: boolean): number =>
  keyboardUp ? space[2] : Math.max(insetBottom + layout.bottomActionOffset, layout.bottomActionMinOffset);

/** `stickyFooterBottom` for the current safe area and keyboard (listeners removed on unmount). */
export function useStickyFooterBottom(): number {
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardVisible();
  return stickyFooterBottom(insets.bottom, keyboardUp);
}
