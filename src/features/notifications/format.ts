import type { IconName } from '../../components/ui';
import type { SemanticColorName } from '../../theme';
import { formatRelativeDate } from '../../utils/format';
import type { AppNotification, NotificationCategory } from './types';

export interface NotificationTone {
  icon: IconName;
  /** Fill of the 40 icon tile. */
  tile: SemanticColorName;
  /** Glyph colour on that tile (each pair is ≥ 3:1 in both modes, tokens.test). */
  glyph: SemanticColorName;
}

/**
 * UI-R14 (DESIGN_SYSTEM §12.4 notification row): the tile's glyph and tone follow the category,
 * so a ride update, a message, money and an offer read apart at a glance. Unread does not
 * change the tile (no tinted rows); the title weight and the dot carry it.
 */
const CATEGORY_TONE: Record<NotificationCategory, NotificationTone> = {
  ride: { icon: 'rides', tile: 'infoSoft', glyph: 'info' },
  chat: { icon: 'chat', tile: 'primarySoft', glyph: 'onPrimarySoft' },
  wallet: { icon: 'cash', tile: 'successSoft', glyph: 'success' },
  promo: { icon: 'promo', tile: 'warningSoft', glyph: 'warning' },
  system: { icon: 'bell', tile: 'surfaceAlt', glyph: 'textSecondary' },
};

export const notificationTone = (category: NotificationCategory): NotificationTone => CATEGORY_TONE[category];

export const categoryIcon = (category: NotificationCategory): IconName => CATEGORY_TONE[category].icon;

export interface NotificationSection {
  /** The local day (`2026-9-18`, `#n` when a day comes back out of order), or `undated`. */
  key: string;
  /** "Today", "Yesterday", "Mon, 28 Sep"; '' when undated. */
  title: string;
  data: AppNotification[];
}

const localDayKey = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'undated';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * UI-R14: newest-first notifications grouped by the local day they were sent, in the server's
 * order. A later page that continues a day joins its section; a day that comes back later in
 * the order gets a section of its own (keys stay unique).
 */
export const groupNotificationsByDay = (
  items: ReadonlyArray<AppNotification>,
  now: Date = new Date(),
): NotificationSection[] => {
  const sections: NotificationSection[] = [];
  const used = new Map<string, number>();
  items.forEach((item) => {
    const day = localDayKey(item.createdAt);
    const last = sections[sections.length - 1];
    if (last && last.key.split('#')[0] === day) {
      last.data.push(item);
      return;
    }
    const seen = used.get(day) ?? 0;
    used.set(day, seen + 1);
    sections.push({
      key: seen === 0 ? day : `${day}#${seen}`,
      title: day === 'undated' ? '' : formatRelativeDate(item.createdAt, now),
      data: [item],
    });
  });
  return sections;
};
