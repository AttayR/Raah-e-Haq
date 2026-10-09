/**
 * Spacing scale on a 4-pt grid (DESIGN_SYSTEM §3.1) and layout constants (§3.2).
 * `Spacing` was added by T-113 for the auth screens; `space` is the same object under the
 * spec's name.
 */
export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Spec name for the spacing scale: `space[4]` = 16. */
export const space = Spacing;

export type SpaceToken = keyof typeof Spacing;

/** Layout rules (§3.2). */
export const layout = {
  /** Screen gutter on every device, including iPhone SE. */
  gutter: Spacing[4],
  /** Content max width on tablets (centred). */
  contentMaxWidth: 560,
  /** Between sections. */
  sectionGap: Spacing[6],
  /** Between a section header and its content. */
  sectionHeaderGap: Spacing[2],
  /** Between stacked cards. */
  cardGap: Spacing[3],
  /** Sticky bottom bars sit at `insets.bottom + 8`, at least 16 when there is no inset. */
  bottomActionOffset: Spacing[2],
  bottomActionMinOffset: Spacing[4],
  /** Minimum touch target: 44 on iOS, 48 on Android; 56 high on driving screens. */
  touchTargetIOS: 44,
  touchTargetAndroid: 48,
  touchTargetDriving: 56,
  /** Sheets cap at 88% of the window on small devices (iPhone SE). */
  smallDeviceSheetMaxRatio: 0.88,
  /** No fixed hero taller than 30% of the screen on small devices. */
  smallDeviceHeroMaxRatio: 0.3,
} as const;
