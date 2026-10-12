/** Corner radii (DESIGN_SYSTEM §3.3). */
export const radius = {
  /** Badges inside text, progress bars. */
  xs: 4,
  /** Small chips, thumbnails, skeleton text lines. */
  sm: 8,
  /** Text fields, list-group corners, toasts, icon tiles. */
  md: 12,
  /** Cards, vehicle option cards, dialogs. */
  lg: 16,
  /** Bottom sheet top corners. */
  xl: 24,
  /** [v1.1] All buttons, chips, pills, avatars, FABs, tab-bar active pill. */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
