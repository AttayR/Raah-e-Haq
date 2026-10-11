/**
 * Where a scroll view must scroll so the focused input sits above the keyboard (T-204, AUTH-13).
 * All values are window coordinates (points) except `scrollY`, the current content offset.
 * Returns the new offset, or null when the input (plus `margin`) is already clear of the keyboard.
 */
export interface RevealInput {
  /** Bottom edge of the focused input in the window. */
  fieldBottom: number;
  /** Top edge of the keyboard (including an input accessory bar) in the window. */
  keyboardTop: number;
  /** Current vertical content offset of the scroll view. */
  scrollY: number;
  /** Room to leave between the input and the keyboard (for its error line). */
  margin: number;
}

export function revealOffset({ fieldBottom, keyboardTop, scrollY, margin }: RevealInput): number | null {
  const overlap = fieldBottom + margin - keyboardTop;
  if (!(overlap > 0)) {
    return null;
  }
  return Math.max(0, scrollY + overlap);
}
