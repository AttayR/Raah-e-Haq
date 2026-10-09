import { StyleSheet } from 'react-native';

/** Border widths (DESIGN_SYSTEM §3.4). */
export const borderWidth = {
  /** List dividers. */
  hairline: StyleSheet.hairlineWidth,
  /** Card outline (dark mode always; light only for outlined cards), text-field default. */
  thin: 1,
  /** Focused text field, selected card, focus ring. */
  focus: 2,
} as const;

export type BorderWidthToken = keyof typeof borderWidth;
