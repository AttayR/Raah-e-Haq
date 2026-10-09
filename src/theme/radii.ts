/** Corner radii (DESIGN_SYSTEM §3.3). */
export const radius = {
  /** Badges inside text, progress bars. */
  xs: 4,
  /** Small chips, thumbnails, skeleton text lines. */
  sm: 8,
  /** Buttons, text fields, list-group corners, toasts. */
  md: 12,
  /** Cards, vehicle option cards, dialogs. */
  lg: 16,
  /** Bottom sheet top corners. */
  xl: 24,
  /** Chips, pills, avatars, FABs, segmented thumb. */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
