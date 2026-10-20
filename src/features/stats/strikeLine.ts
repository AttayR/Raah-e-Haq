import type { IconName } from '../../components/ui';
import { t } from '../../i18n';
import type { DriverStrikes } from '../driver-statements/types';

export interface StrikeLine {
  text: string;
  tone: 'textSecondary' | 'danger' | 'warning' | 'success';
  /** Glyph beside the text; none for the static line. */
  icon: IconName | null;
}

/**
 * The Strikes tile's status line (UI-R17 round 2, driver-earnings.md §3.2), from GET
 * /driver/strikes only: under review, "{n} of {threshold} active", "None active", or the static
 * line while the summary is not loaded (or failed). Icon + colour + words, never colour alone.
 */
export const strikeLine = (strikes: DriverStrikes | null): StrikeLine => {
  if (!strikes) return { text: t('earnings.strikesTileBody'), tone: 'textSecondary', icon: null };
  if (strikes.underReview) return { text: t('earnings.strikesReview'), tone: 'danger', icon: 'alertTriangle' };
  if (strikes.activeCount > 0) {
    return {
      text: t('earnings.strikesActive', { n: strikes.activeCount, threshold: strikes.reviewThreshold }),
      tone: 'warning',
      icon: 'warning',
    };
  }
  return { text: t('earnings.strikesNone'), tone: 'success', icon: 'checkMark' };
};
