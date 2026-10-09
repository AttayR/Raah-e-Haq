import { lightColors, radius, space, type ThemeColors } from '../../../theme';
import type { AccountStatusTone } from '../copy/accountStatus';

/** The accent of each tone, from semantic theme tokens only (DESIGN_SYSTEM §1.4). */
export const toneColor = (tone: AccountStatusTone, colors: ThemeColors): string => {
  switch (tone) {
    case 'pending':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'info':
    default:
      // primaryText, not primary: the navy fill is unreadable as text on dark surfaces.
      return colors.primaryText;
  }
};

/** Text on a brand-filled button: `onPrimary` is white in both modes. */
export const ON_PRIMARY = lightColors.onPrimary;

export const SPACING = { xs: space[1], sm: space[2], md: space[3], lg: space[4], xl: space[6], xxl: space[8] } as const;
export const RADIUS = { md: radius.md, lg: radius.lg, pill: radius.pill } as const;
