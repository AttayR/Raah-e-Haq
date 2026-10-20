/**
 * BE-136: unread messages from the other party in the ride's current chat thread, carried by
 * every ride read for the ride's passenger and assigned driver (`chat: {unread_count}`), so the
 * trip sheet's Message badge needs no `/chats` poll (shared-trip-sheet.md TS5, TS11). Pure.
 */
import { t } from '../../i18n';
import { isRecord, readNumberOrNull } from '../../core/api/read';
import type { RideResource } from '../../services/rideService';

/** The ride's unread count (≥ 0, whole), or null when the read carries no `chat` (older server, admin, request feed). */
export const rideChatUnread = (ride: Pick<RideResource, 'chat'> | null | undefined): number | null => {
  const chat: unknown = ride?.chat;
  if (!isRecord(chat)) return null;
  const n = readNumberOrNull(chat.unread_count);
  return n !== null && n >= 0 ? Math.floor(n) : null;
};

/** The Message action's badge count: only above 0 (no key, or 0, draws nothing). */
export const unreadBadgeCount = (unread: number | null): number | undefined => (unread !== null && unread > 0 ? unread : undefined);

/** The Message action's label with its unread count, so a screen reader hears the badge. */
export const withUnreadA11y = (label: string, unread: number | null): string =>
  unread !== null && unread > 0 ? `${label}, ${t('kit.unreadCountA11y', { count: unread })}` : label;
