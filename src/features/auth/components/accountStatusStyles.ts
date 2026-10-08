import { BrandColors } from '../../../theme/colors';
import type { AppTheme } from '../../../theme';
import type { AccountStatusTone } from '../copy/accountStatus';

type ThemeColors = AppTheme['colors'];

/** The accent of each tone, from theme tokens only. */
export const toneColor = (tone: AccountStatusTone, colors: ThemeColors): string => {
  switch (tone) {
    case 'pending':
      return colors.secondary;
    case 'danger':
      return colors.warning;
    case 'info':
    default:
      // accent, not primary: navy is unreadable on dark surfaces.
      return colors.accent;
  }
};

/**
 * Text on a brand-filled button. The theme has no `onPrimary` token yet (T-601 adds the
 * semantic set); the light surface token is white in both modes.
 */
export const ON_PRIMARY = BrandColors.light.surface;

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADIUS = { md: 12, lg: 16, pill: 999 } as const;
