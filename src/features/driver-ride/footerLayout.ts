import { MAX_FONT_SIZE_MULTIPLIER, componentTokens, layout, space, textStyles } from '../../theme';

/**
 * T-559: the driver ride footer on small phones. The primary step keeps the full width; when two
 * or more secondary actions are offered at once (a parcel's "Refuse parcel" next to "Cancel ride"
 * or "Passenger didn't come"), they share one row instead of stacking three 56pt buttons, which
 * pushed the panel's content off a 320-375pt screen. Each button keeps its full label when it
 * fits its half of the row, else its short one ("Refuse", "Cancel", "No-show"); the screen reader
 * always hears the full label.
 */

/** [UI-R13] The trip sheet footer's side padding (the gutter, 16) and the 8 between its actions. */
export const FOOTER_SIDE_PADDING = layout.gutter;
export const FOOTER_GAP = space[2];

/**
 * A generous width per character of the `button` style (16pt semibold): wider than the average
 * Latin glyph, so a label judged to fit never truncates.
 */
const CHAR_WIDTH = textStyles.button.fontSize * 0.6;
const BUTTON_PADDING = componentTokens.button.paddingHorizontal.lg * 2;

export interface FooterRowAction {
  label: string;
  /** Used when `label` does not fit its share of the row. */
  shortLabel?: string;
}

/** The width each of `count` buttons gets in the footer row on a `windowWidth` pt screen. */
export const footerSlotWidth = (windowWidth: number, count: number): number =>
  count <= 0 ? 0 : (windowWidth - FOOTER_SIDE_PADDING * 2 - FOOTER_GAP * (count - 1)) / count;

/**
 * Whether `label` fits on one line in a large button `slotWidth` pt wide, at the user's text size
 * (`fontScale`, capped like AppText at MAX_FONT_SIZE_MULTIPLIER).
 */
export const labelFits = (label: string, slotWidth: number, fontScale = 1): boolean =>
  label.length * CHAR_WIDTH * Math.min(Math.max(fontScale, 1), MAX_FONT_SIZE_MULTIPLIER) + BUTTON_PADDING <= slotWidth;

/** The label each secondary action shows in the row: the full one when it fits, else the short one. */
export const footerRowLabels = (actions: ReadonlyArray<FooterRowAction>, windowWidth: number, fontScale = 1): string[] => {
  const slot = footerSlotWidth(windowWidth, actions.length);
  return actions.map((a) => (labelFits(a.label, slot, fontScale) || !a.shortLabel ? a.label : a.shortLabel));
};
