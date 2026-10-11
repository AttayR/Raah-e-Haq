import type { IconName } from '../../components/ui';
import { NOTIFICATIONS_COPY } from './copy';
import type { NotificationCategory } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Short relative time for a row: "Just now", "5m", "3h", "2d", then the date ("12 Oct").
 * An unreadable time gives an empty string (the row shows no time rather than "NaN").
 */
export const formatNotificationTime = (iso: string, now: number = Date.now()): string => {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';
  const diff = Math.max(0, now - at);
  if (diff < MINUTE) return NOTIFICATIONS_COPY.justNow;
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const CATEGORY_ICON: Record<NotificationCategory, IconName> = {
  ride: 'rides',
  promo: 'promo',
  wallet: 'wallet',
  chat: 'chat',
  system: 'bell',
};

export const categoryIcon = (category: NotificationCategory): IconName => CATEGORY_ICON[category];
