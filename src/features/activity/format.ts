import { formatMoney } from '../../core/format/money';
import { t } from '../../i18n';
import { formatDistanceKm, formatRating } from '../stats/format';
import type { PassengerStats } from '../stats/types';

export type SummaryItem = { key: 'rides' | 'rating' | 'distance' | 'spent'; label: string; value: string };

/**
 * The Activity summary strip (UI-R15) from GET /me/stats: rides, rating, distance and spent, in
 * that order. No rides yet: nothing (no row of zeros). Every value comes from the server.
 */
export const toActivitySummary = (stats: PassengerStats | null): SummaryItem[] => {
  if (!stats || stats.totalRides <= 0) return [];
  return [
    { key: 'rides', label: t('activity.summaryRides'), value: String(stats.totalRides) },
    { key: 'rating', label: t('activity.summaryRating'), value: formatRating(stats.rating) },
    { key: 'distance', label: t('activity.summaryDistance'), value: formatDistanceKm(stats.totalDistanceKm) },
    { key: 'spent', label: t('activity.summarySpent'), value: formatMoney(stats.totalSpent, { currency: stats.currency }) },
  ];
};
